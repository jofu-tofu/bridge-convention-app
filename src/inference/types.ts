import type { Seat, Auction, AuctionEntry, Call } from "../engine/types";
import type { HandInference, InferredHoldings, BidAlert } from "../shared/types";

// Re-export ConditionInference from its canonical location
export type { ConditionInference } from "../conventions/core/types";

// Re-export inference DTOs from shared (canonical location for cross-boundary types)
export type {
  SuitInference,
  HandInference,
  InferredHoldings,
} from "../shared/types";

/** Snapshot of inference state after a single bid is processed. */
export interface InferenceSnapshot {
  readonly entry: AuctionEntry;
  readonly newInference: HandInference | null;
  readonly cumulativeInferences: Record<Seat, InferredHoldings>;
}

/** Determines how a partnership's bids are interpreted. */
export interface InferenceProvider {
  readonly id: string;
  readonly name: string;
  /** Given a bid and auction state, what does it reveal? */
  inferFromBid(
    entry: AuctionEntry,
    auctionBefore: Auction,
    seat: Seat,
  ): HandInference | null;
}

// ─── Public belief state types ──────────────────────────────

/** Annotation for a single bid in the auction — what it means and what it reveals. */
export interface BidAnnotation {
  readonly call: Call;
  readonly seat: Seat;
  readonly ruleName: string | null;
  readonly conventionId: string | null;
  readonly meaning: string;
  readonly alert: BidAlert | null;
  readonly inferences: readonly HandInference[];
}

/** Public belief state — what a kibitzer can deduce from the auction. */
export interface PublicBeliefState {
  readonly beliefs: Record<Seat, InferredHoldings>;
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
  /** Opaque to the interface boundary — extractor implementations know the concrete shape. */
  readonly protocolResult?: unknown;
  readonly treeEvalResult?: unknown;
}

/**
 * Stable adapter for extracting HandInference[] from convention evaluation results.
 * Decouples public belief layer from evaluator internals (protocol/tree result shapes).
 * Current implementation: protocolInferenceExtractor (reads protocolResult/treeEvalResult).
 * Future: state machine evaluator provides its own implementation.
 */
export interface InferenceExtractor {
  extractInferences(result: InferenceExtractorInput, seat: Seat): readonly HandInference[];
}

/** Per-observer configuration: how does THIS observer interpret bids? */
export interface InferenceConfig {
  /** How to interpret own partnership's bids (convention-aware). */
  readonly ownPartnership: InferenceProvider;
  /** How to interpret opponent partnership's bids. */
  readonly opponentPartnership: InferenceProvider;
}
