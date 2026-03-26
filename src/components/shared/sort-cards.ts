import type { Card, Suit } from "../../service";
import { SUIT_ORDER, RANK_INDEX } from "../../service";

const SUIT_INDEX = new Map(SUIT_ORDER.map((s, i) => [s, i]));

/**
 * Sort cards by suit then rank (high→low within each suit).
 * When trumpSuit is provided, trump goes first (leftmost), then remaining
 * suits in standard strength order (S → H → D → C).
 */
export function sortCards(cards: readonly Card[], trumpSuit?: Suit): Card[] {
  const suitIndex = trumpSuit !== undefined
    ? buildTrumpSuitIndex(trumpSuit)
    : SUIT_INDEX;

  return [...cards].sort((a, b) => {
    const suitDiff = (suitIndex.get(a.suit) ?? 0) - (suitIndex.get(b.suit) ?? 0);
    if (suitDiff !== 0) return suitDiff;
    return RANK_INDEX[b.rank] - RANK_INDEX[a.rank];
  });
}

/** Build suit index with trump at position 0, others in standard order after. */
function buildTrumpSuitIndex(trumpSuit: Suit): Map<Suit, number> {
  const remaining = SUIT_ORDER.filter((s) => s !== trumpSuit);
  const order = [trumpSuit, ...remaining];
  return new Map(order.map((s, i) => [s, i]));
}
