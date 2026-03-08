// Test/integration utility only — not used in the production store path.
// The store uses noopExtractor; real inference flows through treeInferenceData DTOs
// via extractInferencesFromDTO() in tree-inference-extractor.ts.

import type { Seat } from "../engine/types";
import type { HandInference } from "../core/contracts";
import type { TreeEvalResult, ProtocolEvalResult } from "../conventions/core";
import type { InferenceExtractor, InferenceExtractorInput } from "./types";
import {
  extractInference,
  conditionToHandInference,
  invertInference,
  resolveDisjunction,
  shouldInvertCondition,
} from "./condition-mapper";
import { mergeToCumulative } from "./merge";


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
