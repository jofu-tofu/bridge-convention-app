// Sources consulted:
// - bridgebum.com/dont.php [bridgebum/dont]
// - Marty Bergen, original DONT description [Bergen/dont]

import { Seat, BidSuit } from "../engine/types";
import type {
  DealConstraints,
  Call,
  Auction,
  Hand,
  Deal,
} from "../engine/types";
import { ConventionCategory } from "./types";
import { buildAuction } from "../engine/auction-helpers";
import { getSuitLength } from "../engine/hand-evaluator";
import {
  auctionMatches,
  bothMajors,
  diamondsPlusMajor,
  clubsPlusHigher,
  suitMin,
  hasSingleLongSuit,
} from "./conditions";
import { decision, bid, fallback } from "./rule-tree";
import type { RuleNode, TreeConventionConfig } from "./rule-tree";


// SUIT_ORDER indices: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs

/** DONT deal constraints: East opens 1NT (15-17 balanced), South overcalls (8-15, shape) */
export const dontDealConstraints: DealConstraints = {
  seats: [
    {
      seat: Seat.East,
      minHcp: 15,
      maxHcp: 17,
      balanced: true,
    },
    {
      seat: Seat.South,
      minHcp: 8,
      maxHcp: 15,
      customCheck: (hand: Hand) => {
        const shape = getSuitLength(hand);
        const sorted = [...shape].sort((a, b) => b - a);
        return sorted[0]! >= 6 || (sorted[0]! >= 5 && sorted[1]! >= 4);
      },
    },
  ],
  dealer: Seat.East,
};

// ─── Rule Tree ────────────────────────────────────────────────

// Overcaller branch (South, after East opens 1NT)
const overcallerBranch: RuleNode = decision(
  "both-majors",
  bothMajors(),
  bid("dont-2h", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Hearts })),
  decision(
    "diamonds-plus-major",
    diamondsPlusMajor(),
    bid("dont-2d", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Diamonds })),
    decision(
      "clubs-plus-higher",
      clubsPlusHigher(),
      bid("dont-2c", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Clubs })),
      decision(
        "6-plus-spades",
        suitMin(0, "spades", 6),
        bid("dont-2s", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Spades })),
        decision(
          "single-long-suit",
          hasSingleLongSuit(),
          bid("dont-double", (): Call => ({ type: "double" })),
          fallback("not-suited"),
        ),
      ),
    ),
  ),
);

// Advance branch (North, after South overcalls)
// Per-auction sub-trees extracted to reduce nesting depth.

const advanceAfter2H: RuleNode = decision(
  "hearts-support",
  suitMin(1, "hearts", 3),
  bid("dont-advance-pass", (): Call => ({ type: "pass" })),
  bid("dont-advance-next-step", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Spades })),
);

// 2S is a natural 6+ spade bid — no relay mechanism available;
// pass with 2+ support, otherwise no convention bid applies.
const advanceAfter2S: RuleNode = decision(
  "spades-support",
  suitMin(0, "spades", 2),
  bid("dont-advance-pass", (): Call => ({ type: "pass" })),
  fallback("no-advance-after-2s"),
);

const advanceAfter2D: RuleNode = decision(
  "diamonds-support",
  suitMin(2, "diamonds", 3),
  bid("dont-advance-pass", (): Call => ({ type: "pass" })),
  bid("dont-advance-next-step", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Hearts })),
);

const advanceAfter2C: RuleNode = decision(
  "clubs-support",
  suitMin(3, "clubs", 3),
  bid("dont-advance-pass", (): Call => ({ type: "pass" })),
  bid("dont-advance-next-step", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Diamonds })),
);

const advanceAfterDouble: RuleNode = bid(
  "dont-advance-next-step", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Clubs }),
);

const advanceBranch: RuleNode = decision(
  "after-1nt-2h-p",
  auctionMatches(["1NT", "2H", "P"]),
  advanceAfter2H,
  decision(
    "after-1nt-2s-p",
    auctionMatches(["1NT", "2S", "P"]),
    advanceAfter2S,
    decision(
      "after-1nt-2d-p",
      auctionMatches(["1NT", "2D", "P"]),
      advanceAfter2D,
      decision(
        "after-1nt-2c-p",
        auctionMatches(["1NT", "2C", "P"]),
        advanceAfter2C,
        decision(
          "after-1nt-x-p",
          auctionMatches(["1NT", "X", "P"]),
          advanceAfterDouble,
          fallback("not-dont-auction"),
        ),
      ),
    ),
  ),
);

const dontRuleTree: RuleNode = decision(
  "after-1nt",
  auctionMatches(["1NT"]),
  overcallerBranch,
  advanceBranch,
);

/** Overcaller position: East opened 1NT */
function dontDefaultAuction(seat: Seat, _deal?: Deal): Auction | undefined {
  if (seat === Seat.South) {
    return buildAuction(Seat.East, ["1NT"]);
  }
  // Advance positions handled by specific auction patterns in the advance rules
  return undefined;
}

export const dontConfig: TreeConventionConfig = {
  id: "dont",
  name: "DONT",
  description:
    "DONT (Disturbing Opponent's No Trump): overcalls against 1NT openings",
  category: ConventionCategory.Defensive,
  dealConstraints: dontDealConstraints,
  ruleTree: dontRuleTree,
  examples: [],
  defaultAuction: dontDefaultAuction,
};
