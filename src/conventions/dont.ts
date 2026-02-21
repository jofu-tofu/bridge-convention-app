// Sources consulted:
// - bridgebum.com/dont.php [bridgebum/dont]
// - Marty Bergen, original DONT description [Bergen/dont]

import { Seat, BidSuit } from "../engine/types";
import type { DealConstraints, Call, Auction, Hand, Deal } from "../engine/types";
import { ConventionCategory } from "./types";
import type { ConventionConfig, BiddingRule, BiddingContext } from "./types";
import { auctionMatchesExact, buildAuction } from "../engine/auction-helpers";
import { getSuitLength } from "../engine/hand-evaluator";

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
const dont2H: BiddingRule = {
  name: "dont-2h",
  explanation: "2H showing both majors (hearts and spades)",
  matches(ctx: BiddingContext): boolean {
    if (!auctionMatchesExact(ctx.auction, ["1NT"])) return false;
    const shape = ctx.evaluation.shape;
    const spades = shape[0]!;
    const hearts = shape[1]!;
    return (hearts >= 5 && spades >= 4) || (spades >= 5 && hearts >= 4);
  },
  call(): Call {
    return { type: "bid", level: 2, strain: BidSuit.Hearts };
  },
};

// Rule 2: dont-2d — diamonds + major
const dont2D: BiddingRule = {
  name: "dont-2d",
  explanation: "2D showing diamonds and a 4-card major",
  matches(ctx: BiddingContext): boolean {
    if (!auctionMatchesExact(ctx.auction, ["1NT"])) return false;
    const shape = ctx.evaluation.shape;
    const diamonds = shape[2]!;
    const spades = shape[0]!;
    const hearts = shape[1]!;
    return diamonds >= 5 && (spades >= 4 || hearts >= 4);
  },
  call(): Call {
    return { type: "bid", level: 2, strain: BidSuit.Diamonds };
  },
};

// Rule 3: dont-2c — clubs + higher suit
const dont2C: BiddingRule = {
  name: "dont-2c",
  explanation: "2C showing clubs and a higher-ranking suit",
  matches(ctx: BiddingContext): boolean {
    if (!auctionMatchesExact(ctx.auction, ["1NT"])) return false;
    const shape = ctx.evaluation.shape;
    const clubs = shape[3]!;
    const diamonds = shape[2]!;
    const spades = shape[0]!;
    const hearts = shape[1]!;
    return clubs >= 5 && (diamonds >= 4 || hearts >= 4 || spades >= 4);
  },
  call(): Call {
    return { type: "bid", level: 2, strain: BidSuit.Clubs };
  },
};

// Rule 4: dont-2s — natural spades 6+
const dont2S: BiddingRule = {
  name: "dont-2s",
  explanation: "2S natural showing 6+ spades",
  matches(ctx: BiddingContext): boolean {
    if (!auctionMatchesExact(ctx.auction, ["1NT"])) return false;
    return ctx.evaluation.shape[0]! >= 6;
  },
  call(): Call {
    return { type: "bid", level: 2, strain: BidSuit.Spades };
  },
};

// Rule 5: dont-double — single-suited (not spades)
const dontDouble: BiddingRule = {
  name: "dont-double",
  explanation: "Double showing a single-suited hand (not spades, partner bids 2C relay)",
  matches(ctx: BiddingContext): boolean {
    if (!auctionMatchesExact(ctx.auction, ["1NT"])) return false;
    const shape = ctx.evaluation.shape;
    const spades = shape[0]!;
    const hearts = shape[1]!;
    const diamonds = shape[2]!;
    const clubs = shape[3]!;
    const hasSingleLong = (hearts >= 6 || diamonds >= 6 || clubs >= 6);
    const hasSecond4 = [spades, hearts, diamonds, clubs].filter(n => n >= 4).length > 1;
    // Exclude if spades is the long suit (use 2S instead)
    if (spades >= 6) return false;
    return hasSingleLong && !hasSecond4;
  },
  call(): Call {
    return { type: "double" };
  },
};

// ─── Advance Bidding Rules (North, after South overcalls) ────

// Rule 6: dont-advance-pass — pass with support
const dontAdvancePass: BiddingRule = {
  name: "dont-advance-pass",
  explanation: "Pass partner's DONT overcall with support for the shown suit",
  matches(ctx: BiddingContext): boolean {
    const shape = ctx.evaluation.shape;
    // After 1NT-2H-P: partner shows both majors, pass with 3+ hearts
    if (auctionMatchesExact(ctx.auction, ["1NT", "2H", "P"])) return shape[1]! >= 3;
    // After 1NT-2S-P: natural spades, pass with 2+ spades (natural fit)
    if (auctionMatchesExact(ctx.auction, ["1NT", "2S", "P"])) return shape[0]! >= 2;
    // After 1NT-2D-P: partner shows diamonds+major, pass with 3+ diamonds
    if (auctionMatchesExact(ctx.auction, ["1NT", "2D", "P"])) return shape[2]! >= 3;
    // After 1NT-2C-P: partner shows clubs+higher, pass with 3+ clubs
    if (auctionMatchesExact(ctx.auction, ["1NT", "2C", "P"])) return shape[3]! >= 3;
    // After 1NT-X-P: partner doubled (single-suited unknown), can't pass
    return false;
  },
  call(): Call {
    return { type: "pass" };
  },
};

// Rule 7: dont-advance-next-step — bid next step to ask
const dontAdvanceNextStep: BiddingRule = {
  name: "dont-advance-next-step",
  explanation: "Bid next step to ask partner for their second/actual suit",
  matches(ctx: BiddingContext): boolean {
    // After 1NT-2H-P: prefer spades over hearts -> bid 2S
    if (auctionMatchesExact(ctx.auction, ["1NT", "2H", "P"])) return ctx.evaluation.shape[1]! < 3;
    // After 1NT-2D-P: ask for major -> bid 2H
    if (auctionMatchesExact(ctx.auction, ["1NT", "2D", "P"])) return ctx.evaluation.shape[2]! < 3;
    // After 1NT-2C-P: ask for higher suit -> bid 2D
    if (auctionMatchesExact(ctx.auction, ["1NT", "2C", "P"])) return ctx.evaluation.shape[3]! < 3;
    // After 1NT-X-P: relay 2C to discover partner's suit (always bid)
    if (auctionMatchesExact(ctx.auction, ["1NT", "X", "P"])) return true;
    return false;
  },
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
};

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
  description: "DONT (Disturbing Opponent's No Trump): overcalls against 1NT openings",
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
