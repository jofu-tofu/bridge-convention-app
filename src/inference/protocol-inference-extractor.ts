import type { Seat } from "../engine/types";
import type { HandInference } from "../shared/types";
import type { BiddingRuleResult } from "../conventions/core/registry";
import type { InferenceExtractor } from "./types";
import {
  extractInference,
  conditionToHandInference,
  invertInference,
  resolveDisjunction,
} from "./condition-mapper";


/**
 * Extracts HandInference[] from an already-evaluated BiddingRuleResult.
 * Reads protocolResult.handResult or treeEvalResult for path/rejectedDecisions.
 * Graceful degradation: missing data → empty array. Never throws.
 */
export const protocolInferenceExtractor: InferenceExtractor = {
  extractInferences(result: BiddingRuleResult, seat: Seat): readonly HandInference[] {
    const handResult = result.protocolResult?.handResult ?? result.treeEvalResult;
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
