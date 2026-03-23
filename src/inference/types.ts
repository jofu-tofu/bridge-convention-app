import type { Seat, AuctionEntry, Call } from "../engine/types";
import type { PublicBeliefs, BidAlert, InferenceProvider } from "../core/contracts";
import type { FactConstraint } from "../core/contracts/agreement-module";

// ConditionInference — structured inference metadata for condition → HandInference mapping.
// Previously lived in conventions/core/types; now owned by inference layer.
export interface ConditionInference {
  readonly type:
    | "hcp-min"
    | "hcp-max"
    | "hcp-range"
    | "suit-min"
    | "suit-max"
    | "balanced"
    | "not-balanced"
    | "two-suited";
  readonly params: Record<string, unknown>;
}

// Re-export inference DTOs from contracts (canonical location for cross-boundary types)
export type {
  SuitInference,
  HandInference,
  PublicBeliefs,
  DerivedRanges,
  QualitativeConstraint,
  InferenceProvider,
} from "../core/contracts";

/** Snapshot of inference state after a single bid is processed. */
export interface InferenceSnapshot {
  readonly entry: AuctionEntry;
  readonly newConstraints: readonly FactConstraint[];
  readonly cumulativeBeliefs: Record<Seat, PublicBeliefs>;
}

// ─── Public belief state types ──────────────────────────────

/** Annotation for a single bid in the auction — what it means and what it reveals. */
export interface BidAnnotation {
  readonly call: Call;
  readonly seat: Seat;
  readonly conventionId: string | null;
  readonly meaning: string;
  readonly constraints: readonly FactConstraint[];
}

/** Public belief state — what a kibitzer can deduce from the auction. */
export interface PublicBeliefState {
  readonly beliefs: Record<Seat, PublicBeliefs>;
  readonly annotations: readonly BidAnnotation[];
}

/** Narrow input for inference extraction — minimal typed contract, no conventions/core import.
 *  Captures the fields that annotation-producer and stores read directly.
 *  The extractor implementation may internally narrow to richer types. */
export interface InferenceExtractorInput {
  readonly rule: string;
  readonly explanation: string;
  readonly meaning?: string;
  readonly alert?: BidAlert | null;
  /** All constraints from the winning surface's clauses, with isPublic preserved. */
  readonly constraints?: readonly FactConstraint[];
}

/**
 * Stable adapter for extracting FactConstraint[] from convention evaluation results.
 * Decouples public belief layer from evaluator internals.
 * Current implementation: noop-extractor (placeholder) or posterior engine.
 */
export interface InferenceExtractor {
  extractConstraints(result: InferenceExtractorInput, seat: Seat): readonly FactConstraint[];
}

/** Per-observer configuration: how does THIS observer interpret bids? */
export interface InferenceConfig {
  /** How to interpret own partnership's bids (convention-aware). */
  readonly ownPartnership: InferenceProvider;
  /** How to interpret opponent partnership's bids. */
  readonly opponentPartnership: InferenceProvider;
}
