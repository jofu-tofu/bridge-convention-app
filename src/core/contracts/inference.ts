import type { NumberRange, Seat, Suit } from "../../engine/types";

export interface SuitInference {
  readonly minLength?: number;
  readonly maxLength?: number;
}

/** What a single bid reveals about the bidder's hand. */
export interface HandInference {
  readonly seat: Seat;
  readonly minHcp?: number;
  readonly maxHcp?: number;
  readonly isBalanced?: boolean;
  readonly suits: Partial<Record<Suit, SuitInference>>;
  readonly source: string; // rule name or "natural"
}

/** Accumulated view of what's known about a hand. */
export interface InferredHoldings {
  readonly seat: Seat;
  readonly inferences: readonly HandInference[];
  /** Merged view (computed from all inferences). */
  readonly hcpRange: NumberRange;
  readonly suitLengths: Record<Suit, NumberRange>;
  readonly isBalanced: boolean | undefined;
}

/** Belief data for convention pipeline. Per-seat HCP ranges and suit length ranges. */
export interface BeliefData {
  readonly beliefs: Record<Seat, {
    readonly hcpRange: NumberRange;
    readonly suitLengths: Record<Suit, NumberRange>;
  }>;
}
