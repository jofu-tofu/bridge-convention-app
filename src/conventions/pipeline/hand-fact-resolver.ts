import type { Hand, HandEvaluation } from "../../engine/types";
import type {
  FactCatalog,
  FactValue,
} from "../../core/contracts/fact-catalog";
import type { HandFactResolverFn } from "../../core/contracts/fact-helpers";
import { createSharedFactCatalog } from "./shared-fact-catalog";
import { topologicalSort } from "./fact-utils";

/**
 * Create a HandFactResolverFn that evaluates any factId against a hand
 * using the catalog's evaluators. Evaluates facts in dependency order
 * (primitives first, then derived) and caches results per call.
 *
 * This is the bridge between the fact catalog and the posterior sampler.
 * The sampler calls this for each constraint clause instead of its
 * hardcoded resolveFactValue().
 */
export function createHandFactResolver(
  catalog?: FactCatalog,
): HandFactResolverFn {
  const effectiveCatalog = catalog ?? createSharedFactCatalog();
  const evaluators = effectiveCatalog.evaluators;
  const definitions = effectiveCatalog.definitions;

  // Pre-compute topological order once
  const actingHandDefs = definitions.filter((f) => f.world === "acting-hand");
  // Filter out relational evaluators — they need context the sampler doesn't have
  const relEvals = effectiveCatalog.relationalEvaluators;
  const standardDefs = relEvals
    ? actingHandDefs.filter((f) => !relEvals.has(f.id))
    : actingHandDefs;
  const sorted = topologicalSort(standardDefs);

  return (hand: Hand, evaluation: HandEvaluation, factId: string): number | boolean | string | undefined => {
    // Fast path: evaluate all facts in topological order (cached per call)
    const facts = new Map<string, FactValue>();
    for (const def of sorted) {
      const evaluator = evaluators.get(def.id);
      if (evaluator) {
        facts.set(def.id, evaluator(hand, evaluation, facts));
      }
    }
    return facts.get(factId)?.value;
  };
}
