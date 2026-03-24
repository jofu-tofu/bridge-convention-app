import type { Card } from "../../service";
import { SUIT_ORDER, RANK_INDEX } from "../../service";

const SUIT_INDEX = new Map(SUIT_ORDER.map((s, i) => [s, i]));

export function sortCards(cards: readonly Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const suitDiff = (SUIT_INDEX.get(a.suit) ?? 0) - (SUIT_INDEX.get(b.suit) ?? 0);
    if (suitDiff !== 0) return suitDiff;
    return RANK_INDEX[b.rank] - RANK_INDEX[a.rank];
  });
}
