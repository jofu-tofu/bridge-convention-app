import type { Hand, HandEvaluation } from "../../engine/types";
import type { PublicConstraint } from "./agreement-module";
import type { PosteriorFactProvider, PosteriorFactRequest } from "./posterior";
import type { ConstraintDimension } from "./meaning";

// Re-export extracted modules for backward compatibility
export { num, bool, fv } from "./fact-helpers";
export type { HandFactResolverFn } from "./fact-helpers";
export { PRIMITIVE_FACTS, BRIDGE_DERIVED_FACTS, POSTERIOR_DERIVED_FACTS, SHARED_FACTS } from "./shared-facts";
export { FactLayer } from "./fact-layer";

/** World scope for fact evaluation. */
export type EvaluationWorld = "public" | "acting-hand" | "full-deal";

/** Metadata hints for downstream consumers (analyzers, solvers, explainers). */
export interface FactMetadata {
  readonly negatable?: boolean;
  readonly inferable?: boolean;
  readonly explainable?: boolean;
  readonly preferredExplanationLevel?: "semantic" | "mechanical";
  readonly analyzerHint?: "trigger" | "opaque";
  readonly solverSupport?: "native" | "post-filter";
}

/** A fact definition in the catalog. */
export interface FactDefinition {
  readonly id: string;
  readonly layer: FactLayer;
  readonly world: EvaluationWorld;
  readonly description: string;
  readonly valueType: "number" | "boolean" | "string";
  readonly derivesFrom?: readonly string[];
  readonly metadata?: FactMetadata;
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
  context: { bindings?: Readonly<Record<string, string>>; publicCommitments?: readonly PublicConstraint[] },
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

