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
import type {
  BidResult,
  BidHistoryEntry,
  PlayStrategy,
  PlayContext,
  PublicBeliefs,
} from "../core/contracts";
import type { StrategyEvaluation } from "../conventions";
import type { PublicBeliefState, InferenceSnapshot } from "../service";
import { createInferenceCoordinator } from "../service";
import { randomPlayStrategy } from "../service";
import { nextSeat, partnerSeat, areSamePartnership } from "../engine/constants";
import {
  buildBiddingViewport,
  buildDeclarerPromptViewport,
  buildPlayingViewport,
  buildExplanationViewport,
} from "../service";
import type {
  BiddingViewport,
  ViewportBidFeedback,
  TeachingDetail,
  DeclarerPromptViewport,
  PlayingViewport,
  ExplanationViewport,
} from "../service";
import type { ViewportBidGrade } from "../core/viewport/player-viewport";
import type { BidFeedbackDTO } from "../service";
import { isValidTransition } from "../core/phase-machine";
import type { GamePhase } from "../core/phase-machine";
import { delay } from "../core/util/delay";
import { TRICK_PAUSE, AI_PLAY_DELAY } from "./animate";

// ── Re-exports ──────────────────────────────────────────────────────

export type { GamePhase } from "../core/phase-machine";
export type { BidHistoryEntry } from "../core/contracts";

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
  acceptableAlternatives: null,
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
  let activeInferences: Record<Seat, PublicBeliefs> | null = null;
  let onPlayComplete: ((score: number | null) => void) | null = null;

  // ── DDS state ─────────────────────────────────────────────────
  let ddsSolution = $state<DDSolution | null>(null);
  let ddsSolving = $state(false);
  let ddsError = $state<string | null>(null);
  // Intentionally not $state — used as an async generation counter to discard stale DDS results
  let solveGeneration = 0;

  // ── Inference state ───────────────────────────────────────────
  const inference = createInferenceCoordinator();
  let playInferences = $state<Record<Seat, PublicBeliefs> | null>(null);
  let publicBeliefState = $state<PublicBeliefState>(inference.getPublicBeliefState());

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

  function selectAiCard(seat: Seat, legalCards: readonly Card[]): Card {
    const remaining = getRemainingCards(seat);
    const ctx = buildPlayContext(seat, { cards: remaining }, legalCards);
    const result = (activePlayStrategy && activeContract)
      ? activePlayStrategy.suggest(ctx)
      : randomPlayStrategy.suggest(ctx);
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
        const card = selectAiCard(currentPlayer, legalPlays);
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
    if (!activeHandle || !activeContract) return;
    if (playProcessing || !currentPlayer || !activeDeal) return;
    if (seat !== currentPlayer) return;
    if (!isUserControlled(seat)) return;

    playProcessing = true;
    try {
      const result = await activeService.playCard(activeHandle, card, seat);

      if (!result.accepted) return;

      addCardToTrick(card, seat);
      await tick();

      if (currentTrick.length === 4) {
        isShowingTrickResult = true;
        await delay(TRICK_PAUSE);
        isShowingTrickResult = false;
        if (playAborted) return;
        await scoreTrick();
      } else {
        currentPlayer = nextSeat(seat);
      }

      // Animate AI plays
      for (const aiPlay of result.aiPlays) {
        if (playAborted) break;
        await delay(AI_PLAY_DELAY);
        if (playAborted) break;

        addCardToTrick(aiPlay.card, aiPlay.seat);
        playLog = [...playLog, { seat: aiPlay.seat, card: aiPlay.card, reason: aiPlay.reason, trickIndex: tricks.length }];
        await tick();

        if (currentTrick.length === 4) {
          isShowingTrickResult = true;
          await delay(TRICK_PAUSE);
          isShowingTrickResult = false;
          if (playAborted) break;
          await scoreTrick();
        } else {
          currentPlayer = nextSeat(aiPlay.seat);
        }
      }

      if (result.legalPlays) {
        legalPlaysForCurrentPlayer = [...result.legalPlays];
      }

      if (result.currentPlayer !== undefined) {
        currentPlayer = result.currentPlayer;
      }

      if (result.playComplete) {
        score = result.score;
        currentPlayer = null;
        onPlayComplete?.(result.score);
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

    // If opening leader is AI, start AI plays (only in local path)
    if (!activeHandle && !isUserControlled(currentPlayer)) {
      playProcessing = true;
      runAiPlays().catch((err) => {
        console.error('runAiPlays failed:', err);
        playProcessing = false;
      });
    }
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
    if (!activeHandle || !activeSession) return;
    if (biddingProcessing) return;
    if (!currentTurn || !activeSession.isUserSeat(currentTurn)) return;

    biddingProcessing = true;
    try {
      const result = await activeService.submitBid(activeHandle, call);

      if (!result.accepted) {
        if (result.feedback && result.grade) {
          bidFeedback = {
            grade: result.grade,
            viewportFeedback: result.feedback,
            teaching: result.teaching,
          };
        }
        if (import.meta.env.DEV) {
          const log = await activeService.getDebugLog(activeHandle);
          debugLog = [...log] as DebugLogEntry[];
        }
        await tick();
        return;
      }

      bidFeedback = null;

      if (result.userHistoryEntry) {
        auction = {
          entries: [...auction.entries, { seat: result.userHistoryEntry.seat, call: result.userHistoryEntry.call }],
          isComplete: false,
        };
        bidHistory = [...bidHistory, result.userHistoryEntry];
        currentTurn = nextSeat(result.userHistoryEntry.seat);
      }

      if (import.meta.env.DEV) {
        const log = await activeService.getDebugLog(activeHandle);
        debugLog = [...log] as DebugLogEntry[];
      }

      if (result.phaseTransition) {
        auction = { ...auction, isComplete: true };
        await onAuctionComplete?.(auction);
        await tick();
        return;
      }

      await animateAiBidsLocal(result.aiBids);

      if (result.aiBids.length > 0) {
        const servicePhase = await activeService.getPhase(activeHandle);
        if (servicePhase !== "BIDDING") {
          auction = { ...auction, isComplete: true };
          await onAuctionComplete?.(auction);
          await tick();
          return;
        }
      }

      if (result.nextViewport) {
        legalCalls = [...result.nextViewport.legalCalls];
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
    } else {
      transitionToExplanation();
    }
  }

  async function handleSkipToExplanation(finalAuction: Auction) {
    contract = await engine.getContract(finalAuction);
    transitionToExplanation();
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
    startPlayPhase();
  }

  function declinePlay() {
    if (phase !== "DECLARER_PROMPT") return;
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
    get deal() { return deal; },
    get phase() { return phase; },
    get contract() { return contract; },
    get effectiveUserSeat() { return effectiveUserSeat; },
    get playUserSeat(): Seat {
      return effectiveUserSeat ?? userSeat ?? Seat.South;
    },
    get rotated(): boolean {
      return effectiveUserSeat === Seat.North;
    },

    // Bidding state
    get auction() { return auction; },
    get currentTurn() { return currentTurn; },
    get bidHistory() { return bidHistory; },
    get isProcessing() { return biddingProcessing || playProcessing; },
    get isUserTurn() { return isUserTurn; },
    get legalCalls() { return legalCalls; },
    get bidFeedback() { return bidFeedback; },
    get isFeedbackBlocking() { return isFeedbackBlocking; },

    // Play state
    get tricks() { return tricks; },
    get currentTrick() { return currentTrick; },
    get currentPlayer() { return currentPlayer; },
    get declarerTricksWon() { return declarerTricksWon; },
    get defenderTricksWon() { return defenderTricksWon; },
    get dummySeat() { return dummySeat; },
    get score() { return score; },
    get trumpSuit() { return trumpSuit; },
    get legalPlaysForCurrentPlayer() { return legalPlaysForCurrentPlayer; },
    get userControlledSeats() { return getUserControlledSeats(); },
    get remainingCardsPerSeat() { return getRemainingCardsPerSeat(); },

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
    get biddingViewport(): BiddingViewport | null {
      if (!deal || !currentTurn) return null;
      const seat = userSeat ?? Seat.South;
      return buildBiddingViewport({
        deal,
        userSeat: seat,
        auction,
        bidHistory,
        legalCalls,
        faceUpSeats: getFaceUpSeats(),
        conventionName,
        isUserTurn,
        currentBidder: currentTurn,
      });
    },
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
    get declarerPromptViewport(): DeclarerPromptViewport | null {
      if (!deal || !contract || phase !== "DECLARER_PROMPT") return null;
      const seat = userSeat ?? Seat.South;
      const mode = getPromptMode();
      if (!mode) return null;
      return buildDeclarerPromptViewport({
        deal,
        userSeat: seat,
        faceUpSeats: getFaceUpSeats(),
        auction,
        bidHistory,
        contract,
        promptMode: mode,
      });
    },
    get playingViewport(): PlayingViewport | null {
      if (!deal || phase !== "PLAYING") return null;
      return buildPlayingViewport({
        deal,
        faceUpSeats: getFaceUpSeats(),
        auction,
        bidHistory,
        rotated: effectiveUserSeat === Seat.North,
        contract,
        currentPlayer,
        currentTrick,
        trumpSuit,
        legalPlays: legalPlaysForCurrentPlayer,
        userControlledSeats: getUserControlledSeats(),
        remainingCards: getRemainingCardsPerSeat(),
        tricks,
        declarerTricksWon,
        defenderTricksWon,
      });
    },
    get explanationViewport(): ExplanationViewport | null {
      if (!deal || phase !== "EXPLANATION") return null;
      const seat = userSeat ?? Seat.South;
      return buildExplanationViewport({
        deal,
        userSeat: seat,
        auction,
        bidHistory,
        contract,
        score,
        declarerTricksWon,
      });
    },

    // Namespaced sub-store accessors (backward compat)
    get bidding() {
      return {
        get auction() { return auction; },
        get bidHistory() { return bidHistory; },
        get bidFeedback() { return bidFeedback; },
        get legalCalls() { return legalCalls; },
        get currentTurn() { return currentTurn; },
        get isUserTurn() { return isUserTurn; },
      };
    },
    get play() {
      return {
        get tricks() { return tricks; },
        get currentTrick() { return currentTrick; },
        get currentPlayer() { return currentPlayer; },
        get declarerTricksWon() { return declarerTricksWon; },
        get defenderTricksWon() { return defenderTricksWon; },
        get dummySeat() { return dummySeat; },
        get score() { return score; },
        get trumpSuit() { return trumpSuit; },
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

      // When service handle is available, call startDrill to run initial AI bids
      let initialAiBids: readonly AiBidEntry[] | undefined;
      let initialLegalCalls: readonly Call[] | undefined;
      let initialAuctionComplete = false;
      if (activeHandle) {
        const startResult = await activeService.startDrill(activeHandle);
        initialAiBids = startResult.aiBids;
        initialLegalCalls = startResult.viewport.legalCalls;
        initialAuctionComplete = startResult.auctionComplete;
      }

      await initBidding(bundle, initialAiBids, initialLegalCalls, initialAuctionComplete);

      // Populate debug drawer with pre-bid snapshot from the service
      if (import.meta.env.DEV && activeHandle) {
        const log = await activeService.getDebugLog(activeHandle);
        debugLog = [...log] as DebugLogEntry[];
      }
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
