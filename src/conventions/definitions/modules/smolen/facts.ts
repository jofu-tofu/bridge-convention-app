import { FactLayer } from "../../../../core/contracts/fact-layer";
import type {
  FactCatalogExtension,
  FactDefinition,
  FactEvaluatorFn,
} from "../../../../core/contracts/fact-catalog";
import { num, fv } from "../../../pipeline/fact-helpers";

import type { SystemConfig } from "../../../../core/contracts/system-config";

// ─── Facts ───────────────────────────────────────────────────

const SMOLEN_FACTS: readonly FactDefinition[] = [
  {
    id: "module.smolen.hasFiveHearts",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Hand has exactly 5 hearts (for 3♠ Smolen showing long hearts)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.hearts"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.smolen.hasFiveSpades",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Hand has exactly 5 spades (for 3♥ Smolen showing long spades)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.smolen.hasFourSpades",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Hand has exactly 4 spades (short major for 3♠ Smolen: 4♠+5♥)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.smolen.hasFourHearts",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Hand has exactly 4 hearts (short major for 3♥ Smolen: 4♥+5♠)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.hearts"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.smolen.openerHasHeartFit",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Opener has 3+ hearts (heart fit for Smolen placement)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.hearts"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.smolen.openerHasSpadesFit",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Opener has 3+ spades (spade fit for Smolen placement)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
];

const SMOLEN_EVALUATORS = new Map<string, FactEvaluatorFn>([
  ["module.smolen.hasFiveHearts", (_h, _ev, m) =>
    fv("module.smolen.hasFiveHearts", num(m, "hand.suitLength.hearts") === 5)],
  ["module.smolen.hasFiveSpades", (_h, _ev, m) =>
    fv("module.smolen.hasFiveSpades", num(m, "hand.suitLength.spades") === 5)],
  ["module.smolen.hasFourSpades", (_h, _ev, m) =>
    fv("module.smolen.hasFourSpades", num(m, "hand.suitLength.spades") === 4)],
  ["module.smolen.hasFourHearts", (_h, _ev, m) =>
    fv("module.smolen.hasFourHearts", num(m, "hand.suitLength.hearts") === 4)],
  ["module.smolen.openerHasHeartFit", (_h, _ev, m) =>
    fv("module.smolen.openerHasHeartFit", num(m, "hand.suitLength.hearts") >= 3)],
  ["module.smolen.openerHasSpadesFit", (_h, _ev, m) =>
    fv("module.smolen.openerHasSpadesFit", num(m, "hand.suitLength.spades") >= 3)],
]);

/** Factory: creates Smolen facts (no system-dependent thresholds currently,
 *  but accepts SystemConfig for DI consistency). */
export function createSmolenFacts(_sys: SystemConfig): FactCatalogExtension {
  return {
    definitions: SMOLEN_FACTS,
    evaluators: SMOLEN_EVALUATORS,
  };
}
