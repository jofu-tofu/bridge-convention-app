import type { Seat, Suit } from "../../engine/types";

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
  readonly hcpRange: { readonly min: number; readonly max: number };
  readonly suitLengths: Record<
    Suit,
    { readonly min: number; readonly max: number }
  >;
  readonly isBalanced: boolean | undefined;
}

/** A single condition entry extracted from the tree evaluation for inference consumption. */
export interface TreeInferenceConditionEntry {
  readonly type: string;
  readonly params: Record<string, number | string | boolean>;
  readonly negatable?: boolean;
}

/** Inference-ready data extracted from tree evaluation path and rejected branches. */
export interface TreeInferenceData {
  readonly pathConditions: readonly TreeInferenceConditionEntry[];
  readonly rejectedConditions: readonly TreeInferenceConditionEntry[];
}

/** Belief data for convention pipeline. Per-seat HCP ranges and suit length ranges. */
export interface BeliefData {
  readonly beliefs: Record<Seat, {
    readonly hcpRange: { readonly min: number; readonly max: number };
    readonly suitLengths: Record<Suit, { readonly min: number; readonly max: number }>;
  }>;
}
