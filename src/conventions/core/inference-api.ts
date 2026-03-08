import type { Call } from "../../engine/types";
import type { BiddingContext, ConventionConfig, RuleCondition } from "./types";
import type { ConventionProtocol } from "./protocol";
import { isConditionedRule } from "./condition-evaluator";
import { createBiddingContext } from "./context-factory";
import { evaluateProtocol } from "./protocol-evaluator";
import { flattenProtocol, isAuctionCondition } from "./tree-compat";

export interface InferenceRuleDTO {
  readonly name: string;
  readonly auctionConditions: readonly RuleCondition[];
  readonly handConditions: readonly RuleCondition[];
  readonly call: (ctx: BiddingContext) => Call;
}

export interface InferenceTreeResultDTO {
  readonly rejectedDecisions: readonly {
    node: { condition: RuleCondition };
    branch: string;
  }[];
}

export interface ConventionInferenceData {
  readonly rules: readonly InferenceRuleDTO[];
  readonly treeResult: InferenceTreeResultDTO;
}

/**
 * Narrow inference-facing API over protocol evaluation.
 * Returns null for conventions without a protocol.
 */
export function evaluateForInference(
  config: ConventionConfig,
  context: BiddingContext,
): ConventionInferenceData | null {
  if (!config.protocol) return null;

  const proto = config.protocol as ConventionProtocol;
  const rules: InferenceRuleDTO[] = flattenProtocol(proto)
    .filter(isConditionedRule)
    .map((rule) => ({
      name: rule.name,
      auctionConditions: rule.auctionConditions,
      handConditions: rule.handConditions,
      call: (ctx: BiddingContext) => rule.call(ctx),
    }));

  const treeResult = evaluateProtocol(proto, context).handResult;
  return {
    rules,
    treeResult: {
      rejectedDecisions: treeResult.rejectedDecisions.map((entry) => ({
        node: { condition: entry.node.condition },
        branch: entry.passed ? "yes" : "no",
      })),
    },
  };
}

export { createBiddingContext, isAuctionCondition };
