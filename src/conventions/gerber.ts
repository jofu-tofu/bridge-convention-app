import { Seat, BidSuit } from "../engine/types";
import type { DealConstraints, Call, Auction } from "../engine/types";
import { ConventionCategory } from "./types";
import type { ConventionConfig, BiddingContext } from "./types";
import { buildAuction } from "../engine/auction-helpers";
import {
  conditionedRule,
  auctionMatchesAny,
  hcpMin,
  aceCount,
  aceCountAny,
  kingCount,
  kingCountAny,
  noVoid,
  gerberSignoffCondition,
  gerberKingAskCondition,
  countAcesInHand,
  countKingsInHand,
} from "./conditions";

// SUIT_ORDER indices: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs

/** Re-export canonical counters for tests and external consumers. */
export { countAcesInHand as countAces, countKingsInHand as countKings } from "./conditions";

/** Local aliases for use within this module. */
const countAces = countAcesInHand;
const countKings = countKingsInHand;

/**
 * Infer how many aces opener showed from the ace response bid.
 * 4D = 0 or 4 aces, 4H = 1, 4S = 2, 4NT = 3.
 * For 4D, we disambiguate using responder's ace count:
 * if responder has 4 aces, opener has 0; otherwise opener has 4.
 */
function inferOpenerAces(auction: Auction, responderAces: number): number {
  // The ace response is the 5th call (index 4): 1NT-P-4C-P-{response}
  const responseEntry = auction.entries[4];
  if (!responseEntry || responseEntry.call.type !== "bid") return 0;
  const response = responseEntry.call;

  if (response.strain === BidSuit.Diamonds && response.level === 4) {
    // 4D = 0 or 4 aces
    return responderAces === 4 ? 0 : 4;
  }
  if (response.strain === BidSuit.Hearts && response.level === 4) return 1;
  if (response.strain === BidSuit.Spades && response.level === 4) return 2;
  if (response.strain === BidSuit.NoTrump && response.level === 4) return 3;
  return 0;
}

/** Gerber deal constraints: opener 15-17 balanced (standard 1NT), responder 16+ HCP */
export const gerberDealConstraints: DealConstraints = {
  seats: [
    {
      seat: Seat.North,
      minHcp: 15,
      maxHcp: 17,
      balanced: true,
    },
    {
      seat: Seat.South,
      minHcp: 16,
    },
  ],
  dealer: Seat.North,
};

// --- Bidding Rules ---

const gerberAsk = conditionedRule({
  name: "gerber-ask",
  auctionConditions: [auctionMatchesAny([["1NT", "P"], ["2NT", "P"]])],
  handConditions: [hcpMin(16), noVoid()],
  call(): Call {
    return { type: "bid", level: 4, strain: BidSuit.Clubs };
  },
});

const gerberAceAuctionPatterns: string[][] = [
  ["1NT", "P", "4C", "P"],
  ["2NT", "P", "4C", "P"],
];

const gerberResponseZeroFour = conditionedRule({
  name: "gerber-response-zero-four",
  auctionConditions: [auctionMatchesAny(gerberAceAuctionPatterns)],
  handConditions: [aceCountAny([0, 4])],
  call(): Call {
    return { type: "bid", level: 4, strain: BidSuit.Diamonds };
  },
});

const gerberResponseOne = conditionedRule({
  name: "gerber-response-one",
  auctionConditions: [auctionMatchesAny(gerberAceAuctionPatterns)],
  handConditions: [aceCount(1)],
  call(): Call {
    return { type: "bid", level: 4, strain: BidSuit.Hearts };
  },
});

const gerberResponseTwo = conditionedRule({
  name: "gerber-response-two",
  auctionConditions: [auctionMatchesAny(gerberAceAuctionPatterns)],
  handConditions: [aceCount(2)],
  call(): Call {
    return { type: "bid", level: 4, strain: BidSuit.Spades };
  },
});

const gerberResponseThree = conditionedRule({
  name: "gerber-response-three",
  auctionConditions: [auctionMatchesAny(gerberAceAuctionPatterns)],
  handConditions: [aceCount(3)],
  call(): Call {
    return { type: "bid", level: 4, strain: BidSuit.NoTrump };
  },
});

// --- King-Asking (5C) ---

const gerberKingAsk = conditionedRule({
  name: "gerber-king-ask",
  auctionConditions: [],
  handConditions: [gerberKingAskCondition()], // Hybrid: checks auction + total aces >= 3
  call(): Call {
    return { type: "bid", level: 5, strain: BidSuit.Clubs };
  },
});

// --- King Responses ---

/** Build all king-ask auction patterns: {NT}-P-4C-P-{ace resp}-P-5C-P */
const gerberKingAskAuctionPatterns: string[][] = [];
for (const opening of ["1NT", "2NT"]) {
  for (const aceResp of ["4D", "4H", "4S", "4NT"]) {
    gerberKingAskAuctionPatterns.push([opening, "P", "4C", "P", aceResp, "P", "5C", "P"]);
  }
}

const gerberKingResponseZeroFour = conditionedRule({
  name: "gerber-king-response-zero-four",
  auctionConditions: [auctionMatchesAny(gerberKingAskAuctionPatterns)],
  handConditions: [kingCountAny([0, 4])],
  call(): Call {
    return { type: "bid", level: 5, strain: BidSuit.Diamonds };
  },
});

const gerberKingResponseOne = conditionedRule({
  name: "gerber-king-response-one",
  auctionConditions: [auctionMatchesAny(gerberKingAskAuctionPatterns)],
  handConditions: [kingCount(1)],
  call(): Call {
    return { type: "bid", level: 5, strain: BidSuit.Hearts };
  },
});

const gerberKingResponseTwo = conditionedRule({
  name: "gerber-king-response-two",
  auctionConditions: [auctionMatchesAny(gerberKingAskAuctionPatterns)],
  handConditions: [kingCount(2)],
  call(): Call {
    return { type: "bid", level: 5, strain: BidSuit.Spades };
  },
});

const gerberKingResponseThree = conditionedRule({
  name: "gerber-king-response-three",
  auctionConditions: [auctionMatchesAny(gerberKingAskAuctionPatterns)],
  handConditions: [kingCount(3)],
  call(): Call {
    return { type: "bid", level: 5, strain: BidSuit.NoTrump };
  },
});

// --- Signoff ---

/**
 * Infer opener king count from the king response bid.
 * 5D = 0 or 4 kings, 5H = 1, 5S = 2, 5NT = 3.
 */
function inferOpenerKings(auction: Auction, responderKings: number): number {
  // King response is at index 8: {NT}-P-4C-P-{ace}-P-5C-P-{king response}
  const responseEntry = auction.entries[8];
  if (!responseEntry || responseEntry.call.type !== "bid") return 0;
  const response = responseEntry.call;

  if (response.strain === BidSuit.Diamonds && response.level === 5) {
    return responderKings === 4 ? 0 : 4;
  }
  if (response.strain === BidSuit.Hearts && response.level === 5) return 1;
  if (response.strain === BidSuit.Spades && response.level === 5) return 2;
  if (response.strain === BidSuit.NoTrump && response.level === 5) return 3;
  return 0;
}

/** Check if this is a king-response signoff position (10 entries in auction). */
function isAfterKingResponse(auction: Auction): boolean {
  // After king response: {NT}-P-4C-P-{ace}-P-5C-P-{king}-P = 10 entries
  return auction.entries.length === 10;
}

const gerberSignoff = conditionedRule({
  name: "gerber-signoff",
  auctionConditions: [],
  handConditions: [gerberSignoffCondition()], // Hybrid: checks auction to resolve aces/kings, gates on hand
  call(ctx: BiddingContext): Call {
    const responderAces = countAces(ctx.hand);
    const openerAces = inferOpenerAces(ctx.auction, responderAces);
    const totalAces = responderAces + openerAces;

    if (isAfterKingResponse(ctx.auction)) {
      // After king response: decide based on aces + kings
      const responderKings = countKings(ctx.hand);
      const openerKings = inferOpenerKings(ctx.auction, responderKings);
      const totalKings = responderKings + openerKings;

      // 4A+4K is a subset of >=4A+>=3K — single branch covers both
      if (totalAces >= 4 && totalKings >= 3) {
        return { type: "bid", level: 7, strain: BidSuit.NoTrump };
      }
      if (totalAces >= 3) {
        return { type: "bid", level: 6, strain: BidSuit.NoTrump };
      }
      return { type: "bid", level: 5, strain: BidSuit.NoTrump };
    }

    // After ace response only (no king ask): direct signoff
    if (totalAces === 4) {
      return { type: "bid", level: 7, strain: BidSuit.NoTrump };
    }
    if (totalAces >= 3) {
      return { type: "bid", level: 6, strain: BidSuit.NoTrump };
    }

    // Sign off: after 4D or 4H responses, 4NT is available.
    // After 4S response, need 5NT. After 4NT response (3 aces), totalAces >= 3 already handled.
    const responseEntry = ctx.auction.entries[4];
    if (responseEntry && responseEntry.call.type === "bid") {
      const response = responseEntry.call;
      if (response.strain === BidSuit.Spades && response.level === 4) {
        return { type: "bid", level: 5, strain: BidSuit.NoTrump };
      }
    }
    return { type: "bid", level: 4, strain: BidSuit.NoTrump };
  },
});

/** Responder position starts after 1NT - P. */
function gerberDefaultAuction(
  seat: Seat,
  _deal?: import("../engine/types").Deal,
): Auction | undefined {
  if (seat === Seat.South || seat === Seat.East) {
    return buildAuction(Seat.North, ["1NT", "P"]);
  }
  return undefined;
}

export const gerberConfig: ConventionConfig = {
  id: "gerber",
  name: "Gerber",
  description:
    "Gerber convention: 4C response to NT opening asking for aces, then 5C for kings (slam exploration)",
  category: ConventionCategory.Asking,
  dealConstraints: gerberDealConstraints,
  biddingRules: [
    gerberAsk,
    gerberResponseZeroFour,
    gerberResponseOne,
    gerberResponseTwo,
    gerberResponseThree,
    gerberKingAsk,
    gerberKingResponseZeroFour,
    gerberKingResponseOne,
    gerberKingResponseTwo,
    gerberKingResponseThree,
    gerberSignoff,
  ],
  examples: [],
  defaultAuction: gerberDefaultAuction,
};
