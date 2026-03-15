import type { Hand, HandEvaluation } from "../../engine/types";
import type { PublicConstraint } from "./agreement-module";
import type { PosteriorFactProvider, PosteriorFactRequest } from "./posterior";

/** Stratification of fact definitions. */
export type FactLayer = "primitive" | "bridge-derived" | "module-derived";

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

/** A composed fact catalog: definitions + evaluators. */
export interface FactCatalog {
  readonly definitions: readonly FactDefinition[];
  readonly evaluators: ReadonlyMap<string, FactEvaluatorFn>;
  readonly relationalEvaluators?: ReadonlyMap<string, RelationalFactEvaluatorFn>;
  readonly posteriorEvaluators?: ReadonlyMap<string, PosteriorFactEvaluatorFn>;
}

/** An extension that a module contributes to a base catalog. */
export interface FactCatalogExtension {
  readonly definitions: readonly FactDefinition[];
  readonly evaluators: ReadonlyMap<string, FactEvaluatorFn>;
  readonly relationalEvaluators?: ReadonlyMap<string, RelationalFactEvaluatorFn>;
  readonly posteriorEvaluators?: ReadonlyMap<string, PosteriorFactEvaluatorFn>;
}

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
  const mergedPosterior = new Map<string, PosteriorFactEvaluatorFn>(
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
      for (const [id, fn] of ext.posteriorEvaluators) {
        mergedPosterior.set(id, fn);
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

// ─── Shared facts ────────────────────────────────────────────
// Shared facts: bridge-universal vocabulary. Promote to bridge.* only when 2+ modules
// use it AND it can be named without a convention name. Module-specific facts belong
// in their module's FactCatalogExtension, not here.

export const PRIMITIVE_FACTS: readonly FactDefinition[] = [
  {
    id: "hand.hcp",
    layer: "primitive",
    world: "acting-hand",
    description: "High card points",
    valueType: "number",
    derivesFrom: [],
  },
  {
    id: "hand.suitLength.spades",
    layer: "primitive",
    world: "acting-hand",
    description: "Number of spades",
    valueType: "number",
    derivesFrom: [],
  },
  {
    id: "hand.suitLength.hearts",
    layer: "primitive",
    world: "acting-hand",
    description: "Number of hearts",
    valueType: "number",
    derivesFrom: [],
  },
  {
    id: "hand.suitLength.diamonds",
    layer: "primitive",
    world: "acting-hand",
    description: "Number of diamonds",
    valueType: "number",
    derivesFrom: [],
  },
  {
    id: "hand.suitLength.clubs",
    layer: "primitive",
    world: "acting-hand",
    description: "Number of clubs",
    valueType: "number",
    derivesFrom: [],
  },
  {
    id: "hand.isBalanced",
    layer: "primitive",
    world: "acting-hand",
    description: "Hand is balanced (4-3-3-3, 4-4-3-2, 5-3-3-2)",
    valueType: "boolean",
    derivesFrom: [],
  },
];

export const BRIDGE_DERIVED_FACTS: readonly FactDefinition[] = [
  {
    id: "bridge.hasFourCardMajor",
    layer: "bridge-derived",
    world: "acting-hand",
    description: "Has at least one 4+ card major",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades", "hand.suitLength.hearts"],
  },
  {
    id: "bridge.hasFiveCardMajor",
    layer: "bridge-derived",
    world: "acting-hand",
    description: "Has at least one 5+ card major",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades", "hand.suitLength.hearts"],
  },
  {
    id: "bridge.majorPattern",
    layer: "bridge-derived",
    world: "acting-hand",
    description:
      "Major suit pattern classification (none, one-four, both-four, one-five, five-four, five-five)",
    valueType: "string",
    derivesFrom: ["hand.suitLength.spades", "hand.suitLength.hearts"],
  },
  {
    id: "bridge.supportForBoundSuit",
    layer: "bridge-derived",
    world: "acting-hand",
    description: "Length in the suit specified by $suit binding",
    valueType: "number",
    derivesFrom: ["hand.suitLength.spades", "hand.suitLength.hearts", "hand.suitLength.diamonds", "hand.suitLength.clubs"],
  },
  {
    id: "bridge.fitWithBoundSuit",
    layer: "bridge-derived",
    world: "acting-hand",
    description: "8+ combined cards in the bound suit (own length + partner's promised min)",
    valueType: "boolean",
    derivesFrom: ["bridge.supportForBoundSuit"],
  },
  {
    id: "bridge.hasShortage",
    layer: "bridge-derived",
    world: "acting-hand",
    description: "Has singleton or void in any suit (for splinter detection)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades", "hand.suitLength.hearts", "hand.suitLength.diamonds", "hand.suitLength.clubs"],
    metadata: { negatable: true, explainable: true },
  },
  {
    id: "bridge.shortageInSuit",
    layer: "bridge-derived",
    world: "acting-hand",
    description: "Has 0-1 cards in the suit specified by $suit binding",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades", "hand.suitLength.hearts", "hand.suitLength.diamonds", "hand.suitLength.clubs"],
  },
  {
    id: "bridge.totalPointsForRaise",
    layer: "bridge-derived",
    world: "acting-hand",
    description: "Dummy points (HCP + shortage points) for raising the bound suit",
    valueType: "number",
    derivesFrom: ["hand.hcp", "hand.suitLength.spades", "hand.suitLength.hearts", "hand.suitLength.diamonds", "hand.suitLength.clubs"],
  },
];

export const POSTERIOR_DERIVED_FACTS: readonly FactDefinition[] = [
  {
    id: "bridge.partnerHas4CardMajorLikely",
    layer: "bridge-derived",
    world: "acting-hand",
    description: "Posterior probability that partner has a 4+ card major in specified suit",
    valueType: "number",
    metadata: { inferable: true, explainable: true },
  },
  {
    id: "bridge.combinedHcpInRangeLikely",
    layer: "bridge-derived",
    world: "acting-hand",
    description: "Posterior probability that combined HCP falls in specified range",
    valueType: "number",
    metadata: { inferable: true, explainable: true },
  },
];

/** Shared facts (primitive + bridge-derived + posterior-derived). Module-derived facts live in FactCatalogExtensions. */
export const SHARED_FACTS: readonly FactDefinition[] = [
  ...PRIMITIVE_FACTS,
  ...BRIDGE_DERIVED_FACTS,
  ...POSTERIOR_DERIVED_FACTS,
];

// ── Fact authoring helpers ────────────────────────────────────
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

