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
import type { TreeConventionConfig } from "./rule-tree";
import { evaluateTree, evaluateTreeFast } from "./tree-evaluator";
import { treeResultToBiddingRuleResult, flattenTree } from "./tree-compat";

/** Type guard: does this convention use a rule tree? */
export function isTreeConvention(
  config: ConventionConfig,
): config is TreeConventionConfig {
  return config.ruleTree != null;
}

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
  config?: ConventionConfig,
): BiddingRuleResult | null {
  // Tree convention dispatch: evaluates config.ruleTree, ignores `rules` param entirely.
  // For tree conventions, biddingRules is vestigial — see TreeConventionConfig JSDoc.
  if (config && isTreeConvention(config)) {
    // Fast check first (no describe() calls) — only run full eval on match
    const fastMatch = evaluateTreeFast(config.ruleTree, context);
    if (!fastMatch) return null;
    // Validate legality before paying the describe() cost
    const call = fastMatch.call(context);
    if (!isLegalCall(context.auction, call, context.seat)) return null;
    // Full eval for explanation/conditionResults (describe() only called on matched path)
    const treeResult = evaluateTree(config.ruleTree, context);
    const result = treeResultToBiddingRuleResult(treeResult, context);
    if (!result) return null;
    return result;
  }

  // Flat convention dispatch (existing path)
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

/** Evaluate ALL rules against a context, returning results for every rule (not just first match).
 *  For tree conventions, flattens the tree — `rules` param is ignored in favor of config.ruleTree. */
export function evaluateAllBiddingRules(
  rules: readonly BiddingRule[],
  context: BiddingContext,
  config?: ConventionConfig,
): DebugRuleResult[] {
  // For tree conventions, flatten the tree and evaluate each flattened rule
  const effectiveRules = config && isTreeConvention(config)
    ? flattenTree(config.ruleTree)
    : rules;

  return effectiveRules.map((rule) => {
    const matched = rule.matches(context);
    let isLegal = false;
    let call: Call | undefined;

    if (matched) {
      call = rule.call(context);
      isLegal = isLegalCall(context.auction, call, context.seat);
    }

    const conditionResults = matched && isConditionedRule(rule)
      ? evaluateConditions(rule, context)
      : undefined;

    return { ruleName: rule.name, matched, isLegal, call, conditionResults };
  });
}

export function clearRegistry(): void {
  registry.clear();
}
