import type { BiddingStrategy, BidResult } from "../../conventions/core/strategy-types";
import type { BiddingContext } from "../../conventions/core/strategy-types";
import { BidSuit } from "../../engine/types";
import type { ContractBid } from "../../engine/types";
import { isLegalCall } from "../../engine/auction";
import { SUIT_ORDER } from "../../engine/constants";

/** Maps SUIT_ORDER index to BidSuit: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs */
const SUIT_TO_BID_SUIT: readonly BidSuit[] = [
  BidSuit.Spades,
  BidSuit.Hearts,
  BidSuit.Diamonds,
  BidSuit.Clubs,
];

/** HCP-based maximum bid level to prevent runaway escalation.
 *  This is a simple fallback — real conventions handle competitive judgment. */
function maxLevelForHcp(hcp: number): number {
  if (hcp >= 20) return 5;
  if (hcp >= 16) return 4;
  if (hcp >= 12) return 3;
  return 2;
}

export const naturalFallbackStrategy: BiddingStrategy = {
  id: "natural-fallback",
  name: "Natural Fallback",
  suggest(context: BiddingContext): BidResult | null {
    const { evaluation, auction, seat } = context;

    if (evaluation.hcp < 6) return null;

    // Find longest 5+ card suit; ties go to highest-ranking (SUIT_ORDER index 0 first)
    let bestIndex = -1;
    let bestLength = 4; // minimum 5 to qualify
    for (let i = 0; i < 4; i++) {
      const length = evaluation.shape[i] as number;
      if (length > bestLength) {
        bestLength = length;
        bestIndex = i;
      }
    }

    if (bestIndex === -1) return null;

    const strain = SUIT_TO_BID_SUIT[bestIndex]!;
    const maxLevel = maxLevelForHcp(evaluation.hcp);

    // Find cheapest legal level for this suit, capped by HCP strength
    for (let level = 1; level <= maxLevel; level++) {
      const call: ContractBid = {
        type: "bid",
        level: level as ContractBid["level"],
        strain,
      };
      if (isLegalCall(auction, call, seat)) {
        return {
          call,
          ruleName: null,
          explanation: `Natural bid with ${bestLength}-card ${SUIT_ORDER[bestIndex]!} suit`,
        };
      }
    }

    return null;
  },
};
