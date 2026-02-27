import type { BiddingContext } from "./types";
import type { RuleNode, DecisionNode, BidNode } from "./rule-tree";

// ─── Result types ────────────────────────────────────────────

export interface PathEntry {
  readonly node: DecisionNode;
  readonly passed: boolean;
  readonly description: string;
}

export interface TreeEvalResult {
  readonly matched: BidNode | null;
  readonly path: PathEntry[];
  /** Decision nodes where the condition failed (no-branch was chosen).
   *  Only includes nodes actually visited — not all nodes in un-taken subtrees. */
  readonly rejectedDecisions: PathEntry[];
  /** All visited decision nodes in traversal order (passing + rejected interleaved). */
  readonly visited: PathEntry[];
}

// ─── Full evaluation (with path tracking) ────────────────────

/**
 * Evaluate a rule tree against a bidding context.
 * Returns the matched BidNode (if any), the traversal path, rejected decisions,
 * and all visited nodes in traversal order.
 */
export function evaluateTree(
  tree: RuleNode,
  context: BiddingContext,
): TreeEvalResult {
  const path: PathEntry[] = [];
  const rejectedDecisions: PathEntry[] = [];
  const visited: PathEntry[] = [];

  let node: RuleNode = tree;
  let matched: BidNode | null = null;

  // Iterative traversal (stack-safe for deep trees)
  for (;;) {
    switch (node.type) {
      case "bid":
        matched = node;
        return { matched, path, rejectedDecisions, visited };
      case "fallback":
        return { matched: null, path, rejectedDecisions, visited };
      case "decision": {
        const passed = node.condition.test(context);
        const description = node.condition.describe(context);
        const entry: PathEntry = { node, passed, description };
        visited.push(entry);

        if (passed) {
          path.push(entry);
          node = node.yes;
        } else {
          rejectedDecisions.push(entry);
          node = node.no;
        }
        break;
      }
      default: {
        const _exhaustive: never = node;
        throw new Error(`Unhandled RuleNode type: ${String(_exhaustive)}`);
      }
    }
  }
}

