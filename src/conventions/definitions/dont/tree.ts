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
import { handDecision, bid, fallback } from "../../core/rule-tree";
import type { RuleNode, HandNode } from "../../core/rule-tree";
import { protocol, round, semantic } from "../../core/protocol";
import type { ConventionProtocol, EstablishedContext } from "../../core/protocol";
import {
  advanceLongSuitCall,
  revealSuitCall,
  advance3LevelLongSuitCall,
  rebidAfter2C2NT,
  rebidAfter2D2NT,
  rebidAfter2H2NT,
} from "./helpers";

// SUIT_ORDER indices: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs

// ─── Established context ────────────────────────────────────

interface DontEstablished extends EstablishedContext {
  slotName: string;
}

// ─── Hand subtrees (unchanged) ──────────────────────────────

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

// ─── 2NT Inquiry rebid branches ─────────────────────────────

const rebidAfter2C2NTBranch: RuleNode = bid(
  "dont-2nt-rebid",
  "Shows strength and suit distribution after inquiry",
  rebidAfter2C2NT,
);

const rebidAfter2D2NTBranch: RuleNode = bid(
  "dont-2nt-rebid",
  "Shows strength and suit distribution after inquiry",
  rebidAfter2D2NT,
);

const rebidAfter2H2NTBranch: RuleNode = bid(
  "dont-2nt-rebid",
  "Shows strength and suit distribution after inquiry",
  rebidAfter2H2NT,
);

// Overcaller reveal after partner's 2C relay (1NT-X-P-2C-P)
const overcallerRevealBranch: HandNode = handDecision(
  "clubs-long",
  suitMin(3, "clubs", 6),
  bid("dont-reveal-pass", "Confirms clubs as the long suit", (): Call => ({ type: "pass" })),
  bid("dont-reveal-suit", "Reveals the actual long suit", revealSuitCall),
);

// ─── Hand tree dispatch ──────────────────────────────────────

const handTreeMap: Record<string, HandNode> = {
  "after-1nt": overcallerBranch,
  "after-1nt-x-p-2c-p": overcallerRevealBranch,
  "is-2nt-inquiry-rebid": rebidAfter2C2NTBranch as HandNode,
  "is-2nt-inquiry-rebid-2d": rebidAfter2D2NTBranch as HandNode,
  "is-2nt-inquiry-rebid-2h": rebidAfter2H2NTBranch as HandNode,
  "after-1nt-2h-p": advanceAfter2H,
  "after-1nt-2s-p": advanceAfter2S,
  "after-1nt-2d-p": advanceAfter2D,
  "after-1nt-2c-p": advanceAfter2C,
  "after-1nt-x-p": advanceAfterDouble,
};

function resolveHandTree(est: DontEstablished): HandNode {
  return handTreeMap[est.slotName] ?? fallback("unknown-slot");
}

// ─── Protocol ────────────────────────────────────────────────

export const dontProtocol: ConventionProtocol<DontEstablished> = protocol<DontEstablished>("dont", [
  round<DontEstablished>("dispatch", {
    triggers: [
      semantic<DontEstablished>(auctionMatches(["1NT"]), { slotName: "after-1nt" }),
      semantic<DontEstablished>(auctionMatches(["1NT", "X", "P", "2C", "P"]), { slotName: "after-1nt-x-p-2c-p" }),
      semantic<DontEstablished>(auctionMatches(["1NT", "2C", "P", "2NT", "P"]), { slotName: "is-2nt-inquiry-rebid" }),
      semantic<DontEstablished>(auctionMatches(["1NT", "2D", "P", "2NT", "P"]), { slotName: "is-2nt-inquiry-rebid-2d" }),
      semantic<DontEstablished>(auctionMatches(["1NT", "2H", "P", "2NT", "P"]), { slotName: "is-2nt-inquiry-rebid-2h" }),
      semantic<DontEstablished>(auctionMatches(["1NT", "2H", "P"]), { slotName: "after-1nt-2h-p" }),
      semantic<DontEstablished>(auctionMatches(["1NT", "2S", "P"]), { slotName: "after-1nt-2s-p" }),
      semantic<DontEstablished>(auctionMatches(["1NT", "2D", "P"]), { slotName: "after-1nt-2d-p" }),
      semantic<DontEstablished>(auctionMatches(["1NT", "2C", "P"]), { slotName: "after-1nt-2c-p" }),
      semantic<DontEstablished>(auctionMatches(["1NT", "X", "P"]), { slotName: "after-1nt-x-p" }),
    ],
    handTree: resolveHandTree,
  }),
]);
