import { FactLayer } from "../../../core/fact-layer";
import type {
  FactCatalogExtension,
  FactDefinition,
  FactEvaluatorFn,
} from "../../../core/fact-catalog";
import { EvaluationWorld } from "../../../core/fact-catalog";
import { num, fv } from "../../../pipeline/facts/fact-helpers";

import type { SystemConfig } from "../../system-config";
import { SMOLEN_FACT_IDS } from "./ids";

// ─── Facts ───────────────────────────────────────────────────

const SMOLEN_FACTS: readonly FactDefinition[] = [
  {
    id: SMOLEN_FACT_IDS.HAS_FIVE_HEARTS,
    layer: FactLayer.ModuleDerived,
    world: EvaluationWorld.ActingHand,
    description: "Hand has exactly 5 hearts (for 3♠ Smolen showing long hearts)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.hearts"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: SMOLEN_FACT_IDS.HAS_FIVE_SPADES,
    layer: FactLayer.ModuleDerived,
    world: EvaluationWorld.ActingHand,
    description: "Hand has exactly 5 spades (for 3♥ Smolen showing long spades)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: SMOLEN_FACT_IDS.HAS_FOUR_SPADES,
    layer: FactLayer.ModuleDerived,
    world: EvaluationWorld.ActingHand,
    description: "Hand has exactly 4 spades (short major for 3♠ Smolen: 4♠+5♥)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: SMOLEN_FACT_IDS.HAS_FOUR_HEARTS,
    layer: FactLayer.ModuleDerived,
    world: EvaluationWorld.ActingHand,
    description: "Hand has exactly 4 hearts (short major for 3♥ Smolen: 4♥+5♠)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.hearts"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: SMOLEN_FACT_IDS.OPENER_HAS_HEART_FIT,
    layer: FactLayer.ModuleDerived,
    world: EvaluationWorld.ActingHand,
    description: "Opener has 3+ hearts (heart fit for Smolen placement)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.hearts"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: SMOLEN_FACT_IDS.OPENER_HAS_SPADES_FIT,
    layer: FactLayer.ModuleDerived,
    world: EvaluationWorld.ActingHand,
    description: "Opener has 3+ spades (spade fit for Smolen placement)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
];

const SMOLEN_EVALUATORS = new Map<string, FactEvaluatorFn>([
  [SMOLEN_FACT_IDS.HAS_FIVE_HEARTS, (_h, _ev, m) =>
    fv(SMOLEN_FACT_IDS.HAS_FIVE_HEARTS, num(m, "hand.suitLength.hearts") === 5)],
  [SMOLEN_FACT_IDS.HAS_FIVE_SPADES, (_h, _ev, m) =>
    fv(SMOLEN_FACT_IDS.HAS_FIVE_SPADES, num(m, "hand.suitLength.spades") === 5)],
  [SMOLEN_FACT_IDS.HAS_FOUR_SPADES, (_h, _ev, m) =>
    fv(SMOLEN_FACT_IDS.HAS_FOUR_SPADES, num(m, "hand.suitLength.spades") === 4)],
  [SMOLEN_FACT_IDS.HAS_FOUR_HEARTS, (_h, _ev, m) =>
    fv(SMOLEN_FACT_IDS.HAS_FOUR_HEARTS, num(m, "hand.suitLength.hearts") === 4)],
  [SMOLEN_FACT_IDS.OPENER_HAS_HEART_FIT, (_h, _ev, m) =>
    fv(SMOLEN_FACT_IDS.OPENER_HAS_HEART_FIT, num(m, "hand.suitLength.hearts") >= 3)],
  [SMOLEN_FACT_IDS.OPENER_HAS_SPADES_FIT, (_h, _ev, m) =>
    fv(SMOLEN_FACT_IDS.OPENER_HAS_SPADES_FIT, num(m, "hand.suitLength.spades") >= 3)],
]);

/** Factory: creates Smolen facts (no system-dependent thresholds currently,
 *  but accepts SystemConfig for DI consistency). */
export function createSmolenFacts(_sys: SystemConfig): FactCatalogExtension {
  return {
    definitions: SMOLEN_FACTS,
    evaluators: SMOLEN_EVALUATORS,
  };
}
