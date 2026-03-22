/**
 * Canonical binding resolution for $-prefixed placeholders in fact IDs.
 *
 * Surface clauses use parameterized fact IDs like `hand.suitLength.$suit`
 * with surfaceBindings `{ suit: "hearts" }`. This module provides the
 * single source of truth for resolving those placeholders into concrete
 * fact IDs before any downstream lookup.
 */

import type { BidMeaningClause } from "../../core/contracts/meaning";

/**
 * Resolve $-prefixed binding references in a factId.
 * Unresolved keys are left as-is (fail-closed).
 */
export function resolveFactId(
  factId: string,
  bindings?: Readonly<Record<string, string>>,
): string {
  if (!bindings) return factId;
  return factId.replace(/\$(\w+)/g, (_, key: string) => {
    const value = bindings[key];
    return value !== undefined ? value : `$${key}`;
  });
}

/**
 * Resolve bindings in a BidMeaningClause, returning a new clause
 * with the resolved factId. Returns the same object if no resolution needed.
 */
export function resolveClause(
  clause: BidMeaningClause,
  bindings?: Readonly<Record<string, string>>,
): BidMeaningClause {
  if (!bindings) return clause;
  const resolved = resolveFactId(clause.factId, bindings);
  return resolved === clause.factId ? clause : { ...clause, factId: resolved };
}
