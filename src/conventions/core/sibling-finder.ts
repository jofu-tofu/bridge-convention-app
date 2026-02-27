import type { BiddingContext, RuleCondition } from "./types";
import type { RuleNode, DecisionNode, BidNode } from "./rule-tree";
import type { SiblingBid, SiblingConditionDetail } from "../../shared/types";
import { isAuctionCondition } from "./tree-compat";

/** A condition on the path to a sibling, with the branch direction it requires. */
interface PathConditionEntry {
  readonly condition: RuleCondition;
  /** true = reached via YES branch, false = reached via NO branch */
  readonly requiredResult: boolean;
}

/**
 * Find the root of the hand-condition subtree by walking auction conditions
 * and following the evaluated path (YES/NO as the condition dictates).
 *
 * Throws if an auction condition appears after a hand condition (invariant violation).
 */
function findHandSubtreeRoot(tree: RuleNode, context: BiddingContext): RuleNode {
  let node: RuleNode = tree;

  for (;;) {
    if (node.type !== "decision") return node;

    if (isAuctionCondition(node.condition)) {
      // Follow the evaluated path through auction conditions
      node = node.condition.test(context) ? node.yes : node.no;
    } else {
      // First non-auction condition — this is the hand subtree root
      // Auction/hand interleaving invariant enforced by collectAlternatives (line 98-102)
      return node;
    }
  }
}

/**
 * Recursively collect all BidNode alternatives from the hand subtree,
 * tracking which conditions on each path don't match the hand.
 *
 * A condition "fails" for a sibling when the hand's actual result doesn't match
 * the branch direction required to reach that sibling. E.g., if a sibling is on
 * the NO branch of "has 4+ hearts" but the hand DOES have 4+ hearts, that's a
 * failed condition — the hand can't reach that sibling.
 */
function collectAlternatives(
  node: RuleNode,
  matched: BidNode,
  context: BiddingContext,
  pathEntries: readonly PathConditionEntry[],
  results: SiblingBid[],
): void {
  switch (node.type) {
    case "fallback":
      // Not a valid bid — skip
      return;

    case "bid": {
      if (node === matched) return; // Skip the matched bid

      // Resolve the call — skip on error
      let call;
      try {
        call = node.call(context);
      } catch (e) {
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
      collectAlternatives(node.yes, matched, context, yesPath, results);
      collectAlternatives(node.no, matched, context, noPath, results);
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
 * then explores all branches to find other BidNodes that could have been reached
 * in the same auction context.
 *
 * @throws If auction conditions are interleaved after hand conditions (invariant violation).
 */
export function findSiblingBids(
  tree: RuleNode,
  matched: BidNode,
  context: BiddingContext,
): SiblingBid[] {
  const handSubtreeRoot = findHandSubtreeRoot(tree, context);

  // If hand subtree root is a BidNode or FallbackNode, there are no siblings
  if (handSubtreeRoot.type !== "decision") return [];

  const results: SiblingBid[] = [];
  collectAlternatives(handSubtreeRoot, matched, context, [], results);
  return results;
}
