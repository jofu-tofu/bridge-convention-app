import type { Hand, HandEvaluation } from "../../../engine/types";
import type { FactValue } from "../../../core/contracts/fact-catalog";

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
