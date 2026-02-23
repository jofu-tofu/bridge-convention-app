import { Seat, Suit, BidSuit } from "../engine/types";
import type { DealConstraints, Call, Auction, Deal } from "../engine/types";
import { partnerSeat } from "../engine/constants";
import { ConventionCategory } from "./types";
import type { ConventionConfig, BiddingContext } from "./types";
import { auctionMatchesExact, buildAuction } from "../engine/auction-helpers";
import { getSuitLength } from "../engine/hand-evaluator";
import type { RuleCondition } from "./types";
import {
  conditionedRule,
  auctionMatchesAny,
  hcpMin,
  hcpMax,
  hcpRange,
  majorSupport,
  isOpener,
  isResponder,
  biddingRound,
  partnerBidAt,
} from "./conditions";

// SUIT_ORDER indices: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs

// ─── Deal Constraints ─────────────────────────────────────────

/** Bergen Raises deal constraints: opener 12-21 HCP with 5+ major, responder 0+ HCP with exactly 4 in a major */
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
      minHcp: 0,
      minLengthAny: { [Suit.Spades]: 4, [Suit.Hearts]: 4 },
      maxLength: { [Suit.Spades]: 4, [Suit.Hearts]: 4 },
    },
  ],
  dealer: Seat.North,
};

// ─── Bidding Rules ────────────────────────────────────────────

const bergenGameRaise = conditionedRule({
  name: "bergen-game-raise",
  auctionConditions: [
    auctionMatchesAny([
      ["1H", "P"],
      ["1S", "P"],
    ]),
  ],
  handConditions: [hcpMin(13), majorSupport()],
  call(ctx: BiddingContext): Call {
    if (auctionMatchesExact(ctx.auction, ["1H", "P"])) {
      return { type: "bid", level: 4, strain: BidSuit.Hearts };
    }
    return { type: "bid", level: 4, strain: BidSuit.Spades };
  },
});

const bergenLimitRaise = conditionedRule({
  name: "bergen-limit-raise",
  auctionConditions: [
    auctionMatchesAny([
      ["1H", "P"],
      ["1S", "P"],
    ]),
  ],
  handConditions: [hcpRange(10, 12), majorSupport()],
  call(): Call {
    return { type: "bid", level: 3, strain: BidSuit.Diamonds };
  },
});

const bergenConstructiveRaise = conditionedRule({
  name: "bergen-constructive-raise",
  auctionConditions: [
    auctionMatchesAny([
      ["1H", "P"],
      ["1S", "P"],
    ]),
  ],
  handConditions: [hcpRange(7, 9), majorSupport()],
  call(): Call {
    return { type: "bid", level: 3, strain: BidSuit.Clubs };
  },
});

const bergenPreemptiveRaise = conditionedRule({
  name: "bergen-preemptive-raise",
  auctionConditions: [
    auctionMatchesAny([
      ["1H", "P"],
      ["1S", "P"],
    ]),
  ],
  handConditions: [hcpMax(6), majorSupport()],
  call(ctx: BiddingContext): Call {
    if (auctionMatchesExact(ctx.auction, ["1H", "P"])) {
      return { type: "bid", level: 3, strain: BidSuit.Hearts };
    }
    return { type: "bid", level: 3, strain: BidSuit.Spades };
  },
});

// ─── Local Helpers ───────────────────────────────────────────

/** Find the strain of this seat's first contract bid in the auction. */
function myFirstBidStrain(ctx: BiddingContext): BidSuit | null {
  for (const entry of ctx.auction.entries) {
    if (entry.call.type === "bid" && entry.seat === ctx.seat) {
      return entry.call.strain;
    }
  }
  return null;
}

/** Condition: partner raised to 3 of opener's major (for preemptive detection). */
function partnerRaisedToThreeOfMajor(): RuleCondition {
  return {
    name: "partner-raised-3M",
    label: "Partner raised to 3 of opened major",
    test(ctx) {
      const strain = myFirstBidStrain(ctx);
      if (strain !== BidSuit.Hearts && strain !== BidSuit.Spades) return false;
      const partner = partnerSeat(ctx.seat);
      return ctx.auction.entries.some(
        (e) =>
          e.seat === partner &&
          e.call.type === "bid" &&
          e.call.level === 3 &&
          e.call.strain === strain,
      );
    },
    describe(ctx) {
      const strain = myFirstBidStrain(ctx);
      if (strain !== BidSuit.Hearts && strain !== BidSuit.Spades) {
        return "Opener did not bid a major";
      }
      const partner = partnerSeat(ctx.seat);
      const found = ctx.auction.entries.some(
        (e) =>
          e.seat === partner &&
          e.call.type === "bid" &&
          e.call.level === 3 &&
          e.call.strain === strain,
      );
      return found
        ? `Partner raised to 3${strain}`
        : `Partner did not raise to 3${strain}`;
    },
  };
}

// ─── Opener Rebids After Constructive (1M P 3C P) ───────────

const bergenRebidGameAfterConstructive = conditionedRule({
  name: "bergen-rebid-game-after-constructive",
  auctionConditions: [isOpener(), biddingRound(1), partnerBidAt(3, BidSuit.Clubs)],
  handConditions: [hcpMin(17)],
  call(ctx: BiddingContext): Call {
    const strain = myFirstBidStrain(ctx);
    return { type: "bid", level: 4, strain: strain === BidSuit.Spades ? BidSuit.Spades : BidSuit.Hearts };
  },
});

const bergenRebidTryAfterConstructive = conditionedRule({
  name: "bergen-rebid-try-after-constructive",
  auctionConditions: [isOpener(), biddingRound(1), partnerBidAt(3, BidSuit.Clubs)],
  handConditions: [hcpRange(14, 16)],
  call(): Call {
    return { type: "bid", level: 3, strain: BidSuit.Diamonds };
  },
});

const bergenRebidSignoffAfterConstructive = conditionedRule({
  name: "bergen-rebid-signoff-after-constructive",
  auctionConditions: [isOpener(), biddingRound(1), partnerBidAt(3, BidSuit.Clubs)],
  handConditions: [hcpRange(12, 13)],
  call(): Call {
    return { type: "pass" };
  },
});

// ─── Responder Game Try Continuation (1M P 3C P 3D P) ───────

const bergenTryAccept = conditionedRule({
  name: "bergen-try-accept",
  auctionConditions: [isResponder(), biddingRound(1), partnerBidAt(3, BidSuit.Diamonds)],
  handConditions: [hcpRange(9, 10)],
  call(ctx: BiddingContext): Call {
    if (auctionMatchesExact(ctx.auction, ["1H", "P", "3C", "P", "3D", "P"])) {
      return { type: "bid", level: 4, strain: BidSuit.Hearts };
    }
    return { type: "bid", level: 4, strain: BidSuit.Spades };
  },
});

const bergenTryReject = conditionedRule({
  name: "bergen-try-reject",
  auctionConditions: [isResponder(), biddingRound(1), partnerBidAt(3, BidSuit.Diamonds)],
  handConditions: [hcpRange(7, 8)],
  call(ctx: BiddingContext): Call {
    if (auctionMatchesExact(ctx.auction, ["1H", "P", "3C", "P", "3D", "P"])) {
      return { type: "bid", level: 3, strain: BidSuit.Hearts };
    }
    return { type: "bid", level: 3, strain: BidSuit.Spades };
  },
});

// ─── Opener Rebids After Limit (1M P 3D P) ──────────────────

const bergenRebidGameAfterLimit = conditionedRule({
  name: "bergen-rebid-game-after-limit",
  auctionConditions: [isOpener(), biddingRound(1), partnerBidAt(3, BidSuit.Diamonds)],
  handConditions: [hcpMin(15)],
  call(ctx: BiddingContext): Call {
    const strain = myFirstBidStrain(ctx);
    return { type: "bid", level: 4, strain: strain === BidSuit.Spades ? BidSuit.Spades : BidSuit.Hearts };
  },
});

const bergenRebidSignoffAfterLimit = conditionedRule({
  name: "bergen-rebid-signoff-after-limit",
  auctionConditions: [isOpener(), biddingRound(1), partnerBidAt(3, BidSuit.Diamonds)],
  handConditions: [hcpRange(12, 14)],
  call(ctx: BiddingContext): Call {
    const strain = myFirstBidStrain(ctx);
    return { type: "bid", level: 3, strain: strain === BidSuit.Spades ? BidSuit.Spades : BidSuit.Hearts };
  },
});

// ─── Opener Rebids After Preemptive (1M P 3M P) ─────────────

const bergenRebidGameAfterPreemptive = conditionedRule({
  name: "bergen-rebid-game-after-preemptive",
  auctionConditions: [isOpener(), biddingRound(1), partnerRaisedToThreeOfMajor()],
  handConditions: [hcpMin(18)],
  call(ctx: BiddingContext): Call {
    const strain = myFirstBidStrain(ctx);
    return { type: "bid", level: 4, strain: strain === BidSuit.Spades ? BidSuit.Spades : BidSuit.Hearts };
  },
});

const bergenRebidPassAfterPreemptive = conditionedRule({
  name: "bergen-rebid-pass-after-preemptive",
  auctionConditions: [isOpener(), biddingRound(1), partnerRaisedToThreeOfMajor()],
  handConditions: [hcpRange(12, 17)],
  call(): Call {
    return { type: "pass" };
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
  const openMajor = spades >= 5 && spades >= hearts ? "1S" : "1H";
  return buildAuction(Seat.North, [openMajor, "P"]);
}

// ─── Convention Config ────────────────────────────────────────

export const bergenConfig: ConventionConfig = {
  id: "bergen-raises",
  name: "Bergen Raises",
  description:
    "Bergen Raises: coded responses to 1M opening showing support and strength",
  category: ConventionCategory.Constructive,
  dealConstraints: bergenDealConstraints,
  biddingRules: [
    // --- Responder initial rules (2-entry auction: "1M P") ---
    bergenGameRaise,
    bergenLimitRaise,
    bergenConstructiveRaise,
    bergenPreemptiveRaise,
    // --- Opener rebids after constructive (4-entry: "1M P 3C P") ---
    bergenRebidGameAfterConstructive,
    bergenRebidTryAfterConstructive,
    bergenRebidSignoffAfterConstructive,
    // --- Responder game try continuation (6-entry: "1M P 3C P 3D P") ---
    bergenTryAccept,
    bergenTryReject,
    // --- Opener rebids after limit (4-entry: "1M P 3D P") ---
    bergenRebidGameAfterLimit,
    bergenRebidSignoffAfterLimit,
    // --- Opener rebids after preemptive (4-entry: "1M P 3M P") ---
    bergenRebidGameAfterPreemptive,
    bergenRebidPassAfterPreemptive,
  ],
  examples: [],
  defaultAuction: bergenDefaultAuction,
};
