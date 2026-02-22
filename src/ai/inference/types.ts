import type { Seat, Auction, AuctionEntry } from "../../engine/types";
import type { HandInference, InferredHoldings } from "../../shared/types";

// Re-export ConditionInference from its canonical location
export type { ConditionInference } from "../../conventions/types";

// Re-export inference DTOs from shared (canonical location for cross-boundary types)
export type {
  SuitInference,
  HandInference,
  InferredHoldings,
} from "../../shared/types";

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

/** Per-observer configuration: how does THIS observer interpret bids? */
export interface InferenceConfig {
  /** How to interpret own partnership's bids (convention-aware). */
  readonly ownPartnership: InferenceProvider;
  /** How to interpret opponent partnership's bids. */
  readonly opponentPartnership: InferenceProvider;
}
