import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import {
  auctionMatches,
  bothMajors,
  diamondsPlusMajor,
  clubsPlusHigher,
  suitMin,
  hasSingleLongSuit,
  anySuitMin,
} from "../../core/conditions";
import { auctionDecision, handDecision, bid, fallback } from "../../core/rule-tree";
import type { RuleNode, HandNode, AuctionNode } from "../../core/rule-tree";
import {
  advanceLongSuitCall,
  revealSuitCall,
  advance3LevelLongSuitCall,
  rebidAfter2C2NT,
  rebidAfter2D2NT,
  rebidAfter2H2NT,
} from "./helpers";

// SUIT_ORDER indices: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs

// Overcaller branch (South, after East opens 1NT)
const overcallerBranch: HandNode = handDecision(
  "both-majors",
  bothMajors(),
  bid("dont-2h", "Shows both majors", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Hearts })),
  handDecision(
    "diamonds-plus-major",
    diamondsPlusMajor(),
    bid("dont-2d", "Shows diamonds plus a major", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Diamonds })),
    handDecision(
      "clubs-plus-higher",
      clubsPlusHigher(),
      bid("dont-2c", "Shows clubs plus a higher suit", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Clubs })),
      handDecision(
        "6-plus-spades",
        suitMin(0, "spades", 6),
        bid("dont-2s", "Shows a long spade suit", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Spades })),
        handDecision(
          "single-long-suit",
          hasSingleLongSuit(),
          bid("dont-double", "Shows a long single suit", (): Call => ({ type: "double" })),
          fallback("not-suited"),
        ),
      ),
    ),
  ),
);

// ─── Advance branches (North, after South overcalls) ────────

// After 2H (both majors): pass with heart support, 6+ minor escape, or prefer spades
// Note: advancer CAN bid 2NT (inquiry) with game interest — handled by AI strategy, not tree.
// Overcaller's 2NT rebid response IS in the tree (see rebidAfter2H2NTBranch).
const advanceAfter2H: HandNode = handDecision(
  "hearts-support",
  suitMin(1, "hearts", 3),
  bid("dont-advance-pass", "Accepts partner's shown suit", (): Call => ({ type: "pass" })),
  handDecision(
    "has-6-plus-minor-after-2h",
    anySuitMin(
      [
        { index: 2, name: "diamonds" },
        { index: 3, name: "clubs" },
      ],
      6,
    ),
    bid("dont-advance-3-level", "Bids a long minor, non-forcing escape", advance3LevelLongSuitCall([2, 3])),
    bid("dont-advance-next-step", "Prefers spades to hearts", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Spades })),
  ),
);

// After 2S (natural 6+ spades): pass with support, 3-level escape, or fallback
const advanceAfter2S: HandNode = handDecision(
  "spades-support",
  suitMin(0, "spades", 2),
  bid("dont-advance-pass", "Accepts partner's shown suit", (): Call => ({ type: "pass" })),
  handDecision(
    "has-6-plus-suit-after-2s",
    anySuitMin(
      [
        { index: 1, name: "hearts" },
        { index: 2, name: "diamonds" },
        { index: 3, name: "clubs" },
      ],
      6,
    ),
    bid("dont-advance-3-level", "Bids a long suit, non-forcing escape", advance3LevelLongSuitCall([1, 2, 3])),
    fallback("no-advance-after-2s"),
  ),
);

// After 2D (diamonds + major): 6+ spades bypass, pass with support, 6+ clubs escape, or relay
// Note: advancer CAN bid 2NT (inquiry) — handled by AI strategy, not tree.
const advanceAfter2D: HandNode = handDecision(
  "has-6-plus-spades-after-2d",
  suitMin(0, "spades", 6),
  bid("dont-advance-long-suit", "Bids a long suit directly, bypassing the relay", advanceLongSuitCall),
  handDecision(
    "diamonds-support",
    suitMin(2, "diamonds", 3),
    bid("dont-advance-pass", "Accepts partner's shown suit", (): Call => ({ type: "pass" })),
    handDecision(
      "has-6-plus-clubs-after-2d",
      suitMin(3, "clubs", 6),
      bid("dont-advance-3-level", "Bids a long club suit, non-forcing escape", (): Call => ({ type: "bid", level: 3, strain: BidSuit.Clubs })),
      bid("dont-advance-next-step", "Relays asking partner to clarify", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Hearts })),
    ),
  ),
);

// After 2C (clubs + higher): 6+ major bypass, pass with support, or relay
// Note: advancer CAN bid 2NT (inquiry) — handled by AI strategy, not tree.
const advanceAfter2C: HandNode = handDecision(
  "has-6-plus-suit-after-2c",
  anySuitMin(
    [
      { index: 0, name: "spades" },
      { index: 1, name: "hearts" },
    ],
    6,
  ),
  bid("dont-advance-long-suit", "Bids a long suit directly, bypassing the relay", advanceLongSuitCall),
  handDecision(
    "clubs-support",
    suitMin(3, "clubs", 3),
    bid("dont-advance-pass", "Accepts partner's shown suit", (): Call => ({ type: "pass" })),
    bid("dont-advance-next-step", "Relays asking partner to clarify", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Diamonds })),
  ),
);

// After double (single long suit): 6+ suit bypass or 2C relay
const advanceAfterDouble: HandNode = handDecision(
  "has-6-plus-suit",
  anySuitMin(
    [
      { index: 0, name: "spades" },
      { index: 1, name: "hearts" },
      { index: 2, name: "diamonds" },
    ],
    6,
  ),
  bid("dont-advance-long-suit", "Bids a long suit directly, bypassing the relay", advanceLongSuitCall),
  bid("dont-advance-next-step", "Relays asking partner to clarify", (): Call => ({ type: "bid", level: 2, strain: BidSuit.Clubs })),
);

// ─── 2NT Inquiry rebid branches (overcaller responds to advancer's 2NT) ────

// After 1NT-2C-P-2NT-P: overcaller shows min/max and second suit
const rebidAfter2C2NTBranch: RuleNode = bid(
  "dont-2nt-rebid",
  "Shows strength and suit distribution after inquiry",
  rebidAfter2C2NT,
);

// After 1NT-2D-P-2NT-P: overcaller shows min/max and which major
const rebidAfter2D2NTBranch: RuleNode = bid(
  "dont-2nt-rebid",
  "Shows strength and suit distribution after inquiry",
  rebidAfter2D2NT,
);

// After 1NT-2H-P-2NT-P: overcaller shows min/max and major distribution
const rebidAfter2H2NTBranch: RuleNode = bid(
  "dont-2nt-rebid",
  "Shows strength and suit distribution after inquiry",
  rebidAfter2H2NT,
);

// ─── Advance branch dispatcher ──────────────────────────────

const advanceBranch: AuctionNode = auctionDecision(
  "after-1nt-2h-p",
  auctionMatches(["1NT", "2H", "P"]),
  advanceAfter2H,
  auctionDecision(
    "after-1nt-2s-p",
    auctionMatches(["1NT", "2S", "P"]),
    advanceAfter2S,
    auctionDecision(
      "after-1nt-2d-p",
      auctionMatches(["1NT", "2D", "P"]),
      advanceAfter2D,
      auctionDecision(
        "after-1nt-2c-p",
        auctionMatches(["1NT", "2C", "P"]),
        advanceAfter2C,
        auctionDecision(
          "after-1nt-x-p",
          auctionMatches(["1NT", "X", "P"]),
          advanceAfterDouble,
          fallback("not-dont-auction"),
        ),
      ),
    ),
  ),
);

// Overcaller reveal after partner's 2C relay (1NT-X-P-2C-P)
const overcallerRevealBranch: HandNode = handDecision(
  "clubs-long",
  suitMin(3, "clubs", 6),
  bid("dont-reveal-pass", "Confirms clubs as the long suit", (): Call => ({ type: "pass" })),
  bid("dont-reveal-suit", "Reveals the actual long suit", revealSuitCall),
);

export const dontRuleTree: AuctionNode = auctionDecision(
  "after-1nt",
  auctionMatches(["1NT"]),
  overcallerBranch,
  auctionDecision(
    "after-1nt-x-p-2c-p",
    auctionMatches(["1NT", "X", "P", "2C", "P"]),
    overcallerRevealBranch,
    auctionDecision(
      "is-2nt-inquiry-rebid",
      auctionMatches(["1NT", "2C", "P", "2NT", "P"]),
      rebidAfter2C2NTBranch,
      auctionDecision(
        "is-2nt-inquiry-rebid-2d",
        auctionMatches(["1NT", "2D", "P", "2NT", "P"]),
        rebidAfter2D2NTBranch,
        auctionDecision(
          "is-2nt-inquiry-rebid-2h",
          auctionMatches(["1NT", "2H", "P", "2NT", "P"]),
          rebidAfter2H2NTBranch,
          advanceBranch,
        ),
      ),
    ),
  ),
);
