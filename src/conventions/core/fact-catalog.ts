import type { Hand, HandEvaluation } from "../../engine/types";
import type { PublicConstraint } from "./agreement-module";
import type { PosteriorFactProvider, PosteriorFactRequest } from "../../inference/posterior/posterior-types";
import type { ConstraintDimension } from "../pipeline/evaluation/meaning";
import type { FactLayer } from "./fact-layer";


/** World scope for fact evaluation. */
export type EvaluationWorld = "public" | "acting-hand" | "full-deal";

// ─── Composable fact types ────────────────────────────────────

/**
 * A primitive clause that maps directly to a `compileFactClause()` call.
 * The factId must be a primitive fact recognized by the fact compiler
 * (hand.hcp, hand.suitLength.*, hand.isBalanced, bridge.*).
 */
export interface PrimitiveClause {
  readonly factId: string;
  readonly operator: "gte" | "lte" | "eq" | "range";
  readonly value: number | { readonly min: number; readonly max: number };
}

/**
 * Composable tree describing the activation prerequisite of a module-derived fact.
 *
 * A composition captures the LOOSEST constraint under which the fact COULD be true.
 * It does NOT need to be semantically equivalent to the evaluator. Deal constraints
 * only need to include all valid hands; the pipeline evaluates exact semantics at
 * runtime. Convention authors should write the LOOSEST correct composition.
 */
export type FactComposition =
  | { readonly kind: "primitive"; readonly clause: PrimitiveClause }
  | { readonly kind: "and"; readonly operands: readonly FactComposition[] }
  | { readonly kind: "or"; readonly operands: readonly FactComposition[] }
  | { readonly kind: "not"; readonly operand: FactComposition };

/** A fact definition in the catalog. */
export interface FactDefinition {
  readonly id: string;
  readonly layer: FactLayer;
  readonly world: EvaluationWorld;
  readonly description: string;
  readonly valueType: "number" | "boolean" | "string";
  readonly derivesFrom?: readonly string[];
  /** Communicative constraint dimensions this fact provides when used in a bid's clause.
   *  REQUIRED. Describes what information the bid communicates to partner when this
   *  fact is checked — NOT what the evaluator code reads internally.
   *
   *  Rules for assignment:
   *  - "suitIdentity": the fact identifies which specific suit(s) are promised
   *  - "suitLength": the fact constrains min/max cards in specific suits
   *  - "pointRange": the fact constrains HCP or total point bounds
   *  - "shapeClass": the fact constrains distributional shape (balanced, shortage, etc.)
   *  - "suitRelation": the fact constrains relationships between suits
   *  - "suitQuality": the fact constrains honor holdings or suit solidity
   *
   *  For boolean facts that wrap multiple conditions (e.g., module.dont.bothMajors),
   *  list the dimensions the BID COMMUNICATES, not what the evaluator reads.
   *  Specificity is derived from the union of dimensions across a surface's clauses. */
  readonly constrainsDimensions: readonly ConstraintDimension[];
  /**
   * Composable activation prerequisite for module-derived facts.
   * REQUIRED for FactLayer.ModuleDerived after composition migration.
   * The composition captures the loosest constraint under which the fact
   * COULD be true — the pipeline evaluates exact semantics at runtime.
   */
  readonly composition?: FactComposition;
}

/** A concrete fact value. */
export interface FactValue {
  readonly factId: string;
  readonly value: number | boolean | string;
}

/** A set of evaluated facts for a specific world. */
export interface EvaluatedFacts {
  readonly world: EvaluationWorld;
  readonly facts: ReadonlyMap<string, FactValue>;
}

/** Type-safe get accessor for EvaluatedFacts. */
export function getFactValue(
  evaluated: EvaluatedFacts,
  factId: string,
): FactValue | undefined {
  return evaluated.facts.get(factId);
}

// ─── Extensibility types ─────────────────────────────────────

/** Evaluator function for a single fact. */
export type FactEvaluatorFn = (
  hand: Hand,
  evaluation: HandEvaluation,
  evaluated: ReadonlyMap<string, FactValue>,
) => FactValue;

/** Evaluator for relational facts that derive from hand + publicSnapshot + surfaceBindings. */
export type RelationalFactEvaluatorFn = (
  hand: Hand,
  evaluation: HandEvaluation,
  evaluated: ReadonlyMap<string, FactValue>,
  context: {
    bindings?: Readonly<Record<string, string>>;
    publicCommitments?: readonly PublicConstraint[];
    fitAgreed?: { readonly strain: string; readonly confidence: "tentative" | "final" } | null;
  },
) => FactValue;

/** Evaluator that bridges posterior engine probabilities into the fact catalog. */
export type PosteriorFactEvaluatorFn = (
  provider: PosteriorFactProvider,
  request: PosteriorFactRequest,
) => FactValue;

/** A posterior evaluator bundled with its conditionedOn parameters. */
export interface PosteriorFactEvaluator {
  readonly evaluate: PosteriorFactEvaluatorFn;
  readonly conditionedOn?: readonly string[];
}

/** An extension that a module contributes to a base catalog. */
export interface FactCatalogExtension {
  readonly definitions: readonly FactDefinition[];
  readonly evaluators: ReadonlyMap<string, FactEvaluatorFn>;
  readonly relationalEvaluators?: ReadonlyMap<string, RelationalFactEvaluatorFn>;
  readonly posteriorEvaluators?: ReadonlyMap<string, PosteriorFactEvaluator>;
}

/** A composed fact catalog: definitions + evaluators. Structurally identical to an extension. */
export type FactCatalog = FactCatalogExtension;

/** Merge a base catalog with one or more extensions. Extensions override base on evaluator conflict. */
export function createFactCatalog(
  base: FactCatalog,
  ...extensions: FactCatalogExtension[]
): FactCatalog {
  const allDefinitions: FactDefinition[] = [...base.definitions];
  const mergedEvaluators = new Map<string, FactEvaluatorFn>(base.evaluators);
  const mergedRelational = new Map<string, RelationalFactEvaluatorFn>(
    base.relationalEvaluators ?? [],
  );
  const mergedPosterior = new Map<string, PosteriorFactEvaluator>(
    base.posteriorEvaluators ?? [],
  );

  for (const ext of extensions) {
    allDefinitions.push(...ext.definitions);
    for (const [id, fn] of ext.evaluators) {
      mergedEvaluators.set(id, fn);
    }
    if (ext.relationalEvaluators) {
      for (const [id, fn] of ext.relationalEvaluators) {
        mergedRelational.set(id, fn);
      }
    }
    if (ext.posteriorEvaluators) {
      for (const [id, entry] of ext.posteriorEvaluators) {
        mergedPosterior.set(id, entry);
      }
    }
  }

  return {
    definitions: allDefinitions,
    evaluators: mergedEvaluators,
    relationalEvaluators: mergedRelational.size > 0 ? mergedRelational : undefined,
    posteriorEvaluators: mergedPosterior.size > 0 ? mergedPosterior : undefined,
  };
}

// ─── Fact authoring helpers ────────────────────────────────────
// Shared utilities for convention fact evaluators and pipeline fact evaluation.

/** Extract a numeric fact value from evaluated facts. */
export function num(evaluated: ReadonlyMap<string, FactValue>, id: string): number {
  return evaluated.get(id)!.value as number;
}

/** Extract a boolean fact value from evaluated facts. */
export function bool(evaluated: ReadonlyMap<string, FactValue>, id: string): boolean {
  return evaluated.get(id)!.value as boolean;
}

/** Create a FactValue object from a factId and value. */
export function fv(factId: string, value: number | boolean | string): FactValue {
  return { factId, value };
}

/** Resolves a factId to its value for a given hand.
 *  Used by the posterior sampler to check constraints against any fact,
 *  not just hardcoded primitives. */
export type HandFactResolverFn = (
  hand: Hand,
  evaluation: HandEvaluation,
  factId: string,
) => number | boolean | string | undefined;
