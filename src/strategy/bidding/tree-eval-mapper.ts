import type { ConditionResult, BiddingContext, RuleNode, DecisionNode, TreeEvalResult, PathEntry, ResolvedCandidate } from "../../conventions/core";
import { findSiblingBids, findCandidateBids } from "../../conventions/core";
import type {
  CandidateSet,
  ConditionDetail,
  DecisionTrace,
  TreePathEntry,
  TreeForkPoint,
  TreeInferenceData,
  TreeInferenceConditionEntry,
  SiblingBid,
  CandidateBid,
  ResolvedCandidateDTO,
} from "../../core/contracts";
import type { Call } from "../../engine/types";

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

/** Map ResolvedCandidate[] to ResolvedCandidateDTO[] (serializable, no function refs). */
export function mapResolvedCandidates(
  generated: readonly ResolvedCandidate[],
): ResolvedCandidateDTO[] {
  return generated.map(c => ({
    bidName: c.bidName,
    meaning: c.meaning,
    call: c.call,
    resolvedCall: c.resolvedCall,
    isDefaultCall: c.isDefaultCall,
    legal: c.legal,
    isMatched: c.isMatched,
    priority: c.priority,
    ...(c.provenance ? { provenance: c.provenance } : {}),
    intentType: c.intent.type,
    failedConditions: c.failedConditions,
    eligibility: c.eligibility,
    orderKey: c.orderKey,
  }));
}

/**
 * Enriches sibling bids with resolved calls where the resolver diverged from defaultCall.
 * Joins on bidName and preserves unmatched siblings unchanged.
 */
export function enrichSiblingsWithResolvedCalls(
  siblings: readonly SiblingBid[],
  resolvedCandidates: readonly ResolvedCandidateDTO[],
): readonly SiblingBid[] {
  const resolvedMap = new Map<string, { call: SiblingBid["call"]; intentType?: string }>();
  for (const candidate of resolvedCandidates) {
    if (!candidate.isDefaultCall) {
      resolvedMap.set(candidate.bidName, {
        call: candidate.resolvedCall,
        intentType: candidate.intentType,
      });
    }
  }
  if (resolvedMap.size === 0) return siblings;

  return siblings.map((sibling) => {
    const resolved = resolvedMap.get(sibling.bidName);
    if (!resolved) return sibling;
    return {
      ...sibling,
      call: resolved.call,
      resolverContext: {
        intentType: resolved.intentType ?? "",
        wasRemapped: true,
      },
    };
  });
}

export function mapTreeEvalResult(
  result: TreeEvalResult,
  tree: RuleNode,
  context: BiddingContext,
  conventionId?: string,
  roundName?: string,
  resolvedCandidates?: readonly ResolvedCandidate[],
): { decisionTrace: DecisionTrace; candidateSet: CandidateSet } {
  const visited = mapVisitedWithStructure(result.visited, tree);
  const path = visited.filter((e) => e.passed);

  let siblings: readonly SiblingBid[] | undefined;
  let candidates: readonly CandidateBid[] | undefined;
  try {
    if (result.matched) {
      siblings = findSiblingBids(tree, result.matched, context);
      if (conventionId) {
        candidates = findCandidateBids(tree, result.matched, context, conventionId, roundName);
      }
    }
  } catch {
    // Invariant violation or unexpected error — degrade gracefully
    siblings = undefined;
    candidates = undefined;
  }
  const mappedResolvedCandidates = resolvedCandidates
    ? mapResolvedCandidates(resolvedCandidates)
    : undefined;
  const enrichedSiblings = siblings && mappedResolvedCandidates
    ? enrichSiblingsWithResolvedCalls(siblings, mappedResolvedCandidates)
    : siblings;

  return {
    decisionTrace: {
      matchedNodeName: result.matched?.name ?? "",
      path,
      visited,
      forkPoint: extractForkPoint(visited),
    },
    candidateSet: {
      siblings: enrichedSiblings ?? [],
      candidates,
      resolvedCandidates: mappedResolvedCandidates,
    },
  };
}

/** Serialize a Call to a string key for deduplication against pragmatic candidates. */
export function callKeyForDedup(call: Call): string {
  if (call.type === "bid") {
    return `${call.level}${call.strain}`;
  }
  if (call.type === "double") return "X";
  if (call.type === "redouble") return "XX";
  return "P";
}

/** Extract inference-ready condition data from tree evaluation path and rejected branches.
 *  Only includes hand conditions with `.inference` set — auction conditions are skipped. */
export function extractTreeInferenceData(treeEvalResult: TreeEvalResult): TreeInferenceData {
  const pathConditions: TreeInferenceConditionEntry[] = [];
  const rejectedConditions: TreeInferenceConditionEntry[] = [];

  for (const entry of treeEvalResult.path) {
    if (entry.node.condition.category !== "hand") continue;
    const inf = entry.node.condition.inference;
    if (!inf) continue;
    pathConditions.push({ type: inf.type, params: inf.params, negatable: entry.node.condition.negatable });
  }

  for (const entry of treeEvalResult.rejectedDecisions) {
    if (entry.node.condition.category !== "hand") continue;
    const inf = entry.node.condition.inference;
    if (!inf) continue;
    rejectedConditions.push({ type: inf.type, params: inf.params, negatable: entry.node.condition.negatable });
  }

  return { pathConditions, rejectedConditions };
}
