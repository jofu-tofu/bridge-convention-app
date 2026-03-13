/**
 * Bergen Raises fact evaluators.
 *
 * Each fact evaluates a single hand property relevant to Bergen raise selection.
 * Facts are composed by surfaces to determine which raise type applies.
 */

import { BidSuit } from "../../../engine/types";
import type { HandEvaluation } from "../../../engine/types";

/** Evaluated facts for a Bergen raise decision. */
export interface BergenFacts {
  readonly hcp: number;
  readonly supportCount: number;
  readonly hasShortage: boolean;
  readonly trumpSuit: BidSuit.Hearts | BidSuit.Spades | null;
}

/**
 * Evaluate Bergen-relevant facts from a hand evaluation and auction context.
 *
 * @param evaluation - Hand evaluation with shape and hcp
 * @param openingStrain - The major suit opened by partner (Hearts or Spades)
 */
export function evaluateBergenFacts(
  evaluation: HandEvaluation,
  openingStrain: BidSuit.Hearts | BidSuit.Spades,
): BergenFacts {
  const suitIndex = openingStrain === BidSuit.Hearts ? 1 : 0;
  const supportCount = evaluation.shape[suitIndex]!;

  // Check for singleton or void in any suit
  const hasShortage = evaluation.shape.some((s: number) => s <= 1);

  return {
    hcp: evaluation.hcp,
    supportCount,
    hasShortage,
    trumpSuit: openingStrain,
  };
}
