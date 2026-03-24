import type { Auction, AuctionEntry, NumberRange, Seat, Suit } from "../engine/types";
import type { FactConstraint } from "../conventions/core/agreement-module";

export interface SuitInference {
  readonly minLength?: number;
  readonly maxLength?: number;
}

/** What a single bid reveals about the bidder's hand.
 *  Used internally by InferenceProvider (e.g. natural-inference) and partner-interpretation.
 *  For public beliefs, prefer FactConstraint[] — see PublicBeliefs. */
export interface HandInference {
  readonly seat: Seat;
  readonly minHcp?: number;
  readonly maxHcp?: number;
  readonly isBalanced?: boolean;
  readonly suits: Partial<Record<Suit, SuitInference>>;
  readonly source: string; // rule name or "natural"
}

// ─── Public beliefs (constraint-first representation) ────────

/** Qualitative constraint that doesn't reduce to a flat per-suit range.
 *  Displayed as-is in the debug UI (e.g. "Has 4-card major"). */
export interface QualitativeConstraint {
  readonly factId: string;
  readonly label: string;
  readonly operator: string;
  readonly value: unknown;
}

/** Derived display-friendly ranges computed from accumulated constraints. */
export interface DerivedRanges {
  readonly hcp: NumberRange;
  readonly suitLengths: Record<Suit, NumberRange>;
  readonly isBalanced: boolean | undefined;
}

/** Accumulated public knowledge about a seat's hand.
 *  Source of truth is `constraints` (lossless FactConstraint[]).
 *  `ranges` and `qualitative` are derived for display/querying. */
export interface PublicBeliefs {
  readonly seat: Seat;
  /** Raw constraints accumulated from all bids — canonical, lossless. */
  readonly constraints: readonly FactConstraint[];
  /** Derived display-friendly ranges (computed from constraints). */
  readonly ranges: DerivedRanges;
  /** Constraints that don't reduce to flat ranges — displayed as-is. */
  readonly qualitative: readonly QualitativeConstraint[];
}

/**
 * @deprecated Use PosteriorQueryPort (from posterior-query.ts) for modern belief queries.
 * Legacy belief data for convention pipeline. Per-seat HCP ranges and suit length ranges.
 */
export interface BeliefData {
  readonly beliefs: Record<Seat, {
    readonly hcpRange: NumberRange;
    readonly suitLengths: Record<Suit, NumberRange>;
  }>;
}

// ─── Inference strategy interface ────────────────────────────

/** Determines how a partnership's bids are interpreted.
 *  Implementations live in inference/ (natural-inference, partner-interpretation). */
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
