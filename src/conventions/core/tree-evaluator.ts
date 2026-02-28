import type { BiddingContext } from "./types";
import type { RuleNode, DecisionNode, BidNode, AuctionSlotNode, AuctionSlot, HandNode } from "./rule-tree";

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

// ─── Slot tree result types ──────────────────────────────────

/** Entry tracking which slot matched at each dispatch level. */
export interface MatchedSlotEntry {
  readonly slotNode: AuctionSlotNode;
  readonly matchedSlot: AuctionSlot;
  readonly triedBefore: readonly AuctionSlot[];
}

/** Result of evaluating a slot tree. */
export interface SlotTreeEvalResult {
  readonly matched: BidNode | null;
  readonly matchedSlots: readonly MatchedSlotEntry[];
  readonly handResult: TreeEvalResult;
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

// ─── Slot tree evaluation ────────────────────────────────────

function noMatchHandResult(): TreeEvalResult {
  return { matched: null, path: [], rejectedDecisions: [], visited: [] };
}

/**
 * Evaluate a slot tree against a bidding context.
 * Iterates slots in order at each level; first match wins.
 * Recurses through nested AuctionSlotNode children until reaching a HandNode,
 * then delegates to evaluateTree() for hand evaluation.
 */
export function evaluateSlotTree(
  root: AuctionSlotNode,
  context: BiddingContext,
): SlotTreeEvalResult {
  const matchedSlots: MatchedSlotEntry[] = [];
  let current: AuctionSlotNode | HandNode = root;

  while (current.type === "auction-slots") {
    const slotNode: AuctionSlotNode = current;
    const triedBefore: AuctionSlot[] = [];
    let found = false;

    for (const s of slotNode.slots as readonly AuctionSlot[]) {
      if (s.condition.test(context)) {
        matchedSlots.push({ slotNode, matchedSlot: s, triedBefore: [...triedBefore] });
        current = s.child;
        found = true;
        break;
      }
      triedBefore.push(s);
    }

    if (!found) {
      // No slot matched — try defaultChild
      if (slotNode.defaultChild) {
        current = slotNode.defaultChild;
        break;
      }
      return { matched: null, matchedSlots, handResult: noMatchHandResult() };
    }
  }

  // current is now a HandNode — evaluate it
  const handResult = evaluateTree(current as RuleNode, context);
  return { matched: handResult.matched, matchedSlots, handResult };
}

