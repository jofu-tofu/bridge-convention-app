import { Seat, Rank, BidSuit } from "../engine/types";
import type { DealConstraints, Call, Auction, Hand } from "../engine/types";
import { ConventionCategory } from "./types";
import type { ConventionConfig, BiddingRule, BiddingContext } from "./types";
import { auctionMatchesExact, buildAuction } from "../engine/auction-helpers";

// SUIT_ORDER indices: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs

/** Count the number of aces in a hand. */
export function countAces(hand: Hand): number {
  let count = 0;
  for (const card of hand.cards) {
    if (card.rank === Rank.Ace) count++;
  }
  return count;
}

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

/** Gerber deal constraints: opener 15-17 balanced (standard 1NT), responder 13+ HCP */
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
      minHcp: 13,
    },
  ],
  dealer: Seat.North,
};

// --- Bidding Rules ---

const gerberAsk: BiddingRule = {
  name: "gerber-ask",
  explanation: "Bid 4C (Gerber) to ask opener for aces after 1NT opening",
  matches(ctx: BiddingContext): boolean {
    if (!auctionMatchesExact(ctx.auction, ["1NT", "P"])) return false;
    return ctx.evaluation.hcp >= 13;
  },
  call(): Call {
    return { type: "bid", level: 4, strain: BidSuit.Clubs };
  },
};

const gerberResponseZeroFour: BiddingRule = {
  name: "gerber-response-zero-four",
  explanation: "Opener bids 4D showing 0 or 4 aces",
  matches(ctx: BiddingContext): boolean {
    if (!auctionMatchesExact(ctx.auction, ["1NT", "P", "4C", "P"])) return false;
    const aces = countAces(ctx.hand);
    return aces === 0 || aces === 4;
  },
  call(): Call {
    return { type: "bid", level: 4, strain: BidSuit.Diamonds };
  },
};

const gerberResponseOne: BiddingRule = {
  name: "gerber-response-one",
  explanation: "Opener bids 4H showing 1 ace",
  matches(ctx: BiddingContext): boolean {
    if (!auctionMatchesExact(ctx.auction, ["1NT", "P", "4C", "P"])) return false;
    return countAces(ctx.hand) === 1;
  },
  call(): Call {
    return { type: "bid", level: 4, strain: BidSuit.Hearts };
  },
};

const gerberResponseTwo: BiddingRule = {
  name: "gerber-response-two",
  explanation: "Opener bids 4S showing 2 aces",
  matches(ctx: BiddingContext): boolean {
    if (!auctionMatchesExact(ctx.auction, ["1NT", "P", "4C", "P"])) return false;
    return countAces(ctx.hand) === 2;
  },
  call(): Call {
    return { type: "bid", level: 4, strain: BidSuit.Spades };
  },
};

const gerberResponseThree: BiddingRule = {
  name: "gerber-response-three",
  explanation: "Opener bids 4NT showing 3 aces",
  matches(ctx: BiddingContext): boolean {
    if (!auctionMatchesExact(ctx.auction, ["1NT", "P", "4C", "P"])) return false;
    return countAces(ctx.hand) === 3;
  },
  call(): Call {
    return { type: "bid", level: 4, strain: BidSuit.NoTrump };
  },
};

const gerberSignoff: BiddingRule = {
  name: "gerber-signoff",
  explanation: "After ace response, responder decides: signoff, small slam 6NT, or grand slam 7NT",
  matches(ctx: BiddingContext): boolean {
    // Match after 1NT-P-4C-P-{4D|4H|4S|4NT}-P (responder's turn)
    const after4D = auctionMatchesExact(ctx.auction, ["1NT", "P", "4C", "P", "4D", "P"]);
    const after4H = auctionMatchesExact(ctx.auction, ["1NT", "P", "4C", "P", "4H", "P"]);
    const after4S = auctionMatchesExact(ctx.auction, ["1NT", "P", "4C", "P", "4S", "P"]);
    const after4NT = auctionMatchesExact(ctx.auction, ["1NT", "P", "4C", "P", "4NT", "P"]);
    return after4D || after4H || after4S || after4NT;
  },
  call(ctx: BiddingContext): Call {
    const responderAces = countAces(ctx.hand);
    const openerAces = inferOpenerAces(ctx.auction, responderAces);
    const totalAces = responderAces + openerAces;

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
};

/** Responder position starts after 1NT - P. */
function gerberDefaultAuction(seat: Seat, _deal?: import("../engine/types").Deal): Auction | undefined {
  if (seat === Seat.South || seat === Seat.East) {
    return buildAuction(Seat.North, ["1NT", "P"]);
  }
  return undefined;
}

export const gerberConfig: ConventionConfig = {
  id: "gerber",
  name: "Gerber",
  description: "Gerber convention: 4C response to 1NT asking for aces (slam exploration)",
  category: ConventionCategory.Asking,
  dealConstraints: gerberDealConstraints,
  biddingRules: [
    gerberAsk,
    gerberResponseZeroFour,
    gerberResponseOne,
    gerberResponseTwo,
    gerberResponseThree,
    gerberSignoff,
  ],
  examples: [],
  defaultAuction: gerberDefaultAuction,
};
