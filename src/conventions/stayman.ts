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

const staymanRebidMajorFit = conditionedRule({
  name: "stayman-rebid-major-fit",
  auctionConditions: [
    auctionMatchesAny([
      ["1NT", "P", "2C", "P", "2H", "P"],
      ["1NT", "P", "2C", "P", "2S", "P"],
    ]),
  ],
  handConditions: [
    // Hybrid: checks auction to resolve suit, gates on hand length
    {
      name: "fit-in-shown-major",
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
    },
  ],
  call(ctx: BiddingContext): Call {
    if (
      auctionMatchesExact(ctx.auction, ["1NT", "P", "2C", "P", "2H", "P"]) &&
      ctx.evaluation.shape[1]! >= 4
    ) {
      return { type: "bid", level: 4, strain: BidSuit.Hearts };
    }
    return { type: "bid", level: 4, strain: BidSuit.Spades };
  },
});

const staymanRebidNoFit = conditionedRule({
  name: "stayman-rebid-no-fit",
  auctionConditions: [
    auctionMatchesAny([
      ["1NT", "P", "2C", "P", "2H", "P"],
      ["1NT", "P", "2C", "P", "2S", "P"],
      ["1NT", "P", "2C", "P", "2D", "P"],
    ]),
  ],
  handConditions: [
    // Hybrid: checks auction to resolve suit, gates on hand length
    {
      name: "no-major-fit",
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
    },
  ],
  call(): Call {
    return { type: "bid", level: 3, strain: BidSuit.NoTrump };
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
    staymanRebidMajorFit,
    staymanRebidNoFit,
  ],
  examples: [],
  defaultAuction: staymanDefaultAuction,
};
