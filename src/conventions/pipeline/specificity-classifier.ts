import type { BidMeaning, SpecificityBasis } from "../../core/contracts/meaning";
import type { FactCatalogExtension, FactDefinition } from "../../core/contracts/fact-catalog";

/**
 * Classify how a surface's specificity was determined by inspecting its clauses.
 *
 * - "derived": ALL clauses reference primitive facts (hand.*) or bridge-derived facts
 *   that have transparent derivesFrom chains leading to primitives
 * - "asserted": at least one clause references a module-derived boolean fact with
 *   empty or missing derivesFrom (opaque evaluator)
 * - "partial": mix — some clauses are transparent, some are opaque
 *
 * A surface with no clauses is classified as "derived" (trivially — nothing to assert).
 */
export function classifySpecificityBasis(
  surface: BidMeaning,
  factExtensions: readonly FactCatalogExtension[],
): SpecificityBasis {
  const { clauses } = surface;

  if (clauses.length === 0) return "derived";

  // Build a lookup from factId → FactDefinition across all extensions.
  const factLookup = new Map<string, FactDefinition>();
  for (const ext of factExtensions) {
    for (const def of ext.definitions) {
      factLookup.set(def.id, def);
    }
  }

  // Memoize transparency checks to avoid redundant recursive walks.
  const memo = new Map<string, boolean>();

  function isTransparent(factId: string): boolean {
    const cached = memo.get(factId);
    if (cached !== undefined) return cached;

    // Primitive facts are always transparent.
    if (factId.startsWith("hand.")) {
      memo.set(factId, true);
      return true;
    }

    // Bridge-derived facts: transparent if derivesFrom is non-empty.
    if (factId.startsWith("bridge.")) {
      const def = factLookup.get(factId);
      const result = def !== undefined && def.derivesFrom !== undefined && def.derivesFrom.length > 0;
      memo.set(factId, result);
      return result;
    }

    // Module-derived facts: transparent only if derivesFrom is non-empty
    // AND all derivesFrom targets are themselves transparent (recursive).
    if (factId.startsWith("module.")) {
      // Mark as opaque before recursing to handle cycles safely.
      memo.set(factId, false);
      const def = factLookup.get(factId);
      if (!def || !def.derivesFrom || def.derivesFrom.length === 0) {
        return false;
      }
      const result = def.derivesFrom.every((dep) => isTransparent(dep));
      memo.set(factId, result);
      return result;
    }

    // Unknown prefix — treat as opaque.
    memo.set(factId, false);
    return false;
  }

  let transparentCount = 0;
  let opaqueCount = 0;

  for (const clause of clauses) {
    if (isTransparent(clause.factId)) {
      transparentCount++;
    } else {
      opaqueCount++;
    }
  }

  if (opaqueCount === 0) return "derived";
  if (transparentCount === 0) return "asserted";
  return "partial";
}
