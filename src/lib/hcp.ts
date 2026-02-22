import type { Hand } from "../engine/types";
import { HCP_VALUES } from "../engine/constants";

/** Compute HCP for a hand. Pure helper for UI use — avoids importing engine/hand-evaluator. */
export function computeHcp(hand: Hand): number {
  return hand.cards.reduce((sum, card) => sum + HCP_VALUES[card.rank], 0);
}
