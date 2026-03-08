// Candidate builder — converts IntentNode + context into CandidateBid DTO.

import type { BiddingContext } from "../types";
import type { IntentNode } from "../intent/intent-node";
import type { CandidateBid, SiblingConditionDetail } from "../../../core/contracts";

/**
 * Convert an IntentNode into a CandidateBid with intent + source metadata.
 * Returns null if defaultCall() throws.
 */
export function toCandidateBid(
  node: IntentNode,
  context: BiddingContext,
  conventionId: string,
  roundName: string | undefined,
  failedConditions: readonly SiblingConditionDetail[],
): CandidateBid | null {
  let call;
  try {
    call = node.defaultCall(context);
  } catch {
    return null;
  }

  return {
    bidName: node.name,
    nodeId: node.nodeId,
    meaning: node.meaning,
    call,
    failedConditions,
    intent: {
      type: node.intent.type,
      params: node.intent.params,
    },
    source: {
      conventionId,
      roundName,
      nodeName: node.name,
    },
  };
}
