// Derive PublicBeliefs from accumulated FactConstraintIR[].
// Replaces the old mergeInferences() approach with a lossless constraint-first model.

import type { Seat, Suit } from "../engine/types";
import { Suit as SuitEnum } from "../engine/types";
import type { FactConstraintIR } from "../core/contracts/agreement-module";
import type { PublicBeliefs, DerivedRanges, QualitativeConstraint } from "../core/contracts/inference";

const ALL_SUITS: Suit[] = [SuitEnum.Spades, SuitEnum.Hearts, SuitEnum.Diamonds, SuitEnum.Clubs];

/** Map factId suffix → engine Suit value for suit-length constraints. */
const SUIT_SUFFIX: Record<string, Suit> = {
  spades: SuitEnum.Spades,
  hearts: SuitEnum.Hearts,
  diamonds: SuitEnum.Diamonds,
  clubs: SuitEnum.Clubs,
};

/** Known qualitative factIds and their human-readable labels. */
const QUALITATIVE_LABELS: Record<string, string> = {
  "bridge.hasFourCardMajor": "Has 4-card major",
  "bridge.hasFiveCardMajor": "Has 5-card major",
  "bridge.hasShortage": "Has shortage (0-1 in a suit)",
};

/**
 * Derive PublicBeliefs from accumulated constraints for a single seat.
 * Source of truth is always the raw constraints array — ranges and
 * qualitative labels are computed from it.
 */
export function derivePublicBeliefs(
  seat: Seat,
  constraints: readonly FactConstraintIR[],
): PublicBeliefs {
  return {
    seat,
    constraints,
    ranges: deriveRanges(constraints),
    qualitative: deriveQualitative(constraints),
  };
}

/**
 * Compute flat display-friendly ranges from constraints.
 * Handles: hand.hcp, hand.suitLength.*, hand.isBalanced.
 */
function deriveRanges(constraints: readonly FactConstraintIR[]): DerivedRanges {
  let hcpMin = 0;
  let hcpMax = 40;
  let balanced: boolean | undefined;

  const suitMins: Record<string, number> = {
    [SuitEnum.Spades]: 0,
    [SuitEnum.Hearts]: 0,
    [SuitEnum.Diamonds]: 0,
    [SuitEnum.Clubs]: 0,
  };
  const suitMaxes: Record<string, number> = {
    [SuitEnum.Spades]: 13,
    [SuitEnum.Hearts]: 13,
    [SuitEnum.Diamonds]: 13,
    [SuitEnum.Clubs]: 13,
  };

  for (const c of constraints) {
    // HCP
    if (c.factId === "hand.hcp") {
      if (c.operator === "gte" && typeof c.value === "number") {
        hcpMin = Math.max(hcpMin, c.value);
      } else if (c.operator === "lte" && typeof c.value === "number") {
        hcpMax = Math.min(hcpMax, c.value);
      } else if (c.operator === "range" && typeof c.value === "object" && c.value !== null && "min" in c.value) {
        const range = c.value as { min: number; max: number };
        hcpMin = Math.max(hcpMin, range.min);
        hcpMax = Math.min(hcpMax, range.max);
      }
      continue;
    }

    // Suit lengths
    const suitMatch = c.factId.match(/^hand\.suitLength\.(\w+)$/);
    if (suitMatch) {
      const suit = SUIT_SUFFIX[suitMatch[1]!];
      if (!suit) continue;
      if (c.operator === "gte" && typeof c.value === "number") {
        suitMins[suit] = Math.max(suitMins[suit]!, c.value);
      } else if (c.operator === "lte" && typeof c.value === "number") {
        suitMaxes[suit] = Math.min(suitMaxes[suit]!, c.value);
      }
      continue;
    }

    // Balanced
    if (c.factId === "hand.isBalanced" && c.operator === "boolean") {
      balanced = c.value === true;
    }
  }

  // Balanced distributions (4-3-3-3, 4-4-3-2, 5-3-3-2) guarantee ≥2 in every suit
  if (balanced === true) {
    for (const suit of ALL_SUITS) {
      suitMins[suit] = Math.max(suitMins[suit]!, 2);
    }
  }

  // Clamp contradictions
  if (hcpMin > hcpMax) hcpMin = hcpMax;

  const suitLengths: Record<Suit, { min: number; max: number }> = {
    [SuitEnum.Spades]: { min: 0, max: 13 },
    [SuitEnum.Hearts]: { min: 0, max: 13 },
    [SuitEnum.Diamonds]: { min: 0, max: 13 },
    [SuitEnum.Clubs]: { min: 0, max: 13 },
  };
  for (const suit of ALL_SUITS) {
    let min = suitMins[suit]!;
    const max = suitMaxes[suit]!;
    if (min > max) min = max;
    suitLengths[suit] = { min, max };
  }

  return {
    hcp: { min: hcpMin, max: hcpMax },
    suitLengths,
    isBalanced: balanced,
  };
}

/**
 * Extract qualitative constraints — those that don't reduce to flat per-suit ranges.
 * These are displayed as-is in the UI (e.g. "Has 4-card major").
 */
function deriveQualitative(constraints: readonly FactConstraintIR[]): QualitativeConstraint[] {
  const result: QualitativeConstraint[] = [];

  for (const c of constraints) {
    const label = QUALITATIVE_LABELS[c.factId];
    if (label) {
      // Only show positive assertions for now
      if (c.operator === "boolean" && c.value === true) {
        // Deduplicate
        if (!result.some((q) => q.factId === c.factId)) {
          result.push({ factId: c.factId, label, operator: c.operator, value: c.value });
        }
      }
    }
  }

  return result;
}

/**
 * Convert a HandInference to FactConstraintIR[].
 * Used at the boundary where InferenceProvider returns HandInference
 * but the public beliefs pipeline needs FactConstraintIR[].
 */
export function handInferenceToConstraints(inf: {
  readonly minHcp?: number;
  readonly maxHcp?: number;
  readonly isBalanced?: boolean;
  readonly suits: Partial<Record<Suit, { readonly minLength?: number; readonly maxLength?: number }>>;
}): FactConstraintIR[] {
  const constraints: FactConstraintIR[] = [];

  if (inf.minHcp !== undefined) {
    constraints.push({ factId: "hand.hcp", operator: "gte", value: inf.minHcp });
  }
  if (inf.maxHcp !== undefined) {
    constraints.push({ factId: "hand.hcp", operator: "lte", value: inf.maxHcp });
  }
  if (inf.isBalanced === true) {
    constraints.push({ factId: "hand.isBalanced", operator: "boolean", value: true });
  }

  for (const [suit, si] of Object.entries(inf.suits)) {
    if (!si) continue;
    const suffix = suitToSuffix(suit as Suit);
    if (!suffix) continue;
    if (si.minLength !== undefined) {
      constraints.push({ factId: `hand.suitLength.${suffix}`, operator: "gte", value: si.minLength });
    }
    if (si.maxLength !== undefined) {
      constraints.push({ factId: `hand.suitLength.${suffix}`, operator: "lte", value: si.maxLength });
    }
  }

  return constraints;
}

/** Map Suit enum value to factId suffix. */
function suitToSuffix(suit: Suit): string | null {
  switch (suit) {
    case SuitEnum.Spades: return "spades";
    case SuitEnum.Hearts: return "hearts";
    case SuitEnum.Diamonds: return "diamonds";
    case SuitEnum.Clubs: return "clubs";
    default: return null;
  }
}
