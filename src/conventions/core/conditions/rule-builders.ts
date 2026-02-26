import type {
  BiddingContext,
  RuleCondition,
  ConditionedBiddingRule,
  ConditionResult,
  ConditionBranch,
} from "../types";
import type { Call } from "../../../engine/types";

// ─── conditionedRule factory ─────────────────────────────────

/**
 * Build a ConditionedBiddingRule from separate auction and hand conditions.
 * matches() is auto-derived: all conditions must pass.
 * explanation is empty — use buildExplanation() at evaluation time.
 */
export function conditionedRule(config: {
  readonly name: string;
  readonly auctionConditions: RuleCondition[];
  readonly handConditions: RuleCondition[];
  readonly call: (context: BiddingContext) => Call;
}): ConditionedBiddingRule {
  const allConditions = [...config.auctionConditions, ...config.handConditions];
  return {
    name: config.name,
    explanation: "",
    auctionConditions: config.auctionConditions,
    handConditions: config.handConditions,
    get conditions(): readonly RuleCondition[] {
      return allConditions;
    },
    matches(ctx: BiddingContext): boolean {
      return allConditions.every((c) => c.test(ctx));
    },
    call: config.call,
  };
}

// ─── Combinator factories ────────────────────────────────────

/** Invert a condition. */
export function not(cond: RuleCondition): RuleCondition {
  return {
    name: `not-${cond.name}`,
    label: `Not: ${cond.label}`,
    category: cond.category,
    test(ctx) {
      return !cond.test(ctx);
    },
    describe(ctx) {
      return `Not: ${cond.describe(ctx)}`;
    },
  };
}

/** All conditions must pass. */
export function and(...conds: RuleCondition[]): RuleCondition {
  return {
    name: "and",
    label: conds.map((c) => c.label).join("; "),
    test(ctx) {
      return conds.every((c) => c.test(ctx));
    },
    describe(ctx) {
      return conds.map((c) => c.describe(ctx)).join("; ");
    },
    evaluateChildren(ctx): ConditionBranch[] {
      const results: ConditionResult[] = conds.map((c) => ({
        condition: c,
        passed: c.test(ctx),
        description: c.describe(ctx),
      }));
      return [{ results, passed: results.every((r) => r.passed) }];
    },
  };
}

/**
 * Any branch must pass (at least one sub-condition group).
 * INVARIANT: Always evaluates ALL branches — short-circuiting would break
 * the UI branch-highlighting feature that shows which branch matched best.
 */
export function or(...conds: RuleCondition[]): RuleCondition {
  if (conds.length > 4) throw new Error("or() supports max 4 branches");
  return {
    name: "or",
    label: conds.map((c) => c.label).join(" or "),
    test(ctx) {
      return conds.some((c) => c.test(ctx));
    },
    describe(ctx) {
      const matched = conds.find((c) => c.test(ctx));
      if (matched) return matched.describe(ctx);
      return conds.map((c) => c.describe(ctx)).join(" or ");
    },
    evaluateChildren(ctx): ConditionBranch[] {
      // Evaluate ALL branches unconditionally
      const branches: ConditionBranch[] = conds.map((c) => {
        if (c.evaluateChildren) {
          const childBranches = c.evaluateChildren(ctx);
          // Flatten: and() returns one branch, use its results
          const results = childBranches.flatMap((b) => [...b.results]);
          return {
            results,
            passed: c.test(ctx),
          };
        }
        return {
          results: [
            {
              condition: c,
              passed: c.test(ctx),
              description: c.describe(ctx),
            },
          ],
          passed: c.test(ctx),
        };
      });
      return branches;
    },
  };
}
