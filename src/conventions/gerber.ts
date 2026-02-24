import { Seat, BidSuit } from "../engine/types";
import type { DealConstraints, Call, Auction, ContractBid } from "../engine/types";
import { ConventionCategory } from "./types";
import type { BiddingContext } from "./types";
import { auctionMatchesExact, buildAuction } from "../engine/auction-helpers";
import {
  auctionMatchesAny,
  hcpMin,
  and,
  aceCount,
  kingCount,
  noVoid,
  gerberSignoffCondition,
  gerberKingAskCondition,
  countAcesInHand,
  countKingsInHand,
} from "./conditions";
import { decision, bid, fallback } from "./rule-tree";
import type { RuleNode, TreeConventionConfig } from "./rule-tree";
import { flattenTree } from "./tree-compat";

// SUIT_ORDER indices: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs

/** Re-export canonical counters for tests and external consumers. */
export { countAcesInHand as countAces, countKingsInHand as countKings } from "./conditions";

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

// ─── Auction patterns ─────────────────────────────────────────

const gerberAceAuctionPatterns: string[][] = [
  ["1NT", "P", "4C", "P"],
  ["2NT", "P", "4C", "P"],
];

/** Build all king-ask auction patterns: {NT}-P-4C-P-{ace resp}-P-5C-P */
const gerberKingAskAuctionPatterns: string[][] = [];
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

function gerberSignoffCall(ctx: BiddingContext): Call {
  const responderAces = countAcesInHand(ctx.hand);
  const openerAces = inferOpenerAces(ctx.auction, responderAces);
  const totalAces = responderAces + openerAces;

  if (isAfterKingResponse(ctx.auction)) {
    return signoffAfterKings(ctx, totalAces);
  }
  return signoffAfterAces(ctx, totalAces);
}

// ─── Rule Tree ────────────────────────────────────────────────

// Ace response subtree: chained binary decisions (3? → 2? → 1? → 0/4)
const aceResponseBranch: RuleNode = decision(
  "ace-3",
  aceCount(3),
  bid("gerber-response-three", (): Call => ({ type: "bid", level: 4, strain: BidSuit.NoTrump })),
  decision(
    "ace-2",
    aceCount(2),
    bid("gerber-response-two", (): Call => ({ type: "bid", level: 4, strain: BidSuit.Spades })),
    decision(
      "ace-1",
      aceCount(1),
      bid("gerber-response-one", (): Call => ({ type: "bid", level: 4, strain: BidSuit.Hearts })),
      bid("gerber-response-zero-four", (): Call => ({ type: "bid", level: 4, strain: BidSuit.Diamonds })),
    ),
  ),
);

// King response subtree: chained binary decisions (3? → 2? → 1? → 0/4)
const kingResponseBranch: RuleNode = decision(
  "king-3",
  kingCount(3),
  bid("gerber-king-response-three", (): Call => ({ type: "bid", level: 5, strain: BidSuit.NoTrump })),
  decision(
    "king-2",
    kingCount(2),
    bid("gerber-king-response-two", (): Call => ({ type: "bid", level: 5, strain: BidSuit.Spades })),
    decision(
      "king-1",
      kingCount(1),
      bid("gerber-king-response-one", (): Call => ({ type: "bid", level: 5, strain: BidSuit.Hearts })),
      bid("gerber-king-response-zero-four", (): Call => ({ type: "bid", level: 5, strain: BidSuit.Diamonds })),
    ),
  ),
);

const gerberRuleTree: RuleNode = decision(
  "after-nt-opening",
  auctionMatchesAny([["1NT", "P"], ["2NT", "P"]]),
  // YES: responder's turn after NT opening
  decision(
    "hcp-and-no-void",
    and(hcpMin(16), noVoid()),
    bid("gerber-ask", (): Call => ({ type: "bid", level: 4, strain: BidSuit.Clubs })),
    fallback(),
  ),
  // NO: not after NT-P
  decision(
    "after-ace-ask",
    auctionMatchesAny(gerberAceAuctionPatterns),
    // YES: opener responding to ace ask
    aceResponseBranch,
    // NO: not after ace ask
    decision(
      "king-ask-check",
      gerberKingAskCondition(),
      bid("gerber-king-ask", (): Call => ({ type: "bid", level: 5, strain: BidSuit.Clubs })),
      // NO: not king-ask eligible
      decision(
        "after-king-ask",
        auctionMatchesAny(gerberKingAskAuctionPatterns),
        // YES: opener responding to king ask
        kingResponseBranch,
        // NO: not after king ask
        decision(
          "signoff-check",
          gerberSignoffCondition(),
          bid("gerber-signoff", gerberSignoffCall),
          fallback(),
        ),
      ),
    ),
  ),
);

// ─── Default Auction ──────────────────────────────────────────

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

// ─── Convention Config ────────────────────────────────────────

export const gerberConfig: TreeConventionConfig = {
  id: "gerber",
  name: "Gerber",
  description:
    "Gerber convention: 4C response to NT opening asking for aces, then 5C for kings (slam exploration)",
  category: ConventionCategory.Asking,
  dealConstraints: gerberDealConstraints,
  ruleTree: gerberRuleTree,
  biddingRules: flattenTree(gerberRuleTree),
  examples: [],
  defaultAuction: gerberDefaultAuction,
};
