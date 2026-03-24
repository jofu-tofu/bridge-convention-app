import { FactLayer } from "../../../core/fact-layer";
import type {
  FactCatalogExtension,
  FactDefinition,
  FactEvaluatorFn,
} from "../../../core/fact-catalog";
import { num, bool, fv } from "../../../pipeline/fact-helpers";
import type { SystemConfig } from "../../system-config";
import { TRANSFER_FACT_IDS } from "./fact-ids";

// ─── Facts ───────────────────────────────────────────────────

const TRANSFER_FACTS: readonly FactDefinition[] = [
  {
    id: TRANSFER_FACT_IDS.TARGET_SUIT,
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Transfer target suit (hearts, spades, or none)",
    valueType: "string",
    derivesFrom: ["hand.suitLength.hearts", "hand.suitLength.spades"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: TRANSFER_FACT_IDS.ELIGIBLE,
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Eligible for Jacoby transfer (5+ card major)",
    valueType: "boolean",
    derivesFrom: ["bridge.hasFiveCardMajor"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: TRANSFER_FACT_IDS.PREFERRED,
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Transfer preferred (eligible with 5+ card suit)",
    valueType: "boolean",
    derivesFrom: ["module.transfer.eligible"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: TRANSFER_FACT_IDS.OPENER_HAS_HEART_FIT,
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Opener has 3+ hearts (fit with responder's 5-card suit)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.hearts"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: TRANSFER_FACT_IDS.OPENER_HAS_SPADES_FIT,
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
    [TRANSFER_FACT_IDS.TARGET_SUIT, (_h, _ev, m) => {
      const spades = num(m, "hand.suitLength.spades");
      const hearts = num(m, "hand.suitLength.hearts");
      if (spades >= 5 && hearts >= 5) return fv(TRANSFER_FACT_IDS.TARGET_SUIT, "spades");
      if (spades >= 5) return fv(TRANSFER_FACT_IDS.TARGET_SUIT, "spades");
      if (hearts >= 5) return fv(TRANSFER_FACT_IDS.TARGET_SUIT, "hearts");
      return fv(TRANSFER_FACT_IDS.TARGET_SUIT, "none");
    }],
    [TRANSFER_FACT_IDS.ELIGIBLE, (_h, _ev, m) =>
      fv(TRANSFER_FACT_IDS.ELIGIBLE, bool(m, "bridge.hasFiveCardMajor"))],
    [TRANSFER_FACT_IDS.PREFERRED, (_h, _ev, m) =>
      fv(TRANSFER_FACT_IDS.PREFERRED, bool(m, TRANSFER_FACT_IDS.ELIGIBLE))],
    [TRANSFER_FACT_IDS.OPENER_HAS_HEART_FIT, (_h, _ev, m) =>
      fv(TRANSFER_FACT_IDS.OPENER_HAS_HEART_FIT, num(m, "hand.suitLength.hearts") >= 3)],
    [TRANSFER_FACT_IDS.OPENER_HAS_SPADES_FIT, (_h, _ev, m) =>
      fv(TRANSFER_FACT_IDS.OPENER_HAS_SPADES_FIT, num(m, "hand.suitLength.spades") >= 3)],
  ]);
}

/** Factory: creates transfer facts parameterized by system config. */
export function createTransferFacts(sys: SystemConfig): FactCatalogExtension {
  return {
    definitions: TRANSFER_FACTS,
    evaluators: createTransferEvaluators(sys),
  };
}
