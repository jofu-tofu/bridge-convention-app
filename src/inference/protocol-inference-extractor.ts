// Test/integration utility only — not used in the production store path.
// The store uses noopExtractor; real inference flows through treeInferenceData DTOs
// via extractInferencesFromDTO() in tree-inference-extractor.ts.

import type { Seat } from "../engine/types";
import type { HandInference } from "../core/contracts";
import type { TreeEvalResult } from "../conventions/core/tree-evaluator";
import type { ProtocolEvalResult } from "../conventions/core/protocol";
import type { InferenceExtractor, InferenceExtractorInput } from "./types";
import {
  extractInference,
  conditionToHandInference,
  invertInference,
  resolveDisjunction,
  shouldInvertCondition,
} from "./condition-mapper";


/**
 * Extracts HandInference[] from an already-evaluated BiddingRuleResult.
 * Reads protocolResult.handResult or treeEvalResult for path/rejectedDecisions.
 * Graceful degradation: missing data → empty array. Never throws.
 */
export const protocolInferenceExtractor: InferenceExtractor = {
  extractInferences(result: InferenceExtractorInput, seat: Seat): readonly HandInference[] {
    // Narrow opaque fields to their concrete types — this implementation knows the shape
    const proto = result.protocolResult as ProtocolEvalResult | undefined;
    const treeEval = result.treeEvalResult as TreeEvalResult | undefined;
    const handResult = proto?.handResult ?? treeEval;
    if (!handResult) return [];

    const inferences: HandInference[] = [];
    const source = result.rule ?? "unknown";

    // Positive: walk path, extract inference from hand conditions
    for (const entry of handResult.path) {
      if (entry.node.condition.category !== "hand") continue;
      const ci = extractInference(entry.node.condition);
      if (!ci) continue;
      const hi = conditionToHandInference(ci, seat, source);
      if (hi) inferences.push(hi);
    }

    // Build cumulative for disjunction resolution
    let cumulative: HandInference | null =
      inferences.length > 0 ? mergeToCumulative(inferences, seat, source) : null;

    // Negative: walk rejectedDecisions, invert each
    for (const entry of handResult.rejectedDecisions) {
      if (entry.node.condition.category !== "hand") continue;
      if (!shouldInvertCondition(entry.node.condition)) continue;
      const ci = extractInference(entry.node.condition);
      if (!ci) continue;

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
  },
};

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
