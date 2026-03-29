import type {
  FactDefinition,
  FactEvaluatorFn,
  FactValue,
  FactComposition,
} from "../../core/fact-catalog";
import { EvaluationWorld } from "../../core/fact-catalog";
import { FactLayer } from "../../core/fact-layer";
import type { ConstraintDimension } from "../evaluation/meaning";
import type { Hand } from "../../../engine/types";
import { num, fv } from "./fact-helpers";
import { FactOperator } from "../evaluation/meaning";

// ─── Uniform return type ─────────────────────────────────────

/** Single fact definition + its evaluator. Uniform return type for all helpers. */
export interface FactEntry {
  readonly definition: FactDefinition;
  readonly evaluator: [string, FactEvaluatorFn];
}

// ─── Pattern 1: Boolean from a single primitive comparison ───

interface DefineBooleanFactOpts {
  readonly id: string;
  readonly description: string;
  readonly factId: string;
  readonly operator: FactOperator.Gte | FactOperator.Lte | FactOperator.Eq;
  readonly value: number;
  readonly constrainsDimensions: ConstraintDimension[];
  readonly derivesFrom?: string[];
}

/** Boolean fact derived from a single numeric comparison against an existing fact. */
export function defineBooleanFact(opts: DefineBooleanFactOpts): FactEntry {
  const derivesFrom = opts.derivesFrom ?? [opts.factId];
  const composition: FactComposition = {
    kind: "primitive",
    clause: { factId: opts.factId, operator: opts.operator, value: opts.value },
  };
  const definition: FactDefinition = {
    id: opts.id,
    layer: FactLayer.ModuleDerived,
    world: EvaluationWorld.ActingHand,
    description: opts.description,
    valueType: "boolean",
    derivesFrom,
    constrainsDimensions: opts.constrainsDimensions,
    composition,
  };

  const comparator = buildComparator(opts.operator, opts.value);
  const sourceFactId = opts.factId;
  const factId = opts.id;

  const evaluator: FactEvaluatorFn = (_h, _ev, m) => {
    const v = num(m, sourceFactId);
    return fv(factId, comparator(v));
  };

  return { definition, evaluator: [opts.id, evaluator] };
}

function buildComparator(
  operator: FactOperator.Gte | FactOperator.Lte | FactOperator.Eq,
  value: number,
): (v: number) => boolean {
  switch (operator) {
    case FactOperator.Gte:
      return (v) => v >= value;
    case FactOperator.Lte:
      return (v) => v <= value;
    case FactOperator.Eq:
      return (v) => v === value;
  }
}

// ─── Pattern 2: Per-suit fact replication ────────────────────

interface DefinePerSuitFactsOpts {
  readonly idPrefix: string;
  readonly suits: readonly string[];
  readonly description: (suit: string) => string;
  readonly evaluator: (hand: Hand, suit: string, memo: Map<string, FactValue>) => FactValue;
  readonly valueType: "boolean" | "number";
  readonly constrainsDimensions: ConstraintDimension[];
  readonly derivesFrom?: string[] | ((suit: string) => string[]);
}

/** Replicate a fact across suits — returns one FactEntry per suit. */
export function definePerSuitFacts(opts: DefinePerSuitFactsOpts): FactEntry[] {
  return opts.suits.map((suit) => {
    const id = `${opts.idPrefix}.${suit}`;
    const derivesFrom =
      typeof opts.derivesFrom === "function"
        ? opts.derivesFrom(suit)
        : opts.derivesFrom ?? [];

    const definition: FactDefinition = {
      id,
      layer: FactLayer.ModuleDerived,
      world: EvaluationWorld.ActingHand,
      description: opts.description(suit),
      valueType: opts.valueType,
      derivesFrom,
      constrainsDimensions: opts.constrainsDimensions,
    };

    const suitEvaluator = opts.evaluator;
    const evaluator: FactEvaluatorFn = (h, _ev, m) =>
      suitEvaluator(h, suit, m as Map<string, FactValue>);

    return { definition, evaluator: [id, evaluator] };
  });
}

// ─── Pattern 3: HCP range fact ──────────────────────────────

interface DefineHcpRangeFactOpts {
  readonly id: string;
  readonly description: string;
  readonly range: { readonly min: number; readonly max: number };
  readonly constrainsDimensions?: ConstraintDimension[];
}

/** Boolean fact that checks whether HCP falls within a given range. */
export function defineHcpRangeFact(opts: DefineHcpRangeFactOpts): FactEntry {
  const composition: FactComposition = {
    kind: "and",
    operands: [
      { kind: "primitive", clause: { factId: "hand.hcp", operator: FactOperator.Gte, value: opts.range.min } },
      { kind: "primitive", clause: { factId: "hand.hcp", operator: FactOperator.Lte, value: opts.range.max } },
    ],
  };
  const definition: FactDefinition = {
    id: opts.id,
    layer: FactLayer.ModuleDerived,
    world: EvaluationWorld.ActingHand,
    description: opts.description,
    valueType: "boolean",
    derivesFrom: ["hand.hcp"],
    constrainsDimensions: opts.constrainsDimensions ?? ["pointRange"],
    composition,
  };

  const { min, max } = opts.range;
  const factId = opts.id;

  const evaluator: FactEvaluatorFn = (_h, _ev, m) => {
    const hcp = num(m, "hand.hcp");
    return fv(factId, hcp >= min && hcp <= max);
  };

  return { definition, evaluator: [opts.id, evaluator] };
}

// ─── Compose helper ─────────────────────────────────────────

/** Compose FactEntry[] into a FactCatalogExtension-compatible shape. */
export function buildExtension(
  entries: FactEntry[],
): { definitions: FactDefinition[]; evaluators: Map<string, FactEvaluatorFn> } {
  const definitions: FactDefinition[] = [];
  const evaluators = new Map<string, FactEvaluatorFn>();

  for (const entry of entries) {
    definitions.push(entry.definition);
    evaluators.set(entry.evaluator[0], entry.evaluator[1]);
  }

  return { definitions, evaluators };
}
