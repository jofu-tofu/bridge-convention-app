import { FactLayer } from "../../../../core/contracts/fact-layer";
import type {
  FactCatalogExtension,
  FactDefinition,
  FactEvaluatorFn,
} from "../../../../core/contracts/fact-catalog";
import { num, fv } from "../../../core/pipeline/fact-helpers";
import {
  definePerSuitFacts,
  defineHcpRangeFact,
  buildExtension,
} from "../../../core/pipeline/fact-factory";
import type { FactEntry } from "../../../core/pipeline/fact-factory";
import { Rank, Suit } from "../../../../engine/types";
import type { Hand } from "../../../../engine/types";
import { SUIT_NAME_MAP } from "../../../../engine/constants";

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

const topHonorEntries = definePerSuitFacts({
  idPrefix: "module.weakTwo.topHonorCount",
  suits: WEAK_TWO_SUITS,
  description: (suit) => `Count of A, K, Q in ${suit}`,
  evaluator: (h, suit, _m) =>
    fv(`module.weakTwo.topHonorCount.${suit}`, countTopHonorsInSuit(h, suit)),
  valueType: "number",
  constrainsDimensions: ["suitIdentity", "suitQuality"],
});

const isSolidEntries = definePerSuitFacts({
  idPrefix: "module.weakTwo.isSolid",
  suits: WEAK_TWO_SUITS,
  description: (suit) => `All three top honors (AKQ) in ${suit}`,
  evaluator: (_h, suit, m) =>
    fv(`module.weakTwo.isSolid.${suit}`, num(m, `module.weakTwo.topHonorCount.${suit}`) === 3),
  valueType: "boolean",
  constrainsDimensions: ["suitIdentity", "suitLength", "suitQuality", "shapeClass"],
  derivesFrom: (suit) => [`module.weakTwo.topHonorCount.${suit}`],
});

const isMaximumEntry = defineHcpRangeFact({
  id: "module.weakTwo.isMaximum",
  description: "Opener is maximum for weak two (9-11 HCP)",
  range: { min: 9, max: 11 },
});

// ─── Vulnerability-aware facts (hand-written) ───────────────

const isMinimumDef: FactDefinition = {
  id: "module.weakTwo.isMinimum",
  layer: FactLayer.ModuleDerived,
  world: "acting-hand",
  description: "Opener is minimum for weak two (5-8 NV, 6-8 vul)",
  valueType: "boolean",
  derivesFrom: ["hand.hcp", "bridge.isVulnerable"],
  constrainsDimensions: ["pointRange"],
};

const isMinimumEvaluator: FactEvaluatorFn = (_h, _ev, m) => {
  const hcp = num(m, "hand.hcp");
  const vul = m.get("bridge.isVulnerable")?.value === true;
  const minHcp = vul ? 6 : 5;
  return fv("module.weakTwo.isMinimum", hcp >= minHcp && hcp <= 8);
};

const isMinimumEntry: FactEntry = {
  definition: isMinimumDef,
  evaluator: ["module.weakTwo.isMinimum", isMinimumEvaluator],
};

const inOpeningHcpRangeDef: FactDefinition = {
  id: "module.weakTwo.inOpeningHcpRange",
  layer: FactLayer.ModuleDerived,
  world: "acting-hand",
  description: "HCP in weak two opening range (5-11 NV, 6-11 vul)",
  valueType: "boolean",
  derivesFrom: ["hand.hcp", "bridge.isVulnerable"],
  constrainsDimensions: ["pointRange"],
};

const inOpeningHcpRangeEvaluator: FactEvaluatorFn = (_h, _ev, m) => {
  const hcp = num(m, "hand.hcp");
  const vul = m.get("bridge.isVulnerable")?.value === true;
  const minHcp = vul ? 6 : 5;
  return fv("module.weakTwo.inOpeningHcpRange", hcp >= minHcp && hcp <= 11);
};

const inOpeningHcpRangeEntry: FactEntry = {
  definition: inOpeningHcpRangeDef,
  evaluator: ["module.weakTwo.inOpeningHcpRange", inOpeningHcpRangeEvaluator],
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
