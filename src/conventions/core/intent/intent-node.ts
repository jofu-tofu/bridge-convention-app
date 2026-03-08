// IntentNode — a tree leaf that carries semantic intent + defaultCall.
// All downstream consumers (flatten, sibling, inference) use defaultCall
// and are UNAWARE of the intent layer. Only strategy dispatch calls the resolver.

import type { Call } from "../../../engine/types";
import type { BiddingContext } from "../types";
import type { SemanticIntent } from "./semantic-intent";
import type { BidMetadata, BidAlert } from "../tree/rule-tree";

let nextNodeId = 1;

export interface IntentNode {
  readonly type: "intent";
  readonly nodeId: string;
  readonly name: string;
  readonly meaning: string;
  readonly intent: SemanticIntent;
  /**
   * Concrete call for the DEFAULT (uncontested) context. Used by:
   * - flattenTree()/flattenProtocol() for RulesPanel/LearningScreen
   * - convention-inference.ts for call-matching (tryGetRuleCall)
   * - findSiblingBids() for SiblingBid.call
   * - Fallback when resolveIntent() returns null
   */
  readonly defaultCall: (ctx: BiddingContext) => Call;
  readonly metadata?: BidMetadata;
  readonly alert?: BidAlert;
}

/**
 * Creates a scoped IntentNode builder with deterministic `prefix/name` nodeIds.
 * Duplicate names within the same prefix throw at construction time.
 * Use one factory per convention (e.g., `createIntentBidFactory("stayman")`).
 */
export function createIntentBidFactory(prefix: string) {
  const seen = new Set<string>();
  return function scopedIntentBid(
    name: string,
    meaning: string,
    intent: SemanticIntent,
    defaultCallFn: (ctx: BiddingContext) => Call,
    metadata?: BidMetadata,
    alert?: BidAlert,
  ): IntentNode {
    if (seen.has(name)) {
      throw new Error(
        `Duplicate IntentNode name "${name}" in factory "${prefix}". Names must be unique per convention.`,
      );
    }
    seen.add(name);
    return {
      type: "intent",
      nodeId: `${prefix}/${name}`,
      name,
      meaning,
      intent,
      defaultCall: defaultCallFn,
      metadata,
      alert,
    };
  };
}

/**
 * Build an IntentNode leaf with auto-generated nodeId.
 * @deprecated Use `createIntentBidFactory(prefix)` for deterministic, stable IDs.
 */
export function intentBid(
  name: string,
  meaning: string,
  intent: SemanticIntent,
  defaultCallFn: (ctx: BiddingContext) => Call,
  metadata?: BidMetadata,
  alert?: BidAlert,
): IntentNode {
  return {
    type: "intent",
    nodeId: `intent-${nextNodeId++}`,
    name,
    meaning,
    intent,
    defaultCall: defaultCallFn,
    metadata,
    alert,
  };
}
