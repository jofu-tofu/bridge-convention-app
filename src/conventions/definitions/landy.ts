// Sources consulted:
// - bridgebum.com/landy.php [bridgebum/landy]

import { Seat, BidSuit } from "../../engine/types";
import type {
  DealConstraints,
  Call,
  Auction,
  Hand,
  Deal,
} from "../../engine/types";
import { ConventionCategory } from "../core/types";
import { getSuitLength } from "../../engine/hand-evaluator";
import { buildAuction } from "../../engine/auction-helpers";
import {
  auctionMatches,
  hcpMin,
  hcpRange,
  bothMajors,
  suitMin,
  and,
} from "../core/conditions";
import { decision, bid, fallback } from "../core/rule-tree";
import type { RuleNode, TreeConventionConfig } from "../core/rule-tree";


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

// Overcaller rebids after 2NT inquiry (1NT-2C-P-2NT-P)
const overcallerAfter2NT: RuleNode = decision(
  "5-5-majors",
  and(suitMin(0, "spades", 5), suitMin(1, "hearts", 5)),
  // 5-5+: 3NT=max, 3S=med
  decision(
    "max-12+",
    hcpMin(12),
    bid("landy-rebid-3nt", (): Call => ({ type: "bid", level: 3, strain: BidSuit.NoTrump })),
    bid("landy-rebid-3s", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Spades })),
  ),
  // 5-4 / 4-5: 3D=max, 3C=med
  decision(
    "max-12+-54",
    hcpMin(12),
    bid("landy-rebid-3d", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Diamonds })),
    bid("landy-rebid-3c", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Clubs })),
  ),
);

// Responder bids after 2C (1NT-2C-P)
const responderBranch: RuleNode = decision(
  "has-12-plus",
  hcpMin(12),
  bid("landy-response-2nt", (): Call => ({ type: "bid", level: 2, strain: BidSuit.NoTrump })),
  decision(
    "invite-3h",
    and(hcpRange(10, 12), suitMin(1, "hearts", 4)),
    bid("landy-response-3h", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Hearts })),
    decision(
      "invite-3s",
      and(hcpRange(10, 12), suitMin(0, "spades", 4)),
      bid("landy-response-3s", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Spades })),
      decision(
        "has-5-clubs",
        suitMin(3, "clubs", 5),
        bid("landy-response-pass", (): Call => ({ type: "pass" })),
        decision(
          "has-4-hearts",
          suitMin(1, "hearts", 4),
          bid("landy-response-2h", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Hearts })),
          decision(
            "has-4-spades",
            suitMin(0, "spades", 4),
            bid("landy-response-2s", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Spades })),
            bid("landy-response-2d", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Diamonds })),
          ),
        ),
      ),
    ),
  ),
);

const landyRuleTree: RuleNode = decision(
  "after-1nt",
  auctionMatches(["1NT"]),
  // YES: opponent opened 1NT
  decision(
    "both-majors",
    bothMajors(),
    bid("landy-2c", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Clubs })),
    fallback("not-suited"),
  ),
  // NO: not after 1NT
  decision(
    "after-1nt-2c-p-2nt-p",
    auctionMatches(["1NT", "2C", "P", "2NT", "P"]),
    overcallerAfter2NT,
    decision(
      "after-1nt-2c-p",
      auctionMatches(["1NT", "2C", "P"]),
      responderBranch,
      fallback("not-landy-auction"),
    ),
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
  defaultAuction: landyDefaultAuction,
};
