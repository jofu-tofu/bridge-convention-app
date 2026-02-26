import type { Card } from "../engine/types";
import { SUIT_ORDER, RANK_INDEX } from "../engine/constants";

export function sortCards(cards: readonly Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const suitDiff = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
    if (suitDiff !== 0) return suitDiff;
    return RANK_INDEX[b.rank] - RANK_INDEX[a.rank];
  });
}
