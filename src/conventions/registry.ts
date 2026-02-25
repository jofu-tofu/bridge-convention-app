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
} from "./condition-evaluator";
import type { TreeConventionConfig, RuleNode } from "./rule-tree";
import type { TreeEvalResult } from "./tree-evaluator";
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

/** Get the flattened bidding rules from a config (computed from tree on demand). */
export function getEffectiveRules(config: ConventionConfig): readonly BiddingRule[] {
  if (isTreeConvention(config)) {
    return flattenTree(config.ruleTree);
  }
  return config.biddingRules ?? [];
}

/** Get the flattened bidding rules for a convention by ID. */
export function getConventionRules(id: string): readonly BiddingRule[] {
  return getEffectiveRules(getConvention(id));
}

export interface BiddingRuleResult {
  readonly call: Call;
  readonly rule: string;
  readonly explanation: string;
  readonly conditionResults?: readonly ConditionResult[];
  /** Raw tree evaluation result — available for conventions using rule trees.
   *  Carries DecisionNode references, so must not cross the shared/ boundary directly. */
  readonly treeEvalResult?: TreeEvalResult;
  /** The tree root used for evaluation — needed by mappers that compute depth/parent info. */
  readonly treeRoot?: RuleNode;
}

export function evaluateBiddingRules(
  context: BiddingContext,
  config: ConventionConfig,
): BiddingRuleResult | null {
  if (!isTreeConvention(config)) {
    throw new Error(
      `Convention "${config.id}" is not a tree convention. All conventions must use rule trees.`,
    );
  }

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
  return { ...result, treeEvalResult: treeResult, treeRoot: config.ruleTree };
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
  context: BiddingContext,
  config: ConventionConfig,
): DebugRuleResult[] {
  const effectiveRules = getEffectiveRules(config);

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
