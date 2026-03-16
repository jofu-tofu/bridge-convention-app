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

export interface HcpRangeFactor {
  readonly kind: "hcp-range";
  readonly seat: string;
  readonly min: number;
  readonly max: number;
  readonly strength: FactorStrength;
  readonly origin: FactorOrigin;
}

export interface SuitLengthFactor {
  readonly kind: "suit-length";
  readonly seat: string;
  readonly suit: SuitName;
  readonly min: number;
  readonly max: number;
  readonly strength: FactorStrength;
  readonly origin: FactorOrigin;
}

export interface ShapeFactor {
  readonly kind: "shape";
  readonly seat: string;
  readonly pattern: string; // "balanced", "semi-balanced", etc.
  readonly strength: FactorStrength;
  readonly origin: FactorOrigin;
}

export interface ExclusionFactor {
  readonly kind: "exclusion";
  readonly seat: string;
  readonly constraint: string; // description of what's excluded
  readonly strength: FactorStrength;
  readonly origin: FactorOrigin;
}

export interface FitFactor {
  readonly kind: "fit";
  readonly seats: readonly string[];
  readonly suit: SuitName;
  readonly minCombined: number;
  readonly strength: FactorStrength;
  readonly origin: FactorOrigin;
}

// ─── Ambiguity schema ───────────────────────────────────────
export interface AmbiguityAlternativeIR {
  readonly branchId: string;
  readonly meaningId: string;
  readonly description: string;
}

export interface AmbiguityFamilyIR {
  readonly familyId: string;
  readonly alternatives: readonly AmbiguityAlternativeIR[];
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
export interface FactorGraphIR {
  readonly factors: readonly FactorSpec[];
  readonly ambiguitySchema: readonly AmbiguityFamilyIR[];
  readonly evidencePins: readonly EvidencePin[];
}
