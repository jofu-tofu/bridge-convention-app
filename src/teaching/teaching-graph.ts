/**
 * Pedagogical Relation Graph
 *
 * Indexes TeachingRelation[] by meaning ref for O(1) lookup.
 * Pure function — no side effects, no imports from strategy/stores/components.
 */

import type { TeachingRelation } from "../core/contracts/teaching-projection";

/** Indexed pedagogical relation graph for efficient lookup by meaning ref. */
export interface TeachingGraph {
  /** All relations in the graph, indexed by meaning ref (both a and b). */
  readonly byRef: ReadonlyMap<string, readonly TeachingRelation[]>;
}

/**
 * Build an indexed TeachingGraph from a flat array of relations.
 * Each relation is indexed under both its `a` and `b` refs.
 */
export function buildTeachingGraph(
  relations: readonly TeachingRelation[],
): TeachingGraph {
  const byRef = new Map<string, TeachingRelation[]>();

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
  graph: TeachingGraph,
  meaningRef: string,
): readonly TeachingRelation[] {
  return graph.byRef.get(meaningRef) ?? [];
}
