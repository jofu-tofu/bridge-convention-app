import { BidSuit } from "../../../engine/types";
import type { Call, Auction, ContractBid } from "../../../engine/types";
import type { BiddingContext } from "../../core/types";
import { auctionMatchesExact } from "../../../engine/auction-helpers";
import { countAcesInHand, countKingsInHand } from "../../core/conditions";

/** Re-export canonical counters for tests and external consumers. */
export { countAcesInHand as countAces, countKingsInHand as countKings } from "../../core/conditions";

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
    // 4D = 0 or 4 aces — disambiguate: if responder has 0, opener has all 4
    return responderAces === 0 ? 4 : 0;
  }
  if (response.strain === BidSuit.Hearts && response.level === 4) return 1;
  if (response.strain === BidSuit.Spades && response.level === 4) return 2;
  if (response.strain === BidSuit.NoTrump && response.level === 4) return 3;
  return 0;
}

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
    // 5D = 0 or 4 kings — disambiguate: if responder has 0, opener has all 4
    return responderKings === 0 ? 4 : 0;
  }
  if (response.strain === BidSuit.Hearts && response.level === 5) return 1;
  if (response.strain === BidSuit.Spades && response.level === 5) return 2;
  if (response.strain === BidSuit.NoTrump && response.level === 5) return 3;
  return 0;
}

// ─── Auction patterns ─────────────────────────────────────────

export const gerberAceAuctionPatterns: string[][] = [
  ["1NT", "P", "4C", "P"],
  ["2NT", "P", "4C", "P"],
];

/** Build all king-ask auction patterns: {NT}-P-4C-P-{ace resp}-P-5C-P */
export const gerberKingAskAuctionPatterns: string[][] = [];
for (const opening of ["1NT", "2NT"]) {
  for (const aceResp of ["4D", "4H", "4S", "4NT"]) {
    gerberKingAskAuctionPatterns.push([opening, "P", "4C", "P", aceResp, "P", "5C", "P"]);
  }
}

/** Build all king-response auction patterns. */
const gerberKingResponseAuctionPatterns: string[][] = [];
for (const opening of ["1NT", "2NT"]) {
  for (const aceResp of ["4D", "4H", "4S", "4NT"]) {
    for (const kingResp of ["5D", "5H", "5S", "5NT"]) {
      gerberKingResponseAuctionPatterns.push([opening, "P", "4C", "P", aceResp, "P", "5C", "P", kingResp, "P"]);
    }
  }
}

/** Check if this is a king-response signoff position. */
function isAfterKingResponse(auction: Auction): boolean {
  return gerberKingResponseAuctionPatterns.some((p) =>
    auctionMatchesExact(auction, p),
  );
}

// ─── Signoff call function ────────────────────────────────────

function ntBid(level: ContractBid["level"]): Call {
  return { type: "bid", level, strain: BidSuit.NoTrump };
}

/** Signoff after king response: bid based on total aces + kings. */
function signoffAfterKings(ctx: BiddingContext, totalAces: number): Call {
  const responderKings = countKingsInHand(ctx.hand);
  const openerKings = inferOpenerKings(ctx.auction, responderKings);
  const totalKings = responderKings + openerKings;

  if (totalAces >= 4 && totalKings >= 3) return ntBid(7);
  if (totalAces >= 3) return ntBid(6);
  return ntBid(5);
}

/** Signoff after ace response only: bid based on total aces. */
function signoffAfterAces(ctx: BiddingContext, totalAces: number): Call {
  if (totalAces === 4) return ntBid(7);
  if (totalAces >= 3) return ntBid(6);

  // 2 aces (4S response) → 5NT; fewer → 4NT
  const responseEntry = ctx.auction.entries[4];
  if (responseEntry && responseEntry.call.type === "bid") {
    const response = responseEntry.call;
    if (response.strain === BidSuit.Spades && response.level === 4) {
      return ntBid(5);
    }
  }
  return ntBid(4);
}

export function gerberSignoffCall(ctx: BiddingContext): Call {
  const responderAces = countAcesInHand(ctx.hand);
  const openerAces = inferOpenerAces(ctx.auction, responderAces);
  const totalAces = responderAces + openerAces;

  if (isAfterKingResponse(ctx.auction)) {
    return signoffAfterKings(ctx, totalAces);
  }
  return signoffAfterAces(ctx, totalAces);
}
