// Tree compat adapter: flattenTree() produces ConditionedBiddingRule[] from
// a RuleNode tree for consumers that need flat iteration (evaluateAllBiddingRules,
// CLI, RulesPanel, inference engine positive inference path).

import type { ConditionedBiddingRule, ConditionResult, RuleCondition, BiddingContext } from "./types";
import type { RuleNode } from "./rule-tree";
import type { TreeEvalResult } from "./tree-evaluator";
import type { BiddingRuleResult } from "./registry";
import { conditionedRule, AUCTION_CONDITION_NAMES } from "./conditions";

// ─── flattenTree ─────────────────────────────────────────────

const NEGATION_PREFIX = "not-";

/**
 * Check if a condition name (or its negation) is a pure auction check.
 * Handles exact names, dynamic names with level+strain (e.g., partner-opened-1H,
 * partner-bid-3C), and negation prefixes.
 */
export function isAuctionCondition(name: string): boolean {
  if (AUCTION_CONDITION_NAMES.has(name)) return true;
  // Dynamic names from partnerOpenedAt/partnerBidAt: partner-opened-{digit}..., partner-bid-{digit}...
  if (/^partner-opened-\d/.test(name)) return true;
  if (/^partner-bid-\d/.test(name)) return true;
  // partnerOpened(strain) produces "partner opened {strain}" (with space)
  if (name.startsWith("partner opened")) return true;
  if (name.startsWith(NEGATION_PREFIX)) return isAuctionCondition(name.slice(NEGATION_PREFIX.length));
  return false;
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
          if (isAuctionCondition(cond.name)) {
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
        // Negated conditions intentionally omit .inference — the inference engine
        // reads tree nodes directly via evaluateTree(), not flattened rules.
        const negated: RuleCondition = {
          name: `${NEGATION_PREFIX}${node.condition.name}`,
          label: `Not: ${node.condition.label}`,
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
    conditionResults,
  };
}
