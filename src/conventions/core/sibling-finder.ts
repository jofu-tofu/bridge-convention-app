import type { BiddingContext, RuleCondition } from "./types";
import type { RuleNode, IntentNode } from "./rule-tree";
import type { SiblingBid, SiblingConditionDetail, CandidateBid } from "../../core/contracts";
import { isAuctionCondition, findHandSubtreeRoot } from "./tree-compat";
import { toCandidateBid } from "./candidate-builder";

/** A condition on the path to a sibling, with the branch direction it requires. */
interface PathConditionEntry {
  readonly condition: RuleCondition;
  /** true = reached via YES branch, false = reached via NO branch */
  readonly requiredResult: boolean;
}

/**
 * Recursively collect all IntentNode alternatives from the hand subtree,
 * tracking which conditions on each path don't match the hand.
 *
 * A condition "fails" for a sibling when the hand's actual result doesn't match
 * the branch direction required to reach that sibling. E.g., if a sibling is on
 * the NO branch of "has 4+ hearts" but the hand DOES have 4+ hearts, that's a
 * failed condition — the hand can't reach that sibling.
 */
function collectAlternatives(
  node: RuleNode,
  matched: IntentNode,
  context: BiddingContext,
  pathEntries: readonly PathConditionEntry[],
  results: SiblingBid[],
  intentNodes?: Map<string, IntentNode>,
): void {
  switch (node.type) {
    case "fallback":
      // Not a valid bid — skip
      return;

    case "intent": {
      // Collect IntentNode ref before skip check — same skip + keying as former collectIntentNodes()
      if (intentNodes && node.nodeId !== matched.nodeId) intentNodes.set(node.nodeId, node);
      if (node.nodeId === matched.nodeId) return; // Skip the matched node (by nodeId)

      let call;
      try {
        call = node.defaultCall(context);
      } catch (e) {
        // eslint-disable-next-line no-console -- intentional: surface dynamic call errors in dev
        console.warn(`Sibling bid "${node.name}" call() threw:`, e);
        return;
      }

      // A condition fails when the hand's actual result doesn't match the required branch
      const failedConditions: SiblingConditionDetail[] = [];
      for (const entry of pathEntries) {
        const actual = entry.condition.test(context);
        if (actual !== entry.requiredResult) {
          failedConditions.push({
            name: entry.condition.name,
            description: entry.condition.describe(context),
          });
        }
      }

      results.push({
        bidName: node.name,
        nodeId: node.nodeId,
        meaning: node.meaning,
        call,
        failedConditions,
      });
      return;
    }

    case "decision": {
      // Validate: no auction conditions should appear in the hand subtree
      if (isAuctionCondition(node.condition)) {
        throw new Error(
          `Invariant violation: auction condition "${node.condition.name}" found inside hand subtree`,
        );
      }

      const yesPath: PathConditionEntry[] = [...pathEntries, { condition: node.condition, requiredResult: true }];
      const noPath: PathConditionEntry[] = [...pathEntries, { condition: node.condition, requiredResult: false }];
      collectAlternatives(node.yes, matched, context, yesPath, results, intentNodes);
      collectAlternatives(node.no, matched, context, noPath, results, intentNodes);
      return;
    }

    default: {
      const _exhaustive: never = node;
      throw new Error(`Unhandled RuleNode type: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Find sibling alternatives for a matched bid within a convention rule tree.
 *
 * Walks the tree to find the hand-condition subtree root (past all auction conditions),
 * then explores all branches to find other IntentNodes that could have been reached
 * in the same auction context.
 *
 * @throws If auction conditions are interleaved after hand conditions (invariant violation).
 */
export function findSiblingBids(
  tree: RuleNode,
  matched: IntentNode,
  context: BiddingContext,
): SiblingBid[] {
  const handSubtreeRoot = findHandSubtreeRoot(tree, context);

  // If hand subtree root is an IntentNode or FallbackNode, there are no siblings
  if (handSubtreeRoot.type !== "decision") return [];

  const results: SiblingBid[] = [];
  collectAlternatives(handSubtreeRoot, matched, context, [], results);
  return results;
}

/**
 * Find candidate bids with intent + source metadata for a matched bid.
 * Wraps findSiblingBids results with CandidateBid enrichment.
 *
 * @throws If auction conditions are interleaved after hand conditions (invariant violation).
 */
export function findCandidateBids(
  tree: RuleNode,
  matched: IntentNode,
  context: BiddingContext,
  conventionId: string,
  roundName?: string,
): CandidateBid[] {
  const handSubtreeRoot = findHandSubtreeRoot(tree, context);
  if (handSubtreeRoot.type !== "decision") return [];

  const siblingResults: SiblingBid[] = [];
  const intentNodes = new Map<string, IntentNode>();
  collectAlternatives(handSubtreeRoot, matched, context, [], siblingResults, intentNodes);

  const candidates: CandidateBid[] = [];
  for (const sibling of siblingResults) {
    const intentNode = intentNodes.get(sibling.nodeId);
    if (intentNode) {
      const candidate = toCandidateBid(
        intentNode,
        context,
        conventionId,
        roundName,
        sibling.failedConditions,
      );
      if (candidate) candidates.push(candidate);
    }
  }

  return candidates;
}
