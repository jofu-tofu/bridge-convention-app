import type { ConventionConfig, ConditionResult, BiddingContext } from "../../conventions/core/types";
import { evaluateBiddingRules } from "../../conventions/core/registry";
import type { RuleNode, DecisionNode } from "../../conventions/core/rule-tree";
import type { TreeEvalResult, PathEntry } from "../../conventions/core/tree-evaluator";
import { findSiblingBids } from "../../conventions/core/sibling-finder";
import { formatHandSummary } from "../../shared/hand-summary";
import type {
  BiddingStrategy,
  BidResult,
  ConditionDetail,
  TreePathEntry,
  TreeEvalSummary,
  TreeForkPoint,
  SiblingBid,
} from "../../shared/types";

export function mapConditionResult(cr: ConditionResult): ConditionDetail {
  if (cr.branches && cr.branches.length > 0) {
    // Compound condition (or/and): compute best branch (first with highest passing count wins)
    let bestIdx = 0;
    let bestCount = 0;
    const children = cr.branches.map((branch, i) => {
      const passingCount = branch.results.filter((r) => r.passed).length;
      if (passingCount > bestCount) {
        bestCount = passingCount;
        bestIdx = i;
      }
      const branchDesc = branch.results.map((r) => r.description).join("; ");
      return {
        name: `branch-${i + 1}`,
        passed: branch.passed,
        description: branch.passed ? branchDesc : `Not matched: ${branchDesc}`,
        children: branch.results.map(mapConditionResult),
      };
    });
    // Mark best branch
    const childrenWithBest = children.map((child, i) => ({
      ...child,
      isBestBranch: bestCount > 0 && i === bestIdx,
    }));
    return {
      name: cr.condition.name,
      passed: cr.passed,
      description: cr.description,
      category: cr.condition.category,
      children: childrenWithBest,
    };
  }
  return {
    name: cr.condition.name,
    passed: cr.passed,
    description: cr.description,
    category: cr.condition.category,
  };
}

// ─── Tree eval → DTO mapper ──────────────────────────────────

/** Walk a RuleNode tree to build depth/parentName lookup for all DecisionNodes.
 *  Keyed by DecisionNode reference (not name) to handle duplicate names correctly. */
function buildNodeInfo(tree: RuleNode): Map<DecisionNode, { depth: number; parentName: string | null }> {
  const info = new Map<DecisionNode, { depth: number; parentName: string | null }>();
  function walk(node: RuleNode, depth: number, parentName: string | null) {
    if (node.type === "decision") {
      info.set(node, { depth, parentName });
      walk(node.yes, depth + 1, node.name);
      walk(node.no, depth + 1, node.name);
    }
  }
  walk(tree, 0, null);
  return info;
}

/** Map PathEntry[] to TreePathEntry[] with depth/parentNodeName from tree structure. */
export function mapVisitedWithStructure(
  visited: readonly PathEntry[],
  tree: RuleNode,
): TreePathEntry[] {
  const nodeInfo = buildNodeInfo(tree);
  return visited.map((e) => {
    const info = nodeInfo.get(e.node);
    return {
      nodeName: e.node.name,
      passed: e.passed,
      description: e.description,
      depth: info?.depth ?? 0,
      parentNodeName: info?.parentName ?? null,
    };
  });
}

/** Find the last (deepest) adjacent pass/fail pair that are true siblings (same parent). */
export function extractForkPoint(entries: readonly TreePathEntry[]): TreeForkPoint | undefined {
  for (let i = entries.length - 1; i >= 1; i--) {
    const curr = entries[i]!;
    const prev = entries[i - 1]!;
    if (curr.passed !== prev.passed && curr.parentNodeName === prev.parentNodeName) {
      const matched = curr.passed ? curr : prev;
      const rejected = curr.passed ? prev : curr;
      return { matched, rejected };
    }
  }
  return undefined;
}

function mapTreeEvalResult(result: TreeEvalResult, tree: RuleNode, context: BiddingContext): TreeEvalSummary {
  const visited = mapVisitedWithStructure(result.visited, tree);
  const path = visited.filter((e) => e.passed);

  let siblings: readonly SiblingBid[] | undefined;
  try {
    siblings = result.matched
      ? findSiblingBids(tree, result.matched, context)
      : undefined;
  } catch {
    // Invariant violation or unexpected error — degrade gracefully
    siblings = undefined;
  }

  return {
    matchedNodeName: result.matched?.name ?? "",
    path,
    visited,
    forkPoint: extractForkPoint(visited),
    siblings,
  };
}

export function conventionToStrategy(
  config: ConventionConfig,
): BiddingStrategy {
  return {
    id: `convention:${config.id}`,
    name: config.name,
    suggest(context): BidResult | null {
      const result = evaluateBiddingRules(context, config);
      if (!result) return null;
      return {
        call: result.call,
        ruleName: result.rule,
        explanation: result.explanation,
        meaning: result.meaning,
        handSummary: formatHandSummary(context.evaluation),
        conditions: result.conditionResults
          ? result.conditionResults.map(mapConditionResult)
          : undefined,
        treePath: result.treeEvalResult && result.treeRoot
          ? mapTreeEvalResult(result.treeEvalResult, result.treeRoot, context)
          : undefined,
      };
    },
  };
}
