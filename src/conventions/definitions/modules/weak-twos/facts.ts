import { FactLayer } from "../../../core/fact-layer";
import type {
  FactCatalogExtension,
  FactDefinition,
  FactEvaluatorFn,
  FactComposition,
} from "../../../core/fact-catalog";
import { num, fv } from "../../../pipeline/fact-helpers";
import {
  definePerSuitFacts,
  defineHcpRangeFact,
  buildExtension,
} from "../../../pipeline/fact-factory";
import type { FactEntry } from "../../../pipeline/fact-factory";
import { Rank, Suit } from "../../../../engine/types";
import type { Hand } from "../../../../engine/types";
import { SUIT_NAME_MAP } from "../../../../engine/constants";
import {
  WEAK_TWO_FACT_IDS,
  WEAK_TWO_TOP_HONOR_COUNT_BY_SUIT,
  WEAK_TWO_IS_SOLID_BY_SUIT,
} from "./fact-ids";

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
  description: "Opener is maximum for weak two (9-11 HCP)",
  range: { min: 9, max: 11 },
});

// ─── Vulnerability-aware facts (hand-written) ───────────────

const isMinimumDef: FactDefinition = {
  id: WEAK_TWO_FACT_IDS.IS_MINIMUM,
  layer: FactLayer.ModuleDerived,
  world: "acting-hand",
  description: "Opener is minimum for weak two (5-8 NV, 6-8 vul)",
  valueType: "boolean",
  derivesFrom: ["hand.hcp", "bridge.isVulnerable"],
  constrainsDimensions: ["pointRange"],
  composition: {
    kind: "and",
    operands: [
      { kind: "primitive", clause: { factId: "hand.hcp", operator: "gte", value: 5 } },
      { kind: "primitive", clause: { factId: "hand.hcp", operator: "lte", value: 8 } },
    ],
  },
};

const isMinimumEvaluator: FactEvaluatorFn = (_h, _ev, m) => {
  const hcp = num(m, "hand.hcp");
  const vul = m.get("bridge.isVulnerable")?.value === true;
  const minHcp = vul ? 6 : 5;
  return fv(WEAK_TWO_FACT_IDS.IS_MINIMUM, hcp >= minHcp && hcp <= 8);
};

const isMinimumEntry: FactEntry = {
  definition: isMinimumDef,
  evaluator: [WEAK_TWO_FACT_IDS.IS_MINIMUM, isMinimumEvaluator],
};

// Composition: loose approximation — 5-11 HCP (widest across vulnerability states)
const IN_OPENING_HCP_RANGE_COMPOSITION: FactComposition = {
  kind: "and",
  operands: [
    { kind: "primitive", clause: { factId: "hand.hcp", operator: "gte", value: 5 } },
    { kind: "primitive", clause: { factId: "hand.hcp", operator: "lte", value: 11 } },
  ],
};

const inOpeningHcpRangeDef: FactDefinition = {
  id: WEAK_TWO_FACT_IDS.IN_OPENING_HCP_RANGE,
  layer: FactLayer.ModuleDerived,
  world: "acting-hand",
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

// ─── Compose extension ──────────────────────────────────────

const { definitions, evaluators } = buildExtension([
  ...topHonorEntries,
  isMinimumEntry,
  isMaximumEntry,
  inOpeningHcpRangeEntry,
  ...isSolidEntries,
]);

export const weakTwoFacts: FactCatalogExtension = {
  definitions,
  evaluators,
};
