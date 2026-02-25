// Sources consulted:
// - bridgebum.com/landy.php [bridgebum/landy]

import { Seat, BidSuit } from "../engine/types";
import type {
  DealConstraints,
  Call,
  Auction,
  Hand,
  Deal,
} from "../engine/types";
import { ConventionCategory } from "./types";
import { getSuitLength } from "../engine/hand-evaluator";
import { buildAuction } from "../engine/auction-helpers";
import {
  auctionMatches,
  bothMajors,
  suitMin,
} from "./conditions";
import { decision, bid, fallback } from "./rule-tree";
import type { RuleNode, TreeConventionConfig } from "./rule-tree";


// SUIT_ORDER indices: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs

/** Landy deal constraints: East opens 1NT (15-17 balanced), South overcalls (10+, 5-4+ majors) */
export const landyDealConstraints: DealConstraints = {
  seats: [
    {
      seat: Seat.East,
      minHcp: 15,
      maxHcp: 17,
      balanced: true,
    },
    {
      seat: Seat.South,
      minHcp: 10,
      customCheck: (hand: Hand) => {
        const shape = getSuitLength(hand);
        const spades = shape[0]!;
        const hearts = shape[1]!;
        return (spades >= 5 && hearts >= 4) || (hearts >= 5 && spades >= 4);
      },
    },
  ],
  dealer: Seat.East,
};

// ─── Rule Tree ────────────────────────────────────────────────

const landyRuleTree: RuleNode = decision(
  "after-1nt",
  auctionMatches(["1NT"]),
  // YES: opponent opened 1NT
  decision(
    "both-majors",
    bothMajors(),
    // YES: has both majors
    bid("landy-2c", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Clubs })),
    // NO: doesn't have both majors
    fallback("not-suited"),
  ),
  // NO: not after 1NT, check response auctions
  decision(
    "after-1nt-2c-p",
    auctionMatches(["1NT", "2C", "P"]),
    // YES: partner overcalled 2C, we're responding
    decision(
      "has-5-clubs",
      suitMin(3, "clubs", 5),
      // YES: 5+ clubs, happy to play 2C
      bid("landy-response-pass", (): Call => ({ type: "pass" })),
      // NO: fewer than 5 clubs, pick a major
      decision(
        "has-4-hearts",
        suitMin(1, "hearts", 4),
        // YES: 4+ hearts
        bid("landy-response-2h", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Hearts })),
        // NO: fewer than 4 hearts
        decision(
          "has-4-spades",
          suitMin(0, "spades", 4),
          // YES: 4+ spades (hearts already rejected)
          bid("landy-response-2s", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Spades })),
          // NO: no major preference, relay 2D
          bid("landy-response-2d", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Diamonds })),
        ),
      ),
    ),
    // NO: not a Landy auction
    fallback("not-landy-auction"),
  ),
);

/** Overcaller position: East opened 1NT */
function landyDefaultAuction(seat: Seat, _deal?: Deal): Auction | undefined {
  if (seat === Seat.South) {
    return buildAuction(Seat.East, ["1NT"]);
  }
  return undefined;
}

export const landyConfig: TreeConventionConfig = {
  id: "landy",
  name: "Landy",
  description:
    "Landy: 2C overcall over opponent's 1NT showing both major suits (5-4+)",
  category: ConventionCategory.Defensive,
  dealConstraints: landyDealConstraints,
  ruleTree: landyRuleTree,
  examples: [],
  defaultAuction: landyDefaultAuction,
};
