import type { ConventionConfig } from "../conventions/types";
import { evaluateBiddingRules } from "../conventions/registry";
import type { BiddingStrategy, BidResult } from "../shared/types";

export function conventionToStrategy(config: ConventionConfig): BiddingStrategy {
  return {
    id: `convention:${config.id}`,
    name: config.name,
    suggest(context): BidResult | null {
      const result = evaluateBiddingRules(config.biddingRules, context);
      if (!result) return null;
      return {
        call: result.call,
        ruleName: result.rule,
        explanation: result.explanation,
      };
    },
  };
}
