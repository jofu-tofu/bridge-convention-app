import type {
  BiddingRule,
  BiddingContext,
  ConditionedBiddingRule,
  ConditionResult,
} from "./types";

/**
 * Type guard: does this BiddingRule have a conditions[] array?
 */
export function isConditionedRule(
  rule: BiddingRule,
): rule is ConditionedBiddingRule {
  return (
    "auctionConditions" in rule &&
    "handConditions" in rule &&
    Array.isArray((rule as ConditionedBiddingRule).conditions)
  );
}

/**
 * Evaluate all conditions of a ConditionedBiddingRule against a context.
 * Returns per-condition results including branch data for compound conditions.
 */
export function evaluateConditions(
  rule: ConditionedBiddingRule,
  context: BiddingContext,
): ConditionResult[] {
  return rule.conditions.map((cond) => {
    const passed = cond.test(context);
    const description = cond.describe(context);
    const branches = cond.evaluateChildren?.(context) ?? undefined;

    return {
      condition: cond,
      passed,
      description,
      branches: branches ?? undefined,
    };
  });
}

/**
 * Build a context-aware explanation string from condition results.
 * Includes ALL conditions (both passing and failing) with pass/fail markers.
 */
export function buildExplanation(results: ConditionResult[]): string {
  return results
    .map((r) => `${r.passed ? "✓" : "✗"} ${r.description}`)
    .join("; ");
}
