import type { Auction, AuctionEntry } from "../engine/types";
import type { Seat } from "../engine/types";
import type { BidResult } from "../conventions";
import type { PublicBeliefs } from "./inference-types";
import type { InferenceEngine } from "./inference-engine";
import type { InferenceExtractor, InferenceExtractorInput, InferenceSnapshot, PublicBeliefState } from "./types";
import { createInitialBeliefState, applyAnnotation } from "./belief-accumulator";
import { produceAnnotation } from "./annotation-producer";
import { noopExtractor } from "./noop-extractor";
import { createNaturalInferenceProvider } from "./natural-inference";
import type { SystemConfig } from "../conventions/definitions/system-config";

// ── Helpers ─────────────────────────────────────────────────────────

/** Adapt BidResult (shared DTO) to InferenceExtractorInput. */
function toExtractorInput(bidResult: BidResult): InferenceExtractorInput {
  return {
    rule: bidResult.ruleName ?? "unknown",
    explanation: bidResult.explanation,
    meaning: bidResult.meaning,
    alert: bidResult.alert ?? null,
    constraints: bidResult.constraints ?? [],
  };
}

// ── InferenceCoordinator ────────────────────────────────────────────

export interface InferenceCoordinator {
  /** Set the NS and EW inference engines for a new drill. */
  initialize(nsEngine: InferenceEngine | null, ewEngine: InferenceEngine | null): void;

  /**
   * Process a bid through both inference engines and update belief state.
   * Returns the updated PublicBeliefState so the caller can store it reactively.
   */
  processBid(
    entry: AuctionEntry,
    auctionBefore: Auction,
    bidResult: BidResult | null,
    conventionId: string | null,
  ): PublicBeliefState;

  /** Capture inferences from both engines at auction end. Returns null if no engines. */
  capturePlayInferences(): Record<Seat, PublicBeliefs> | null;

  /** Current public belief state. */
  getPublicBeliefState(): PublicBeliefState;

  /** NS inference timeline snapshots. */
  getNSTimeline(): readonly InferenceSnapshot[];

  /** EW inference timeline snapshots. */
  getEWTimeline(): readonly InferenceSnapshot[];

  /** Reset all inference state. */
  reset(): void;
}

/**
 * Create an InferenceCoordinator that manages inference engine lifecycle,
 * bid processing, annotation production, and public belief accumulation.
 *
 * The coordinator is a plain (non-reactive) service. The game store holds
 * reactive proxies that read from it.
 */
export function createInferenceCoordinator(
  extractor: InferenceExtractor = noopExtractor,
  systemConfig?: SystemConfig,
): InferenceCoordinator {
  let nsEngine: InferenceEngine | null = null;
  let ewEngine: InferenceEngine | null = null;
  let beliefState: PublicBeliefState = createInitialBeliefState();
  const naturalProvider = createNaturalInferenceProvider(systemConfig);

  return {
    initialize(ns, ew) {
      nsEngine = ns;
      ewEngine = ew;
      beliefState = createInitialBeliefState();
    },

    processBid(entry, auctionBefore, bidResult, conventionId) {
      nsEngine?.processBid(entry, auctionBefore);
      ewEngine?.processBid(entry, auctionBefore);

      const extractorInput = bidResult ? toExtractorInput(bidResult) : null;
      const annotation = produceAnnotation(
        entry,
        extractorInput,
        bidResult?.ruleName ? conventionId : null,
        extractor,
        naturalProvider,
        auctionBefore,
      );
      beliefState = applyAnnotation(beliefState, annotation);
      return beliefState;
    },

    capturePlayInferences() {
      if (!nsEngine && !ewEngine) return null;
      const nsBeliefs = nsEngine?.getBeliefs() ?? {};
      const ewBeliefs = ewEngine?.getBeliefs() ?? {};
      return { ...nsBeliefs, ...ewBeliefs } as Record<Seat, PublicBeliefs>;
    },

    getPublicBeliefState() {
      return beliefState;
    },

    getNSTimeline() {
      return nsEngine?.getTimeline() ?? [];
    },

    getEWTimeline() {
      return ewEngine?.getTimeline() ?? [];
    },

    reset() {
      nsEngine = null;
      ewEngine = null;
      beliefState = createInitialBeliefState();
    },
  };
}
