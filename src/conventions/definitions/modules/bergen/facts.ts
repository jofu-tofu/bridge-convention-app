import { FactLayer } from "../../../core/fact-layer";
import type {
  FactCatalogExtension,
} from "../../../core/fact-catalog";
import { EvaluationWorld } from "../../../core/fact-catalog";
import { num, fv } from "../../../pipeline/facts/fact-helpers";
import { buildExtension } from "../../../pipeline/facts/fact-factory";
import type { FactEntry } from "../../../pipeline/facts/fact-factory";
import { BERGEN_FACT_IDS, BERGEN_CLAUSE_FACT_IDS } from "./ids";

// ─── Bergen module facts (factory-based) ─────────────────────

// Bergen has a single cross-suit fact — hand-written FactEntry,
// composed via buildExtension for consistency with other modules.

const hasMajorSupportEntry: FactEntry = {
  definition: {
    id: BERGEN_FACT_IDS.HAS_MAJOR_SUPPORT,
    layer: FactLayer.ModuleDerived,
    world: EvaluationWorld.ActingHand,
    description: "Has exactly 4-card support in at least one major",
    valueType: "boolean",
    derivesFrom: [BERGEN_CLAUSE_FACT_IDS.HAND_SUIT_LENGTH_HEARTS, BERGEN_CLAUSE_FACT_IDS.HAND_SUIT_LENGTH_SPADES],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  evaluator: [BERGEN_FACT_IDS.HAS_MAJOR_SUPPORT, (_h, _ev, m) =>
    fv(BERGEN_FACT_IDS.HAS_MAJOR_SUPPORT,
      num(m, BERGEN_CLAUSE_FACT_IDS.HAND_SUIT_LENGTH_HEARTS) === 4 || num(m, BERGEN_CLAUSE_FACT_IDS.HAND_SUIT_LENGTH_SPADES) === 4)],
};

const { definitions, evaluators } = buildExtension([hasMajorSupportEntry]);

export const bergenFacts: FactCatalogExtension = {
  definitions,
  evaluators,
};
