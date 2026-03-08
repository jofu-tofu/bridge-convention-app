// Compatibility layer for legacy evaluator paths.
// Kept intentionally for protocol hand-tree evaluation and migration-adjacent flows.

import type { ConditionedBiddingRule, ConditionResult, RuleCondition, AuctionCondition, BiddingContext } from "../types";
import type { RuleNode, HandNode } from "./rule-tree";
import type { TreeEvalResult } from "./tree-evaluator";
import type { BiddingRuleResult } from "../types";
import { conditionedRule } from "../conditions";
import type { ConventionProtocol, EstablishedContext } from "../protocol/protocol";

// ─── findHandSubtreeRoot ─────────────────────────────────

/**
 * Walk past auction conditions to find the hand subtree root.
 * Follows the evaluated path (YES/NO as the condition dictates).
 *
 * Shared by sibling-finder and intent-collector.
 */
export function findHandSubtreeRoot(tree: RuleNode, context: BiddingContext): RuleNode {
  let node: RuleNode = tree;

  for (;;) {
    if (node.type !== "decision") return node;

    if (isAuctionCondition(node.condition)) {
      node = node.condition.test(context) ? node.yes : node.no;
    } else {
      return node;
    }
  }
}

// ─── flattenTree ─────────────────────────────────────────────

const NEGATION_PREFIX = "not-";

function splitConditionGroups(conditions: RuleCondition[]): {
  auctionConds: RuleCondition[];
  handConds: RuleCondition[];
} {
  const auctionConds: RuleCondition[] = [];
  const handConds: RuleCondition[] = [];

  for (const cond of conditions) {
    if (isAuctionCondition(cond)) {
      auctionConds.push(cond);
    } else {
      handConds.push(cond);
    }
  }

  return { auctionConds, handConds };
}

function negateCondition(condition: RuleCondition): RuleCondition {
  return {
    name: `${NEGATION_PREFIX}${condition.name}`,
    label: `Not: ${condition.label}`,
    category: condition.category,
    test(ctx: BiddingContext) {
      return !condition.test(ctx);
    },
    describe(ctx: BiddingContext) {
      return `Not: ${condition.describe(ctx)}`;
    },
  };
}

/**
 * Check if a condition is a pure auction check using the `category` field.
 * Falls back to false when category is unset (hand conditions are the safe default).
 */
export function isAuctionCondition(condition: RuleCondition): condition is AuctionCondition {
  return condition.category === "auction";
}

/**
 * Walk all paths to IntentNodes, collecting accumulated conditions along each path.
 * Returns ConditionedBiddingRule[] compatible with the flat evaluation system.
 *
 * Conditions are split: pure auction conditions (auctionMatches, isOpener, etc.)
 * go into `auctionConditions`, everything else into `handConditions`.
 *
 * Constraint: tree must be a strict tree (no shared node references across branches).
 * DAG structure would produce duplicate/incorrect flattened paths.
 */
export function flattenTree(tree: RuleNode): readonly ConditionedBiddingRule[] {
  return flattenBinaryTree(tree);
}

function walkBinaryNode(
  node: RuleNode,
  auctionConditions: RuleCondition[],
  rules: ConditionedBiddingRule[],
): void {
  function walk(n: RuleNode, conditions: RuleCondition[]): void {
    switch (n.type) {
      case "fallback":
        return;
      case "intent": {
        const { auctionConds, handConds } = splitConditionGroups(conditions);
        rules.push(
          conditionedRule({
            name: n.name,
            auctionConditions: auctionConds,
            handConditions: handConds,
            call: n.defaultCall,
          }),
        );
        return;
      }
      case "decision": {
        walk(n.yes, [...conditions, n.condition]);
        walk(n.no, [...conditions, negateCondition(n.condition)]);
        return;
      }
      default: {
        const _exhaustive: never = n;
        throw new Error(`Unhandled RuleNode type: ${String(_exhaustive)}`);
      }
    }
  }
  walk(node, [...auctionConditions]);
}

function flattenBinaryTree(tree: RuleNode): ConditionedBiddingRule[] {
  const rules: ConditionedBiddingRule[] = [];

  function walk(
    node: RuleNode,
    conditions: RuleCondition[],
  ): void {
    switch (node.type) {
      case "fallback":
        // Dead end — no rule produced
        return;
      case "intent": {
        // IntentNode uses defaultCall for flatten compatibility
        const { auctionConds, handConds } = splitConditionGroups(conditions);
        rules.push(
          conditionedRule({
            name: node.name,
            auctionConditions: auctionConds,
            handConditions: handConds,
            call: node.defaultCall,
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
        walk(node.no, [...conditions, negateCondition(node.condition)]);
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

// ─── flattenProtocol ─────────────────────────────────────────

/**
 * Flatten a protocol into ConditionedBiddingRule[] for UI display.
 * Recursively walks rounds, accumulating trigger conditions + seatFilters
 * across rounds so each flattened rule has the full path of conditions
 * from ALL rounds leading to it.
 *
 * For function-based hand trees, resolves them with the trigger's established
 * context to produce the correct flattened rules per trigger variant.
 */
export function flattenProtocol(proto: ConventionProtocol): readonly ConditionedBiddingRule[] {
  const rules: ConditionedBiddingRule[] = [];

  function walkRounds(
    roundIdx: number,
    accConds: RuleCondition[],
    accEst: EstablishedContext,
  ): void {
    if (roundIdx >= proto.rounds.length) return;
    const r = proto.rounds[roundIdx]!;
    for (const trigger of r.triggers) {
      const pathConds = [...accConds, trigger.condition];
      const est = { ...accEst, ...trigger.establishes } as EstablishedContext;

      // Flatten this round's hand tree with accumulated trigger conditions
      // plus ONLY this round's seatFilter (not accumulated from previous rounds,
      // since seatFilters apply to different seats in multi-round protocols)
      let handTree: HandNode | null;
      if (typeof r.handTree === "function") {
        try {
          handTree = r.handTree(est);
        } catch {
          handTree = null;
        }
      } else {
        handTree = r.handTree;
      }

      if (handTree) {
        const handTreeConds = r.seatFilter ? [...pathConds, r.seatFilter] : pathConds;
        walkBinaryNode(handTree as RuleNode, handTreeConds, rules);
      }

      // Recurse to next round with accumulated trigger conditions (no seatFilter)
      walkRounds(roundIdx + 1, pathConds, est);
    }
  }

  walkRounds(0, [], { role: "responder" as const } as EstablishedContext);
  return rules;
}

// ─── treeResultToBiddingRuleResult ───────────────────────────

/**
 * Maps a TreeEvalResult to the existing BiddingRuleResult shape.
 * Returns null if no IntentNode matched.
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

  const call = result.matched.defaultCall(context);

  return {
    call,
    rule: result.matched.name,
    explanation,
    meaning: result.matched.meaning,
    conditionResults,
    alert: result.matched.alert,
  };
}
