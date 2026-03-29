/**
 * Bidding-phase sub-module.
 *
 * Owns all reactive state, derived values, and async logic for the bidding
 * lifecycle. Created via `createBiddingPhase()` and called from the game
 * store coordinator.
 */

import { tick } from "svelte";

import type { Call, Seat } from "../service";
import { nextSeat, ViewportBidGrade } from "../service";
import type { DevServicePort, SessionHandle } from "../service";
import type { BiddingViewport, AuctionEntryView } from "../service";
import type { GamePhase } from "../service";
import type { ServicePublicBeliefState, ServicePublicBeliefs } from "../service";
import { formatError } from "../service/util/format-error";

// Type-only import — no runtime circular dependency.
import type { BidFeedback, DebugLogEntry } from "./game.svelte";

// ── Internal state shape ────────────────────────────────────────────

interface BiddingPhaseState {
  processing: boolean;
  error: string | null;
  debugLog: DebugLogEntry[];
}

// ── Dependency contract ─────────────────────────────────────────────

export interface BiddingDeps {
  getActiveHandle: () => SessionHandle | null;
  getActiveService: () => DevServicePort;
  getPhase: () => string;
  getBiddingViewport: () => BiddingViewport | null;
  setBiddingViewport: (vp: BiddingViewport) => void;
  setPublicBeliefState: (state: ServicePublicBeliefState) => void;
  handlePostAuction: (handle: SessionHandle, phase: GamePhase, options?: { playInferences?: Record<Seat, ServicePublicBeliefs> | null }) => Promise<boolean>;
  delayFn: (ms: number) => Promise<void>;
}

// ── Factory ─────────────────────────────────────────────────────────

export function createBiddingPhase(deps: BiddingDeps) {
  // ── State ───────────────────────────────────────────────────────
  let bidFeedback = $state<BidFeedback | null>(null);
  let bidding = $state<BiddingPhaseState>({ processing: false, error: null, debugLog: [] });
  let sessionStats = $state({ correct: 0, incorrect: 0, streak: 0 });
  let isRetryAttempt = false;
  let biddingAnim = $state<{ totalAiBids: number; revealed: number } | null>(null);

  // ── Derived ─────────────────────────────────────────────────────

  const displayedAuctionEntries = $derived.by((): readonly AuctionEntryView[] => {
    const vp = deps.getBiddingViewport();
    if (!vp) return [];
    if (!biddingAnim) return vp.auctionEntries;
    const baseCount = vp.auctionEntries.length - biddingAnim.totalAiBids;
    return vp.auctionEntries.slice(0, baseCount + biddingAnim.revealed);
  });

  const displayedLegalCalls = $derived.by((): readonly Call[] => {
    if (bidding.processing || biddingAnim) return [];
    return deps.getBiddingViewport()?.legalCalls ?? [];
  });

  const displayedCurrentBidder = $derived.by((): Seat | null => {
    const vp = deps.getBiddingViewport();
    if (!vp) return null;
    if (!biddingAnim) return vp.currentBidder;
    // During animation, derive current bidder from the last displayed entry
    const displayed = displayedAuctionEntries;
    if (displayed.length === 0) return vp.dealer;
    return nextSeat(displayed[displayed.length - 1]!.seat);
  });

  const displayedIsUserTurn = $derived(
    !bidding.processing &&
    !biddingAnim &&
    deps.getPhase() === "BIDDING" &&
    deps.getBiddingViewport() !== null &&
    deps.getBiddingViewport()!.isUserTurn,
  );

  // Grade-acceptance policy: only near-miss/incorrect block.
  // Acceptable/correct-not-preferred show non-blocking feedback below bid table.
  const isFeedbackBlocking = $derived(
    bidFeedback !== null &&
      (bidFeedback.grade === ViewportBidGrade.NearMiss || bidFeedback.grade === ViewportBidGrade.Incorrect),
  );

  // ── Actions ─────────────────────────────────────────────────────

  async function userBidViaService(call: Call) {
    const activeHandle = deps.getActiveHandle();
    if (!activeHandle) return;
    if (bidding.processing) return;
    if (!displayedIsUserTurn) return;

    // Capture and clear retry flag early — prevents leak if submitBid throws
    const skipTracking = isRetryAttempt;
    isRetryAttempt = false;

    // Clear non-blocking feedback from previous bid (acceptable/correct-not-preferred)
    if (bidFeedback && !isFeedbackBlocking) {
      bidFeedback = null;
    }

    const handle = activeHandle;
    const activeService = deps.getActiveService();
    bidding.processing = true;
    try {
      const result = await activeService.submitBid(handle, call);
      if (deps.getActiveHandle() !== handle) return; // cancelled

      if (!result.accepted) {
        if (result.feedback && result.grade) {
          bidFeedback = {
            grade: result.grade,
            viewportFeedback: result.feedback,
            teaching: result.teaching,
          };
        }
        // Track incorrect/near-miss (first attempt only)
        if (!skipTracking && result.grade) {
          sessionStats = { ...sessionStats, incorrect: sessionStats.incorrect + 1, streak: 0 };
        }
        if (import.meta.env.DEV) {
          const log = await activeService.getDebugLog(handle);
          bidding.debugLog = [...log] as DebugLogEntry[];
        }
        await tick();
        return;
      }

      // Show non-blocking feedback for all accepted bids (correct, acceptable, correct-not-preferred)
      if (result.grade && result.feedback) {
        bidFeedback = {
          grade: result.grade,
          viewportFeedback: result.feedback,
          teaching: result.teaching,
        };
      } else {
        bidFeedback = null;
      }

      // Track correct/acceptable (first attempt only)
      if (!skipTracking && result.grade) {
        sessionStats = { ...sessionStats, correct: sessionStats.correct + 1, streak: sessionStats.streak + 1 };
      }

      // Update viewport — always non-null for accepted bids (PR 0 fix)
      if (result.nextViewport) {
        deps.setBiddingViewport(result.nextViewport);
      }

      if (import.meta.env.DEV) {
        const log = await activeService.getDebugLog(handle);
        bidding.debugLog = [...log] as DebugLogEntry[];
      }

      // Animate AI bids via incremental reveal
      if (result.aiBids.length > 0) {
        biddingAnim = { totalAiBids: result.aiBids.length, revealed: 0 };

        for (let i = 0; i < result.aiBids.length; i++) {
          await deps.delayFn(300);
          if (deps.getActiveHandle() !== handle) return; // cancelled — bail
          biddingAnim = { totalAiBids: result.aiBids.length, revealed: i + 1 };
        }
        biddingAnim = null;
      }

      // Fetch belief state from service (single source of truth for inference)
      deps.setPublicBeliefState(await activeService.getPublicBeliefState(handle));
      if (deps.getActiveHandle() !== handle) return;

      // Handle phase transition (auction complete — phaseTransition is always set when auction ends)
      if (result.phaseTransition) {
        const ok = await deps.handlePostAuction(handle, result.phaseTransition.to, { playInferences: result.playInferences });
        if (!ok || deps.getActiveHandle() !== handle) return;
        await tick();
        return;
      }
    } catch (e) {
      bidding.error = formatError(e);
    } finally {
      bidding.processing = false;
      await tick();
    }
  }

  function retryBid() {
    isRetryAttempt = true;
    bidFeedback = null;
  }

  // ── Public surface ──────────────────────────────────────────────

  return {
    // State accessors
    get bidFeedback() { return bidFeedback; },
    set bidFeedback(v: BidFeedback | null) { bidFeedback = v; },
    get bidding() { return bidding; },
    set bidding(v: BiddingPhaseState) { bidding = v; },
    get sessionStats() { return sessionStats; },
    set sessionStats(v: { correct: number; incorrect: number; streak: number }) { sessionStats = v; },
    get biddingAnim() { return biddingAnim; },
    set biddingAnim(v: { totalAiBids: number; revealed: number } | null) { biddingAnim = v; },

    // Derived (read-only)
    get displayedAuctionEntries() { return displayedAuctionEntries; },
    get displayedLegalCalls() { return displayedLegalCalls; },
    get displayedCurrentBidder() { return displayedCurrentBidder; },
    get displayedIsUserTurn() { return displayedIsUserTurn; },
    get isFeedbackBlocking() { return isFeedbackBlocking; },

    // Actions
    userBidViaService,
    retryBid,

    // Lifecycle
    reset() {
      bidFeedback = null;
      bidding = { processing: false, error: null, debugLog: [] };
      sessionStats = { correct: 0, incorrect: 0, streak: 0 };
      isRetryAttempt = false;
      biddingAnim = null;
    },
  };
}

export type BiddingPhase = ReturnType<typeof createBiddingPhase>;
