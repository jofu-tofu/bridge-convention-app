// Interference classifier — extracted from effective-context.ts to break
// the effective-context.ts ↔ registry.ts circular dependency.
// Uses dependency injection (lookupConvention param) instead of importing getConvention.

import type { ConventionConfig } from "./types";
import type { DialogueState } from "./dialogue/dialogue-state";

/** Classify detected interference using registered opponent convention signatures.
 *  Uses a lookup function instead of importing getConvention directly to avoid
 *  circular dependency with registry.ts. */
export function classifyInterference(
  state: DialogueState,
  opponentConventionIds: readonly string[],
  lookupConvention: (id: string) => ConventionConfig,
): DialogueState {
  const detail = state.interferenceDetail;
  if (!detail || opponentConventionIds.length === 0) return state;

  for (const conventionId of opponentConventionIds) {
    try {
      const config = lookupConvention(conventionId);
      for (const signature of config.interferenceSignatures ?? []) {
        if (!signature.matches(detail.call)) continue;
        return {
          ...state,
          interferenceDetail: {
            ...detail,
            kind: signature.kind,
            isNatural: signature.isNatural ?? detail.isNatural,
          },
        };
      }
    } catch {
      // Ignore unknown IDs in classification path; caller may pass stale metadata.
    }
  }

  return state;
}
