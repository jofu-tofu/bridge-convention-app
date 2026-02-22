import type { HandInference, InferredHoldings, SuitInference } from "./types";
import type { Seat, Suit } from "../../engine/types";
import { Suit as SuitEnum } from "../../engine/types";

const ALL_SUITS: Suit[] = [
  SuitEnum.Spades,
  SuitEnum.Hearts,
  SuitEnum.Diamonds,
  SuitEnum.Clubs,
];

/**
 * Merge multiple HandInferences for a single seat into an InferredHoldings.
 * Uses range intersection: tighten bounds from each inference.
 * On contradiction, clamp to last inference (most recent bid wins).
 */
export function mergeInferences(
  seat: Seat,
  inferences: readonly HandInference[],
): InferredHoldings {
  let hcpMin = 0;
  let hcpMax = 40;
  let balanced: boolean | undefined = undefined;

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

  for (const inf of inferences) {
    if (inf.minHcp !== undefined) hcpMin = Math.max(hcpMin, inf.minHcp);
    if (inf.maxHcp !== undefined) hcpMax = Math.min(hcpMax, inf.maxHcp);
    if (inf.isBalanced !== undefined) balanced = inf.isBalanced;

    for (const suit of ALL_SUITS) {
      const si: SuitInference | undefined = inf.suits[suit];
      if (si) {
        if (si.minLength !== undefined)
          suitMins[suit] = Math.max(suitMins[suit]!, si.minLength);
        if (si.maxLength !== undefined)
          suitMaxes[suit] = Math.min(suitMaxes[suit]!, si.maxLength);
      }
    }
  }

  // Clamp on HCP contradiction: prefer last inference
  if (hcpMin > hcpMax) {
    const last = inferences[inferences.length - 1];
    if (last) {
      hcpMin = last.minHcp ?? hcpMin;
      hcpMax = last.maxHcp ?? hcpMax;
    }
  }

  const suitLengths = {} as Record<Suit, { min: number; max: number }>;
  for (const suit of ALL_SUITS) {
    let min = suitMins[suit]!;
    let max = suitMaxes[suit]!;
    if (min > max) {
      min = max; // clamp on contradiction
    }
    suitLengths[suit] = { min, max };
  }

  return {
    seat,
    inferences,
    hcpRange: { min: hcpMin, max: hcpMax },
    suitLengths,
    isBalanced: balanced,
  };
}
