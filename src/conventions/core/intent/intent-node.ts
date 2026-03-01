// IntentNode — a tree leaf that carries semantic intent + defaultCall.
// All downstream consumers (flatten, sibling, inference) use defaultCall
// and are UNAWARE of the intent layer. Only strategy dispatch calls the resolver.

import type { Call } from "../../../engine/types";
import type { BiddingContext } from "../types";
import type { SemanticIntent } from "./semantic-intent";
import type { BidMetadata, BidAlert } from "../rule-tree";

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

/** Build an IntentNode leaf. */
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
