// TODO(phase-1.5c): Remove after all conventions migrated to tree system.
// This is a temporary compat adapter for the flat→tree migration period.

import type { ConditionedBiddingRule, ConditionResult, RuleCondition, BiddingContext } from "./types";
import type { RuleNode } from "./rule-tree";
import type { TreeEvalResult } from "./tree-evaluator";
import type { BiddingRuleResult } from "./registry";
import { conditionedRule } from "./conditions";

// ─── flattenTree ─────────────────────────────────────────────

const NEGATION_PREFIX = "not-";

/**
 * Check if a condition is a pure auction check using the `category` field.
 * Falls back to false when category is unset (hand conditions are the safe default).
 */
export function isAuctionCondition(condition: RuleCondition): boolean {
  return condition.category === "auction";
}

/**
 * Walk all paths to BidNodes, collecting accumulated conditions along each path.
 * Returns ConditionedBiddingRule[] compatible with the flat evaluation system.
 *
 * Conditions are split: pure auction conditions (auctionMatches, isOpener, etc.)
 * go into `auctionConditions`, everything else into `handConditions`.
 *
 * Constraint: tree must be a strict tree (no shared node references across branches).
 * DAG structure would produce duplicate/incorrect flattened paths.
 */
export function flattenTree(tree: RuleNode): readonly ConditionedBiddingRule[] {
  const rules: ConditionedBiddingRule[] = [];

  function walk(
    node: RuleNode,
    conditions: RuleCondition[],
  ): void {
    switch (node.type) {
      case "fallback":
        // Dead end — no rule produced
        return;
      case "bid": {
        // Reached a bid leaf — split accumulated conditions by type
        const auctionConds: RuleCondition[] = [];
        const handConds: RuleCondition[] = [];
        for (const cond of conditions) {
          if (isAuctionCondition(cond)) {
            auctionConds.push(cond);
          } else {
            handConds.push(cond);
          }
        }
        rules.push(
          conditionedRule({
            name: node.name,
            auctionConditions: auctionConds,
            handConditions: handConds,
            call: node.call,
          }),
        );
        return;
      }
      case "decision": {
        // Yes branch: add the condition
        walk(node.yes, [...conditions, node.condition]);
        // No branch: add the negated condition (via a not() wrapper)
        // Note: .inference is intentionally omitted — negated bounds need inverted
        // inference types (e.g., not-hcp-min → hcp-max). Wire this in Phase 1.5(c) cleanup.
        const negated: RuleCondition = {
          name: `${NEGATION_PREFIX}${node.condition.name}`,
          label: `Not: ${node.condition.label}`,
          category: node.condition.category,
          test(ctx: BiddingContext) {
            return !node.condition.test(ctx);
          },
          describe(ctx: BiddingContext) {
            return `Not: ${node.condition.describe(ctx)}`;
          },
        };
        walk(node.no, [...conditions, negated]);
        return;
      }
      default: {
        const _exhaustive: never = node;
        throw new Error(`Unhandled RuleNode type: ${String(_exhaustive)}`);
      }
    }
  }

  walk(tree, []);
  return rules;
}

// ─── treeResultToBiddingRuleResult ───────────────────────────

/**
 * Maps a TreeEvalResult to the existing BiddingRuleResult shape.
 * Returns null if no BidNode matched.
 *
 * Uses `visited` (all decisions in traversal order) for conditionResults and explanation,
 * matching the flat system's buildExplanation() format (both ✓ passing and ✗ failing).
 */
export function treeResultToBiddingRuleResult(
  result: TreeEvalResult,
  context: BiddingContext,
): BiddingRuleResult | null {
  if (!result.matched) return null;

  // Build condition results from all visited decisions (traversal order, pass + fail)
  const conditionResults: ConditionResult[] = result.visited.map((entry) => ({
    condition: entry.node.condition,
    passed: entry.passed,
    description: entry.description,
  }));

  const explanation = conditionResults
    .map((r) => `${r.passed ? "✓" : "✗"} ${r.description}`)
    .join("; ");

  return {
    call: result.matched.call(context),
    rule: result.matched.name,
    explanation,
    meaning: result.matched.meaning,
    conditionResults,
  };
}
