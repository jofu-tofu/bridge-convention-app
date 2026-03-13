import type {
  FactCatalogExtension,
  FactDefinition,
  FactValue,
  FactEvaluatorFn,
} from "../../../core/contracts/fact-catalog";

// ─── Helpers ─────────────────────────────────────────────────

function num(evaluated: ReadonlyMap<string, FactValue>, id: string): number {
  return evaluated.get(id)!.value as number;
}

function fv(factId: string, value: number | boolean | string): FactValue {
  return { factId, value };
}

// ─── Bergen module facts ────────────────────────────────────

const BERGEN_FACTS: readonly FactDefinition[] = [
  {
    id: "module.bergen.hasMajorSupport",
    layer: "module-derived",
    world: "acting-hand",
    description: "Has 4+ card support in at least one major",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.hearts", "hand.suitLength.spades"],
  },
];

const BERGEN_EVALUATORS = new Map<string, FactEvaluatorFn>([
  ["module.bergen.hasMajorSupport", (_h, _ev, m) =>
    fv("module.bergen.hasMajorSupport",
      num(m, "hand.suitLength.hearts") >= 4 || num(m, "hand.suitLength.spades") >= 4)],
]);

export const bergenFacts: FactCatalogExtension = {
  definitions: BERGEN_FACTS,
  evaluators: BERGEN_EVALUATORS,
};
