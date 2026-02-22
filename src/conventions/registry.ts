import type {
  ConventionConfig,
  BiddingRule,
  BiddingContext,
  ConditionResult,
} from "./types";
import type { Call } from "../engine/types";
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
      if (isConditionedRule(rule)) {
        const conditionResults = evaluateConditions(rule, context);
        return {
          call: rule.call(context),
          rule: rule.name,
          explanation: buildExplanation(conditionResults),
          conditionResults,
        };
      }
      return {
        call: rule.call(context),
        rule: rule.name,
        explanation: rule.explanation,
      };
    }
  }
  return null;
}

export function clearRegistry(): void {
  registry.clear();
}
