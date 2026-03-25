import type { FactDefinition } from "../../core/fact-catalog";

/**
 * Topological sort of fact definitions by dependency order.
 *
 * Walks each definition's `derivesFrom` edges so that dependencies are
 * evaluated before the facts that depend on them.
 */
export function topologicalSort(catalog: readonly FactDefinition[]): FactDefinition[] {
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
