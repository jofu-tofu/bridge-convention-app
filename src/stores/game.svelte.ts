import type { EnginePort } from "../engine/port";
import type { Deal, Call, Auction, Seat, Contract, Card, PlayedCard, Trick } from "../engine/types";
import { BidSuit, Suit } from "../engine/types";
import type { DrillSession } from "../ai/types";
import type { BiddingStrategy, BidResult, ConditionDetail } from "../shared/types";
import { nextSeat, partnerSeat } from "../engine/constants";
import { evaluateHand } from "../engine/hand-evaluator";
import { randomPlay } from "../ai/play-strategy";

export type GamePhase = "BIDDING" | "DECLARER_PROMPT" | "PLAYING" | "EXPLANATION";

export interface BidHistoryEntry {
  readonly seat: Seat;
  readonly call: Call;
  readonly ruleName: string | null;
  readonly explanation: string;
  readonly isUser: boolean;
  readonly conditions?: readonly ConditionDetail[];
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
  let legalCalls = $state<Call[]>([]);
  let drillSession = $state<DrillSession | null>(null);

  // Bid feedback state
  let bidFeedback = $state<BidFeedback | null>(null);
  let conventionStrategy = $state<BiddingStrategy | null>(null);

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

  async function completeAuction() {
    const result = await engine.getContract(auction);
    contract = result;
    if (result) {
      // Check if user is dummy (partner of declarer === user's seat)
      if (userSeat && partnerSeat(result.declarer) === userSeat) {
        effectiveUserSeat = userSeat; // default to South, may be swapped
        phase = "DECLARER_PROMPT";
      } else {
        effectiveUserSeat = userSeat;
        startPlay();
      }
    } else {
      // Passed out — skip to explanation
      phase = "EXPLANATION";
    }
  }

  function acceptDeclarerSwap() {
    if (!contract) return;
    effectiveUserSeat = contract.declarer;
    startPlay();
  }

  function declineDeclarerSwap() {
    // effectiveUserSeat already set to userSeat (South) in completeAuction
    startPlay();
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

  async function userPlayCard(card: Card, seat: Seat) {
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

    if (currentTrick.length === 4) {
      await completeTrick();
    } else {
      currentPlayer = nextSeat(currentPlayer);
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
    const declarerSide = new Set([contract.declarer, partnerSeat(contract.declarer)]);
    if (declarerSide.has(winner)) {
      declarerTricksWon++;
    } else {
      defenderTricksWon++;
    }

    tricks = [...tricks, completedTrick];

    // Brief pause to show completed trick
    isProcessing = true;
    await delay(TRICK_PAUSE);
    isProcessing = false;

    if (playAborted) return;

    // Clear current trick
    currentTrick = [];

    if (tricks.length === 13) {
      await completePlay();
      return;
    }

    // Winner leads next trick
    currentPlayer = winner;

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
        const card = randomPlay(legalPlays);
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
    phase = "EXPLANATION";
  }

  async function skipToReview() {
    playAborted = true;
    if (!contract || !deal) return;

    // Finish all remaining tricks without delays
    while (tricks.length < 13) {
      // Fill current trick to 4 cards
      while (currentTrick.length < 4) {
        const seat = currentTrick.length === 0
          ? currentPlayer!
          : nextSeat(currentTrick[currentTrick.length - 1]!.seat);
        const remaining = getRemainingCards(seat);
        const leadSuit = getLeadSuit();
        const legalPlays = await engine.getLegalPlays(
          { cards: remaining },
          leadSuit,
        );
        const card = randomPlay(legalPlays);
        currentTrick = [...currentTrick, { card, seat }];
      }

      // Complete the trick
      const trick: Trick = {
        plays: [...currentTrick],
        trumpSuit,
      };
      const winner = await engine.getTrickWinner(trick);
      const completedTrick: Trick = { ...trick, winner };

      const declarerSide = new Set([contract.declarer, partnerSeat(contract.declarer)]);
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

        auction = await engine.addCall(auction, { seat: currentTurn, call: result.call });
        bidHistory = [...bidHistory, {
          seat: currentTurn,
          call: result.call,
          ruleName: result.ruleName,
          explanation: result.explanation,
          isUser: false,
          conditions: result.conditions,
        }];

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
    }
  }

  return {
    get deal() { return deal; },
    get auction() { return auction; },
    get phase() { return phase; },
    get currentTurn() { return currentTurn; },
    get bidHistory() { return bidHistory; },
    get contract() { return contract; },
    get isProcessing() { return isProcessing; },
    get isUserTurn() { return isUserTurn; },
    get legalCalls() { return legalCalls; },
    get bidFeedback() { return bidFeedback; },
    // Play state
    get tricks() { return tricks; },
    get currentTrick() { return currentTrick; },
    get currentPlayer() { return currentPlayer; },
    get declarerTricksWon() { return declarerTricksWon; },
    get defenderTricksWon() { return defenderTricksWon; },
    get dummySeat() { return dummySeat; },
    get score() { return score; },
    get trumpSuit() { return trumpSuit; },
    get effectiveUserSeat() { return effectiveUserSeat; },

    /** Get legal plays for a seat based on current trick context. */
    async getLegalPlaysForSeat(seat: Seat): Promise<Card[]> {
      if (!deal || currentPlayer !== seat) return [];
      const remaining = getRemainingCards(seat);
      return engine.getLegalPlays({ cards: remaining }, getLeadSuit());
    },

    /** Get remaining cards for a seat (hand minus played cards). */
    getRemainingCards,

    userPlayCard,
    skipToReview,
    acceptDeclarerSwap,
    declineDeclarerSwap,

    async startDrill(
      newDeal: Deal,
      session: DrillSession,
      initialAuction?: Auction,
      strategy?: BiddingStrategy,
    ) {
      deal = newDeal;
      drillSession = session;
      conventionStrategy = strategy ?? null;
      bidFeedback = null;
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

      if (initialAuction) {
        auction = initialAuction;
        // Replay initial auction entries into bid history with generic explanations
        bidHistory = initialAuction.entries.map((entry) => ({
          seat: entry.seat,
          call: entry.call,
          ruleName: null,
          explanation: entry.call.type === "bid"
            ? `Opening ${entry.call.level}${entry.call.strain} bid`
            : "Pass",
          isUser: false,
        }));
        // Current turn is the next seat after the last entry
        const lastEntry = initialAuction.entries[initialAuction.entries.length - 1];
        currentTurn = lastEntry ? nextSeat(lastEntry.seat) : newDeal.dealer;
      } else {
        auction = { entries: [], isComplete: false };
        bidHistory = [];
        currentTurn = newDeal.dealer;
      }

      await runAiBids();
    },

    async userBid(call: Call) {
      if (isProcessing) return;
      if (!currentTurn || !drillSession?.isUserSeat(currentTurn)) return;
      if (!deal) return;

      // Check correctness against convention strategy before proceeding
      let expectedResult: BidResult | null = null;
      if (conventionStrategy) {
        const hand = deal.hands[currentTurn];
        const evaluation = evaluateHand(hand);
        expectedResult = conventionStrategy.suggest({
          hand, auction, seat: currentTurn, evaluation,
        });
      }

      const isCorrect = callsMatch(call, expectedResult?.call ?? { type: "pass" });

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

      // Add bid to auction regardless of correctness
      auction = await engine.addCall(auction, { seat: currentTurn, call });
      bidHistory = [...bidHistory, {
        seat: currentTurn,
        call,
        ruleName: null,
        explanation: "User bid",
        isUser: true,
      }];

      currentTurn = nextSeat(currentTurn);

      // If correct, auto-dismiss feedback after brief display and continue
      if (isCorrect) {
        const complete = await engine.isAuctionComplete(auction);
        if (complete) {
          await completeAuction();
          bidFeedback = null;
          return;
        }
        await runAiBids();
        // Clear correct feedback after AI bids complete (user has seen it)
        bidFeedback = null;
        return;
      }

      // If wrong, pause — user must dismiss feedback before auction continues
      // runAiBids() will be called by dismissBidFeedback()
    },

    /** Dismiss bid feedback and continue auction (called after wrong bid acknowledged). */
    async dismissBidFeedback() {
      bidFeedback = null;

      const complete = await engine.isAuctionComplete(auction);
      if (complete) {
        await completeAuction();
        return;
      }

      await runAiBids();
    },

    /** Skip directly to explanation from bid feedback. */
    async skipFromFeedback() {
      bidFeedback = null;
      phase = "EXPLANATION";
    },

    async reset() {
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
    },
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
