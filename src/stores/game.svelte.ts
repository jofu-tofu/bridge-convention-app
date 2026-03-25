import { tick } from "svelte";
import type { EnginePort } from "../engine/port";
import type {
  Deal,
  Auction,
  AuctionEntry,
  Contract,
  Call,
  Card,
  PlayedCard,
  Trick,
  Hand,
  DDSolution,
} from "../engine/types";
import { BidSuit, Suit, Seat } from "../engine/types";
import type {
  DrillSession,
  DrillBundle,
  DevServicePort,
  SessionHandle,
  AiBidEntry,
} from "../service";
import type { BidResult, BidHistoryEntry } from "../service";
import type { PlayStrategy, PlayContext } from "../service";
import type { ServicePublicBeliefs } from "../service/response-types";
import type { StrategyEvaluation } from "../conventions";
import type { PublicBeliefState, InferenceSnapshot } from "../service";
import { createInferenceCoordinator } from "../service";
import { randomPlayStrategy } from "../service";
import { nextSeat, partnerSeat, areSamePartnership } from "../service";

import type {
  BiddingViewport,
  AuctionEntryView,
  ViewportBidFeedback,
  TeachingDetail,
  DeclarerPromptViewport,
  PlayingViewport,
  ExplanationViewport,
} from "../service";
import type { ViewportBidGrade } from "../service";
import type { BidFeedbackDTO } from "../service";
import { isValidTransition } from "../session/phase-machine";
import type { GamePhase } from "../session/phase-machine";
import { delay } from "../service/util/delay";
import { TRICK_PAUSE, AI_PLAY_DELAY } from "./animate";

// ── Re-exports ──────────────────────────────────────────────────────

export type { ServiceGamePhase as GamePhase } from "../service/response-types";
export type { BidHistoryEntry } from "../service";

// ── Exported types (previously in sub-stores) ───────────────────────

export interface GameStoreOptions {
  /** Override the delay function used for AI bid/play timing. Defaults to setTimeout-based delay. */
  delayFn?: (ms: number) => Promise<void>;
}

/** Viewport-safe bid feedback for the current turn. */
export interface BidFeedback {
  readonly grade: ViewportBidGrade;
  readonly viewportFeedback: ViewportBidFeedback;
  readonly teaching: TeachingDetail | null;
}

/** Aggregated debug snapshot — strategy evaluation plus the expected bid. */
export interface DebugSnapshot extends StrategyEvaluation {
  readonly expectedBid: BidResult | null;
}

/** Internal feedback stored in debug log entries (richer than viewport BidFeedback). */
export type DebugBidFeedback = BidFeedbackDTO;

/** A single entry in the persistent debug log — captures a snapshot at a specific moment. */
export interface DebugLogEntry {
  readonly kind: "pre-bid" | "user-bid" | "ai-bid";
  readonly turnIndex: number;
  readonly seat: Seat;
  readonly call?: Call;
  /** Pipeline state at this moment (null for AI bids). */
  readonly snapshot: DebugSnapshot;
  /** Feedback from grading (only on user-bid entries). */
  readonly feedback: BidFeedbackDTO | null;
}

export interface PlayLogEntry {
  readonly seat: Seat;
  readonly card: Card;
  readonly reason: string;
  readonly trickIndex: number;
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

type PromptMode = "defender" | "south-declarer" | "declarer-swap";

// ── Internal constants ──────────────────────────────────────────────

const DDS_TIMEOUT_MS = 10_000;

/** Default empty evaluation — used when no strategy is wired or before first suggest(). */
const EMPTY_EVALUATION: StrategyEvaluation = {
  practicalRecommendation: null,
  surfaceGroups: null,
  pipelineResult: null,
  posteriorSummary: null,
  explanationCatalog: null,
  teachingProjection: null,
  facts: null,
  machineSnapshot: null,
  auctionContext: null,
};

/** Map BidSuit to Suit for trump. NoTrump returns undefined. */
function bidSuitToSuit(strain: BidSuit): Suit | undefined {
  switch (strain) {
    case BidSuit.Clubs: return Suit.Clubs;
    case BidSuit.Diamonds: return Suit.Diamonds;
    case BidSuit.Hearts: return Suit.Hearts;
    case BidSuit.Spades: return Suit.Spades;
    case BidSuit.NoTrump: return undefined;
    default: {
      const _exhaustive: never = strain;
      throw new Error(`Unknown BidSuit: ${String(_exhaustive)}`);
    }
  }
}

// ── Store factory ───────────────────────────────────────────────────

export function createGameStore(
  engine: EnginePort,
  service: DevServicePort,
  options?: GameStoreOptions,
) {
  const delayFn = options?.delayFn ?? delay;

  // ── Session state ─────────────────────────────────────────────
  let activeHandle = $state<SessionHandle | null>(null);
  // Not $state — swapped per-drill, not reactive (components access via closures)
  let activeService: DevServicePort = service;
  let deal = $state<Deal | null>(null);
  let phase = $state<GamePhase>("BIDDING");
  let contract = $state<Contract | null>(null);
  let drillSession = $state<DrillSession | null>(null);
  let conventionName = $state("");
  let effectiveUserSeat = $state<Seat | null>(null);

  // ── Bidding state ─────────────────────────────────────────────
  let auction = $state<Auction>({ entries: [], isComplete: false });
  let currentTurn = $state<Seat | null>(null);
  let bidHistory = $state<BidHistoryEntry[]>([]);
  let biddingProcessing = $state(false);
  let legalCalls = $state<Call[]>([]);
  let bidFeedback = $state.raw<BidFeedback | null>(null);
  let biddingError = $state<string | null>(null);
  let debugLog = $state<DebugLogEntry[]>([]);

  // Bidding config set at init time
  let activeDeal = $state<Deal | null>(null);
  let activeSession = $state<DrillSession | null>(null);
  let onAuctionComplete: ((auction: Auction) => Promise<void>) | null = null;
  let _onSkipToExplanation: ((auction: Auction) => Promise<void>) | null = null;
  let onProcessBid: ((bid: AuctionEntry, auctionBefore: Auction, bidResult: BidResult | null) => void) | null = null;

  // ── Play state ────────────────────────────────────────────────
  let tricks = $state<Trick[]>([]);
  let currentTrick = $state<PlayedCard[]>([]);
  let currentPlayer = $state<Seat | null>(null);
  let declarerTricksWon = $state(0);
  let defenderTricksWon = $state(0);
  let dummySeat = $state<Seat | null>(null);
  let score = $state<number | null>(null);
  let trumpSuit = $state<Suit | undefined>(undefined);
  let playAborted = $state(false);
  let isShowingTrickResult = $state(false);
  let playProcessing = $state(false);
  let playLog = $state<PlayLogEntry[]>([]);
  let legalPlaysForCurrentPlayer = $state<Card[]>([]);
  let activePlayStrategy: PlayStrategy | null = null;
  let activeContract: Contract | null = null;
  let activeUserSeat: Seat | null = null;
  let activeInferences: Record<Seat, ServicePublicBeliefs> | null = null;
  let onPlayComplete: ((score: number | null) => void) | null = null;

  // ── DDS state ─────────────────────────────────────────────────
  let ddsSolution = $state<DDSolution | null>(null);
  let ddsSolving = $state(false);
  let ddsError = $state<string | null>(null);
  // Intentionally not $state — used as an async generation counter to discard stale DDS results
  let solveGeneration = 0;

  // ── Inference state ───────────────────────────────────────────
  const inference = createInferenceCoordinator();
  let playInferences = $state<Record<Seat, ServicePublicBeliefs> | null>(null);
  let publicBeliefState = $state<PublicBeliefState>(inference.getPublicBeliefState());

  // ── Cached viewports ───────────────────────────────────────────
  let cachedBiddingViewport = $state<BiddingViewport | null>(null);
  let cachedDeclarerPromptViewport = $state<DeclarerPromptViewport | null>(null);
  let cachedPlayingViewport = $state<PlayingViewport | null>(null);
  let cachedExplanationViewport = $state<ExplanationViewport | null>(null);

  // ── Bidding animation state ──────────────────────────────────
  // Animation overlay: controls incremental reveal of AI bids from the viewport.
  // When non-null, displayedAuctionEntries slices the viewport's entries.
  let biddingAnim = $state<{ totalAiBids: number; revealed: number } | null>(null);

  // Viewport-derived display values — single source of truth for bidding UI
  const displayedAuctionEntries = $derived.by((): readonly AuctionEntryView[] => {
    const vp = cachedBiddingViewport;
    if (!vp) return [];
    if (!biddingAnim) return vp.auctionEntries;
    const baseCount = vp.auctionEntries.length - biddingAnim.totalAiBids;
    return vp.auctionEntries.slice(0, baseCount + biddingAnim.revealed);
  });

  const displayedLegalCalls = $derived.by((): readonly Call[] => {
    if (biddingProcessing || biddingAnim) return [];
    return cachedBiddingViewport?.legalCalls ?? [];
  });

  const displayedCurrentBidder = $derived.by((): Seat | null => {
    const vp = cachedBiddingViewport;
    if (!vp) return null;
    if (!biddingAnim) return vp.currentBidder;
    // During animation, derive current bidder from the last displayed entry
    const displayed = displayedAuctionEntries;
    if (displayed.length === 0) return vp.dealer;
    return nextSeat(displayed[displayed.length - 1]!.seat);
  });

  const displayedIsUserTurn = $derived(
    !biddingProcessing &&
    !biddingAnim &&
    phase === "BIDDING" &&
    cachedBiddingViewport !== null &&
    cachedBiddingViewport.isUserTurn,
  );

  // ── Play animation state ─────────────────────────────────────
  let playAnim = $state<{ totalAiPlays: number; revealed: number } | null>(null);

  const displayedCurrentTrick = $derived.by((): readonly PlayedCard[] => {
    const vp = cachedPlayingViewport;
    if (!vp) return [];
    if (!playAnim) return vp.currentTrick;
    const baseCount = vp.currentTrick.length - playAnim.totalAiPlays;
    return vp.currentTrick.slice(0, baseCount + playAnim.revealed);
  });

  async function refreshViewport() {
    if (!activeHandle) return;
    switch (phase) {
      case "BIDDING":
        cachedBiddingViewport = await activeService.getBiddingViewport(activeHandle);
        break;
      case "DECLARER_PROMPT":
        cachedDeclarerPromptViewport = await activeService.getDeclarerPromptViewport(activeHandle);
        break;
      case "PLAYING":
        cachedPlayingViewport = await activeService.getPlayingViewport(activeHandle);
        break;
      case "EXPLANATION":
        cachedExplanationViewport = await activeService.getExplanationViewport(activeHandle);
        break;
    }
  }

  // ── Derived ───────────────────────────────────────────────────

  const userSeat = $derived<Seat | null>(
    drillSession ? drillSession.config.userSeat : null,
  );

  const isUserTurn = $derived(
    currentTurn !== null &&
      activeSession !== null &&
      activeSession.isUserSeat(currentTurn) &&
      !biddingProcessing,
  );

  const isFeedbackBlocking = $derived(
    bidFeedback !== null &&
      bidFeedback.grade !== "correct",
  );

  // ── Phase helpers ─────────────────────────────────────────────

  function transitionTo(target: GamePhase): boolean {
    if (isValidTransition(phase, target)) {
      phase = target;
      return true;
    }
    const msg = `Invalid phase transition: ${phase} → ${target}`;
    if (import.meta.env.DEV) {
      throw new Error(msg);
    }
    return false;
  }

  function transitionToExplanation() {
    if (!transitionTo("EXPLANATION")) return;
    if (deal && contract) {
      void triggerDDSSolve(deal, contract);
    }
    void refreshViewport();
  }

  /** Determine the current prompt mode from game state. */
  function getPromptMode(): PromptMode | null {
    if (phase !== "DECLARER_PROMPT" || !contract || !userSeat) return null;
    if (contract.declarer !== userSeat && partnerSeat(contract.declarer) !== userSeat) return "defender";
    if (contract.declarer === userSeat) return "south-declarer";
    return "declarer-swap";
  }

  /** Compute which seats should be shown face-up. */
  function getFaceUpSeats(): ReadonlySet<Seat> {
    const seat = effectiveUserSeat ?? userSeat;
    if (!seat) return new Set();

    const seats = new Set<Seat>([seat]);

    if (phase === "DECLARER_PROMPT" && contract) {
      const mode = getPromptMode();
      if (mode === "south-declarer") {
        seats.add(partnerSeat(contract.declarer));
      } else if (mode === "declarer-swap") {
        seats.add(contract.declarer);
      }
    }

    if (phase === "PLAYING" && contract) {
      const dummy = partnerSeat(contract.declarer);
      if (areSamePartnership(dummy, seat)) {
        seats.add(dummy);
      }
    }

    return seats;
  }

  // ── DDS helpers ───────────────────────────────────────────────

  async function triggerDDSSolve(d: Deal, _contract: Contract) {
    if (ddsSolving) return;
    const gen = ++solveGeneration;
    ddsSolving = true;
    ddsError = null;
    ddsSolution = null;

    const plainDeal: Deal = $state.snapshot(d);

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("DDS analysis timed out")),
          DDS_TIMEOUT_MS,
        );
      });
      const result = await Promise.race([
        engine.solveDeal(plainDeal),
        timeoutPromise,
      ]);
      if (solveGeneration === gen) {
        ddsSolution = result;
      }
    } catch (err: unknown) {
      if (solveGeneration === gen) {
        ddsError = err instanceof Error ? err.message : String(err);
      }
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      if (solveGeneration === gen) {
        ddsSolving = false;
      }
    }
  }

  function resetDDS() {
    ddsSolution = null;
    ddsSolving = false;
    ddsError = null;
    solveGeneration++;
  }

  // ── Play helpers ──────────────────────────────────────────────

  function isUserControlled(seat: Seat): boolean {
    if (!activeContract || !activeUserSeat) return false;
    return seatController(seat, activeContract.declarer, activeUserSeat) === "user";
  }

  function getRemainingCards(seat: Seat): Card[] {
    if (!activeDeal) return [];
    const played = new Set<string>();
    for (const trick of tricks) {
      for (const p of trick.plays) {
        if (p.seat === seat) played.add(`${p.card.suit}${p.card.rank}`);
      }
    }
    for (const p of currentTrick) {
      if (p.seat === seat) played.add(`${p.card.suit}${p.card.rank}`);
    }
    return activeDeal.hands[seat].cards.filter(
      (c) => !played.has(`${c.suit}${c.rank}`),
    );
  }

  function getLeadSuit(): Suit | undefined {
    return currentTrick.length > 0 ? currentTrick[0]!.card.suit : undefined;
  }

  function buildPlayContext(
    seat: Seat,
    hand: Hand,
    legalCards: readonly Card[],
  ): PlayContext {
    if (!activeContract) {
      throw new Error("buildPlayContext called without an active contract");
    }
    const dummyVisible = tricks.length > 0 || currentTrick.length > 0;
    return {
      hand,
      currentTrick: [...currentTrick],
      previousTricks: [...tricks],
      contract: activeContract,
      seat,
      trumpSuit,
      legalPlays: legalCards,
      dummyHand: dummyVisible && dummySeat && activeDeal ? activeDeal.hands[dummySeat] : undefined,
      inferences: activeInferences ?? undefined,
    };
  }

  async function selectAiCard(seat: Seat, legalCards: readonly Card[]): Promise<Card> {
    const remaining = getRemainingCards(seat);
    const ctx = buildPlayContext(seat, { cards: remaining }, legalCards);
    const result = (activePlayStrategy && activeContract)
      ? await activePlayStrategy.suggest(ctx)
      : await randomPlayStrategy.suggest(ctx);
    playLog = [...playLog, { seat, card: result.card, reason: result.reason, trickIndex: tricks.length }];
    return result.card;
  }

  function addCardToTrick(card: Card, seat: Seat) {
    currentTrick = [...currentTrick, { card, seat }];
  }

  async function scoreTrick() {
    if (!activeContract) return;
    const trick: Trick = { plays: [...currentTrick], trumpSuit };
    const winner = await engine.getTrickWinner(trick);
    const completedTrick: Trick = { ...trick, winner };

    const declarerSide = new Set([
      activeContract.declarer,
      partnerSeat(activeContract.declarer),
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

  async function completeTrickLocal() {
    isShowingTrickResult = true;
    await delay(TRICK_PAUSE);
    isShowingTrickResult = false;

    if (playAborted) return;
    await scoreTrick();
    const winner = currentPlayer!;

    if (tricks.length === 13) {
      await completePlay();
      return;
    }

    if (!isUserControlled(winner)) {
      await runAiPlays();
    }
  }

  async function runAiPlays() {
    playProcessing = true;
    try {
      while (currentPlayer && !isUserControlled(currentPlayer) && !playAborted) {
        await delay(AI_PLAY_DELAY);
        if (playAborted) break;

        const remaining = getRemainingCards(currentPlayer);
        const legalPlays = await engine.getLegalPlays({ cards: remaining }, getLeadSuit());
        const card = await selectAiCard(currentPlayer, legalPlays);
        addCardToTrick(card, currentPlayer);

        if (currentTrick.length === 4) {
          await completeTrickLocal();
          continue;
        }

        currentPlayer = nextSeat(currentPlayer);
      }
    } finally {
      playProcessing = false;
    }
  }

  async function completePlay() {
    if (!activeContract || !activeDeal) return;
    const result = await engine.calculateScore(
      activeContract,
      declarerTricksWon,
      activeDeal.vulnerability,
    );
    score = result;
    currentPlayer = null;
    onPlayComplete?.(result);
  }

  async function userPlayCardLocal(card: Card, seat: Seat) {
    if (playProcessing || !currentPlayer || !activeDeal) return;
    if (seat !== currentPlayer) return;
    if (!isUserControlled(seat)) return;

    const remaining = getRemainingCards(seat);
    const legalPlays = await engine.getLegalPlays({ cards: remaining }, getLeadSuit());
    const isLegal = legalPlays.some((c) => c.suit === card.suit && c.rank === card.rank);
    if (!isLegal) return;

    addCardToTrick(card, seat);
    await tick();

    if (currentTrick.length === 4) {
      await completeTrickLocal();
    } else {
      currentPlayer = nextSeat(currentPlayer);
      await tick();
      if (!isUserControlled(currentPlayer)) {
        await runAiPlays();
      }
    }
  }

  async function userPlayCardViaService(card: Card, seat: Seat) {
    if (!activeHandle) return;
    if (playProcessing || playAborted) return;

    const handle = activeHandle;
    playProcessing = true;
    try {
      const result = await activeService.playCard(handle, card, seat);
      if (activeHandle !== handle) return; // cancelled

      if (!result.accepted) return;

      // Fetch updated viewport (includes user's card + all AI plays)
      cachedPlayingViewport = await activeService.getPlayingViewport(handle);
      if (activeHandle !== handle) return;

      // Log AI plays
      for (const aiPlay of result.aiPlays) {
        playLog = [...playLog, { seat: aiPlay.seat, card: aiPlay.card, reason: aiPlay.reason, trickIndex: (cachedPlayingViewport?.tricks.length ?? 0) }];
      }

      // Animate AI plays via incremental reveal on currentTrick
      if (result.aiPlays.length > 0 && cachedPlayingViewport) {
        playAnim = { totalAiPlays: result.aiPlays.length, revealed: 0 };

        for (let i = 0; i < result.aiPlays.length; i++) {
          await delayFn(AI_PLAY_DELAY);
          if (activeHandle !== handle || playAborted) return;

          playAnim = { totalAiPlays: result.aiPlays.length, revealed: i + 1 };
        }
        playAnim = null;
      }

      // Handle trick completion pause
      if (result.trickComplete && !playAborted) {
        isShowingTrickResult = true;
        await delayFn(TRICK_PAUSE);
        isShowingTrickResult = false;
        if (activeHandle !== handle || playAborted) return;

        // Refresh viewport for post-trick state
        cachedPlayingViewport = await activeService.getPlayingViewport(handle);
        if (activeHandle !== handle) return;
      }

      // Handle play completion
      if (result.playComplete) {
        score = result.score;
        transitionToExplanation();
      }
    } finally {
      playProcessing = false;
      await tick();
    }
  }

  async function skipToReviewLocal() {
    playAborted = true;
    if (!activeContract || !activeDeal) return;

    try {
      while (tricks.length < 13) {
        while (currentTrick.length < 4) {
          if (!currentPlayer) return;
          const seat =
            currentTrick.length === 0
              ? currentPlayer
              : nextSeat(currentTrick[currentTrick.length - 1]!.seat);
          const remaining = getRemainingCards(seat);
          const leadSuit = getLeadSuit();
          const legalPlays = await engine.getLegalPlays({ cards: remaining }, leadSuit);
          if (legalPlays.length === 0) break;
          const card = legalPlays[0]!;
          playLog = [...playLog, { seat, card, reason: "skip", trickIndex: tricks.length }];
          currentTrick = [...currentTrick, { card, seat }];
        }
        await scoreTrick();
      }
      await completePlay();
    } catch (err) {
      console.error('skipToReviewLocal error:', err);
      currentPlayer = null;
      onPlayComplete?.(null);
    }
  }

  function startPlayPhaseImpl() {
    if (!contract || !deal) return;
    activeContract = contract;
    activeDeal = deal;
    activeUserSeat = effectiveUserSeat ?? userSeat ?? Seat.South;
    activePlayStrategy = drillSession?.config.playStrategy ?? null;
    activeInferences = playInferences;
    onPlayComplete = (_score) => {
      transitionToExplanation();
    };

    playAborted = false;
    playAnim = null;
    tricks = [];
    currentTrick = [];
    declarerTricksWon = 0;
    defenderTricksWon = 0;
    dummySeat = partnerSeat(contract.declarer);
    trumpSuit = bidSuitToSuit(contract.strain);
    score = null;
    isShowingTrickResult = false;
    playProcessing = false;
    legalPlaysForCurrentPlayer = [];
    playLog = [];

    currentPlayer = nextSeat(contract.declarer);

    if (activeHandle) {
      // Service path: fetch initial playing viewport + handle AI opening lead
      void (async () => {
        try {
          cachedPlayingViewport = await activeService.getPlayingViewport(activeHandle!);
        } catch (err) {
          console.error('Failed to fetch initial playing viewport:', err);
        }
      })();
    } else {
      // Local path: If opening leader is AI, start AI plays
      if (!isUserControlled(currentPlayer)) {
        playProcessing = true;
        runAiPlays().catch((err) => {
          console.error('runAiPlays failed:', err);
          playProcessing = false;
        });
      }
    }

    void refreshViewport();
  }

  // ── Bidding helpers ───────────────────────────────────────────

  async function runAiBidsLocal() {
    if (!activeSession || !activeDeal) return;
    biddingProcessing = true;
    try {
      while (currentTurn && !activeSession.isUserSeat(currentTurn)) {
        await delayFn(300);

        const hand = activeDeal.hands[currentTurn];
        const result = activeSession.getNextBid(currentTurn, hand, auction);

        if (!result) break;

        const bidEntry = { seat: currentTurn, call: result.call };
        const auctionBefore = auction;
        let newAuction: Auction;
        try {
          newAuction = await engine.addCall(auction, bidEntry);
        } catch (err) {
          console.error('AI bid failed:', err);
          break;
        }
        auction = newAuction;

        onProcessBid?.(bidEntry, auctionBefore, result);

        bidHistory = [
          ...bidHistory,
          {
            seat: currentTurn,
            call: result.call,
            meaning: result.meaning,
            isUser: false,
            alertLabel: result.alert?.teachingLabel,
            annotationType: result.alert?.annotationType,
          },
        ];

        currentTurn = nextSeat(currentTurn);

        const complete = await engine.isAuctionComplete(auction);
        if (complete) {
          await onAuctionComplete?.(auction);
          return;
        }
      }

      if (currentTurn) {
        legalCalls = await engine.getLegalCalls(auction, currentTurn);
      }
    } finally {
      biddingProcessing = false;
      await tick();
    }
  }

  async function animateAiBidsLocal(aiBids: readonly AiBidEntry[]) {
    for (const aiBid of aiBids) {
      await delayFn(300);
      auction = {
        entries: [...auction.entries, { seat: aiBid.seat, call: aiBid.call }],
        isComplete: false,
      };
      bidHistory = [...bidHistory, aiBid.historyEntry];
      currentTurn = nextSeat(aiBid.seat);
    }
  }

  async function userBidViaService(call: Call) {
    if (!activeHandle) return;
    if (biddingProcessing) return;
    if (!displayedIsUserTurn) return;

    const handle = activeHandle;
    const conventionId = drillSession?.config.conventionId ?? null;
    biddingProcessing = true;
    try {
      const result = await activeService.submitBid(handle, call);
      if (activeHandle !== handle) return; // cancelled

      if (!result.accepted) {
        if (result.feedback && result.grade) {
          bidFeedback = {
            grade: result.grade,
            viewportFeedback: result.feedback,
            teaching: result.teaching,
          };
        }
        if (import.meta.env.DEV) {
          const log = await activeService.getDebugLog(handle);
          debugLog = [...log] as DebugLogEntry[];
        }
        await tick();
        return;
      }

      bidFeedback = null;

      // Update viewport — always non-null for accepted bids (PR 0 fix)
      if (result.nextViewport) {
        cachedBiddingViewport = result.nextViewport;
      }

      if (import.meta.env.DEV) {
        const log = await activeService.getDebugLog(handle);
        debugLog = [...log] as DebugLogEntry[];
      }

      // Animate AI bids via incremental reveal
      if (result.aiBids.length > 0) {
        biddingAnim = { totalAiBids: result.aiBids.length, revealed: 0 };

        for (let i = 0; i < result.aiBids.length; i++) {
          await delayFn(300);
          if (activeHandle !== handle) return; // cancelled — bail
          biddingAnim = { totalAiBids: result.aiBids.length, revealed: i + 1 };
        }
        biddingAnim = null;
      }

      // Fetch belief state from service (single source of truth for inference)
      publicBeliefState = await activeService.getPublicBeliefState(handle);
      if (activeHandle !== handle) return;

      // Handle phase transition (auction complete)
      const phaseTransitioned = result.phaseTransition ||
        (result.aiBids.length > 0 && await activeService.getPhase(handle) !== "BIDDING");
      if (activeHandle !== handle) return;

      if (phaseTransitioned) {
        playInferences = inference.capturePlayInferences();
        const servicePhase = await activeService.getPhase(handle);
        if (activeHandle !== handle) return;
        if (servicePhase === "DECLARER_PROMPT") {
          const dpvp = await activeService.getDeclarerPromptViewport(handle);
          if (activeHandle !== handle) return;
          cachedDeclarerPromptViewport = dpvp;
          contract = dpvp?.contract ?? null;
          effectiveUserSeat = userSeat;
          transitionTo("DECLARER_PROMPT");
        } else if (servicePhase === "EXPLANATION") {
          contract = null;
          transitionToExplanation();
        }
        await tick();
        return;
      }
    } catch (e) {
      biddingError = e instanceof Error ? e.message : "Unknown error during bid";
    } finally {
      biddingProcessing = false;
      await tick();
    }
  }

  async function handleAuctionComplete(finalAuction: Auction) {
    playInferences = inference.capturePlayInferences();
    const result = await engine.getContract(finalAuction);
    contract = result;
    if (result) {
      effectiveUserSeat = userSeat;
      transitionTo("DECLARER_PROMPT");
      await refreshViewport();
    } else {
      transitionToExplanation();
    }
    await tick();
  }

  async function handleSkipToExplanation(finalAuction: Auction) {
    contract = await engine.getContract(finalAuction);
    transitionToExplanation();
    await tick();
  }

  async function initBidding(bundle: DrillBundle, initialAiBids?: readonly AiBidEntry[], initialLegalCalls?: readonly Call[], initialAuctionComplete?: boolean) {
    const { deal: d, session, initialAuction } = bundle;
    activeDeal = d;
    activeSession = session;
    onAuctionComplete = handleAuctionComplete;
    _onSkipToExplanation = handleSkipToExplanation;
    onProcessBid = (bid, auctionBefore, bidResult) => {
      const conventionId = bundle.session.config.conventionId ?? null;
      publicBeliefState = inference.processBid(bid, auctionBefore, bidResult, conventionId);
    };

    bidFeedback = null;
    biddingError = null;
    debugLog = [];

    if (initialAuction) {
      auction = initialAuction;
      bidHistory = initialAuction.entries.map((entry) => {
        const is1NT = entry.call.type === "bid" && entry.call.level === 1 && entry.call.strain === BidSuit.NoTrump;
        return {
          seat: entry.seat,
          call: entry.call,
          isUser: false,
          alertLabel: is1NT ? "15 to 17" : undefined,
          annotationType: is1NT ? "announce" as const : undefined,
        };
      });
      const lastEntry = initialAuction.entries[initialAuction.entries.length - 1];
      currentTurn = lastEntry ? nextSeat(lastEntry.seat) : d.dealer;

      if (onProcessBid) {
        for (let i = 0; i < initialAuction.entries.length; i++) {
          const entry = initialAuction.entries[i]!;
          const auctionBefore: Auction = {
            entries: initialAuction.entries.slice(0, i),
            isComplete: false,
          };
          onProcessBid(entry, auctionBefore, null);
        }
      }
    } else {
      auction = { entries: [], isComplete: false };
      bidHistory = [];
      currentTurn = d.dealer;
    }

    await tick();

    if (activeHandle && initialAiBids) {
      await animateAiBidsLocal(initialAiBids);
      if (initialAuctionComplete) {
        await onAuctionComplete?.(auction);
      } else if (initialLegalCalls) {
        legalCalls = [...initialLegalCalls];
      }
    } else {
      await runAiBidsLocal();
    }
  }

  // ── Play phase transitions ────────────────────────────────────

  function startPlayPhase() {
    if (!contract || !deal) return;
    if (!transitionTo("PLAYING")) return;
    startPlayPhaseImpl();
  }

  function acceptPlay(seatOverride?: Seat) {
    if (!contract || phase !== "DECLARER_PROMPT") return;
    if (seatOverride) {
      effectiveUserSeat = seatOverride;
    }
    if (activeHandle) {
      // Service path: notify service of prompt acceptance
      void (async () => {
        try {
          await activeService.acceptPrompt(activeHandle!, "play");
        } catch (err) {
          console.error('acceptPrompt failed:', err);
        }
      })();
    }
    startPlayPhase();
  }

  function declinePlay() {
    if (phase !== "DECLARER_PROMPT") return;
    if (activeHandle) {
      void (async () => {
        try {
          await activeService.acceptPrompt(activeHandle!, "skip");
        } catch (err) {
          console.error('acceptPrompt (skip) failed:', err);
        }
      })();
    }
    transitionToExplanation();
  }

  function acceptDeclarerSwap() {
    if (!contract) return;
    acceptPlay(contract.declarer);
  }
  function declineDeclarerSwap() { declinePlay(); }
  function acceptDefend() { acceptPlay(); }
  function declineDefend() { declinePlay(); }
  function acceptSouthPlay() { acceptPlay(); }
  function declineSouthPlay() { declinePlay(); }

  function acceptPrompt() {
    if (!contract || phase !== "DECLARER_PROMPT") return;
    const mode = getPromptMode();
    if (mode === "declarer-swap") {
      acceptPlay(contract.declarer);
    } else {
      acceptPlay();
    }
  }

  function declinePrompt() { declinePlay(); }

  // ── Play actions ──────────────────────────────────────────────

  function getUserControlledSeats(): readonly Seat[] {
    if (!activeContract || !activeUserSeat) return [];
    const seats: Seat[] = [activeUserSeat];
    const dummy = partnerSeat(activeContract.declarer);
    if (seatController(dummy, activeContract.declarer, activeUserSeat) === "user") {
      seats.push(dummy);
    }
    return seats;
  }

  function getRemainingCardsPerSeat(): Partial<Record<Seat, readonly Card[]>> {
    if (!activeDeal) return {};
    const result: Partial<Record<Seat, readonly Card[]>> = {};
    for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West] as Seat[]) {
      result[seat] = getRemainingCards(seat);
    }
    return result;
  }

  async function refreshLegalPlays() {
    const player = currentPlayer;
    if (!activeDeal || !player) {
      legalPlaysForCurrentPlayer = [];
      return;
    }
    const remaining = getRemainingCards(player);
    const plays = await engine.getLegalPlays({ cards: remaining }, getLeadSuit());
    if (currentPlayer === player) {
      legalPlaysForCurrentPlayer = plays;
    }
  }

  // ── Reset ─────────────────────────────────────────────────────

  function resetImpl() {
    // Session
    activeHandle = null;
    activeService = service;
    deal = null;
    phase = "BIDDING";
    contract = null;
    effectiveUserSeat = null;
    drillSession = null;
    conventionName = "";

    // Bidding
    auction = { entries: [], isComplete: false };
    currentTurn = null;
    bidHistory = [];
    biddingProcessing = false;
    legalCalls = [];
    bidFeedback = null;
    biddingError = null;
    activeDeal = null;
    activeSession = null;
    onAuctionComplete = null;
    _onSkipToExplanation = null;
    onProcessBid = null;
    debugLog = [];

    // Play
    playAborted = true;
    tricks = [];
    currentTrick = [];
    currentPlayer = null;
    declarerTricksWon = 0;
    defenderTricksWon = 0;
    dummySeat = null;
    score = null;
    trumpSuit = undefined;
    isShowingTrickResult = false;
    playProcessing = false;
    playLog = [];
    legalPlaysForCurrentPlayer = [];
    activePlayStrategy = null;
    activeContract = null;
    activeUserSeat = null;
    activeInferences = null;
    onPlayComplete = null;

    // DDS
    resetDDS();

    // Animation
    biddingAnim = null;
    playAnim = null;

    // Cached viewports
    cachedBiddingViewport = null;
    cachedDeclarerPromptViewport = null;
    cachedPlayingViewport = null;
    cachedExplanationViewport = null;

    // Inference
    inference.reset();
    playInferences = null;
    publicBeliefState = inference.getPublicBeliefState();
  }

  function resetPlay() {
    playAborted = true;
    tricks = [];
    currentTrick = [];
    currentPlayer = null;
    declarerTricksWon = 0;
    defenderTricksWon = 0;
    dummySeat = null;
    score = null;
    trumpSuit = undefined;
    isShowingTrickResult = false;
    playProcessing = false;
    playLog = [];
    legalPlaysForCurrentPlayer = [];
    activePlayStrategy = null;
    activeContract = null;
    activeUserSeat = null;
    activeInferences = null;
    onPlayComplete = null;
  }

  // ── Return ────────────────────────────────────────────────────

  return {
    get activeHandle() { return activeHandle; },
    /** True when a drill has been started (deal is loaded). Use instead of `deal !== null`. */
    get isInitialized(): boolean { return deal !== null || activeHandle !== null; },
    get deal() { return deal; },
    get phase() { return phase; },
    get contract(): Contract | null {
      // Derive from viewport when service handle is active
      if (activeHandle) {
        if (cachedDeclarerPromptViewport) return cachedDeclarerPromptViewport.contract;
        if (cachedPlayingViewport) return cachedPlayingViewport.contract;
        if (cachedExplanationViewport) return cachedExplanationViewport.contract;
        return contract; // fallback during transitions
      }
      return contract;
    },
    get effectiveUserSeat() { return effectiveUserSeat; },
    get playUserSeat(): Seat {
      return effectiveUserSeat ?? userSeat ?? Seat.South;
    },
    get rotated(): boolean {
      return effectiveUserSeat === Seat.North;
    },

    // Bidding state — viewport-derived when service handle is active
    get auction(): Auction {
      if (activeHandle && cachedBiddingViewport) {
        return {
          entries: displayedAuctionEntries.map(e => ({ seat: e.seat, call: e.call })),
          isComplete: phase !== "BIDDING",
        };
      }
      return auction;
    },
    get currentTurn(): Seat | null {
      if (activeHandle) return displayedCurrentBidder;
      return currentTurn;
    },
    get bidHistory(): BidHistoryEntry[] {
      if (activeHandle && cachedBiddingViewport) {
        return displayedAuctionEntries.map(e => ({
          seat: e.seat,
          call: e.call,
          isUser: false, // all entries from viewport; user's entry gets correct flag from feedback
          alertLabel: e.alertLabel,
          annotationType: e.annotationType,
        }));
      }
      return bidHistory;
    },
    get isProcessing() { return biddingProcessing || playProcessing; },
    get isUserTurn() {
      if (activeHandle) return displayedIsUserTurn;
      return isUserTurn;
    },
    get legalCalls(): Call[] {
      if (activeHandle) return [...displayedLegalCalls];
      return legalCalls;
    },
    get bidFeedback() { return bidFeedback; },
    get isFeedbackBlocking() { return isFeedbackBlocking; },

    // Play state — viewport-derived when service handle is active
    get tricks() {
      const vp = cachedPlayingViewport;
      return activeHandle && vp ? vp.tricks : tricks;
    },
    get currentTrick() {
      return activeHandle && cachedPlayingViewport ? displayedCurrentTrick : currentTrick;
    },
    get currentPlayer() {
      const vp = cachedPlayingViewport;
      return activeHandle && vp ? vp.currentPlayer : currentPlayer;
    },
    get declarerTricksWon() {
      const vp = cachedPlayingViewport;
      return activeHandle && vp ? vp.declarerTricksWon : declarerTricksWon;
    },
    get defenderTricksWon() {
      const vp = cachedPlayingViewport;
      return activeHandle && vp ? vp.defenderTricksWon : defenderTricksWon;
    },
    get dummySeat() {
      const vp = cachedPlayingViewport;
      return activeHandle && vp ? partnerSeat(vp.contract?.declarer ?? Seat.North) : dummySeat;
    },
    get score() { return score; },
    get trumpSuit() {
      const vp = cachedPlayingViewport;
      return activeHandle && vp ? vp.trumpSuit : trumpSuit;
    },
    get legalPlaysForCurrentPlayer() {
      const vp = cachedPlayingViewport;
      return activeHandle && vp ? [...vp.legalPlays] : legalPlaysForCurrentPlayer;
    },
    get userControlledSeats() {
      const vp = cachedPlayingViewport;
      return activeHandle && vp ? [...vp.userControlledSeats] : getUserControlledSeats();
    },
    get remainingCardsPerSeat() {
      const vp = cachedPlayingViewport;
      return activeHandle && vp ? (vp.remainingCards ?? {}) : getRemainingCardsPerSeat();
    },

    // DDS state
    get ddsSolution() { return ddsSolution; },
    get ddsSolving() { return ddsSolving; },
    get ddsError() { return ddsError; },

    // Prompt state
    get isDefenderPrompt() {
      if (!contract || !userSeat) return false;
      return (
        contract.declarer !== userSeat &&
        partnerSeat(contract.declarer) !== userSeat
      );
    },
    get isSouthDeclarerPrompt() {
      if (!contract || !userSeat) return false;
      return contract.declarer === userSeat;
    },
    get promptMode(): PromptMode | null { return getPromptMode(); },
    get faceUpSeats(): ReadonlySet<Seat> { return getFaceUpSeats(); },

    // ── Viewport getters ──────────────────────────────────────
    get biddingViewport() { return cachedBiddingViewport; },
    get viewportFeedback(): ViewportBidFeedback | null {
      const fb = bidFeedback;
      if (!fb) return null;
      return fb.viewportFeedback;
    },
    get teachingDetail(): TeachingDetail | null {
      const fb = bidFeedback;
      if (!fb) return null;
      return fb.teaching;
    },
    get declarerPromptViewport() { return cachedDeclarerPromptViewport; },
    get playingViewport() { return cachedPlayingViewport; },
    get explanationViewport() { return cachedExplanationViewport; },

    // Namespaced sub-store accessors (backward compat) — delegates to top-level getters
    get bidding() {
      // Capture `this` (the returned store object) to delegate to top-level getters
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const store = this;
      return {
        get auction() { return store.auction; },
        get bidHistory() { return store.bidHistory; },
        get bidFeedback() { return bidFeedback; },
        get legalCalls() { return store.legalCalls; },
        get currentTurn() { return store.currentTurn; },
        get isUserTurn() { return store.isUserTurn; },
      };
    },
    get play() {
      const vp = cachedPlayingViewport;
      return {
        get tricks() { return activeHandle && vp ? vp.tricks : tricks; },
        get currentTrick() { return activeHandle && vp ? displayedCurrentTrick : currentTrick; },
        get currentPlayer() { return activeHandle && vp ? vp.currentPlayer : currentPlayer; },
        get declarerTricksWon() { return activeHandle && vp ? vp.declarerTricksWon : declarerTricksWon; },
        get defenderTricksWon() { return activeHandle && vp ? vp.defenderTricksWon : defenderTricksWon; },
        get dummySeat() { return activeHandle && vp ? partnerSeat(vp.contract?.declarer ?? Seat.North) : dummySeat; },
        get score() { return score; },
        get trumpSuit() { return activeHandle && vp ? vp.trumpSuit : trumpSuit; },
      };
    },
    get dds() {
      return {
        get solution() { return ddsSolution; },
        get solving() { return ddsSolving; },
        get error() { return ddsError; },
      };
    },

    // Public belief state
    get publicBeliefState(): PublicBeliefState { return publicBeliefState; },

    // Debug observability
    get debugLog() { return debugLog; },
    get playLog() { return playLog; },
    get playInferences() { return playInferences; },
    get inferenceTimeline(): readonly InferenceSnapshot[] {
      return inference.getNSTimeline();
    },
    get ewInferenceTimeline(): readonly InferenceSnapshot[] {
      return inference.getEWTimeline();
    },

    setConventionName(name: string) { conventionName = name; },

    getLegalPlaysForSeat: async (seat: Seat): Promise<Card[]> => {
      if (!activeDeal || currentPlayer !== seat) return [];
      const remaining = getRemainingCards(seat);
      return engine.getLegalPlays({ cards: remaining }, getLeadSuit());
    },

    refreshLegalPlays,
    getRemainingCards,

    userPlayCard(card: Card, seat: Seat): void {
      const impl = activeHandle ? userPlayCardViaService : userPlayCardLocal;
      impl(card, seat).catch((err) => { console.error('userPlayCard failed:', err); });
    },

    skipToReview(): void {
      if (activeHandle) {
        playAborted = true;
        onPlayComplete?.(null);
      } else {
        skipToReviewLocal().catch((err) => { console.error('skipToReview failed:', err); });
      }
    },

    acceptPlay,
    declinePlay,
    acceptPrompt,
    declinePrompt,
    acceptDeclarerSwap,
    declineDeclarerSwap,
    acceptDefend,
    declineDefend,
    acceptSouthPlay,
    declineSouthPlay,

    playThisHand() {
      if (!contract) return;
      if (phase !== "EXPLANATION") return;
      resetPlay();
      effectiveUserSeat = userSeat;
      resetDDS();
      transitionTo("DECLARER_PROMPT");
      void refreshViewport();
    },

    async startDrill(bundle: DrillBundle, drillService?: DevServicePort, handle?: SessionHandle) {
      activeService = drillService ?? service;
      deal = bundle.deal;
      drillSession = bundle.session;
      conventionName = bundle.session.config.conventionId;
      contract = null;
      phase = "BIDDING";
      effectiveUserSeat = null;

      // Play + DDS reset
      resetPlay();
      resetDDS();

      // Inference
      playInferences = null;
      inference.initialize(bundle.nsInferenceEngine, bundle.ewInferenceEngine);
      publicBeliefState = inference.getPublicBeliefState();

      // Session handle — only use service path when handle is explicitly provided
      activeHandle = handle ?? null;
      biddingAnim = null;

      if (activeHandle) {
        // ── Service path: viewport is single source of truth ──
        const startResult = await activeService.startDrill(activeHandle);
        cachedBiddingViewport = startResult.viewport;

        // Animate initial AI bids via incremental reveal
        if (startResult.aiBids.length > 0 && !startResult.auctionComplete) {
          biddingAnim = { totalAiBids: startResult.aiBids.length, revealed: 0 };

          for (let i = 0; i < startResult.aiBids.length; i++) {
            await delayFn(300);
            if (activeHandle !== handle) return; // cancelled
            biddingAnim = { totalAiBids: startResult.aiBids.length, revealed: i + 1 };
          }
          biddingAnim = null;
        }

        // Fetch belief state from service (single source of truth for inference)
        publicBeliefState = await activeService.getPublicBeliefState(activeHandle);
        if (activeHandle !== handle) return;

        // Handle auction complete during initial bids
        if (startResult.auctionComplete) {
          playInferences = inference.capturePlayInferences();
          const servicePhase = await activeService.getPhase(activeHandle);
          if (activeHandle !== handle) return;
          if (servicePhase === "DECLARER_PROMPT") {
            const dpvp = await activeService.getDeclarerPromptViewport(activeHandle);
            if (activeHandle !== handle) return;
            cachedDeclarerPromptViewport = dpvp;
            contract = dpvp?.contract ?? null;
            effectiveUserSeat = userSeat;
            transitionTo("DECLARER_PROMPT");
          } else if (servicePhase === "EXPLANATION") {
            transitionToExplanation();
          }
        }

        // Populate debug drawer
        if (import.meta.env.DEV) {
          const log = await activeService.getDebugLog(activeHandle);
          debugLog = [...log] as DebugLogEntry[];
        }
      } else {
        // ── Legacy local path (no service handle) ──
        await initBidding(bundle);
      }

      await refreshViewport();
      // Ensure all pending state changes are flushed
      await tick();
    },

    // Bidding actions
    userBid(call: Call): void {
      userBidViaService(call).catch((e: unknown) => {
        biddingError = e instanceof Error ? e.message : "Unknown error during bid";
      });
    },
    retryBid(): void {
      bidFeedback = null;
    },

    // Debug
    async getExpectedBid(): Promise<{ call: Call } | null> {
      if (!activeHandle) return null;
      return activeService.getExpectedBid(activeHandle);
    },
    async getDebugSnapshot(): Promise<DebugSnapshot> {
      if (!activeHandle) {
        return { expectedBid: null, ...EMPTY_EVALUATION };
      }
      const snap = await activeService.getDebugSnapshot(activeHandle);
      return { ...snap, expectedBid: null };
    },

    reset(): void {
      resetImpl();
    },
  };
}
