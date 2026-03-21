import type { Hand, SuitName } from "../../engine/types";
import type { PublicConstraint, PublicEvent } from "./agreement-module";

// ─── Factor strength ────────────────────────────────────────
/** Whether a factor is a hard constraint (rejection) or soft evidence (weighting). */
export type FactorStrength = "hard" | "soft";

// ─── Factor origin (compilation trace) ──────────────────────
/** Maps a compiled factor back to its pedagogical source. */
export interface FactorOrigin {
  readonly sourceConstraint?: PublicConstraint;
  readonly sourceMeaning?: string;
  readonly sourceModule?: string;
  readonly originKind:
    | "call-meaning"
    | "entailed-denial";
}

// ─── Factor specifications (discriminated union) ────────────
export type FactorSpec =
  | HcpRangeFactor
  | SuitLengthFactor
  | ShapeFactor
  | ExclusionFactor
  | FitFactor;

/** Common properties shared by all factor types. */
export interface BaseFactor {
  readonly strength: FactorStrength;
  readonly origin: FactorOrigin;
}

/** Factor constrained to a single seat. */
export interface SingleSeatFactor extends BaseFactor {
  readonly seat: string;
}

export interface HcpRangeFactor extends SingleSeatFactor {
  readonly kind: "hcp-range";
  readonly min: number;
  readonly max: number;
}

export interface SuitLengthFactor extends SingleSeatFactor {
  readonly kind: "suit-length";
  readonly suit: SuitName;
  readonly min: number;
  readonly max: number;
}

export interface ShapeFactor extends SingleSeatFactor {
  readonly kind: "shape";
  readonly pattern: string; // "balanced", "semi-balanced", etc.
}

export interface ExclusionFactor extends SingleSeatFactor {
  readonly kind: "exclusion";
  readonly constraint: string; // description of what's excluded
}

export interface FitFactor extends BaseFactor {
  readonly kind: "fit";
  readonly seats: readonly string[];
  readonly suit: SuitName;
  readonly minCombined: number;
}

// ─── Ambiguity schema ───────────────────────────────────────
export interface AmbiguityAlternative {
  readonly branchId: string;
  readonly meaningId: string;
  readonly description: string;
}

export interface AmbiguityFamily {
  readonly familyId: string;
  readonly alternatives: readonly AmbiguityAlternative[];
  readonly exclusivity: "xor" | "or";
}

// ─── Evidence pins ──────────────────────────────────────────
export type EvidencePin = OwnHandPin | AuctionRecordPin | AlertPin;

export interface OwnHandPin {
  readonly kind: "own-hand";
  readonly seat: string;
  readonly hand: Hand;
}

export interface AuctionRecordPin {
  readonly kind: "auction-record";
  readonly events: readonly PublicEvent[];
}

export interface AlertPin {
  readonly kind: "alert";
  readonly seat: string;
  readonly message: string;
}

// ─── Factor Graph IR ────────────────────────────────────────
/** The compiled, convention-erased IR passed to the posterior backend. */
export interface FactorGraph {
  readonly factors: readonly FactorSpec[];
  readonly ambiguitySchema: readonly AmbiguityFamily[];
  readonly evidencePins: readonly EvidencePin[];
}
