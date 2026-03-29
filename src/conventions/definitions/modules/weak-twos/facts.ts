import { FactLayer } from "../../../core/fact-layer";
import type {
  FactCatalogExtension,
  FactDefinition,
  FactEvaluatorFn,
  FactComposition,
} from "../../../core/fact-catalog";
import { EvaluationWorld } from "../../../core/fact-catalog";
import { num, fv } from "../../../pipeline/facts/fact-helpers";
import {
  definePerSuitFacts,
  defineHcpRangeFact,
  buildExtension,
} from "../../../pipeline/facts/fact-factory";
import type { FactEntry } from "../../../pipeline/facts/fact-factory";
import { Rank, Suit } from "../../../../engine/types";
import type { Hand } from "../../../../engine/types";
import { SUIT_NAME_MAP } from "../../../../engine/constants";
import {
  WEAK_TWO_FACT_IDS,
  WEAK_TWO_TOP_HONOR_COUNT_BY_SUIT,
  WEAK_TWO_IS_SOLID_BY_SUIT,
} from "./ids";
import { FactOperator } from "../../../pipeline/evaluation/meaning";

// ─── Top honor counting helper ──────────────────────────────

const TOP_HONORS = new Set([Rank.Ace, Rank.King, Rank.Queen]);

function countTopHonorsInSuit(hand: Hand, suitName: string): number {
  const suit = SUIT_NAME_MAP[suitName as keyof typeof SUIT_NAME_MAP] ?? Suit.Clubs;
  return hand.cards.filter(
    (c) => c.suit === suit && TOP_HONORS.has(c.rank),
  ).length;
}

// ─── Weak Two module facts (factory-based) ──────────────────

const WEAK_TWO_SUITS = ["hearts", "spades", "diamonds"] as const;
type WeakTwoSuit = (typeof WEAK_TWO_SUITS)[number];

/** Type-safe cast for suit parameter from definePerSuitFacts (typed as string). */
const asSuit = (suit: string): WeakTwoSuit => suit as WeakTwoSuit;

const topHonorEntries = definePerSuitFacts({
  idPrefix: "module.weakTwo.topHonorCount",
  suits: WEAK_TWO_SUITS,
  description: (suit) => `Count of A, K, Q in ${suit}`,
  evaluator: (h, suit, _m) =>
    fv(WEAK_TWO_TOP_HONOR_COUNT_BY_SUIT[asSuit(suit)], countTopHonorsInSuit(h, suit)),
  valueType: "number",
  constrainsDimensions: ["suitIdentity", "suitQuality"],
});

const isSolidEntries = definePerSuitFacts({
  idPrefix: "module.weakTwo.isSolid",
  suits: WEAK_TWO_SUITS,
  description: (suit) => `All three top honors (AKQ) in ${suit}`,
  evaluator: (_h, suit, m) =>
    fv(WEAK_TWO_IS_SOLID_BY_SUIT[asSuit(suit)], num(m, WEAK_TWO_TOP_HONOR_COUNT_BY_SUIT[asSuit(suit)]) === 3),
  valueType: "boolean",
  constrainsDimensions: ["suitIdentity", "suitLength", "suitQuality", "shapeClass"],
  derivesFrom: (suit) => [WEAK_TWO_TOP_HONOR_COUNT_BY_SUIT[asSuit(suit)]],
});

const isMaximumEntry = defineHcpRangeFact({
  id: WEAK_TWO_FACT_IDS.IS_MAXIMUM,
  description: "Opener is maximum for weak two (8-11 HCP)",
  range: { min: 8, max: 11 },
});

// ─── Vulnerability-aware facts (hand-written) ───────────────

const isMinimumDef: FactDefinition = {
  id: WEAK_TWO_FACT_IDS.IS_MINIMUM,
  layer: FactLayer.ModuleDerived,
  world: EvaluationWorld.ActingHand,
  description: "Opener is minimum for weak two (5-7 NV, 6-7 vul)",
  valueType: "boolean",
  derivesFrom: ["hand.hcp", "bridge.isVulnerable"],
  constrainsDimensions: ["pointRange"],
  composition: {
    kind: "and",
    operands: [
      { kind: "primitive", clause: { factId: "hand.hcp", operator: FactOperator.Gte, value: 5 } },
      { kind: "primitive", clause: { factId: "hand.hcp", operator: FactOperator.Lte, value: 7 } },
    ],
  },
};

const isMinimumEvaluator: FactEvaluatorFn = (_h, _ev, m) => {
  const hcp = num(m, "hand.hcp");
  const vul = m.get("bridge.isVulnerable")?.value === true;
  const minHcp = vul ? 6 : 5;
  return fv(WEAK_TWO_FACT_IDS.IS_MINIMUM, hcp >= minHcp && hcp <= 7);
};

const isMinimumEntry: FactEntry = {
  definition: isMinimumDef,
  evaluator: [WEAK_TWO_FACT_IDS.IS_MINIMUM, isMinimumEvaluator],
};

// Composition: loose approximation — 5-11 HCP (widest across vulnerability states)
const IN_OPENING_HCP_RANGE_COMPOSITION: FactComposition = {
  kind: "and",
  operands: [
    { kind: "primitive", clause: { factId: "hand.hcp", operator: FactOperator.Gte, value: 5 } },
    { kind: "primitive", clause: { factId: "hand.hcp", operator: FactOperator.Lte, value: 11 } },
  ],
};

const inOpeningHcpRangeDef: FactDefinition = {
  id: WEAK_TWO_FACT_IDS.IN_OPENING_HCP_RANGE,
  layer: FactLayer.ModuleDerived,
  world: EvaluationWorld.ActingHand,
  description: "HCP in weak two opening range (5-11 NV, 6-11 vul)",
  valueType: "boolean",
  derivesFrom: ["hand.hcp", "bridge.isVulnerable"],
  constrainsDimensions: ["pointRange"],
  composition: IN_OPENING_HCP_RANGE_COMPOSITION,
};

const inOpeningHcpRangeEvaluator: FactEvaluatorFn = (_h, _ev, m) => {
  const hcp = num(m, "hand.hcp");
  const vul = m.get("bridge.isVulnerable")?.value === true;
  const minHcp = vul ? 6 : 5;
  return fv(WEAK_TWO_FACT_IDS.IN_OPENING_HCP_RANGE, hcp >= minHcp && hcp <= 11);
};

const inOpeningHcpRangeEntry: FactEntry = {
  definition: inOpeningHcpRangeDef,
  evaluator: [WEAK_TWO_FACT_IDS.IN_OPENING_HCP_RANGE, inOpeningHcpRangeEvaluator],
};

// ─── New suit forcing facts ──────────────────────────────────
//
// hasNewSuit: responder has 5+ cards in any suit other than opener's suit
// hasNsfSupport: opener has 3+ cards in a suit other than their own (generic)

const ALL_SUIT_NAMES = ["spades", "hearts", "diamonds", "clubs"] as const;

const HAS_NEW_SUIT_BY_SUIT: Record<WeakTwoSuit, string> = {
  hearts: WEAK_TWO_FACT_IDS.HAS_NEW_SUIT_HEARTS,
  spades: WEAK_TWO_FACT_IDS.HAS_NEW_SUIT_SPADES,
  diamonds: WEAK_TWO_FACT_IDS.HAS_NEW_SUIT_DIAMONDS,
};

const hasNewSuitEntries = definePerSuitFacts({
  idPrefix: "module.weakTwo.hasNewSuit",
  suits: WEAK_TWO_SUITS,
  description: (suit) => `Has 5+ cards in a suit other than ${suit}`,
  evaluator: (_h, suit, m) => {
    const otherSuits = ALL_SUIT_NAMES.filter(s => s !== suit);
    const hasLong = otherSuits.some(s => num(m, `hand.suitLength.${s}`) >= 5);
    return fv(HAS_NEW_SUIT_BY_SUIT[asSuit(suit)], hasLong);
  },
  valueType: "boolean",
  constrainsDimensions: ["suitLength"],
  derivesFrom: () => [
    "hand.suitLength.spades",
    "hand.suitLength.hearts",
    "hand.suitLength.diamonds",
    "hand.suitLength.clubs",
  ],
});

const HAS_NSF_SUPPORT_BY_SUIT: Record<WeakTwoSuit, string> = {
  hearts: WEAK_TWO_FACT_IDS.HAS_NSF_SUPPORT_HEARTS,
  spades: WEAK_TWO_FACT_IDS.HAS_NSF_SUPPORT_SPADES,
  diamonds: WEAK_TWO_FACT_IDS.HAS_NSF_SUPPORT_DIAMONDS,
};

const hasNsfSupportEntries = definePerSuitFacts({
  idPrefix: "module.weakTwo.hasNsfSupport",
  suits: WEAK_TWO_SUITS,
  description: (suit) => `Opener has 3+ support for a non-${suit} suit`,
  evaluator: (_h, suit, m) => {
    const otherSuits = ALL_SUIT_NAMES.filter(s => s !== suit);
    const hasFit = otherSuits.some(s => num(m, `hand.suitLength.${s}`) >= 3);
    return fv(HAS_NSF_SUPPORT_BY_SUIT[asSuit(suit)], hasFit);
  },
  valueType: "boolean",
  constrainsDimensions: ["suitLength"],
  derivesFrom: () => [
    "hand.suitLength.spades",
    "hand.suitLength.hearts",
    "hand.suitLength.diamonds",
    "hand.suitLength.clubs",
  ],
});

// ─── Compose extension ──────────────────────────────────────

const { definitions, evaluators } = buildExtension([
  ...topHonorEntries,
  isMinimumEntry,
  isMaximumEntry,
  inOpeningHcpRangeEntry,
  ...isSolidEntries,
  ...hasNewSuitEntries,
  ...hasNsfSupportEntries,
]);

export const weakTwoFacts: FactCatalogExtension = {
  definitions,
  evaluators,
};
