import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import {
  auctionMatches,
  hcpMin,
  hcpRange,
  bothMajors,
  suitMin,
  and,
} from "../../core/conditions";
import { auctionDecision, handDecision, bid, fallback } from "../../core/rule-tree";
import type { RuleNode, HandNode } from "../../core/rule-tree";

// SUIT_ORDER indices: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs

// Overcaller rebids after 2NT inquiry (1NT-2C-P-2NT-P)
// Bridge Bum defines three tiers for 5-5: 3H=minimum (6-10), 3S=medium (10-12), 3NT=maximum (12+)
// For 5-4/4-5: 3C=medium (<12), 3D=maximum (12+)
const overcallerAfter2NT: HandNode = handDecision(
  "5-5-majors",
  and(suitMin(0, "spades", 5), suitMin(1, "hearts", 5)),
  // 5-5+: 3NT=max, 3S=med, 3H=min
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
  // 5-4 / 4-5: 3D=max, 3C=med
  handDecision(
    "max-12+-54",
    hcpMin(12),
    bid("landy-rebid-3d", "Shows unequal majors with maximum values", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Diamonds })),
    bid("landy-rebid-3c", "Shows unequal majors with medium values", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Clubs })),
  ),
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

export const landyRuleTree: RuleNode = auctionDecision(
  "after-1nt",
  auctionMatches(["1NT"]),
  // YES: opponent opened 1NT
  handDecision(
    "both-majors",
    and(bothMajors(), hcpMin(10)),
    bid("landy-2c", "Shows both majors", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Clubs })),
    fallback("not-suited"),
  ),
  // NO: not after 1NT
  auctionDecision(
    "after-1nt-2c-p-2nt-p",
    auctionMatches(["1NT", "2C", "P", "2NT", "P"]),
    overcallerAfter2NT,
    auctionDecision(
      "after-1nt-2c-p",
      auctionMatches(["1NT", "2C", "P"]),
      responderBranch,
      fallback("not-landy-auction"),
    ),
  ),
);
