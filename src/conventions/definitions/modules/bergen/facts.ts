import { FactLayer } from "../../../../core/contracts/fact-layer";
import type {
  FactCatalogExtension,
} from "../../../../core/contracts/fact-catalog";
import { num, fv } from "../../../pipeline/fact-helpers";
import { buildExtension } from "../../../pipeline/fact-factory";
import type { FactEntry } from "../../../pipeline/fact-factory";

// ─── Bergen module facts (factory-based) ─────────────────────

// Bergen has a single cross-suit fact — hand-written FactEntry,
// composed via buildExtension for consistency with other modules.

const hasMajorSupportEntry: FactEntry = {
  definition: {
    id: "module.bergen.hasMajorSupport",
    layer: FactLayer.ModuleDerived,
    world: "acting-hand",
    description: "Has exactly 4-card support in at least one major",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.hearts", "hand.suitLength.spades"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  evaluator: ["module.bergen.hasMajorSupport", (_h, _ev, m) =>
    fv("module.bergen.hasMajorSupport",
      num(m, "hand.suitLength.hearts") === 4 || num(m, "hand.suitLength.spades") === 4)],
};

const { definitions, evaluators } = buildExtension([hasMajorSupportEntry]);

export const bergenFacts: FactCatalogExtension = {
  definitions,
  evaluators,
};
