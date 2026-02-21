import { Seat, Suit, BidSuit } from "../engine/types";
import type { DealConstraints, Call, Auction } from "../engine/types";
import { ConventionCategory } from "./types";
import type { ConventionConfig, BiddingRule, BiddingContext } from "./types";
import { auctionMatchesExact, buildAuction } from "../engine/auction-helpers";

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

const staymanAsk: BiddingRule = {
  name: "stayman-ask",
  explanation: "Bid 2C (Stayman) to ask opener for a 4-card major",
  matches(ctx: BiddingContext): boolean {
    // Responder after 1NT - P
    if (!auctionMatchesExact(ctx.auction, ["1NT", "P"])) return false;
    if (ctx.evaluation.hcp < 8) return false;
    const shape = ctx.evaluation.shape;
    // Need at least one 4-card major
    return shape[0]! >= 4 || shape[1]! >= 4;
  },
  call(): Call {
    return { type: "bid", level: 2, strain: BidSuit.Clubs };
  },
};

const staymanResponseHearts: BiddingRule = {
  name: "stayman-response-hearts",
  explanation: "Opener bids 2H showing a 4-card heart suit",
  matches(ctx: BiddingContext): boolean {
    // Opener after 1NT - P - 2C - P
    if (!auctionMatchesExact(ctx.auction, ["1NT", "P", "2C", "P"])) return false;
    // Has 4+ hearts (priority: show hearts before spades)
    return ctx.evaluation.shape[1]! >= 4;
  },
  call(): Call {
    return { type: "bid", level: 2, strain: BidSuit.Hearts };
  },
};

const staymanResponseSpades: BiddingRule = {
  name: "stayman-response-spades",
  explanation: "Opener bids 2S showing a 4-card spade suit (no 4 hearts)",
  matches(ctx: BiddingContext): boolean {
    if (!auctionMatchesExact(ctx.auction, ["1NT", "P", "2C", "P"])) return false;
    // Has 4+ spades but NOT 4+ hearts (hearts checked first by priority)
    return ctx.evaluation.shape[0]! >= 4 && ctx.evaluation.shape[1]! < 4;
  },
  call(): Call {
    return { type: "bid", level: 2, strain: BidSuit.Spades };
  },
};

const staymanResponseDenial: BiddingRule = {
  name: "stayman-response-denial",
  explanation: "Opener bids 2D denying a 4-card major",
  matches(ctx: BiddingContext): boolean {
    if (!auctionMatchesExact(ctx.auction, ["1NT", "P", "2C", "P"])) return false;
    // No 4-card major
    return ctx.evaluation.shape[0]! < 4 && ctx.evaluation.shape[1]! < 4;
  },
  call(): Call {
    return { type: "bid", level: 2, strain: BidSuit.Diamonds };
  },
};

const staymanRebidMajorFit: BiddingRule = {
  name: "stayman-rebid-major-fit",
  explanation: "Responder raises to game in the agreed major suit",
  matches(ctx: BiddingContext): boolean {
    // After 1NT-P-2C-P-2H-P or 1NT-P-2C-P-2S-P
    const heartsShown = auctionMatchesExact(ctx.auction, ["1NT", "P", "2C", "P", "2H", "P"]);
    const spadesShown = auctionMatchesExact(ctx.auction, ["1NT", "P", "2C", "P", "2S", "P"]);
    if (!heartsShown && !spadesShown) return false;

    const shape = ctx.evaluation.shape;
    if (heartsShown) return shape[1]! >= 4;
    if (spadesShown) return shape[0]! >= 4;
    return false;
  },
  call(ctx: BiddingContext): Call {
    const heartsShown = auctionMatchesExact(ctx.auction, ["1NT", "P", "2C", "P", "2H", "P"]);
    if (heartsShown && ctx.evaluation.shape[1]! >= 4) {
      return { type: "bid", level: 4, strain: BidSuit.Hearts };
    }
    return { type: "bid", level: 4, strain: BidSuit.Spades };
  },
};

const staymanRebidNoFit: BiddingRule = {
  name: "stayman-rebid-no-fit",
  explanation: "Responder bids 3NT when no major fit is found",
  matches(ctx: BiddingContext): boolean {
    // After opener shows a major or denies
    const heartsShown = auctionMatchesExact(ctx.auction, ["1NT", "P", "2C", "P", "2H", "P"]);
    const spadesShown = auctionMatchesExact(ctx.auction, ["1NT", "P", "2C", "P", "2S", "P"]);
    const denied = auctionMatchesExact(ctx.auction, ["1NT", "P", "2C", "P", "2D", "P"]);
    if (!heartsShown && !spadesShown && !denied) return false;

    if (denied) return true;
    // Opener showed hearts but responder doesn't have 4
    if (heartsShown && ctx.evaluation.shape[1]! < 4) return true;
    // Opener showed spades but responder doesn't have 4
    if (spadesShown && ctx.evaluation.shape[0]! < 4) return true;
    return false;
  },
  call(): Call {
    return { type: "bid", level: 3, strain: BidSuit.NoTrump };
  },
};

/** Responder position starts after 1NT - P. */
function staymanDefaultAuction(seat: Seat): Auction | undefined {
  if (seat === Seat.South || seat === Seat.East) {
    return buildAuction(Seat.North, ["1NT", "P"]);
  }
  return undefined;
}

export const staymanConfig: ConventionConfig = {
  id: "stayman",
  name: "Stayman",
  description: "Stayman convention: 2C response to 1NT asking for 4-card majors",
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
