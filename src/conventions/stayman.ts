import { Seat, Suit, BidSuit } from "../engine/types";
import type { DealConstraints, Call, Auction } from "../engine/types";
import { ConventionCategory } from "./types";
import type { ConventionConfig, BiddingContext } from "./types";
import { auctionMatchesExact, buildAuction } from "../engine/auction-helpers";
import {
  conditionedRule,
  auctionMatches,
  auctionMatchesAny,
  hcpMin,
  hcpMax,
  suitMin,
  suitBelow,
  anySuitMin,
} from "./conditions";

// SUIT_ORDER indices: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs

/** Stayman deal constraints: opener 15-17 balanced no 5M, responder 8+ with 4+M */
export const staymanDealConstraints: DealConstraints = {
  seats: [
    {
      seat: Seat.North,
      minHcp: 15,
      maxHcp: 17,
      balanced: true,
      maxLength: {
        [Suit.Spades]: 4,
        [Suit.Hearts]: 4,
      },
    },
    {
      seat: Seat.South,
      minHcp: 8,
      minLengthAny: {
        [Suit.Spades]: 4,
        [Suit.Hearts]: 4,
      },
    },
  ],
  dealer: Seat.North,
};

// ─── Bidding Rules ──────────────────────────────────────────

const staymanAsk = conditionedRule({
  name: "stayman-ask",
  auctionConditions: [auctionMatches(["1NT", "P"])],
  handConditions: [
    hcpMin(8),
    anySuitMin(
      [
        { index: 0, name: "spades" },
        { index: 1, name: "hearts" },
      ],
      4,
    ),
  ],
  call(): Call {
    return { type: "bid", level: 2, strain: BidSuit.Clubs };
  },
});

const staymanResponseHearts = conditionedRule({
  name: "stayman-response-hearts",
  auctionConditions: [auctionMatches(["1NT", "P", "2C", "P"])],
  handConditions: [suitMin(1, "hearts", 4)],
  call(): Call {
    return { type: "bid", level: 2, strain: BidSuit.Hearts };
  },
});

const staymanResponseSpades = conditionedRule({
  name: "stayman-response-spades",
  auctionConditions: [auctionMatches(["1NT", "P", "2C", "P"])],
  handConditions: [suitMin(0, "spades", 4), suitBelow(1, "hearts", 4)],
  call(): Call {
    return { type: "bid", level: 2, strain: BidSuit.Spades };
  },
});

const staymanResponseDenial = conditionedRule({
  name: "stayman-response-denial",
  auctionConditions: [auctionMatches(["1NT", "P", "2C", "P"])],
  handConditions: [suitBelow(0, "spades", 4), suitBelow(1, "hearts", 4)],
  call(): Call {
    return { type: "bid", level: 2, strain: BidSuit.Diamonds };
  },
});

/** Hybrid condition: 4+ cards in the major opener showed via Stayman. */
function fitInShownMajor(): import("./types").RuleCondition {
  return {
    name: "fit-in-shown-major",
    label: "4+ cards in opener's shown major",
    test(ctx) {
      if (
        auctionMatchesExact(ctx.auction, ["1NT", "P", "2C", "P", "2H", "P"])
      ) {
        return ctx.evaluation.shape[1]! >= 4;
      }
      if (
        auctionMatchesExact(ctx.auction, ["1NT", "P", "2C", "P", "2S", "P"])
      ) {
        return ctx.evaluation.shape[0]! >= 4;
      }
      return false;
    },
    describe(ctx) {
      if (
        auctionMatchesExact(ctx.auction, ["1NT", "P", "2C", "P", "2H", "P"])
      ) {
        const len = ctx.evaluation.shape[1]!;
        return len >= 4
          ? `${len} hearts (fit with opener's shown major)`
          : `Only ${len} hearts (no fit)`;
      }
      if (
        auctionMatchesExact(ctx.auction, ["1NT", "P", "2C", "P", "2S", "P"])
      ) {
        const len = ctx.evaluation.shape[0]!;
        return len >= 4
          ? `${len} spades (fit with opener's shown major)`
          : `Only ${len} spades (no fit)`;
      }
      return "No major shown by opener";
    },
  };
}

/** Resolve which major strain to bid based on opener's Stayman response. */
function shownMajorStrain(ctx: BiddingContext): BidSuit {
  if (
    auctionMatchesExact(ctx.auction, ["1NT", "P", "2C", "P", "2H", "P"]) &&
    ctx.evaluation.shape[1]! >= 4
  ) {
    return BidSuit.Hearts;
  }
  return BidSuit.Spades;
}

const staymanRebidMajorFitGame = conditionedRule({
  name: "stayman-rebid-major-fit",
  auctionConditions: [
    auctionMatchesAny([
      ["1NT", "P", "2C", "P", "2H", "P"],
      ["1NT", "P", "2C", "P", "2S", "P"],
    ]),
  ],
  handConditions: [hcpMin(10), fitInShownMajor()],
  call(ctx: BiddingContext): Call {
    return { type: "bid", level: 4, strain: shownMajorStrain(ctx) };
  },
});

const staymanRebidMajorFitInvite = conditionedRule({
  name: "stayman-rebid-major-fit-invite",
  auctionConditions: [
    auctionMatchesAny([
      ["1NT", "P", "2C", "P", "2H", "P"],
      ["1NT", "P", "2C", "P", "2S", "P"],
    ]),
  ],
  handConditions: [hcpMax(9), fitInShownMajor()],
  call(ctx: BiddingContext): Call {
    return { type: "bid", level: 3, strain: shownMajorStrain(ctx) };
  },
});

/** Hybrid condition: no 4-card fit in opener's shown major (or 2D denial). */
function noMajorFit(): import("./types").RuleCondition {
  return {
    name: "no-major-fit",
    label: "No 4-card fit in opener's shown major",
    test(ctx) {
      if (
        auctionMatchesExact(ctx.auction, ["1NT", "P", "2C", "P", "2D", "P"])
      )
        return true;
      if (
        auctionMatchesExact(ctx.auction, ["1NT", "P", "2C", "P", "2H", "P"])
      ) {
        return ctx.evaluation.shape[1]! < 4;
      }
      if (
        auctionMatchesExact(ctx.auction, ["1NT", "P", "2C", "P", "2S", "P"])
      ) {
        return ctx.evaluation.shape[0]! < 4;
      }
      return false;
    },
    describe(ctx) {
      if (
        auctionMatchesExact(ctx.auction, ["1NT", "P", "2C", "P", "2D", "P"])
      ) {
        return "Opener denied 4-card major";
      }
      if (
        auctionMatchesExact(ctx.auction, ["1NT", "P", "2C", "P", "2H", "P"])
      ) {
        const len = ctx.evaluation.shape[1]!;
        return `Only ${len} hearts (no fit with opener's hearts)`;
      }
      if (
        auctionMatchesExact(ctx.auction, ["1NT", "P", "2C", "P", "2S", "P"])
      ) {
        const len = ctx.evaluation.shape[0]!;
        return `Only ${len} spades (no fit with opener's spades)`;
      }
      return "Not in rebid position";
    },
  };
}

const staymanRebidNoFitGame = conditionedRule({
  name: "stayman-rebid-no-fit",
  auctionConditions: [
    auctionMatchesAny([
      ["1NT", "P", "2C", "P", "2H", "P"],
      ["1NT", "P", "2C", "P", "2S", "P"],
      ["1NT", "P", "2C", "P", "2D", "P"],
    ]),
  ],
  handConditions: [hcpMin(10), noMajorFit()],
  call(): Call {
    return { type: "bid", level: 3, strain: BidSuit.NoTrump };
  },
});

const staymanRebidNoFitInvite = conditionedRule({
  name: "stayman-rebid-no-fit-invite",
  auctionConditions: [
    auctionMatchesAny([
      ["1NT", "P", "2C", "P", "2H", "P"],
      ["1NT", "P", "2C", "P", "2S", "P"],
      ["1NT", "P", "2C", "P", "2D", "P"],
    ]),
  ],
  handConditions: [hcpMax(9), noMajorFit()],
  call(): Call {
    return { type: "bid", level: 2, strain: BidSuit.NoTrump };
  },
});

/** Responder position starts after 1NT - P. */
function staymanDefaultAuction(
  seat: Seat,
  _deal?: import("../engine/types").Deal,
): Auction | undefined {
  if (seat === Seat.South || seat === Seat.East) {
    return buildAuction(Seat.North, ["1NT", "P"]);
  }
  return undefined;
}

export const staymanConfig: ConventionConfig = {
  id: "stayman",
  name: "Stayman",
  description:
    "Stayman convention: 2C response to 1NT asking for 4-card majors",
  category: ConventionCategory.Asking,
  dealConstraints: staymanDealConstraints,
  biddingRules: [
    staymanAsk,
    staymanResponseHearts,
    staymanResponseSpades,
    staymanResponseDenial,
    staymanRebidMajorFitGame,
    staymanRebidMajorFitInvite,
    staymanRebidNoFitGame,
    staymanRebidNoFitInvite,
  ],
  examples: [],
  defaultAuction: staymanDefaultAuction,
};
