import { Seat, Suit, BidSuit } from "../engine/types";
import type { DealConstraints, Call, Auction, Deal } from "../engine/types";
import { ConventionCategory } from "./types";
import type { ConventionConfig, BiddingContext } from "./types";
import { auctionMatchesExact, buildAuction } from "../engine/auction-helpers";
import { getSuitLength } from "../engine/hand-evaluator";
import {
  conditionedRule,
  auctionMatchesAny,
  hcpMin,
  hcpMax,
  hcpRange,
  majorSupport,
} from "./conditions";

// SUIT_ORDER indices: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs

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

const bergenGameRaise = conditionedRule({
  name: "bergen-game-raise",
  conditions: [
    auctionMatchesAny([["1H", "P"], ["1S", "P"]]),
    hcpMin(13),
    majorSupport(),
  ],
  call(ctx: BiddingContext): Call {
    if (auctionMatchesExact(ctx.auction, ["1H", "P"])) {
      return { type: "bid", level: 4, strain: BidSuit.Hearts };
    }
    return { type: "bid", level: 4, strain: BidSuit.Spades };
  },
});

const bergenLimitRaise = conditionedRule({
  name: "bergen-limit-raise",
  conditions: [
    auctionMatchesAny([["1H", "P"], ["1S", "P"]]),
    hcpRange(10, 12),
    majorSupport(),
  ],
  call(): Call {
    return { type: "bid", level: 3, strain: BidSuit.Diamonds };
  },
});

const bergenConstructiveRaise = conditionedRule({
  name: "bergen-constructive-raise",
  conditions: [
    auctionMatchesAny([["1H", "P"], ["1S", "P"]]),
    hcpRange(7, 9),
    majorSupport(),
  ],
  call(): Call {
    return { type: "bid", level: 3, strain: BidSuit.Clubs };
  },
});

const bergenPreemptiveRaise = conditionedRule({
  name: "bergen-preemptive-raise",
  conditions: [
    auctionMatchesAny([["1H", "P"], ["1S", "P"]]),
    hcpMax(6),
    majorSupport(),
  ],
  call(ctx: BiddingContext): Call {
    if (auctionMatchesExact(ctx.auction, ["1H", "P"])) {
      return { type: "bid", level: 3, strain: BidSuit.Hearts };
    }
    return { type: "bid", level: 3, strain: BidSuit.Spades };
  },
});

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
