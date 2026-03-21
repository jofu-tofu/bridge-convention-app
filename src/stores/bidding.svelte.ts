import { tick } from "svelte";
import type { EnginePort } from "../engine/port";
import type { Deal, Call, Auction, AuctionEntry, Seat } from "../engine/types";
import { BidSuit } from "../engine/types";
import type { DrillSession } from "../service";
import { delay } from "../core/util/delay";
import type {
  BidResult,
  BidHistoryEntry,
  ConventionBiddingStrategy,
  StrategyEvaluation,
} from "../core/contracts";
import { nextSeat } from "../engine/constants";

import type { DevServicePort, SessionHandle, AiBidEntry } from "../service";
import type { ViewportBidFeedback, TeachingDetail } from "../core/viewport";
import type { ViewportBidGrade } from "../core/viewport/player-viewport";

import type { GameStoreOptions } from "./game.svelte";

export type { BidHistoryEntry } from "../core/contracts";
export type { TeachingResolution } from "../core/contracts";

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

import type { BidFeedbackDTO } from "../service";

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

const AI_BID_DELAY = 300;

/** Default empty evaluation — used when no strategy is wired or before first suggest(). */
const EMPTY_EVALUATION: StrategyEvaluation = {
  practicalRecommendation: null,
  acceptableAlternatives: null,
  intentFamilies: null,
  provenance: null,
  arbitration: null,
  posteriorSummary: null,
  explanationCatalog: null,
  teachingProjection: null,
  facts: null,
  machineSnapshot: null,
  auctionContext: null,
};

export interface BiddingStoreConfig {
  deal: Deal;
  session: DrillSession;
  strategy: ConventionBiddingStrategy | null;
  initialAuction?: Auction;
  onAuctionComplete: (auction: Auction) => Promise<void>;
  onSkipToExplanation: (auction: Auction) => Promise<void>;
  onProcessBid?: (bid: AuctionEntry, auctionBefore: Auction, bidResult: BidResult | null) => void;
  /** Service for bid delegation. When provided, userBid delegates to service.submitBid(). */
  service?: DevServicePort;
  /** Session handle for the current drill. Required when service is provided. */
  handle?: SessionHandle;
  /** Pre-computed initial AI bids from service.startDrill(). Animated on init instead of running local AI bid loop. */
  initialAiBids?: readonly AiBidEntry[];
  /** Legal calls for the user's first turn (from DrillStartResult.viewport.legalCalls). */
  initialLegalCalls?: readonly Call[];
  /** True when the auction completed during initial AI bids (service detected completion). */
  initialAuctionComplete?: boolean;
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

  // Persistent debug log — accumulates snapshots across the auction
  let debugLog = $state<DebugLogEntry[]>([]);

  // Config set at init time — needs to be $state for $derived to track
  let activeDeal = $state<Deal | null>(null);
  let activeSession = $state<DrillSession | null>(null);
  let onAuctionComplete: ((auction: Auction) => Promise<void>) | null = null;
  let _onSkipToExplanation: ((auction: Auction) => Promise<void>) | null = null;
  let onProcessBid: ((bid: AuctionEntry, auctionBefore: Auction, bidResult: BidResult | null) => void) | null = null;

  // Service delegation (set at init when available)
  let activeService: DevServicePort | null = null;
  let activeHandle: SessionHandle | null = null;

  const isUserTurn = $derived(
    currentTurn !== null &&
      activeSession !== null &&
      activeSession.isUserSeat(currentTurn) &&
      !isProcessing,
  );

  /** True when bid feedback is showing and should block further input. */
  const isFeedbackBlocking = $derived(
    bidFeedback !== null &&
      bidFeedback.grade !== "correct",
  );

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

  /** Animate AI bids from a service response one at a time with delays. */
  async function animateAiBids(aiBids: readonly AiBidEntry[]) {
    for (const aiBid of aiBids) {
      await delayFn(AI_BID_DELAY);

      // Update local state from service response
      auction = {
        entries: [...auction.entries, { seat: aiBid.seat, call: aiBid.call }],
        isComplete: false,
      };
      bidHistory = [...bidHistory, aiBid.historyEntry];
      currentTurn = nextSeat(aiBid.seat);
    }
  }

  /** Service-delegated bid submission. */
  async function userBidViaService(call: Call) {
    if (!activeService || !activeHandle || !activeSession) return;
    if (isProcessing) return;
    if (!currentTurn || !activeSession.isUserSeat(currentTurn)) return;

    isProcessing = true;
    try {
      const result = await activeService.submitBid(activeHandle, call);

      if (!result.accepted) {
        // Wrong bid — show viewport-safe feedback, don't modify auction
        if (result.feedback && result.grade) {
          bidFeedback = {
            grade: result.grade,
            viewportFeedback: result.feedback,
            teaching: result.teaching,
          };
        }
        // Update debug log from service
        if (import.meta.env.DEV) {
          const log = await activeService.getDebugLog(activeHandle);
          debugLog = [...log] as DebugLogEntry[];
        }
        await tick();
        return;
      }

      // Correct bid — update local state
      bidFeedback = null;

      // Add user's bid to local auction/history
      if (result.userHistoryEntry) {
        auction = {
          entries: [...auction.entries, { seat: result.userHistoryEntry.seat, call: result.userHistoryEntry.call }],
          isComplete: false,
        };
        bidHistory = [...bidHistory, result.userHistoryEntry];
        currentTurn = nextSeat(result.userHistoryEntry.seat);
      }

      // Update debug log from service
      if (import.meta.env.DEV) {
        const log = await activeService.getDebugLog(activeHandle);
        debugLog = [...log] as DebugLogEntry[];
      }

      // Check for phase transition (auction complete)
      if (result.phaseTransition) {
        auction = { ...auction, isComplete: true };
        await onAuctionComplete?.(auction);
        await tick();
        return;
      }

      // Animate AI bids with delays
      await animateAiBids(result.aiBids);

      // After AI bids, check for phase transition from AI completing auction
      if (result.aiBids.length > 0) {
        // Re-check: the service may have detected auction completion during AI bids
        const phase = await activeService.getPhase(activeHandle);
        if (phase !== "BIDDING") {
          auction = { ...auction, isComplete: true };
          await onAuctionComplete?.(auction);
          await tick();
          return;
        }
      }

      // Update legal calls from next viewport
      if (result.nextViewport) {
        legalCalls = [...result.nextViewport.legalCalls];
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "Unknown error during bid";
    } finally {
      isProcessing = false; await tick();
    }
  }

  /** Dismiss feedback and let the user try again.
   *  Correct-path-only: auction was never modified, so just clear feedback. */
  function retryBidImpl() {
    bidFeedback = null;
  }

  async function init(config: BiddingStoreConfig) {
    const { deal, session, initialAuction } = config;
    activeDeal = deal;
    activeSession = session;
    onAuctionComplete = config.onAuctionComplete;
    _onSkipToExplanation = config.onSkipToExplanation;
    onProcessBid = config.onProcessBid ?? null;

    // Service delegation
    activeService = config.service ?? null;
    activeHandle = config.handle ?? null;

    bidFeedback = null;
    error = null;
    debugLog = [];

    if (initialAuction) {
      auction = initialAuction;
      bidHistory = initialAuction.entries.map((entry) => {
        // Add range announcement for 1NT opening (ACBL requires partner to announce "15 to 17")
        const is1NT = entry.call.type === "bid" && entry.call.level === 1 && entry.call.strain === BidSuit.NoTrump;
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

    // When service is wired, AI bids come pre-computed from service.startDrill().
    // Animate them and set legal calls from the result.
    if (activeService && config.initialAiBids) {
      await animateAiBids(config.initialAiBids);
      if (config.initialAuctionComplete) {
        // Auction completed during initial AI bids — notify game store
        await onAuctionComplete?.(auction);
      } else if (config.initialLegalCalls) {
        legalCalls = [...config.initialLegalCalls];
      }
    } else {
      // Legacy local path (tests without service): run AI bids via engine
      await runAiBids();
    }
  }

  function reset() {
    auction = { entries: [], isComplete: false };
    currentTurn = null;
    bidHistory = [];
    isProcessing = false;
    legalCalls = [];
    bidFeedback = null;
    error = null;
    activeDeal = null;
    activeSession = null;
    onAuctionComplete = null;
    _onSkipToExplanation = null;
    onProcessBid = null;
    activeService = null;
    activeHandle = null;
    debugLog = [];
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
      userBidViaService(call).catch((e: unknown) => {
        error = e instanceof Error ? e.message : "Unknown error during bid";
      });
    },
    retryBid(): void {
      retryBidImpl();
    },
    /** DEV: returns the expected bid for the current user turn, or null. */
    async getExpectedBid(): Promise<{ call: Call } | null> {
      if (!activeService || !activeHandle) return null;
      return activeService.getExpectedBid(activeHandle);
    },
    /** DEV: returns all internal pipeline state from the most recent suggest() call. */
    async getDebugSnapshot(): Promise<DebugSnapshot> {
      if (!activeService || !activeHandle) {
        return { expectedBid: null, ...EMPTY_EVALUATION };
      }
      const snap = await activeService.getDebugSnapshot(activeHandle);
      return { ...snap, expectedBid: null };
    },
  };
}
