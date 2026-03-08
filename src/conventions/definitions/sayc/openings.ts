import type { Call } from "../../../engine/types";
import { BidSuit } from "../../../engine/types";
import {
  hcpMin,
  hcpRange,
  suitMin,
  suitBelow,
  noFiveCardMajor,
  longerMajor,
  isBalanced,
  and,
} from "../../core/conditions";
import { handDecision } from "../../core/tree/rule-tree";
import type { HandNode } from "../../core/tree/rule-tree";
import { SemanticIntentType } from "../../core/intent/semantic-intent";
import { saycBid, saycPass } from "./helpers";

// ─── Opening subtrees ───────────────────────────────────────

// Preempts (7+ card) checked BEFORE weak twos (6+ card) so 7-card hands open at 3-level
export const weakAndPreemptBranch: HandNode = handDecision(
  "preempt-7spades",
  and(hcpRange(5, 11), suitMin(0, "spades", 7)),
  saycBid("sayc-open-3s", "Opens showing a 7-card spade suit",
    { type: SemanticIntentType.PreemptiveOpen, params: { level: 3, strain: "S" } },
    (): Call => ({ type: "bid", level: 3, strain: BidSuit.Spades })),
  handDecision(
    "preempt-7hearts",
    and(hcpRange(5, 11), suitMin(1, "hearts", 7)),
    saycBid("sayc-open-3h", "Opens showing a 7-card heart suit",
      { type: SemanticIntentType.PreemptiveOpen, params: { level: 3, strain: "H" } },
      (): Call => ({ type: "bid", level: 3, strain: BidSuit.Hearts })),
    handDecision(
      "preempt-7diamonds",
      and(hcpRange(5, 11), suitMin(2, "diamonds", 7)),
      saycBid("sayc-open-3d", "Opens showing a 7-card diamond suit",
        { type: SemanticIntentType.PreemptiveOpen, params: { level: 3, strain: "D" } },
        (): Call => ({ type: "bid", level: 3, strain: BidSuit.Diamonds })),
      handDecision(
        "preempt-7clubs",
        and(hcpRange(5, 11), suitMin(3, "clubs", 7)),
        saycBid("sayc-open-3c", "Opens showing a 7-card club suit",
          { type: SemanticIntentType.PreemptiveOpen, params: { level: 3, strain: "C" } },
          (): Call => ({ type: "bid", level: 3, strain: BidSuit.Clubs })),
        handDecision(
          "weak-6hearts",
          and(hcpRange(5, 11), suitMin(1, "hearts", 6)),
          saycBid("sayc-open-weak-2h", "Opens showing a 6-card heart suit",
            { type: SemanticIntentType.PreemptiveOpen, params: { level: 2, strain: "H" } },
            (): Call => ({ type: "bid", level: 2, strain: BidSuit.Hearts })),
          handDecision(
            "weak-6spades",
            and(hcpRange(5, 11), suitMin(0, "spades", 6)),
            saycBid("sayc-open-weak-2s", "Opens showing a 6-card spade suit",
              { type: SemanticIntentType.PreemptiveOpen, params: { level: 2, strain: "S" } },
              (): Call => ({ type: "bid", level: 2, strain: BidSuit.Spades })),
            handDecision(
              "weak-6diamonds",
              and(hcpRange(5, 11), suitMin(2, "diamonds", 6)),
              saycBid("sayc-open-weak-2d", "Opens showing a 6-card diamond suit",
                { type: SemanticIntentType.PreemptiveOpen, params: { level: 2, strain: "D" } },
                (): Call => ({ type: "bid", level: 2, strain: BidSuit.Diamonds })),
              saycPass("no-preempt"),
            ),
          ),
        ),
      ),
    ),
  ),
);

export const openMinorBranch: HandNode = handDecision(
  "12+-4diamonds",
  and(hcpMin(12), suitBelow(0, "spades", 5), suitBelow(1, "hearts", 5), suitMin(2, "diamonds", 4)),
  saycBid("sayc-open-1d", "Opens in the longer minor",
    { type: SemanticIntentType.NaturalBid, params: { level: 1, strain: "D" } },
    (): Call => ({ type: "bid", level: 1, strain: BidSuit.Diamonds })),
  handDecision(
    "12+-3clubs",
    and(hcpMin(12), suitBelow(0, "spades", 5), suitBelow(1, "hearts", 5), suitMin(3, "clubs", 3)),
    saycBid("sayc-open-1c", "Opens the better minor",
      { type: SemanticIntentType.NaturalBid, params: { level: 1, strain: "C" } },
      (): Call => ({ type: "bid", level: 1, strain: BidSuit.Clubs })),
    handDecision(
      "12+-3diamonds-fallback",
      and(hcpMin(12), suitBelow(0, "spades", 5), suitBelow(1, "hearts", 5), suitMin(2, "diamonds", 3)),
      saycBid("sayc-open-1d-short", "Opens the longer minor",
        { type: SemanticIntentType.NaturalBid, params: { level: 1, strain: "D" } },
        (): Call => ({ type: "bid", level: 1, strain: BidSuit.Diamonds })),
      weakAndPreemptBranch,
    ),
  ),
);

export const openMajorBranch: HandNode = handDecision(
  "12+-longer-spades",
  and(hcpMin(12), longerMajor(0, "spades")),
  saycBid("sayc-open-1s", "Opens in the longest major",
    { type: SemanticIntentType.NaturalBid, params: { level: 1, strain: "S" } },
    (): Call => ({ type: "bid", level: 1, strain: BidSuit.Spades })),
  handDecision(
    "12+-5hearts",
    and(hcpMin(12), suitMin(1, "hearts", 5)),
    saycBid("sayc-open-1h", "Opens showing 5+ hearts",
      { type: SemanticIntentType.NaturalBid, params: { level: 1, strain: "H" } },
      (): Call => ({ type: "bid", level: 1, strain: BidSuit.Hearts })),
    openMinorBranch,
  ),
);

export const openingBranch: HandNode = handDecision(
  "hcp-22+",
  hcpMin(22),
  saycBid("sayc-open-2c", "Opens artificial and forcing for one round",
    { type: SemanticIntentType.ForceGame, params: { level: 2, strain: "C" } },
    (): Call => ({ type: "bid", level: 2, strain: BidSuit.Clubs })),
  handDecision(
    "hcp-20-21-balanced",
    and(hcpRange(20, 21), isBalanced()),
    saycBid("sayc-open-2nt", "Opens showing a balanced hand",
      { type: SemanticIntentType.NaturalBid, params: { level: 2, strain: "NT" } },
      (): Call => ({ type: "bid", level: 2, strain: BidSuit.NoTrump })),
    handDecision(
      "hcp-15-17-bal-no5M",
      and(hcpRange(15, 17), isBalanced(), noFiveCardMajor()),
      saycBid("sayc-open-1nt", "Opens showing a balanced hand",
        { type: SemanticIntentType.NaturalBid, params: { level: 1, strain: "NT" } },
        (): Call => ({ type: "bid", level: 1, strain: BidSuit.NoTrump })),
      openMajorBranch,
    ),
  ),
);
