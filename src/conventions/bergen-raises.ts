import { Seat, Suit, BidSuit } from "../engine/types";
import type { DealConstraints, Call, Auction, Deal } from "../engine/types";
import { partnerSeat } from "../engine/constants";
import { ConventionCategory } from "./types";
import type { BiddingContext, RuleCondition } from "./types";
import { buildAuction } from "../engine/auction-helpers";
import { getSuitLength } from "../engine/hand-evaluator";
import {
  auctionMatchesAny,
  hcpMin,
  hcpMax,
  hcpRange,
  majorSupport,
  hasShortage,
  and,
  not,
  isOpener,
  isResponder,
  biddingRound,
  partnerBidAt,
  opponentActed,
  seatFirstBidStrain,
  partnerOpeningStrain,
} from "./conditions";
import { decision, bid, fallback } from "./rule-tree";
import type { RuleNode, TreeConventionConfig } from "./rule-tree";


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

// ─── Local Helpers ───────────────────────────────────────────

const pass: Call = { type: "pass" };

/** Resolve a major strain, returning null if not Hearts or Spades. */
function asMajor(strain: BidSuit | null): BidSuit.Hearts | BidSuit.Spades | null {
  if (strain === BidSuit.Hearts || strain === BidSuit.Spades) return strain;
  return null;
}

/** Dynamic call: return 4 of opener's major (called by responder). */
function gameInOpenersMajor(ctx: BiddingContext): Call {
  const strain = asMajor(partnerOpeningStrain(ctx));
  if (!strain) return pass;
  return { type: "bid", level: 4, strain };
}

/** Dynamic call: return 3 of opener's major (called by responder). */
function threeOfOpenersMajor(ctx: BiddingContext): Call {
  const strain = asMajor(partnerOpeningStrain(ctx));
  if (!strain) return pass;
  return { type: "bid", level: 3, strain };
}

/** Dynamic call for game try accept: return 4M (called by responder). */
function gameTryAcceptCall(ctx: BiddingContext): Call {
  const strain = asMajor(partnerOpeningStrain(ctx));
  if (!strain) return pass;
  return { type: "bid", level: 4, strain };
}

/** Dynamic call for game try reject: return 3M (called by responder). */
function gameTryRejectCall(ctx: BiddingContext): Call {
  const strain = asMajor(partnerOpeningStrain(ctx));
  if (!strain) return pass;
  return { type: "bid", level: 3, strain };
}

/** Dynamic call for opener rebid game: return 4M of opener's own suit. */
function openerRebidGame(ctx: BiddingContext): Call {
  const strain = asMajor(seatFirstBidStrain(ctx));
  if (!strain) return pass;
  return { type: "bid", level: 4, strain };
}

/** Dynamic call for opener rebid signoff: return 3M of opener's own suit. */
function openerRebidSignoff(ctx: BiddingContext): Call {
  const strain = asMajor(seatFirstBidStrain(ctx));
  if (!strain) return pass;
  return { type: "bid", level: 3, strain };
}

/** Dynamic call for splinter: 3S after 1H, 3H after 1S (the OTHER major). */
function splinterCall(ctx: BiddingContext): Call {
  const strain = asMajor(partnerOpeningStrain(ctx));
  if (!strain) return pass;
  // Splinter is the other major at the 3 level
  const otherMajor = strain === BidSuit.Hearts ? BidSuit.Spades : BidSuit.Hearts;
  return { type: "bid", level: 3, strain: otherMajor };
}

// ─── Local Conditions ───────────────────────────────────────

/** Condition: partner raised to 3 of opener's major (for preemptive detection). */
function partnerRaisedToThreeOfMajor(): RuleCondition {
  return {
    name: "partner-raised-3M",
    label: "Partner raised to 3 of opened major",
    test(ctx) {
      const strain = seatFirstBidStrain(ctx);
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
      const strain = seatFirstBidStrain(ctx);
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

/** Condition: partner bid game in a major (4H or 4S). */
function partnerBidGameInMajor(): RuleCondition {
  return {
    name: "partner-bid-4M",
    label: "Partner bid game in major",
    test(ctx) {
      const partner = partnerSeat(ctx.seat);
      return ctx.auction.entries.some(
        (e) =>
          e.seat === partner &&
          e.call.type === "bid" &&
          e.call.level === 4 &&
          (e.call.strain === BidSuit.Hearts || e.call.strain === BidSuit.Spades),
      );
    },
    describe(ctx) {
      const partner = partnerSeat(ctx.seat);
      const found = ctx.auction.entries.find(
        (e) =>
          e.seat === partner &&
          e.call.type === "bid" &&
          e.call.level === 4 &&
          (e.call.strain === BidSuit.Hearts || e.call.strain === BidSuit.Spades),
      );
      return found ? `Partner bid game in ${(found.call as { strain: BidSuit }).strain}` : "Partner has not bid game in a major";
    },
  };
}

/** Condition: partner signed off in 3 of their opened major. */
function partnerSignedOffInThreeMajor(): RuleCondition {
  return {
    name: "partner-signoff-3M",
    label: "Partner signed off in 3 of major",
    test(ctx) {
      const partner = partnerSeat(ctx.seat);
      // Find partner's opening strain (partner is opener in Bergen)
      const firstEntry = ctx.auction.entries.find(
        (e) => e.call.type === "bid" && e.seat === partner,
      );
      const openerStrain = firstEntry?.call.type === "bid" ? firstEntry.call.strain : null;
      if (openerStrain !== BidSuit.Hearts && openerStrain !== BidSuit.Spades) return false;
      // Check partner bid 3 of that same major (their rebid)
      let partnerBidCount = 0;
      for (const entry of ctx.auction.entries) {
        if (entry.seat === partner && entry.call.type === "bid") {
          partnerBidCount++;
          if (
            partnerBidCount === 2 &&
            entry.call.level === 3 &&
            entry.call.strain === openerStrain
          ) {
            return true;
          }
        }
      }
      return false;
    },
    describe(ctx) {
      return this.test(ctx)
        ? "Partner signed off in 3 of their major"
        : "Partner did not sign off in 3 of major";
    },
  };
}

// ─── Rule Tree ────────────────────────────────────────────────

// Responder initial bids (after 1M-P)
const responderInitialBranch: RuleNode = decision(
  "splinter-hcp",
  and(hcpMin(12), majorSupport(), hasShortage()),
  bid("bergen-splinter", splinterCall),
  decision(
    "game-raise-hcp",
    and(hcpMin(13), majorSupport()),
    bid("bergen-game-raise", gameInOpenersMajor),
    decision(
      "limit-raise-hcp",
      and(hcpRange(10, 12), majorSupport()),
      bid("bergen-limit-raise", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Diamonds })),
      decision(
        "constructive-hcp",
        and(hcpRange(7, 10), majorSupport()),
        bid("bergen-constructive-raise", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Clubs })),
        decision(
          "preemptive-hcp",
          and(hcpMax(6), majorSupport()),
          bid("bergen-preemptive-raise", threeOfOpenersMajor),
          fallback(),
        ),
      ),
    ),
  ),
);

// Opener rebids after constructive (1M P 3C P)
const openerAfterConstructive: RuleNode = decision(
  "rebid-game-17+",
  hcpMin(17),
  bid("bergen-rebid-game-after-constructive", openerRebidGame),
  decision(
    "rebid-try-14-16",
    hcpRange(14, 16),
    bid("bergen-rebid-try-after-constructive", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Diamonds })),
    bid("bergen-rebid-signoff-after-constructive", (): Call => ({ type: "pass" })),
  ),
);

// Opener rebids after limit (1M P 3D P)
const openerAfterLimit: RuleNode = decision(
  "rebid-game-15+",
  hcpMin(15),
  bid("bergen-rebid-game-after-limit", openerRebidGame),
  bid("bergen-rebid-signoff-after-limit", openerRebidSignoff),
);

// Opener rebids after preemptive (1M P 3M P)
const openerAfterPreemptive: RuleNode = decision(
  "rebid-game-18+",
  hcpMin(18),
  bid("bergen-rebid-game-after-preemptive", openerRebidGame),
  bid("bergen-rebid-pass-after-preemptive", (): Call => ({ type: "pass" })),
);

// Opener round 1 rebids
const openerRound1Branch: RuleNode = decision(
  "after-constructive",
  partnerBidAt(3, BidSuit.Clubs),
  openerAfterConstructive,
  decision(
    "after-limit",
    partnerBidAt(3, BidSuit.Diamonds),
    openerAfterLimit,
    decision(
      "after-preemptive",
      partnerRaisedToThreeOfMajor(),
      openerAfterPreemptive,
      fallback(),
    ),
  ),
);

// Responder round 1 continuation
const responderRound1Branch: RuleNode = decision(
  "partner-bid-game",
  partnerBidGameInMajor(),
  bid("bergen-accept-game", (): Call => ({ type: "pass" })),
  decision(
    "partner-signoff",
    partnerSignedOffInThreeMajor(),
    bid("bergen-accept-signoff", (): Call => ({ type: "pass" })),
    decision(
      "game-try-resp",
      partnerBidAt(3, BidSuit.Diamonds),
      decision(
        "try-accept-9-10",
        hcpRange(9, 10),
        bid("bergen-try-accept", gameTryAcceptCall),
        bid("bergen-try-reject", gameTryRejectCall),
      ),
      fallback(),
    ),
  ),
);

// Root tree
const bergenRuleTree: RuleNode = decision(
  "responder-initial",
  auctionMatchesAny([["1H", "P"], ["1S", "P"]]),
  responderInitialBranch,
  decision(
    "is-opener-round1",
    and(isOpener(), biddingRound(1), not(opponentActed())),
    openerRound1Branch,
    decision(
      "is-responder-round1",
      and(isResponder(), biddingRound(1), not(opponentActed())),
      responderRound1Branch,
      decision(
        "is-opener-round2",
        and(isOpener(), biddingRound(2), not(opponentActed())),
        bid("bergen-opener-accept-after-try", (): Call => ({ type: "pass" })),
        fallback(),
      ),
    ),
  ),
);

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

export const bergenConfig: TreeConventionConfig = {
  id: "bergen-raises",
  name: "Bergen Raises",
  description:
    "Bergen Raises: coded responses to 1M opening showing support and strength",
  category: ConventionCategory.Constructive,
  dealConstraints: bergenDealConstraints,
  ruleTree: bergenRuleTree,
  examples: [],
  defaultAuction: bergenDefaultAuction,
};
