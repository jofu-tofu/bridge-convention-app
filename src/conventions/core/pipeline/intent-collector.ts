// Intent collector — traverses a hand subtree and gathers all semantic intent proposals.
// Decoupled from tree node structure — no resolution, no overlays, no legality.

import type { Call } from "../../../engine/types";
import type { BiddingContext, HandCondition } from "../types";
import type { RuleNode } from "../tree/rule-tree";
import type { IntentNode } from "../intent/intent-node";
import type { SemanticIntent } from "../intent/semantic-intent";
import type { BidMetadata, BidAlert } from "../tree/rule-tree";
import { isAuctionCondition, findHandSubtreeRoot } from "../tree/tree-compat";

/** A hand condition on the path to an intent, with the branch direction required. */
export interface PathConditionEntry {
  readonly condition: HandCondition;
  /** true = reached via YES branch, false = reached via NO branch */
  readonly requiredResult: boolean;
}

/** A semantic proposal collected from a hand subtree — decoupled from tree node structure. */
export interface CollectedIntent {
  readonly intent: SemanticIntent;
  readonly nodeName: string;
  readonly meaning: string;
  readonly defaultCall: (ctx: BiddingContext) => Call;
  readonly pathConditions: readonly PathConditionEntry[];
  /** Original IntentNode reference. Present for tree-collected intents.
   *  Absent for overlay-injected intents (from addIntents()). */
  readonly sourceNode?: IntentNode;
  readonly metadata?: BidMetadata;
  readonly alert?: BidAlert;
  /** Priority for selection. "preferred" = selected when no matched candidate.
   *  "alternative" = never auto-selected (informational only). */
  readonly priority?: "preferred" | "alternative";
  /** DFS traversal order — monotonic key assigned during collection.
   *  YES branch gets lower key than NO. Used for deterministic tie-breaking within selection tiers.
   *  Optional for overlay-injected intents — assigned generous gap (10_000 + index) during pipeline. */
  readonly orderKey?: number;
}

/**
 * Recursively collect all IntentNode leaves from the hand subtree,
 * tracking path conditions for each leaf.
 * Counter tracks DFS order for deterministic tie-breaking.
 */
function collectLeaves(
  node: RuleNode,
  pathEntries: readonly PathConditionEntry[],
  results: CollectedIntent[],
  counter: { value: number },
): void {
  switch (node.type) {
    case "fallback":
      return;

    case "intent":
      results.push({
        intent: node.intent,
        nodeName: node.name,
        meaning: node.meaning,
        defaultCall: node.defaultCall,
        pathConditions: pathEntries,
        sourceNode: node,
        metadata: node.metadata,
        alert: node.alert,
        orderKey: counter.value++,
      });
      return;

    case "decision": {
      if (isAuctionCondition(node.condition)) {
        throw new Error(
          `Invariant violation: auction condition "${node.condition.name}" found inside hand subtree`,
        );
      }

      const yesPath: PathConditionEntry[] = [
        ...pathEntries,
        { condition: node.condition as HandCondition, requiredResult: true },
      ];
      const noPath: PathConditionEntry[] = [
        ...pathEntries,
        { condition: node.condition as HandCondition, requiredResult: false },
      ];
      collectLeaves(node.yes, yesPath, results, counter);
      collectLeaves(node.no, noPath, results, counter);
      return;
    }

    default: {
      const _exhaustive: never = node;
      throw new Error(`Unhandled RuleNode type: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Collect all semantic intent proposals from a hand subtree.
 * Receives the protocol's handTreeRoot (may have auction condition prefix).
 * Walks past auction conditions internally.
 * Collects ALL IntentNodes with their path conditions. FallbackNodes skipped.
 */
export function collectIntentProposals(
  handTreeRoot: RuleNode,
  context: BiddingContext,
): CollectedIntent[] {
  const root = findHandSubtreeRoot(handTreeRoot, context);
  const results: CollectedIntent[] = [];
  collectLeaves(root, [], results, { value: 0 });
  return results;
}
