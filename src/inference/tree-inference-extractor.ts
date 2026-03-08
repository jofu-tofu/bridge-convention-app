// Tree inference extractor — converts TreeInferenceData DTO to HandInference[].
// Operates on the serialized DTO form (no tree node references needed).
// Reuses condition-mapper logic for ConditionInference → HandInference conversion.

import type { Seat } from "../engine/types";
import type { HandInference, TreeInferenceData, TreeInferenceConditionEntry } from "../core/contracts";
import {
  conditionToHandInference,
  invertInference,
  resolveDisjunction,
} from "./condition-mapper";
import type { ConditionInference } from "./types";

/**
 * Extract HandInference[] from a TreeInferenceData DTO.
 * Positive inferences from pathConditions, negative (inverted) from rejectedConditions.
 * Non-negatable rejected conditions are skipped. Empty data → [].
 */
export function extractInferencesFromDTO(
  data: TreeInferenceData,
  seat: Seat,
  source: string,
): HandInference[] {
  const inferences: HandInference[] = [];

  // Positive: path conditions map directly to inferences
  for (const entry of data.pathConditions) {
    const ci = entryToConditionInference(entry);
    const hi = conditionToHandInference(ci, seat, source);
    if (hi) inferences.push(hi);
  }

  // Build cumulative for disjunction resolution
  let cumulative: HandInference | null =
    inferences.length > 0 ? mergeToCumulative(inferences, seat, source) : null;

  // Negative: invert rejected conditions
  for (const entry of data.rejectedConditions) {
    // Default negatable to true if not specified
    if (entry.negatable === false) continue;

    const ci = entryToConditionInference(entry);
    const inverted = invertInference(ci);
    if (!inverted) continue;

    const resolved = Array.isArray(inverted)
      ? resolveDisjunction(inverted, cumulative)
      : inverted;
    if (!resolved) continue;

    const hi = conditionToHandInference(resolved, seat, source);
    if (hi) {
      inferences.push(hi);
      cumulative = mergeToCumulative(inferences, seat, source);
    }
  }

  return inferences;
}

function entryToConditionInference(entry: TreeInferenceConditionEntry): ConditionInference {
  return { type: entry.type, params: entry.params } as ConditionInference;
}

/** Simple merge for cumulative tracking during extraction. */
function mergeToCumulative(
  inferences: HandInference[],
  seat: Seat,
  source: string,
): HandInference {
  let minHcp: number | undefined;
  let maxHcp: number | undefined;
  const suits: HandInference["suits"] = {};

  for (const inf of inferences) {
    if (inf.minHcp !== undefined) {
      minHcp = minHcp !== undefined ? Math.max(minHcp, inf.minHcp) : inf.minHcp;
    }
    if (inf.maxHcp !== undefined) {
      maxHcp = maxHcp !== undefined ? Math.min(maxHcp, inf.maxHcp) : inf.maxHcp;
    }
    for (const [s, si] of Object.entries(inf.suits)) {
      if (!suits[s as keyof typeof suits]) {
        suits[s as keyof typeof suits] = { ...si };
      }
    }
  }

  return { seat, minHcp, maxHcp, suits, source };
}
