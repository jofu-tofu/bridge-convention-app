/**
 * Pedagogical Relation Graph
 *
 * Indexes PedagogicalRelation[] by meaning ref for O(1) lookup.
 * Pure function — no side effects, no imports from strategy/stores/components.
 */

import type { PedagogicalRelation } from "../core/contracts/pedagogical-relations";

/** Indexed pedagogical relation graph for efficient lookup by meaning ref. */
export interface PedagogicalGraph {
  /** All relations in the graph, indexed by meaning ref (both a and b). */
  readonly byRef: ReadonlyMap<string, readonly PedagogicalRelation[]>;
}

/**
 * Build an indexed PedagogicalGraph from a flat array of relations.
 * Each relation is indexed under both its `a` and `b` refs.
 */
export function buildPedagogicalGraph(
  relations: readonly PedagogicalRelation[],
): PedagogicalGraph {
  const byRef = new Map<string, PedagogicalRelation[]>();

  for (const relation of relations) {
    const aList = byRef.get(relation.a);
    if (aList) {
      aList.push(relation);
    } else {
      byRef.set(relation.a, [relation]);
    }

    const bList = byRef.get(relation.b);
    if (bList) {
      bList.push(relation);
    } else {
      byRef.set(relation.b, [relation]);
    }
  }

  return { byRef };
}

/**
 * Find all pedagogical relations involving a given meaning ref.
 * Returns empty array if no relations found.
 */
export function findRelationsFor(
  graph: PedagogicalGraph,
  meaningRef: string,
): readonly PedagogicalRelation[] {
  return graph.byRef.get(meaningRef) ?? [];
}
