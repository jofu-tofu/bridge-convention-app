import { tick } from "svelte";
import type { EnginePort } from "../engine/port";
import type { Deal, Call, Auction, AuctionEntry, Seat } from "../engine/types";
import type { DrillSession } from "../bootstrap/types";
import { delay } from "../core/util/delay";
import type {
  BidResult,
  BidHistoryEntry,
  PracticalRecommendation,
  ConventionBiddingStrategy,
  StrategyEvaluation,
  TeachingProjection,
} from "../core/contracts";
import type { EncodingTrace } from "../core/contracts/provenance";
import { nextSeat } from "../engine/constants";
import { evaluateHand } from "../engine/hand-evaluator";
import { callsMatch } from "../engine/call-helpers";
import { createBiddingContext } from "../conventions/core";
import type { GameStoreOptions } from "./game.svelte";
import {
  BidGrade,
  resolveTeachingAnswer,
  gradeBid,
} from "../teaching/teaching-resolution";
import type { TeachingResolution } from "../teaching/teaching-resolution";

export type { BidHistoryEntry } from "../core/contracts";
export { BidGrade } from "../teaching/teaching-resolution";
export type { TeachingResolution } from "../teaching/teaching-resolution";

export interface BidFeedback {
  readonly grade: BidGrade;
  readonly userCall: Call;
  readonly expectedResult: BidResult | null;
  readonly teachingResolution: TeachingResolution | null;
  readonly practicalRecommendation?: PracticalRecommendation;
  readonly teachingProjection?: TeachingProjection;
  /** Encoding trace for the selected meaning (how it became a concrete call).
   *  Null when provenance is unavailable. */
  readonly encodingTrace?: EncodingTrace;
}

/** Aggregated debug snapshot — strategy evaluation plus the expected bid. */
export interface DebugSnapshot extends StrategyEvaluation {
  readonly expectedBid: BidResult | null;
}

/** A single entry in the persistent debug log — captures a snapshot at a specific moment. */
export interface DebugLogEntry {
  readonly kind: "pre-bid" | "user-bid" | "ai-bid";
  readonly turnIndex: number;
  readonly seat: Seat;
  readonly call?: Call;
  /** Pipeline state at this moment (null for AI bids). */
  readonly snapshot: DebugSnapshot;
  /** Feedback from grading (only on user-bid entries). */
  readonly feedback: BidFeedback | null;
}

const AI_BID_DELAY = 300;

/** Default empty evaluation — used when no strategy is wired or before first suggest(). */
const EMPTY_EVALUATION: StrategyEvaluation = {
  practicalRecommendation: null,
  acceptableAlternatives: undefined,
  intentFamilies: undefined,
  provenance: null,
  arbitration: null,
  posteriorSummary: null,
  explanationCatalog: undefined,
  teachingProjection: null,
  facts: null,
  machineSnapshot: null,
};

interface BiddingStoreConfig {
  deal: Deal;
  session: DrillSession;
  strategy: ConventionBiddingStrategy | null;
  initialAuction?: Auction;
  onAuctionComplete: (auction: Auction) => Promise<void>;
  onSkipToExplanation: (auction: Auction) => Promise<void>;
  onProcessBid?: (bid: AuctionEntry, auctionBefore: Auction, bidResult: BidResult | null) => void;
}

export function createBiddingStore(engine: EnginePort, options?: GameStoreOptions) {
  const delayFn = options?.delayFn ?? delay;
  let auction = $state<Auction>({ entries: [], isComplete: false });
  let currentTurn = $state<Seat | null>(null);
  let bidHistory = $state<BidHistoryEntry[]>([]);
  let isProcessing = $state(false);
  let legalCalls = $state<Call[]>([]);
  let bidFeedback = $state.raw<BidFeedback | null>(null);
  let error = $state<string | null>(null);
  let conventionStrategy: ConventionBiddingStrategy | null = null;

  // Persistent debug log — accumulates snapshots across the auction
  let debugLog = $state<DebugLogEntry[]>([]);
  let debugTurnCounter = 0;

  // Config set at init time — needs to be $state for $derived to track
  let activeDeal = $state<Deal | null>(null);
  let activeSession = $state<DrillSession | null>(null);
  let onAuctionComplete: ((auction: Auction) => Promise<void>) | null = null;
  let onSkipToExplanation: ((auction: Auction) => Promise<void>) | null = null;
  let onProcessBid: ((bid: AuctionEntry, auctionBefore: Auction, bidResult: BidResult | null) => void) | null = null;

  const isUserTurn = $derived(
    currentTurn !== null &&
      activeSession !== null &&
      activeSession.isUserSeat(currentTurn) &&
      !isProcessing,
  );

  /** True when bid feedback is showing and should block further input.
   *  Correct-path-only: any non-correct feedback blocks until retry. */
  const isFeedbackBlocking = $derived(
    bidFeedback !== null &&
      bidFeedback.grade !== BidGrade.Correct,
  );

  /** Build a DebugSnapshot from the convention strategy's cached state. */
  function captureSnapshot(): DebugSnapshot {
    const evaluation = conventionStrategy?.getLastEvaluation() ?? EMPTY_EVALUATION;
    return { expectedBid: null, ...evaluation };
  }

  /** Append a debug log entry. */
  function pushDebugLog(entry: DebugLogEntry) {
    debugLog = [...debugLog, entry];
  }

  async function runAiBids() {
    if (!activeSession || !activeDeal) return;
    isProcessing = true;
    try {
      while (currentTurn && !activeSession.isUserSeat(currentTurn)) {
        await delayFn(AI_BID_DELAY);

        const hand = activeDeal.hands[currentTurn];
        const result = activeSession.getNextBid(currentTurn, hand, auction);

        if (!result) break;

        const bidEntry = { seat: currentTurn, call: result.call };
        const auctionBefore = auction;
        let newAuction: Auction;
        try {
          newAuction = await engine.addCall(auction, bidEntry);
        } catch {
          break; // Stop AI bid loop — state stays consistent (bidHistory matches auction)
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
      isProcessing = false; await tick();
    }
  }

  async function userBidImpl(call: Call) {
    if (!activeDeal || !activeSession) {
      if (import.meta.env.DEV) {
        throw new Error("userBid called but store not initialized (no active deal/session)");
      }
      return;
    }
    if (isProcessing) return;
    if (!currentTurn || !activeSession.isUserSeat(currentTurn)) return;

    // No convention strategy at all — no correctness checking, let any bid through.
    if (!conventionStrategy) {
      await applyBidAndContinue(currentTurn, call, null);
      return;
    }

    const hand = activeDeal.hands[currentTurn];
    const evaluation = evaluateHand(hand);
    const expectedResult = conventionStrategy.suggest(
      createBiddingContext({ hand, auction, seat: currentTurn, evaluation }),
    );

    // Convention exhausted (no surfaces match) → expected bid is Pass.
    // Still grade so the user gets feedback instead of silently accepting any bid.
    const effectiveResult: BidResult = expectedResult ?? {
      call: { type: "pass" },
      ruleName: null,
      explanation: "No convention bid applies — pass",
    };

    const strategyEval = conventionStrategy.getLastEvaluation();
    const teachingResolution = resolveTeachingAnswer(
      effectiveResult,
      strategyEval?.acceptableAlternatives,
      strategyEval?.intentFamilies,
    );
    const grade = gradeBid(call, teachingResolution);
    const isCorrect = grade === BidGrade.Correct;

    bidFeedback = {
      grade,
      userCall: call,
      expectedResult: effectiveResult,
      teachingResolution,
      practicalRecommendation: strategyEval?.practicalRecommendation ?? undefined,
      teachingProjection: strategyEval?.teachingProjection ?? undefined,
      encodingTrace: strategyEval?.provenance?.encoding[0] ?? undefined,
    };

    // Capture persistent debug log entry — strategy caches are fresh right now
    if (import.meta.env.DEV) {
      const snap = captureSnapshot();
      pushDebugLog({
        kind: "user-bid",
        turnIndex: debugTurnCounter++,
        seat: currentTurn,
        call,
        snapshot: { ...snap, expectedBid: effectiveResult },
        feedback: bidFeedback,
      });
    }

    // Correct-path-only: wrong bids are never applied to the auction.
    // The user sees feedback and must retry until they get the correct bid.
    if (!isCorrect) {
      await tick();
      return;
    }

    await applyBidAndContinue(currentTurn, call, effectiveResult);
  }

  /** Apply a user bid to the auction and continue with AI bids. */
  async function applyBidAndContinue(seat: Seat, call: Call, expectedResult: BidResult | null) {
    const userBidEntry = { seat, call };
    const auctionBeforeUser = auction;
    let newAuction: Auction;
    try {
      newAuction = await engine.addCall(auction, userBidEntry);
    } catch (e) {
      bidFeedback = null;
      throw e;
    }
    auction = newAuction;

    onProcessBid?.(userBidEntry, auctionBeforeUser, expectedResult);

    bidHistory = [
      ...bidHistory,
      {
        seat,
        call,
        meaning: expectedResult?.meaning,
        isUser: true,
        isCorrect: expectedResult ? true : undefined,
        alertLabel: expectedResult?.alert?.teachingLabel,
        annotationType: expectedResult?.alert?.annotationType,
        teachingProjection: conventionStrategy?.getLastEvaluation()?.teachingProjection ?? undefined,
      },
    ];

    currentTurn = nextSeat(seat);

    const complete = await engine.isAuctionComplete(auction);
    if (complete) {
      await onAuctionComplete?.(auction);
      bidFeedback = null; await tick();
      return;
    }
    await runAiBids();
    bidFeedback = null; await tick();
  }

  /** Dismiss feedback and let the user try again.
   *  Correct-path-only: auction was never modified, so just clear feedback. */
  function retryBidImpl() {
    bidFeedback = null;
  }

  async function init(config: BiddingStoreConfig) {
    const { deal, session, strategy, initialAuction } = config;
    activeDeal = deal;
    activeSession = session;
    conventionStrategy = strategy;
    onAuctionComplete = config.onAuctionComplete;
    onSkipToExplanation = config.onSkipToExplanation;
    onProcessBid = config.onProcessBid ?? null;

    bidFeedback = null;
    error = null;

    if (initialAuction) {
      auction = initialAuction;
      bidHistory = initialAuction.entries.map((entry) => {
        // Add range announcement for 1NT opening (ACBL requires partner to announce "15 to 17")
        const is1NT = entry.call.type === "bid" && entry.call.level === 1 && entry.call.strain === "NT";
        return {
          seat: entry.seat,
          call: entry.call,
          isUser: false,
          alertLabel: is1NT ? "15 to 17" : undefined,
          annotationType: is1NT ? "announce" as const : undefined,
        };
      });
      const lastEntry =
        initialAuction.entries[initialAuction.entries.length - 1];
      currentTurn = lastEntry ? nextSeat(lastEntry.seat) : deal.dealer;

      // Replay initial auction through onProcessBid so inference engines
      // and public beliefs update for pre-set bids (e.g., 1NT opening).
      // Pass null bidResult so the natural inference provider handles them.
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
      currentTurn = deal.dealer;
    }

    await tick();
    await runAiBids();
  }

  function reset() {
    auction = { entries: [], isComplete: false };
    currentTurn = null;
    bidHistory = [];
    isProcessing = false;
    legalCalls = [];
    bidFeedback = null;
    error = null;
    conventionStrategy = null;
    activeDeal = null;
    activeSession = null;
    onAuctionComplete = null;
    onSkipToExplanation = null;
    onProcessBid = null;
    debugLog = [];
    debugTurnCounter = 0;
  }

  return {
    get auction() { return auction; },
    get currentTurn() { return currentTurn; },
    get bidHistory() { return bidHistory; },
    get isProcessing() { return isProcessing; },
    get isUserTurn() { return isUserTurn; },
    get isFeedbackBlocking() { return isFeedbackBlocking; },
    get legalCalls() { return legalCalls; },
    get bidFeedback() { return bidFeedback; },
    get error() { return error; },
    get debugLog() { return debugLog; },
    init,
    reset,
    userBid(call: Call): void {
      userBidImpl(call).catch((e: unknown) => {
        error = e instanceof Error ? e.message : "Unknown error during bid";
      });
    },
    retryBid(): void {
      retryBidImpl();
    },
    /** DEV: returns the expected bid result for the current user turn, or null */
    getExpectedBid(): BidResult | null {
      if (!activeDeal || !activeSession || !conventionStrategy || !currentTurn) return null;
      if (!activeSession.isUserSeat(currentTurn)) return null;
      const hand = activeDeal.hands[currentTurn];
      const evaluation = evaluateHand(hand);
      return conventionStrategy.suggest(
        createBiddingContext({ hand, auction, seat: currentTurn, evaluation }),
      );
    },
    /** DEV: returns all internal pipeline state from the most recent suggest() call.
     *  Calls suggest() first to ensure caches are populated, then reads all debug data. */
    getDebugSnapshot(): DebugSnapshot {
      if (!activeDeal || !activeSession || !conventionStrategy || !currentTurn) {
        return { expectedBid: null, ...EMPTY_EVALUATION };
      }
      if (!activeSession.isUserSeat(currentTurn)) {
        return { expectedBid: null, ...EMPTY_EVALUATION };
      }
      const hand = activeDeal.hands[currentTurn];
      const evaluation = evaluateHand(hand);
      const expectedBid = conventionStrategy.suggest(
        createBiddingContext({ hand, auction, seat: currentTurn, evaluation }),
      );
      const strategyEval = conventionStrategy.getLastEvaluation() ?? EMPTY_EVALUATION;
      return { expectedBid, ...strategyEval };
    },
  };
}
