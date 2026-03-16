import type { Hand, HandEvaluation } from "../../../engine/types";
import type {
  FactDefinition,
  FactValue,
  EvaluatedFacts,
  FactCatalog,
  FactEvaluatorFn,
  RelationalFactEvaluatorFn,
} from "../../../core/contracts/fact-catalog";
import type { PosteriorFactProvider, PosteriorFactRequest } from "../../../core/contracts/posterior";
import type { PublicConstraint } from "../../../core/contracts/agreement-module";
import { createSharedFactCatalog, SHARED_EVALUATORS } from "./shared-fact-catalog";

// Re-export FactEvaluatorFn from contracts (canonical location)
export type { FactEvaluatorFn } from "../../../core/contracts/fact-catalog";
export type { HandFactResolverFn } from "../../../core/contracts/fact-catalog";

// Re-export for backward compatibility — consumers that imported these from fact-evaluator
export { createSharedFactCatalog } from "./shared-fact-catalog";
export { createHandFactResolver } from "./hand-fact-resolver";

/**
 * Context for relational fact evaluation. Relational facts derive from
 * hand + publicSnapshot + surfaceBindings, unlike standard facts which
 * derive from hand alone.
 *
 * Two independent binding mechanisms coexist:
 * 1. Clause-level bindings — `resolveFactId()` in meaning-evaluator replaces
 *    `$suit` in clause factId before fact lookup
 * 2. Fact-level relational evaluators — `RelationalFactEvaluatorFn` receives
 *    surfaceBindings as context, producing derived facts like "support for
 *    the bound suit" or "total raise points"
 */
export interface RelationalFactContext {
  readonly bindings?: Readonly<Record<string, string>>;
  readonly publicCommitments?: readonly PublicConstraint[];
}

// ─── Topological sort ───────────────────────────────────────

function topologicalSort(catalog: readonly FactDefinition[]): FactDefinition[] {
  const byId = new Map<string, FactDefinition>();
  for (const f of catalog) byId.set(f.id, f);

  const visited = new Set<string>();
  const sorted: FactDefinition[] = [];

  function visit(id: string): void {
    if (visited.has(id)) return;
    visited.add(id);
    const def = byId.get(id);
    if (!def) return;
    for (const dep of def.derivesFrom ?? []) {
      visit(dep);
    }
    sorted.push(def);
  }

  for (const f of catalog) {
    visit(f.id);
  }

  return sorted;
}

// ─── Public API ─────────────────────────────────────────────

export function evaluateFacts(
  hand: Hand,
  evaluation: HandEvaluation,
  catalog?: FactCatalog | readonly FactDefinition[],
  relationalContext?: RelationalFactContext,
  posterior?: PosteriorFactProvider,
  /** Seat ID to query posterior facts about (e.g. partner seat). Required when posterior is provided. */
  posteriorSeatId?: string,
): EvaluatedFacts {
  let effectiveDefinitions: readonly FactDefinition[];
  let effectiveEvaluators: ReadonlyMap<string, FactEvaluatorFn>;
  let effectiveRelationalEvaluators: ReadonlyMap<string, RelationalFactEvaluatorFn> | undefined;

  if (catalog === undefined || catalog === null) {
    // No catalog — use shared catalog (SHARED_FACTS)
    const shared = createSharedFactCatalog();
    effectiveDefinitions = shared.definitions;
    effectiveEvaluators = shared.evaluators;
    effectiveRelationalEvaluators = shared.relationalEvaluators;
  } else if ("evaluators" in catalog) {
    // FactCatalog object — use its definitions and evaluators
    effectiveDefinitions = catalog.definitions;
    effectiveEvaluators = catalog.evaluators;
    effectiveRelationalEvaluators = catalog.relationalEvaluators;
  } else {
    // Legacy: plain FactDefinition[] — use those definitions with shared evaluators
    effectiveDefinitions = catalog;
    effectiveEvaluators = SHARED_EVALUATORS;
    effectiveRelationalEvaluators = undefined;
  }

  // Standard evaluators: run all non-relational facts
  const actingHandDefs = effectiveDefinitions.filter((f) => f.world === "acting-hand");
  const relEvals = effectiveRelationalEvaluators;
  const standardDefs = relEvals
    ? actingHandDefs.filter((f) => !relEvals.has(f.id))
    : actingHandDefs;
  const sorted = topologicalSort(standardDefs);

  const facts = new Map<string, FactValue>();

  for (const def of sorted) {
    const evaluator = effectiveEvaluators.get(def.id);
    if (evaluator) {
      const value = evaluator(hand, evaluation, facts);
      facts.set(def.id, value);
    }
  }

  // Relational evaluators: run after standard facts, only when relationalContext provided
  if (relationalContext && relEvals) {
    const relationalDefs = actingHandDefs.filter((f) => relEvals.has(f.id));
    const relationalSorted = topologicalSort(relationalDefs);
    for (const def of relationalSorted) {
      const evaluator = relEvals.get(def.id);
      if (evaluator) {
        const value = evaluator(hand, evaluation, facts, relationalContext);
        facts.set(def.id, value);
      }
    }
  }

  // Posterior evaluators: run after all other evaluators.
  // Each PosteriorFactEvaluator handles null internally (see Fail-Open Policy).
  if (posterior && catalog && "posteriorEvaluators" in catalog && catalog.posteriorEvaluators) {
    for (const [factId, entry] of catalog.posteriorEvaluators) {
      const request: PosteriorFactRequest = { factId, seatId: posteriorSeatId ?? "" };
      const value = entry.evaluate(posterior, request);
      facts.set(factId, value);
    }
  }

  return { world: "acting-hand", facts };
}
