import { Seat, Suit, BidSuit } from "../engine/types";
import type { DealConstraints, Call, Auction, Hand, Deal } from "../engine/types";
import { ConventionCategory } from "./types";
import type { ConventionConfig, BiddingRule, BiddingContext } from "./types";
import { auctionMatchesExact, buildAuction } from "../engine/auction-helpers";
import { getSuitLength } from "../engine/hand-evaluator";

// SUIT_ORDER indices: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs

// ─── Helpers ──────────────────────────────────────────────────

function openerBidHearts(auction: Auction): boolean {
  return auctionMatchesExact(auction, ["1H", "P"]);
}

function openerBidSpades(auction: Auction): boolean {
  return auctionMatchesExact(auction, ["1S", "P"]);
}

function hasSupport(ctx: BiddingContext): boolean {
  const shape = ctx.evaluation.shape;
  if (openerBidHearts(ctx.auction)) return shape[1]! >= 4; // hearts index 1
  if (openerBidSpades(ctx.auction)) return shape[0]! >= 4; // spades index 0
  return false;
}

// ─── Deal Constraints ─────────────────────────────────────────

/** Bergen Raises deal constraints: opener 12-21 HCP with 5+ major, responder 6-12 HCP with 4+ major */
export const bergenDealConstraints: DealConstraints = {
  seats: [
    {
      seat: Seat.North,
      minHcp: 12,
      maxHcp: 21,
      minLengthAny: { [Suit.Spades]: 5, [Suit.Hearts]: 5 },
    },
    {
      seat: Seat.South,
      minHcp: 6,
      maxHcp: 12,
      minLengthAny: { [Suit.Spades]: 4, [Suit.Hearts]: 4 },
    },
  ],
  dealer: Seat.North,
};

// ─── Bidding Rules ────────────────────────────────────────────

const bergenGameRaise: BiddingRule = {
  name: "bergen-game-raise",
  explanation: "Bid 4 of opener's major with 13+ HCP and 4+ card support",
  matches(ctx: BiddingContext): boolean {
    if (!openerBidHearts(ctx.auction) && !openerBidSpades(ctx.auction)) return false;
    if (ctx.evaluation.hcp < 13) return false;
    return hasSupport(ctx);
  },
  call(ctx: BiddingContext): Call {
    if (openerBidHearts(ctx.auction)) return { type: "bid", level: 4, strain: BidSuit.Hearts };
    return { type: "bid", level: 4, strain: BidSuit.Spades };
  },
};

const bergenLimitRaise: BiddingRule = {
  name: "bergen-limit-raise",
  explanation: "Bid 3D showing a limit raise (10-12 HCP) with 4+ card support",
  matches(ctx: BiddingContext): boolean {
    if (!openerBidHearts(ctx.auction) && !openerBidSpades(ctx.auction)) return false;
    if (ctx.evaluation.hcp < 10 || ctx.evaluation.hcp > 12) return false;
    return hasSupport(ctx);
  },
  call(): Call {
    return { type: "bid", level: 3, strain: BidSuit.Diamonds };
  },
};

const bergenConstructiveRaise: BiddingRule = {
  name: "bergen-constructive-raise",
  explanation: "Bid 3C showing a constructive raise (7-9 HCP) with 4+ card support",
  matches(ctx: BiddingContext): boolean {
    if (!openerBidHearts(ctx.auction) && !openerBidSpades(ctx.auction)) return false;
    if (ctx.evaluation.hcp < 7 || ctx.evaluation.hcp > 9) return false;
    return hasSupport(ctx);
  },
  call(): Call {
    return { type: "bid", level: 3, strain: BidSuit.Clubs };
  },
};

const bergenPreemptiveRaise: BiddingRule = {
  name: "bergen-preemptive-raise",
  explanation: "Bid 3 of opener's major as a preemptive raise (0-6 HCP) with 4+ card support",
  matches(ctx: BiddingContext): boolean {
    if (!openerBidHearts(ctx.auction) && !openerBidSpades(ctx.auction)) return false;
    if (ctx.evaluation.hcp > 6) return false;
    return hasSupport(ctx);
  },
  call(ctx: BiddingContext): Call {
    if (openerBidHearts(ctx.auction)) return { type: "bid", level: 3, strain: BidSuit.Hearts };
    return { type: "bid", level: 3, strain: BidSuit.Spades };
  },
};

// ─── Default Auction ──────────────────────────────────────────

function bergenDefaultAuction(seat: Seat, deal?: Deal): Auction | undefined {
  if (seat !== Seat.South) return undefined;
  if (!deal) return buildAuction(Seat.North, ["1H", "P"]);
  const openerShape = getSuitLength(deal.hands[Seat.North]);
  const spades = openerShape[0]; // index 0 = Spades
  const hearts = openerShape[1]; // index 1 = Hearts
  // SAYC: open the LONGER major; with 5-5, prefer 1S (higher-ranking)
  const openMajor = (spades >= 5 && spades >= hearts) ? "1S" : "1H";
  return buildAuction(Seat.North, [openMajor, "P"]);
}

// ─── Convention Config ────────────────────────────────────────

export const bergenConfig: ConventionConfig = {
  id: "bergen-raises",
  name: "Bergen Raises",
  description: "Bergen Raises: coded responses to 1M opening showing support and strength",
  category: ConventionCategory.Constructive,
  dealConstraints: bergenDealConstraints,
  biddingRules: [
    bergenGameRaise,
    bergenLimitRaise,
    bergenConstructiveRaise,
    bergenPreemptiveRaise,
  ],
  examples: [],
  defaultAuction: bergenDefaultAuction,
};
