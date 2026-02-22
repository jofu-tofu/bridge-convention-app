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
import type { ConventionConfig, BiddingContext } from "./types";
import { auctionMatchesExact, buildAuction } from "../engine/auction-helpers";
import { getSuitLength } from "../engine/hand-evaluator";
import {
  conditionedRule,
  auctionMatches,
  bothMajors,
  diamondsPlusMajor,
  clubsPlusHigher,
  suitMin,
  hasSingleLongSuit,
  advanceSupportFor,
  advanceLackSupport,
  advanceAfterDouble,
  or,
} from "./conditions";

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

// ─── Overcaller Bidding Rules (South, after East opens 1NT) ──

// Rule 1: dont-2h — both majors
const dont2H = conditionedRule({
  name: "dont-2h",
  auctionConditions: [auctionMatches(["1NT"])],
  handConditions: [bothMajors()],
  call(): Call {
    return { type: "bid", level: 2, strain: BidSuit.Hearts };
  },
});

// Rule 2: dont-2d — diamonds + major
const dont2D = conditionedRule({
  name: "dont-2d",
  auctionConditions: [auctionMatches(["1NT"])],
  handConditions: [diamondsPlusMajor()],
  call(): Call {
    return { type: "bid", level: 2, strain: BidSuit.Diamonds };
  },
});

// Rule 3: dont-2c — clubs + higher suit
const dont2C = conditionedRule({
  name: "dont-2c",
  auctionConditions: [auctionMatches(["1NT"])],
  handConditions: [clubsPlusHigher()],
  call(): Call {
    return { type: "bid", level: 2, strain: BidSuit.Clubs };
  },
});

// Rule 4: dont-2s — natural spades 6+
const dont2S = conditionedRule({
  name: "dont-2s",
  auctionConditions: [auctionMatches(["1NT"])],
  handConditions: [suitMin(0, "spades", 6)],
  call(): Call {
    return { type: "bid", level: 2, strain: BidSuit.Spades };
  },
});

// Rule 5: dont-double — single-suited (not spades)
const dontDouble = conditionedRule({
  name: "dont-double",
  auctionConditions: [auctionMatches(["1NT"])],
  handConditions: [hasSingleLongSuit()],
  call(): Call {
    return { type: "double" };
  },
});

// ─── Advance Bidding Rules (North, after South overcalls) ────

// Rule 6: dont-advance-pass — pass with support
const dontAdvancePass = conditionedRule({
  name: "dont-advance-pass",
  auctionConditions: [],
  handConditions: [
    // Hybrid: each advanceSupportFor checks auction to resolve suit, gates on hand length
    or(
      advanceSupportFor(["1NT", "2H", "P"], 1, "hearts", 3),
      advanceSupportFor(["1NT", "2S", "P"], 0, "spades", 2),
      advanceSupportFor(["1NT", "2D", "P"], 2, "diamonds", 3),
      advanceSupportFor(["1NT", "2C", "P"], 3, "clubs", 3),
    ),
  ],
  call(): Call {
    return { type: "pass" };
  },
});

// Rule 7: dont-advance-next-step — bid next step to ask
const dontAdvanceNextStep = conditionedRule({
  name: "dont-advance-next-step",
  auctionConditions: [],
  handConditions: [
    // Hybrid: each advanceLackSupport/advanceAfterDouble checks auction internally
    or(
      advanceLackSupport(["1NT", "2H", "P"], 1, "hearts", 3),
      advanceLackSupport(["1NT", "2D", "P"], 2, "diamonds", 3),
      advanceLackSupport(["1NT", "2C", "P"], 3, "clubs", 3),
      advanceAfterDouble(),
    ),
  ],
  call(ctx: BiddingContext): Call {
    // After 2H (both majors): bid 2S (prefers spades)
    if (auctionMatchesExact(ctx.auction, ["1NT", "2H", "P"])) {
      return { type: "bid", level: 2, strain: BidSuit.Spades };
    }
    // After 2D (diamonds+major): bid 2H (asking for major)
    if (auctionMatchesExact(ctx.auction, ["1NT", "2D", "P"])) {
      return { type: "bid", level: 2, strain: BidSuit.Hearts };
    }
    // After 2C (clubs+higher): bid 2D (asking for higher suit)
    if (auctionMatchesExact(ctx.auction, ["1NT", "2C", "P"])) {
      return { type: "bid", level: 2, strain: BidSuit.Diamonds };
    }
    // After X (single-suited): bid 2C (relay)
    return { type: "bid", level: 2, strain: BidSuit.Clubs };
  },
});

/** Overcaller position: East opened 1NT */
function dontDefaultAuction(seat: Seat, _deal?: Deal): Auction | undefined {
  if (seat === Seat.South) {
    return buildAuction(Seat.East, ["1NT"]);
  }
  // Advance positions handled by specific auction patterns in the advance rules
  return undefined;
}

export const dontConfig: ConventionConfig = {
  id: "dont",
  name: "DONT",
  description:
    "DONT (Disturbing Opponent's No Trump): overcalls against 1NT openings",
  category: ConventionCategory.Defensive,
  dealConstraints: dontDealConstraints,
  biddingRules: [
    dont2H,
    dont2D,
    dont2C,
    dont2S,
    dontDouble,
    dontAdvancePass,
    dontAdvanceNextStep,
  ],
  examples: [],
  defaultAuction: dontDefaultAuction,
};
