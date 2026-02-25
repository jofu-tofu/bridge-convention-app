import { tick } from "svelte";
import type { EnginePort } from "../engine/port";
import type {
  Deal,
  Call,
  Auction,
  Contract,
  Card,
  PlayedCard,
  Trick,
  Hand,
  DDSolution,
} from "../engine/types";
import { BidSuit, Suit, Seat } from "../engine/types";
import type { DrillSession } from "../ai/types";
import type {
  BiddingStrategy,
  BidResult,
  ConditionDetail,
  PlayStrategy,
  PlayContext,
  TreeEvalSummary,
} from "../shared/types";
import type { InferredHoldings } from "../shared/types";
import type { InferenceEngine } from "../ai/inference/inference-engine";
import type { InferenceSnapshot } from "../ai/inference/types";
import { nextSeat, partnerSeat } from "../engine/constants";
import { evaluateHand } from "../engine/hand-evaluator";
import { randomPlayStrategy } from "../ai/play-strategy";
import { createBiddingContext } from "../conventions/context-factory";

export type GamePhase =
  | "BIDDING"
  | "DECLARER_PROMPT"
  | "PLAYING"
  | "EXPLANATION";

export interface BidHistoryEntry {
  readonly seat: Seat;
  readonly call: Call;
  readonly ruleName: string | null;
  readonly explanation: string;
  readonly isUser: boolean;
  readonly conditions?: readonly ConditionDetail[];
  /** Whether the user's bid matched the expected convention bid (user bids only). */
  readonly isCorrect?: boolean;
  /** The expected correct bid when the user bid incorrectly (user bids only). */
  readonly expectedResult?: BidResult;
  /** Tree traversal summary — available for convention bids using rule trees. */
  readonly treePath?: TreeEvalSummary;
}

export interface PlayLogEntry {
  readonly seat: Seat;
  readonly card: Card;
  readonly reason: string;
  readonly trickIndex: number;
}

export interface BidFeedback {
  readonly isCorrect: boolean;
  readonly userCall: Call;
  readonly expectedResult: BidResult | null;
}

/** Map BidSuit to Suit for trump. NoTrump returns undefined. */
function bidSuitToSuit(strain: BidSuit): Suit | undefined {
  const map: Partial<Record<BidSuit, Suit>> = {
    [BidSuit.Clubs]: Suit.Clubs,
    [BidSuit.Diamonds]: Suit.Diamonds,
    [BidSuit.Hearts]: Suit.Hearts,
    [BidSuit.Spades]: Suit.Spades,
  };
  return map[strain];
}

/** Determine who controls a seat: 'user' or 'ai'. */
export function seatController(
  seat: Seat,
  declarer: Seat,
  userSeat: Seat,
): "user" | "ai" {
  if (seat === userSeat) return "user";
  if (seat === partnerSeat(declarer) && declarer === userSeat) return "user";
  return "ai";
}

const AI_BID_DELAY = 300;
const AI_PLAY_DELAY = 500;
const TRICK_PAUSE = 1000;

/** Compare two calls for equality. */
function callsMatch(a: Call, b: Call): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "bid" && b.type === "bid") {
    return a.level === b.level && a.strain === b.strain;
  }
  return true; // pass === pass, double === double, etc.
}

export function createGameStore(engine: EnginePort) {
  // Bidding state
  let deal = $state<Deal | null>(null);
  let auction = $state<Auction>({ entries: [], isComplete: false });
  let phase = $state<GamePhase>("BIDDING");
  let currentTurn = $state<Seat | null>(null);
  let bidHistory = $state<BidHistoryEntry[]>([]);
  let contract = $state<Contract | null>(null);
  let isProcessing = $state(false);
  let isShowingTrickResult = $state(false);
  let legalCalls = $state<Call[]>([]);
  let drillSession = $state<DrillSession | null>(null);

  // Bid feedback state
  let bidFeedback = $state<BidFeedback | null>(null);
  let conventionStrategy = $state<BiddingStrategy | null>(null);

  // Retry state — saved before a wrong bid so we can roll back
  let preBidAuction = $state<Auction | null>(null);
  let preBidTurn = $state<Seat | null>(null);
  let preBidHistory = $state<BidHistoryEntry[] | null>(null);

  // Play state
  let tricks = $state<Trick[]>([]);
  let currentTrick = $state<PlayedCard[]>([]);
  let currentPlayer = $state<Seat | null>(null);
  let declarerTricksWon = $state(0);
  let defenderTricksWon = $state(0);
  let dummySeat = $state<Seat | null>(null);
  let score = $state<number | null>(null);
  let playAborted = $state(false);
  let trumpSuit = $state<Suit | undefined>(undefined);
  let effectiveUserSeat = $state<Seat | null>(null);

  // Inference + play strategy state
  let nsInferenceEngine = $state<InferenceEngine | null>(null);
  let playInferences = $state<Record<Seat, InferredHoldings> | null>(null);
  let activePlayStrategy = $state<PlayStrategy | null>(null);

  // Always-on: playLog is not DEV-gated. Resets per drill, max ~52 entries.
  // Used by DebugDrawer now and future play review features.
  let playLog = $state<PlayLogEntry[]>([]);

  // DDS analysis state
  let ddsSolution = $state<DDSolution | null>(null);
  let ddsSolving = $state(false);
  let ddsError = $state<string | null>(null);

  const DDS_TIMEOUT_MS = 10_000;

  async function triggerDDSSolve() {
    if (!deal || !contract || ddsSolving) return;
    const solvingDeal = deal;
    ddsSolving = true;
    ddsError = null;
    ddsSolution = null;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("DDS analysis timed out")), DDS_TIMEOUT_MS);
      });
      const result = await Promise.race([
        engine.solveDeal(solvingDeal),
        timeoutPromise,
      ]);
      // Guard against stale results
      if (deal === solvingDeal) {
        ddsSolution = result;
      }
    } catch (err: unknown) {
      if (deal === solvingDeal) {
        ddsError = err instanceof Error ? err.message : String(err);
      }
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      if (deal === solvingDeal) {
        ddsSolving = false;
      }
    }
  }

  /** Transition to EXPLANATION phase and trigger DDS solve. */
  function transitionToExplanation() {
    phase = "EXPLANATION";
    currentPlayer = null; // Stop any in-flight AI play loop
    triggerDDSSolve();
  }

  const isUserTurn = $derived(
    currentTurn !== null &&
      drillSession !== null &&
      drillSession.isUserSeat(currentTurn) &&
      !isProcessing,
  );

  const userSeat = $derived<Seat | null>(
    drillSession ? drillSession.config.userSeat : null,
  );

  /** Check if a seat is user-controlled during play. */
  function isUserControlled(seat: Seat): boolean {
    if (!contract) return false;
    const activeSeat = effectiveUserSeat ?? userSeat;
    if (!activeSeat) return false;
    return seatController(seat, contract.declarer, activeSeat) === "user";
  }

  /** Get remaining cards for a seat (original hand minus played cards). */
  function getRemainingCards(seat: Seat): Card[] {
    if (!deal) return [];
    const played = new Set<string>();
    for (const trick of tricks) {
      for (const p of trick.plays) {
        if (p.seat === seat) played.add(`${p.card.suit}${p.card.rank}`);
      }
    }
    for (const p of currentTrick) {
      if (p.seat === seat) played.add(`${p.card.suit}${p.card.rank}`);
    }
    return deal.hands[seat].cards.filter(
      (c) => !played.has(`${c.suit}${c.rank}`),
    );
  }

  /** Get lead suit of current trick (undefined if no cards played yet). */
  function getLeadSuit(): Suit | undefined {
    return currentTrick.length > 0 ? currentTrick[0]!.card.suit : undefined;
  }

  /** Build a PlayContext for AI card selection. */
  function buildPlayContext(
    seat: Seat,
    hand: Hand,
    legalCards: readonly Card[],
  ): PlayContext {
    const dummyVisible = tricks.length > 0 || currentTrick.length > 0;
    return {
      hand,
      currentTrick: [...currentTrick],
      previousTricks: [...tricks],
      contract: contract!,
      seat,
      trumpSuit,
      legalPlays: legalCards,
      dummyHand: dummyVisible && dummySeat && deal ? deal.hands[dummySeat] : undefined,
      inferences: playInferences ?? undefined,
    };
  }

  /** Select a card using the active play strategy or fall back to random. */
  function selectAiCard(seat: Seat, legalCards: readonly Card[]): Card {
    const remaining = getRemainingCards(seat);
    const ctx = buildPlayContext(seat, { cards: remaining }, legalCards);
    const result = (activePlayStrategy && contract)
      ? activePlayStrategy.suggest(ctx)
      : randomPlayStrategy.suggest(ctx);
    playLog = [...playLog, { seat, card: result.card, reason: result.reason, trickIndex: tricks.length }];
    return result.card;
  }

  async function completeAuction() {
    // Capture inferences from both engines before transitioning
    if (nsInferenceEngine) {
      playInferences = nsInferenceEngine.getInferences();
    }

    const result = await engine.getContract(auction);
    contract = result;
    if (result) {
      // All declarer/dummy/defender scenarios go through DECLARER_PROMPT
      effectiveUserSeat = userSeat;
      phase = "DECLARER_PROMPT";
    } else {
      // Passed out — skip to explanation
      transitionToExplanation();
    }
    await tick();
  }

  function acceptDeclarerSwap() {
    if (!contract) return;
    effectiveUserSeat = contract.declarer;
    startPlay();
  }

  function declineDeclarerSwap() {
    // Skip play phase, go straight to review
    transitionToExplanation();
  }

  function acceptDefend() {
    if (!contract || phase !== "DECLARER_PROMPT") return;
    // User stays as South (defender) — no seat swap needed
    startPlay();
  }

  function declineDefend() {
    // Skip play phase, go straight to review
    transitionToExplanation();
  }

  function acceptSouthPlay() {
    if (!contract || phase !== "DECLARER_PROMPT") return;
    // South is already declarer — no seat swap needed
    startPlay();
  }

  function declineSouthPlay() {
    transitionToExplanation();
  }

  function startPlay() {
    if (!contract || !deal) return;
    playAborted = false;
    phase = "PLAYING";
    tricks = [];
    currentTrick = [];
    declarerTricksWon = 0;
    defenderTricksWon = 0;
    dummySeat = partnerSeat(contract.declarer);
    trumpSuit = bidSuitToSuit(contract.strain);
    score = null;

    // Opening leader: left of declarer
    currentPlayer = nextSeat(contract.declarer);

    // If opening leader is AI, start AI plays
    if (!isUserControlled(currentPlayer)) {
      runAiPlays();
    }
  }

  async function userPlayCardImpl(card: Card, seat: Seat) {
    if (isProcessing || !currentPlayer || !deal) return;
    if (seat !== currentPlayer) return;
    if (!isUserControlled(seat)) return;

    const remaining = getRemainingCards(seat);
    const legalPlays = await engine.getLegalPlays(
      { cards: remaining },
      getLeadSuit(),
    );
    const isLegal = legalPlays.some(
      (c) => c.suit === card.suit && c.rank === card.rank,
    );
    if (!isLegal) return;

    addCardToTrick(card, seat);
    await tick();

    if (currentTrick.length === 4) {
      await completeTrick();
    } else {
      currentPlayer = nextSeat(currentPlayer);
      await tick();
      if (!isUserControlled(currentPlayer)) {
        await runAiPlays();
      }
    }
  }

  function addCardToTrick(card: Card, seat: Seat) {
    currentTrick = [...currentTrick, { card, seat }];
  }

  async function completeTrick() {
    const trick: Trick = {
      plays: [...currentTrick],
      trumpSuit,
    };
    const winner = await engine.getTrickWinner(trick);
    const completedTrick: Trick = { ...trick, winner };

    // Update trick counts
    if (!contract) return;
    const declarerSide = new Set([
      contract.declarer,
      partnerSeat(contract.declarer),
    ]);
    if (declarerSide.has(winner)) {
      declarerTricksWon++;
    } else {
      defenderTricksWon++;
    }

    tricks = [...tricks, completedTrick];

    // Brief pause to show completed trick (separate from isProcessing to avoid race)
    isShowingTrickResult = true;
    await tick();
    await delay(TRICK_PAUSE);
    isShowingTrickResult = false;

    if (playAborted) return;

    // Clear current trick
    currentTrick = [];

    if (tricks.length === 13) {
      await completePlay();
      return;
    }

    // Winner leads next trick
    currentPlayer = winner;
    await tick();

    // If next leader is AI, continue
    if (!isUserControlled(winner)) {
      await runAiPlays();
    }
  }

  async function runAiPlays() {
    if (playAborted) return;
    isProcessing = true;
    try {
      while (currentPlayer && !isUserControlled(currentPlayer)) {
        if (playAborted) return;

        await delay(AI_PLAY_DELAY);
        if (playAborted) return;

        const remaining = getRemainingCards(currentPlayer);
        const legalPlays = await engine.getLegalPlays(
          { cards: remaining },
          getLeadSuit(),
        );
        const card = selectAiCard(currentPlayer, legalPlays);
        addCardToTrick(card, currentPlayer);

        if (currentTrick.length === 4) {
          await completeTrick();
          if (playAborted) return;
          // After completeTrick, currentPlayer is set to winner
          // Loop continues checking if winner is AI
          continue;
        }

        currentPlayer = nextSeat(currentPlayer);
      }
    } finally {
      isProcessing = false;
      // Flush Svelte DOM updates — async $state mutations need an
      // explicit tick to propagate after await chains.
      await tick();
    }
  }

  async function completePlay() {
    if (!contract || !deal) return;
    const result = await engine.calculateScore(
      contract,
      declarerTricksWon,
      deal.vulnerability,
    );
    score = result;
    currentPlayer = null;
    transitionToExplanation();
  }

  async function skipToReviewImpl() {
    playAborted = true;
    if (!contract || !deal) return;

    // Finish all remaining tricks without delays
    while (tricks.length < 13) {
      // Fill current trick to 4 cards
      while (currentTrick.length < 4) {
        const seat =
          currentTrick.length === 0
            ? currentPlayer!
            : nextSeat(currentTrick[currentTrick.length - 1]!.seat);
        const remaining = getRemainingCards(seat);
        const leadSuit = getLeadSuit();
        const legalPlays = await engine.getLegalPlays(
          { cards: remaining },
          leadSuit,
        );
        // Use first legal play and log as "skip" — not AI-attributed
        const card = legalPlays[0]!;
        playLog = [...playLog, { seat, card, reason: "skip", trickIndex: tricks.length }];
        currentTrick = [...currentTrick, { card, seat }];
      }

      // Complete the trick
      const trick: Trick = {
        plays: [...currentTrick],
        trumpSuit,
      };
      const winner = await engine.getTrickWinner(trick);
      const completedTrick: Trick = { ...trick, winner };

      const declarerSide = new Set([
        contract.declarer,
        partnerSeat(contract.declarer),
      ]);
      if (declarerSide.has(winner)) {
        declarerTricksWon++;
      } else {
        defenderTricksWon++;
      }

      tricks = [...tricks, completedTrick];
      currentTrick = [];
      currentPlayer = winner;
    }

    await completePlay();
  }

  async function runAiBids() {
    if (!drillSession || !deal) return;
    isProcessing = true;
    try {
      while (currentTurn && !drillSession.isUserSeat(currentTurn)) {
        await delay(AI_BID_DELAY);

        const hand = deal.hands[currentTurn];
        const result = drillSession.getNextBid(currentTurn, hand, auction);

        // Safety: null from AI means no bid possible
        if (!result) break;

        const bidEntry = { seat: currentTurn, call: result.call };
        const auctionBefore = auction;
        auction = await engine.addCall(auction, bidEntry);

        // Process bid through inference engine
        if (nsInferenceEngine) nsInferenceEngine.processBid(bidEntry, auctionBefore);

        bidHistory = [
          ...bidHistory,
          {
            seat: currentTurn,
            call: result.call,
            ruleName: result.ruleName,
            explanation: result.explanation,
            isUser: false,
            conditions: result.conditions,
            treePath: result.treePath,
          },
        ];

        currentTurn = nextSeat(currentTurn);

        const complete = await engine.isAuctionComplete(auction);
        if (complete) {
          await completeAuction();
          return;
        }
      }

      // Update legal calls for user's turn
      if (currentTurn) {
        legalCalls = await engine.getLegalCalls(auction, currentTurn);
      }
    } finally {
      isProcessing = false;
      // Flush Svelte DOM updates — async $state mutations (isProcessing,
      // legalCalls) need an explicit tick to propagate after await chains.
      await tick();
    }
  }

  async function userBidImpl(call: Call) {
    if (isProcessing) return;
    if (!currentTurn || !drillSession?.isUserSeat(currentTurn)) return;
    if (!deal) return;

    // Check correctness against convention strategy before proceeding
    let expectedResult: BidResult | null = null;
    if (conventionStrategy) {
      const hand = deal.hands[currentTurn];
      const evaluation = evaluateHand(hand);
      expectedResult = conventionStrategy.suggest(
        createBiddingContext({ hand, auction, seat: currentTurn, evaluation }),
      );
    }

    const isCorrect = callsMatch(
      call,
      expectedResult?.call ?? { type: "pass" },
    );

    // Store feedback
    bidFeedback = {
      isCorrect,
      userCall: call,
      expectedResult: expectedResult ?? {
        call: { type: "pass" },
        ruleName: null,
        explanation: "No convention bid applies — pass",
      },
    };

    // Save pre-bid state for potential retry (wrong bids only)
    const auctionBeforeUser = auction;
    if (!isCorrect) {
      preBidAuction = auction;
      preBidTurn = currentTurn;
      preBidHistory = [...bidHistory];
    } else {
      preBidAuction = null;
      preBidTurn = null;
      preBidHistory = null;
    }

    // Add bid to auction regardless of correctness
    const userBidEntry = { seat: currentTurn, call };
    auction = await engine.addCall(auction, userBidEntry);

    // Process user bid through inference engine
    if (nsInferenceEngine) nsInferenceEngine.processBid(userBidEntry, auctionBeforeUser);

    bidHistory = [
      ...bidHistory,
      {
        seat: currentTurn,
        call,
        ruleName: null,
        explanation: "User bid",
        isUser: true,
        isCorrect,
        expectedResult: !isCorrect ? (expectedResult ?? undefined) : undefined,
        treePath: expectedResult?.treePath,
      },
    ];

    currentTurn = nextSeat(currentTurn);

    // If correct, auto-dismiss feedback after brief display and continue
    if (isCorrect) {
      const complete = await engine.isAuctionComplete(auction);
      if (complete) {
        await completeAuction();
        bidFeedback = null;
        await tick();
        return;
      }
      await runAiBids();
      // Clear correct feedback after AI bids complete (user has seen it)
      bidFeedback = null;
      await tick();
      return;
    }

    // If wrong, pause — user must dismiss feedback before auction continues
    // runAiBids() will be called by dismissBidFeedback()
    // Flush DOM — state mutations after await (bidFeedback, bidHistory,
    // currentTurn) need explicit tick to propagate.
    await tick();
  }

  /** Dismiss bid feedback and continue auction (called after wrong bid acknowledged). */
  async function dismissBidFeedbackImpl() {
    bidFeedback = null;

    const complete = await engine.isAuctionComplete(auction);
    if (complete) {
      await completeAuction();
      return;
    }

    await runAiBids();
    await tick();
  }

  /** Undo the wrong bid and let user try again on the same deal. */
  async function retryBidImpl() {
    if (isProcessing) return;
    if (!preBidAuction || !preBidTurn || !preBidHistory) return;
    auction = preBidAuction;
    currentTurn = preBidTurn;
    bidHistory = preBidHistory;
    bidFeedback = null;
    preBidAuction = null;
    preBidTurn = null;
    preBidHistory = null;

    // Refresh legal calls for the restored turn
    if (currentTurn) {
      legalCalls = await engine.getLegalCalls(auction, currentTurn);
    }

    // Inference state for the undone bid is not rolled back — acceptable
    // since inference is approximate and the user is retrying immediately
    await tick();
  }

  /** Skip directly to explanation from bid feedback — completes auction first for DDS. */
  async function skipFromFeedbackImpl() {
    if (phase !== "BIDDING") return;
    bidFeedback = null;

    // Complete the auction with AI bids so contract is available for DDS
    const complete = await engine.isAuctionComplete(auction);
    if (!complete) {
      await runAiBids();
    }
    // Extract contract (may be null for passout)
    contract = await engine.getContract(auction);

    transitionToExplanation();
    await tick();
  }

  function resetImpl() {
    playAborted = true;
    deal = null;
    auction = { entries: [], isComplete: false };
    phase = "BIDDING";
    currentTurn = null;
    bidHistory = [];
    contract = null;
    isProcessing = false;
    legalCalls = [];
    drillSession = null;
    bidFeedback = null;
    conventionStrategy = null;
    preBidAuction = null;
    preBidTurn = null;
    preBidHistory = null;
    // Reset play state
    tricks = [];
    currentTrick = [];
    currentPlayer = null;
    declarerTricksWon = 0;
    defenderTricksWon = 0;
    dummySeat = null;
    score = null;
    trumpSuit = undefined;
    effectiveUserSeat = null;
    isShowingTrickResult = false;
    // Reset inference + strategy state
    nsInferenceEngine = null;
    playInferences = null;
    activePlayStrategy = null;
    playLog = [];
    // Reset DDS state
    ddsSolution = null;
    ddsSolving = false;
    ddsError = null;
  }

  return {
    get deal() {
      return deal;
    },
    get auction() {
      return auction;
    },
    get phase() {
      return phase;
    },
    get currentTurn() {
      return currentTurn;
    },
    get bidHistory() {
      return bidHistory;
    },
    get contract() {
      return contract;
    },
    get isProcessing() {
      return isProcessing;
    },
    get isUserTurn() {
      return isUserTurn;
    },
    get legalCalls() {
      return legalCalls;
    },
    get bidFeedback() {
      return bidFeedback;
    },
    // Play state
    get tricks() {
      return tricks;
    },
    get currentTrick() {
      return currentTrick;
    },
    get currentPlayer() {
      return currentPlayer;
    },
    get declarerTricksWon() {
      return declarerTricksWon;
    },
    get defenderTricksWon() {
      return defenderTricksWon;
    },
    get dummySeat() {
      return dummySeat;
    },
    get score() {
      return score;
    },
    get trumpSuit() {
      return trumpSuit;
    },
    get effectiveUserSeat() {
      return effectiveUserSeat;
    },
    // DDS analysis state
    get ddsSolution() {
      return ddsSolution;
    },
    get ddsSolving() {
      return ddsSolving;
    },
    get ddsError() {
      return ddsError;
    },
    /** True when DECLARER_PROMPT is showing because E/W declares (user defends). */
    get isDefenderPrompt() {
      if (!contract || !userSeat) return false;
      return (
        contract.declarer !== userSeat &&
        partnerSeat(contract.declarer) !== userSeat
      );
    },
    /** True when DECLARER_PROMPT is showing because South (user) is declarer. */
    get isSouthDeclarerPrompt() {
      if (!contract || !userSeat) return false;
      return contract.declarer === userSeat;
    },

    // --- Debug observability getters ---
    get playLog() {
      return playLog;
    },
    get playInferences() {
      return playInferences;
    },
    get inferenceTimeline(): readonly InferenceSnapshot[] {
      return nsInferenceEngine?.getTimeline() ?? [];
    },

    /** Get legal plays for a seat based on current trick context. */
    async getLegalPlaysForSeat(seat: Seat): Promise<Card[]> {
      if (!deal || currentPlayer !== seat) return [];
      const remaining = getRemainingCards(seat);
      return engine.getLegalPlays({ cards: remaining }, getLeadSuit());
    },

    /** Get remaining cards for a seat (hand minus played cards). */
    getRemainingCards,

    userPlayCard(card: Card, seat: Seat): void {
      userPlayCardImpl(card, seat).catch((err) => console.error("[game] userPlayCard:", err));
    },
    skipToReview(): void {
      skipToReviewImpl().catch((err) => console.error("[game] skipToReview:", err));
    },
    acceptDeclarerSwap,
    declineDeclarerSwap,
    acceptDefend,
    declineDefend,
    acceptSouthPlay,
    declineSouthPlay,

    /** Return to DECLARER_PROMPT from EXPLANATION so the user can play the hand. */
    playThisHand() {
      if (!contract || phase !== "EXPLANATION") return;
      // Signal any in-flight AI play loop to stop
      playAborted = true;
      tricks = [];
      currentTrick = [];
      currentPlayer = null;
      declarerTricksWon = 0;
      defenderTricksWon = 0;
      dummySeat = null;
      score = null;
      trumpSuit = undefined;
      effectiveUserSeat = userSeat;
      isShowingTrickResult = false;
      playLog = [];
      // Reset DDS state so it doesn't leak into the new play session
      ddsSolution = null;
      ddsSolving = false;
      ddsError = null;
      phase = "DECLARER_PROMPT";
    },

    async startDrill(
      newDeal: Deal,
      session: DrillSession,
      initialAuction?: Auction,
      strategy?: BiddingStrategy,
    ) {
      // Eagerly load inference engine BEFORE any $state mutations —
      // dynamic await import() breaks the Svelte 5 scheduler, causing
      // subsequent $state mutations to not trigger DOM updates.
      let inferenceFactory: typeof import("../ai/inference/inference-engine") | null = null;
      if (session.config.nsInferenceConfig) {
        inferenceFactory = await import("../ai/inference/inference-engine");
      }

      deal = newDeal;
      drillSession = session;
      conventionStrategy = strategy ?? null;
      bidFeedback = null;
      preBidAuction = null;
      preBidTurn = null;
      preBidHistory = null;
      contract = null;
      phase = "BIDDING";
      playAborted = true; // Cancel any in-flight play from previous drill

      // Reset play state
      tricks = [];
      currentTrick = [];
      currentPlayer = null;
      declarerTricksWon = 0;
      defenderTricksWon = 0;
      dummySeat = null;
      score = null;
      trumpSuit = undefined;
      effectiveUserSeat = null;
      isShowingTrickResult = false;

      // Reset DDS state
      ddsSolution = null;
      ddsSolving = false;
      ddsError = null;

      // Set up play strategy from drill config
      activePlayStrategy = session.config.playStrategy ?? null;

      // Set up inference engine if configured
      playInferences = null;
      playLog = [];
      if (inferenceFactory && session.config.nsInferenceConfig) {
        nsInferenceEngine = inferenceFactory.createInferenceEngine(
          session.config.nsInferenceConfig,
          Seat.North,
        );
      } else {
        nsInferenceEngine = null;
      }


      if (initialAuction) {
        auction = initialAuction;
        // Replay initial auction entries into bid history with generic explanations
        bidHistory = initialAuction.entries.map((entry) => ({
          seat: entry.seat,
          call: entry.call,
          ruleName: null,
          explanation:
            entry.call.type === "bid"
              ? `Opening ${entry.call.level}${entry.call.strain} bid`
              : "Pass",
          isUser: false,
        }));
        // Current turn is the next seat after the last entry
        const lastEntry =
          initialAuction.entries[initialAuction.entries.length - 1];
        currentTurn = lastEntry ? nextSeat(lastEntry.seat) : newDeal.dealer;
      } else {
        auction = { entries: [], isComplete: false };
        bidHistory = [];
        currentTurn = newDeal.dealer;
      }

      // Flush initial state to DOM before AI bids start — ensures
      // deal/phase/hand display updates before the async bid loop.
      await tick();
      await runAiBids();
    },

    /** User action: submit a bid. Returns void — safe for event handlers. */
    userBid(call: Call): void {
      userBidImpl(call).catch((err) => console.error("[game] userBid:", err));
    },

    /** Dismiss bid feedback and continue auction (called after wrong bid acknowledged). */
    dismissBidFeedback(): void {
      dismissBidFeedbackImpl().catch((err) => console.error("[game] dismissBidFeedback:", err));
    },

    /** Undo the wrong bid and let user try again on the same deal. */
    retryBid(): void {
      retryBidImpl().catch((err) => console.error("[game] retryBid:", err));
    },

    /** Skip directly to explanation from bid feedback — completes auction first for DDS. */
    skipFromFeedback(): void {
      skipFromFeedbackImpl().catch((err) => console.error("[game] skipFromFeedback:", err));
    },

    /** Reset all game state. Returns void — safe for event handlers. */
    reset(): void {
      resetImpl();
    },
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
