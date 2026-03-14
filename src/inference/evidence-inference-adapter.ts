// Evidence-bundle inference adapter — converts EvidenceBundleIR to HandInference.
// Bridges the meaning-arbitrator's evidence output to the inference system.
// Follows the same pattern as tree-inference-extractor.ts (positive + negative inference).

import type {
  EvidenceBundleIR,
  ConditionEvidenceIR,
} from "../core/contracts/evidence-bundle";
import type { HandInference } from "./types";
import type { ConditionInference } from "../conventions/core";
import type { Seat } from "../engine/types";
import {
  conditionToHandInference,
  invertInference,
  resolveDisjunction,
} from "./condition-mapper";
import { mergeToCumulative } from "./merge";

/** Maps suit names in factIds (hand.suitLength.<name>) to suitIndex used by ConditionInference. */
const SUIT_NAME_TO_INDEX: Record<string, number> = {
  spades: 0,
  hearts: 1,
  diamonds: 2,
  clubs: 3,
};

/**
 * Infer whether a numeric threshold represents a minimum or maximum constraint.
 * Uses the observedValue/satisfied pair to determine constraint direction.
 * Defaults to "min" (gte) when ambiguous — the most common bridge convention pattern.
 */
function inferDirection(
  observedValue: unknown,
  threshold: number,
  satisfied: boolean,
): "min" | "max" {
  if (typeof observedValue !== "number") return "min";
  if (satisfied) {
    // satisfied + observedValue >= threshold → gte constraint (minimum)
    // satisfied + observedValue < threshold → lte constraint (maximum)
    return observedValue >= threshold ? "min" : "max";
  }
  // failed + observedValue < threshold → gte constraint that wasn't met (minimum)
  // failed + observedValue > threshold → lte constraint that was exceeded (maximum)
  return observedValue < threshold ? "min" : "max";
}

/**
 * Convert a ConditionEvidenceIR into a ConditionInference.
 * Maps factId patterns (hand.hcp, hand.suitLength.*) to structured inference types.
 * Returns null for unrecognized fact patterns or missing threshold.
 */
export function evidenceToConditionInference(
  evidence: ConditionEvidenceIR,
): ConditionInference | null {
  const { conditionId, factId, threshold, observedValue, satisfied } = evidence;
  const id = factId ?? conditionId;
  if (threshold === null || threshold === undefined) return null;

  // HCP conditions
  if (id === "hand.hcp") {
    // Range threshold: { min, max }
    if (
      typeof threshold === "object" &&
      threshold !== null &&
      "min" in threshold &&
      "max" in threshold
    ) {
      const range = threshold as { min: number; max: number };
      return { type: "hcp-range", params: { min: range.min, max: range.max } };
    }
    if (typeof threshold !== "number") return null;

    const dir = inferDirection(observedValue, threshold, satisfied);
    return dir === "min"
      ? { type: "hcp-min", params: { min: threshold } }
      : { type: "hcp-max", params: { max: threshold } };
  }

  // Suit length conditions: hand.suitLength.<suitName>
  const suitMatch = id.match(/^hand\.suitLength\.(\w+)$/);
  if (suitMatch) {
    const suitName = suitMatch[1]!;
    const suitIndex = SUIT_NAME_TO_INDEX[suitName];
    if (suitIndex === undefined) return null;
    if (typeof threshold !== "number") return null;

    const dir = inferDirection(observedValue, threshold, satisfied);
    return dir === "min"
      ? { type: "suit-min", params: { min: threshold, suitIndex } }
      : { type: "suit-max", params: { max: threshold, suitIndex } };
  }

  // Balanced conditions
  if (id === "bridge.isBalanced" || id === "hand.isBalanced") {
    if (threshold === true) return { type: "balanced", params: {} };
    if (threshold === false) return { type: "not-balanced", params: {} };
    return null;
  }

  // Unrecognized factId — skip
  return null;
}

/**
 * Extract HandInference from an EvidenceBundleIR.
 *
 * Positive inferences from matched.satisfiedConditions,
 * negative (inverted) inferences from rejected[].negatableFailures.
 *
 * Follows the same pattern as extractInferencesFromDTO in tree-inference-extractor.ts.
 * Returns null when no inference can be extracted (no match or no mappable conditions).
 */
export function extractInferenceFromEvidence(
  evidence: EvidenceBundleIR,
  seat: Seat,
  source?: string,
): HandInference | null {
  if (!evidence.matched) return null;

  const inferenceSource = source ?? evidence.matched.meaningId;
  const inferences: HandInference[] = [];

  // Positive: extract from satisfied conditions
  for (const condition of evidence.matched.satisfiedConditions) {
    if (!condition.satisfied) continue;
    const ci = evidenceToConditionInference(condition);
    if (!ci) continue;
    const hi = conditionToHandInference(ci, seat, inferenceSource);
    if (hi) inferences.push(hi);
  }

  // Build cumulative for disjunction resolution
  let cumulative: HandInference | null =
    inferences.length > 0
      ? mergeToCumulative(inferences, seat, inferenceSource)
      : null;

  // Negative: invert rejected meanings' negatable failures
  for (const rejection of evidence.rejected) {
    if (!rejection.negatableFailures) continue;
    for (const failure of rejection.negatableFailures) {
      const ci = evidenceToConditionInference(failure);
      if (!ci) continue;

      const inverted = invertInference(ci);
      if (!inverted) continue;

      const resolved = Array.isArray(inverted)
        ? resolveDisjunction(inverted, cumulative)
        : inverted;
      if (!resolved) continue;

      const hi = conditionToHandInference(resolved, seat, inferenceSource);
      if (hi) {
        inferences.push(hi);
        cumulative = mergeToCumulative(inferences, seat, inferenceSource);
      }
    }
  }

  if (inferences.length === 0) return null;
  return mergeToCumulative(inferences, seat, inferenceSource);
}
