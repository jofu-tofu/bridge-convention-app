import { Seat, Suit, BidSuit } from "../../engine/types";
import type { DealConstraints, Call, Auction } from "../../engine/types";
import { ConventionCategory } from "../core/types";
import { buildAuction } from "../../engine/auction-helpers";
import {
  auctionMatches,
  hcpMin,
  suitMin,
  anySuitMin,
  and,
} from "../core/conditions";
import { decision, bid, fallback } from "../core/rule-tree";
import type { RuleNode, TreeConventionConfig } from "../core/rule-tree";


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

// ─── Rule Tree ────────────────────────────────────────────────

// Round 1: Responder asks 2C (after 1NT-P)
const round1Ask: RuleNode = decision(
  "hcp-8-plus",
  hcpMin(8),
  decision(
    "has-4-card-major",
    anySuitMin(
      [
        { index: 0, name: "spades" },
        { index: 1, name: "hearts" },
      ],
      4,
    ),
    bid("stayman-ask", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Clubs })),
    fallback("no-major"),
  ),
  fallback("too-weak"),
);

// Round 2: Opener responds (after 1NT-P-2C-P)
const round2Response: RuleNode = decision(
  "has-4-hearts",
  suitMin(1, "hearts", 4),
  bid("stayman-response-hearts", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Hearts })),
  decision(
    "has-4-spades",
    suitMin(0, "spades", 4),
    bid("stayman-response-spades", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Spades })),
    bid("stayman-response-denial", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Diamonds })),
  ),
);

// Round 3: Responder rebids — decomposed per opener response

// After opener showed 2H
const rebidAfter2H: RuleNode = decision(
  "fit-hearts",
  suitMin(1, "hearts", 4),
  // Fit found: game or invite based on HCP
  decision(
    "game-hcp-fit-h",
    hcpMin(10),
    bid("stayman-rebid-major-fit", (): Call => ({ type: "bid", level: 4, strain: BidSuit.Hearts })),
    bid("stayman-rebid-major-fit-invite", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Hearts })),
  ),
  // No fit: NT game or invite
  decision(
    "game-hcp-nofit-h",
    hcpMin(10),
    bid("stayman-rebid-no-fit", (): Call => ({ type: "bid", level: 3, strain: BidSuit.NoTrump })),
    bid("stayman-rebid-no-fit-invite", (): Call => ({ type: "bid", level: 2, strain: BidSuit.NoTrump })),
  ),
);

// After opener showed 2S
const rebidAfter2S: RuleNode = decision(
  "fit-spades",
  suitMin(0, "spades", 4),
  decision(
    "game-hcp-fit-s",
    hcpMin(10),
    bid("stayman-rebid-major-fit", (): Call => ({ type: "bid", level: 4, strain: BidSuit.Spades })),
    bid("stayman-rebid-major-fit-invite", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Spades })),
  ),
  decision(
    "game-hcp-nofit-s",
    hcpMin(10),
    bid("stayman-rebid-no-fit", (): Call => ({ type: "bid", level: 3, strain: BidSuit.NoTrump })),
    bid("stayman-rebid-no-fit-invite", (): Call => ({ type: "bid", level: 2, strain: BidSuit.NoTrump })),
  ),
);

// After opener denied with 2D
const rebidAfter2D: RuleNode = decision(
  "smolen-hearts",
  and(hcpMin(10), suitMin(0, "spades", 4), suitMin(1, "hearts", 5)),
  // 3H Smolen: shows 4S+5H, game-forcing
  bid("stayman-rebid-smolen-hearts", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Hearts })),
  decision(
    "smolen-spades",
    and(hcpMin(10), suitMin(0, "spades", 5), suitMin(1, "hearts", 4)),
    // 3S Smolen: shows 5S+4H, game-forcing
    bid("stayman-rebid-smolen-spades", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Spades })),
    decision(
      "game-hcp-denial",
      hcpMin(10),
      bid("stayman-rebid-no-fit", (): Call => ({ type: "bid", level: 3, strain: BidSuit.NoTrump })),
      bid("stayman-rebid-no-fit-invite", (): Call => ({ type: "bid", level: 2, strain: BidSuit.NoTrump })),
    ),
  ),
);

// ─── 2NT Opening Stayman (3C ask) ────────────────────────────

// Round 1: Responder asks 3C (after 2NT-P)
const round1Ask2NT: RuleNode = decision(
  "hcp-8-plus-2nt",
  hcpMin(8),
  decision(
    "has-4-card-major-2nt",
    anySuitMin(
      [
        { index: 0, name: "spades" },
        { index: 1, name: "hearts" },
      ],
      4,
    ),
    bid("stayman-ask", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Clubs })),
    fallback("no-major-2nt"),
  ),
  fallback("too-weak-2nt"),
);

// Round 2: Opener responds (after 2NT-P-3C-P)
const round2Response2NT: RuleNode = decision(
  "has-4-hearts-2nt",
  suitMin(1, "hearts", 4),
  bid("stayman-response-hearts", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Hearts })),
  decision(
    "has-4-spades-2nt",
    suitMin(0, "spades", 4),
    bid("stayman-response-spades", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Spades })),
    bid("stayman-response-denial", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Diamonds })),
  ),
);

// Full tree
const staymanRuleTree: RuleNode = decision(
  "after-1nt-p",
  auctionMatches(["1NT", "P"]),
  // Round 1: Responder's Stayman ask
  round1Ask,
  // Not after 1NT-P
  decision(
    "after-2nt-p",
    auctionMatches(["2NT", "P"]),
    // 2NT Stayman: 3C ask
    round1Ask2NT,
    // Not after 2NT-P
    decision(
      "after-1nt-p-2c-p",
      auctionMatches(["1NT", "P", "2C", "P"]),
      // Round 2: Opener responds
      round2Response,
      // Not Round 2 — check Round 3 rebid positions
      decision(
        "after-2nt-p-3c-p",
        auctionMatches(["2NT", "P", "3C", "P"]),
        // 2NT Stayman Round 2: Opener responds
        round2Response2NT,
        decision(
          "after-2h-response",
          auctionMatches(["1NT", "P", "2C", "P", "2H", "P"]),
          rebidAfter2H,
          decision(
            "after-2s-response",
            auctionMatches(["1NT", "P", "2C", "P", "2S", "P"]),
            rebidAfter2S,
            decision(
              "after-2d-denial",
              auctionMatches(["1NT", "P", "2C", "P", "2D", "P"]),
              rebidAfter2D,
              fallback("not-stayman-auction"),
            ),
          ),
        ),
      ),
    ),
  ),
);

/** Responder position starts after 1NT - P. */
function staymanDefaultAuction(
  seat: Seat,
  _deal?: import("../../engine/types").Deal,
): Auction | undefined {
  if (seat === Seat.South || seat === Seat.East) {
    return buildAuction(Seat.North, ["1NT", "P"]);
  }
  return undefined;
}

export const staymanConfig: TreeConventionConfig = {
  id: "stayman",
  name: "Stayman",
  description:
    "Stayman convention: 2C response to 1NT asking for 4-card majors",
  category: ConventionCategory.Asking,
  dealConstraints: staymanDealConstraints,
  ruleTree: staymanRuleTree,
  defaultAuction: staymanDefaultAuction,
};
