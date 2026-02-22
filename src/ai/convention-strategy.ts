import type { ConventionConfig, ConditionResult } from "../conventions/types";
import { evaluateBiddingRules } from "../conventions/registry";
import type { BiddingStrategy, BidResult, ConditionDetail } from "../shared/types";

function mapConditionResult(cr: ConditionResult): ConditionDetail {
  if (cr.branches && cr.branches.length > 0) {
    // Compound condition (or/and): compute best branch (first with highest passing count wins)
    let bestIdx = 0;
    let bestCount = 0;
    const children = cr.branches.map((branch, i) => {
      const passingCount = branch.results.filter((r) => r.passed).length;
      if (passingCount > bestCount) {
        bestCount = passingCount;
        bestIdx = i;
      }
      const branchDesc = branch.results.map((r) => r.description).join("; ");
      return {
        name: `branch-${i + 1}`,
        passed: branch.passed,
        description: branch.passed ? branchDesc : `Not matched: ${branchDesc}`,
        children: branch.results.map(mapConditionResult),
      };
    });
    // Mark best branch
    const childrenWithBest = children.map((child, i) => ({
      ...child,
      isBestBranch: i === bestIdx,
    }));
    return {
      name: cr.condition.name,
      passed: cr.passed,
      description: cr.description,
      children: childrenWithBest,
    };
  }
  return {
    name: cr.condition.name,
    passed: cr.passed,
    description: cr.description,
  };
}

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
        conditions: result.conditionResults
          ? result.conditionResults.map(mapConditionResult)
          : undefined,
      };
    },
  };
}
