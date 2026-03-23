import { FactLayer } from "../../../../core/contracts/fact-layer";
import type {
  FactCatalogExtension,
  FactDefinition,
  FactEvaluatorFn,
} from "../../../../core/contracts/fact-catalog";
import { num, bool, fv } from "../../../pipeline/fact-helpers";
import type { SystemConfig } from "../../../../core/contracts/system-config";

// ─── Facts ───────────────────────────────────────────────────

const TRANSFER_FACTS: readonly FactDefinition[] = [
  {
    id: "module.transfer.targetSuit",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Transfer target suit (hearts, spades, or none)",
    valueType: "string",
    derivesFrom: ["hand.suitLength.hearts", "hand.suitLength.spades"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.transfer.eligible",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Eligible for Jacoby transfer (5+ card major)",
    valueType: "boolean",
    derivesFrom: ["bridge.hasFiveCardMajor"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.transfer.preferred",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Transfer preferred (eligible with 5+ card suit)",
    valueType: "boolean",
    derivesFrom: ["module.transfer.eligible"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.transfer.openerHasHeartFit",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Opener has 3+ hearts (fit with responder's 5-card suit)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.hearts"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.transfer.openerHasSpadesFit",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Opener has 3+ spades (fit with responder's 5-card suit)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
];

/** Factory: creates transfer fact evaluators parameterized by system config. */
function createTransferEvaluators(_sys: SystemConfig): Map<string, FactEvaluatorFn> {
  return new Map<string, FactEvaluatorFn>([
    ["module.transfer.targetSuit", (_h, _ev, m) => {
      const spades = num(m, "hand.suitLength.spades");
      const hearts = num(m, "hand.suitLength.hearts");
      if (spades >= 5 && hearts >= 5) return fv("module.transfer.targetSuit", "spades");
      if (spades >= 5) return fv("module.transfer.targetSuit", "spades");
      if (hearts >= 5) return fv("module.transfer.targetSuit", "hearts");
      return fv("module.transfer.targetSuit", "none");
    }],
    ["module.transfer.eligible", (_h, _ev, m) =>
      fv("module.transfer.eligible", bool(m, "bridge.hasFiveCardMajor"))],
    ["module.transfer.preferred", (_h, _ev, m) =>
      fv("module.transfer.preferred", bool(m, "module.transfer.eligible"))],
    ["module.transfer.openerHasHeartFit", (_h, _ev, m) =>
      fv("module.transfer.openerHasHeartFit", num(m, "hand.suitLength.hearts") >= 3)],
    ["module.transfer.openerHasSpadesFit", (_h, _ev, m) =>
      fv("module.transfer.openerHasSpadesFit", num(m, "hand.suitLength.spades") >= 3)],
  ]);
}

/** Factory: creates transfer facts parameterized by system config. */
export function createTransferFacts(sys: SystemConfig): FactCatalogExtension {
  return {
    definitions: TRANSFER_FACTS,
    evaluators: createTransferEvaluators(sys),
  };
}
