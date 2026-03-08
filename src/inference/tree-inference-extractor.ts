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
import { mergeToCumulative } from "./merge";
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
