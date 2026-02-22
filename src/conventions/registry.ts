import type {
  ConventionConfig,
  BiddingRule,
  BiddingContext,
  ConditionResult,
} from "./types";
import type { Call } from "../engine/types";
import { isLegalCall } from "../engine/auction";
import {
  isConditionedRule,
  evaluateConditions,
  buildExplanation,
} from "./condition-evaluator";

const registry = new Map<string, ConventionConfig>();

export function registerConvention(config: ConventionConfig): void {
  if (registry.has(config.id)) {
    throw new Error(`Convention "${config.id}" is already registered.`);
  }
  registry.set(config.id, config);
}

export function getConvention(id: string): ConventionConfig {
  const config = registry.get(id);
  if (!config) {
    const available = [...registry.keys()].join(", ") || "(none)";
    throw new Error(`Unknown convention "${id}". Available: ${available}`);
  }
  return config;
}

export function listConventions(): ConventionConfig[] {
  return [...registry.values()];
}

export function listConventionIds(): string[] {
  return [...registry.keys()];
}

export interface BiddingRuleResult {
  readonly call: Call;
  readonly rule: string;
  readonly explanation: string;
  readonly conditionResults?: readonly ConditionResult[];
}

export function evaluateBiddingRules(
  rules: readonly BiddingRule[],
  context: BiddingContext,
): BiddingRuleResult | null {
  for (const rule of rules) {
    if (rule.matches(context)) {
      const call = rule.call(context);

      // Skip rules that produce illegal bids (e.g., below current auction level)
      if (!isLegalCall(context.auction, call, context.seat)) {
        continue;
      }

      if (isConditionedRule(rule)) {
        const conditionResults = evaluateConditions(rule, context);
        return {
          call,
          rule: rule.name,
          explanation: buildExplanation(conditionResults),
          conditionResults,
        };
      }
      return {
        call,
        rule: rule.name,
        explanation: rule.explanation,
      };
    }
  }
  return null;
}

export interface DebugRuleResult {
  readonly ruleName: string;
  readonly matched: boolean;
  readonly isLegal: boolean;
  readonly call?: Call;
  readonly conditionResults?: readonly ConditionResult[];
}

/** Evaluate ALL rules against a context, returning results for every rule (not just first match). */
export function evaluateAllBiddingRules(
  rules: readonly BiddingRule[],
  context: BiddingContext,
): DebugRuleResult[] {
  return rules.map((rule) => {
    const matched = rule.matches(context);
    let isLegal = false;
    let call: Call | undefined;

    if (matched) {
      call = rule.call(context);
      isLegal = isLegalCall(context.auction, call, context.seat);
    }

    const conditionResults = isConditionedRule(rule)
      ? evaluateConditions(rule, context)
      : undefined;

    return { ruleName: rule.name, matched, isLegal, call, conditionResults };
  });
}

export function clearRegistry(): void {
  registry.clear();
}
