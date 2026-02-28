import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import {
  bidMade,
  hcpMin,
  hcpRange,
  bothMajors,
  suitMin,
  seatHasBid,
  seatHasActed,
  isResponder,
  passedAfter,
  not,
  and,
} from "../../core/conditions";
import type { AuctionCondition } from "../../core/types";
import { handDecision, bid, fallback } from "../../core/rule-tree";
import type { HandNode } from "../../core/rule-tree";
import { protocol, round, semantic } from "../../core/protocol";
import type { ConventionProtocol } from "../../core/protocol";

// SUIT_ORDER indices: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs

// ─── Hand subtrees ──────────────────────────────────────────

// Overcaller's initial 2C bid (after opponent opens 1NT)
const overcallerBranch: HandNode = handDecision(
  "both-majors",
  and(bothMajors(), hcpMin(10)),
  bid("landy-2c", "Shows both majors", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Clubs })),
  fallback("not-suited"),
);

// Responder bids after 2C (1NT-2C-P)
const responderBranch: HandNode = handDecision(
  "has-12-plus",
  hcpMin(12),
  bid("landy-response-2nt", "Asks overcaller to describe their major holdings", (): Call => ({ type: "bid", level: 2, strain: BidSuit.NoTrump })),
  handDecision(
    "invite-3h",
    and(hcpRange(10, 12), suitMin(1, "hearts", 4)),
    bid("landy-response-3h", "Shows an invitational raise with heart support", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Hearts })),
    handDecision(
      "invite-3s",
      and(hcpRange(10, 12), suitMin(0, "spades", 4)),
      bid("landy-response-3s", "Shows an invitational raise with spade support", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Spades })),
      handDecision(
        "has-5-clubs",
        suitMin(3, "clubs", 5),
        bid("landy-response-pass", "Passes to play in clubs", (): Call => ({ type: "pass" })),
        handDecision(
          "has-4-hearts",
          suitMin(1, "hearts", 4),
          bid("landy-response-2h", "Shows a preference for hearts", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Hearts })),
          handDecision(
            "has-4-spades",
            suitMin(0, "spades", 4),
            bid("landy-response-2s", "Shows a preference for spades", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Spades })),
            bid("landy-response-2d", "Asks overcaller to bid their longer major", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Diamonds })),
          ),
        ),
      ),
    ),
  ),
);

// Overcaller rebids after 2NT inquiry (1NT-2C-P-2NT-P)
const overcallerAfter2NT: HandNode = handDecision(
  "5-5-majors",
  and(suitMin(0, "spades", 5), suitMin(1, "hearts", 5)),
  handDecision(
    "max-12+",
    hcpMin(12),
    bid("landy-rebid-3nt", "Shows 5-5 majors with maximum values", (): Call => ({ type: "bid", level: 3, strain: BidSuit.NoTrump })),
    handDecision(
      "med-10+",
      hcpMin(10),
      bid("landy-rebid-3s", "Shows 5-5 majors with medium values", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Spades })),
      bid("landy-rebid-3h", "Shows 5-5 majors with minimum values", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Hearts })),
    ),
  ),
  handDecision(
    "max-12+-54",
    hcpMin(12),
    bid("landy-rebid-3d", "Shows unequal majors with maximum values", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Diamonds })),
    bid("landy-rebid-3c", "Shows unequal majors with medium values", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Clubs })),
  ),
);

// ─── Protocol ────────────────────────────────────────────────

export const landyProtocol: ConventionProtocol = protocol("landy", [
  // Round 1: Opponent opens 1NT — overcaller acts
  // seatFilter: hasn't acted yet AND isn't partner of the opener
  round("opponent-opens", {
    triggers: [semantic(bidMade(1, BidSuit.NoTrump), {})],
    handTree: overcallerBranch,
    seatFilter: and(not(seatHasActed()), not(isResponder())) as AuctionCondition,
  }),
  // Round 2: Overcaller bid 2C — advancer (partner of overcaller) acts
  // seatFilter: hasn't acted yet AND opponent passed after 2C (no interference)
  round("landy-2c", {
    triggers: [semantic(bidMade(2, BidSuit.Clubs), {})],
    handTree: responderBranch,
    seatFilter: and(not(seatHasActed()), passedAfter(2, BidSuit.Clubs)) as AuctionCondition,
  }),
  // Round 3: Advancer bid 2NT inquiry — overcaller rebids
  // seatFilter: has previously bid AND opponent passed after 2NT (no interference)
  round("inquiry", {
    triggers: [semantic(bidMade(2, BidSuit.NoTrump), {})],
    handTree: overcallerAfter2NT,
    seatFilter: and(seatHasBid(), passedAfter(2, BidSuit.NoTrump)) as AuctionCondition,
  }),
]);
