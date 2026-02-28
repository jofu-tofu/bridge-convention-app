import type {
  ConventionConfig,
  BiddingRule,
  BiddingContext,
  ConditionResult,
} from "./types";
import type { Call } from "../../engine/types";
import { isLegalCall } from "../../engine/auction";
import {
  isConditionedRule,
  evaluateConditions,
} from "./condition-evaluator";
import type { TreeConventionConfig, RuleNode, ConventionTreeRoot, BidAlert } from "./rule-tree";
import { validateTree, validateSlotTree } from "./rule-tree";
import type { TreeEvalResult, SlotTreeEvalResult } from "./tree-evaluator";
import { evaluateTree, evaluateSlotTree } from "./tree-evaluator";
import { treeResultToBiddingRuleResult, flattenTree, flattenProtocol } from "./tree-compat";
import type { ProtocolEvalResult } from "./protocol";
import { validateProtocol } from "./protocol";
import { evaluateProtocol } from "./protocol-evaluator";

/** Type guard: does this convention use a rule tree? */
export function isTreeConvention(
  config: ConventionConfig,
): config is TreeConventionConfig {
  return config.ruleTree != null;
}

/** Type guard: does this convention use a protocol? */
export function isProtocolConvention(
  config: ConventionConfig,
): boolean {
  return config.protocol != null;
}

const registry = new Map<string, ConventionConfig>();

export function registerConvention(config: ConventionConfig): void {
  if (registry.has(config.id)) {
    throw new Error(`Convention "${config.id}" is already registered.`);
  }
  if (config.protocol && config.ruleTree) {
    throw new Error(
      `Convention "${config.id}" has both protocol and ruleTree set. Use one or the other.`,
    );
  }
  if (config.protocol) {
    validateProtocol(config.protocol);
  } else if (isTreeConvention(config)) {
    if (config.ruleTree.type === "auction-slots") {
      validateSlotTree(config.ruleTree);
    } else {
      validateTree(config.ruleTree);
    }
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
  if (config.protocol) {
    return flattenProtocol(config.protocol);
  }
  if (isTreeConvention(config)) {
    return flattenTree(config.ruleTree as ConventionTreeRoot);
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
  readonly meaning?: string;
  readonly conditionResults?: readonly ConditionResult[];
  /** Raw tree evaluation result — available for conventions using rule trees.
   *  Carries DecisionNode references, so must not cross the shared/ boundary directly. */
  readonly treeEvalResult?: TreeEvalResult;
  /** The tree root used for evaluation — needed by mappers that compute depth/parent info. */
  readonly treeRoot?: RuleNode;
  /** Full slot tree evaluation result — available for slot-based conventions.
   *  Preserved for future inference work (auction-level rejection data). */
  readonly slotTreeResult?: SlotTreeEvalResult;
  /** Full protocol evaluation result — available for protocol-based conventions. */
  readonly protocolResult?: ProtocolEvalResult;
  /** Alert metadata from matched BidNode — for conventional (non-natural) bids. */
  readonly alert?: BidAlert;
}

export function evaluateBiddingRules(
  context: BiddingContext,
  config: ConventionConfig,
): BiddingRuleResult | null {
  // Protocol convention dispatch
  if (config.protocol) {
    const protoResult = evaluateProtocol(config.protocol, context);
    const result = treeResultToBiddingRuleResult(protoResult.handResult, context);
    if (!result) return null;
    if (!isLegalCall(context.auction, result.call, context.seat)) return null;

    const treeRoot = protoResult.handTreeRoot as RuleNode | undefined;
    return {
      ...result,
      treeEvalResult: protoResult.handResult,
      treeRoot,
      protocolResult: protoResult,
    };
  }

  if (!isTreeConvention(config)) {
    throw new Error(
      `Convention "${config.id}" is not a tree or protocol convention. All conventions must use rule trees or protocols.`,
    );
  }

  if (config.ruleTree.type === "auction-slots") {
    // Slot tree evaluation
    const slotResult = evaluateSlotTree(config.ruleTree, context);
    const result = treeResultToBiddingRuleResult(slotResult.handResult, context);
    if (!result) return null;
    if (!isLegalCall(context.auction, result.call, context.seat)) return null;

    // Extract hand subtree root from last matched slot's child
    let treeRoot: RuleNode | undefined;
    if (slotResult.matchedSlots.length > 0) {
      const lastSlot = slotResult.matchedSlots[slotResult.matchedSlots.length - 1]!;
      const child = lastSlot.matchedSlot.child;
      if (child.type !== "auction-slots") {
        treeRoot = child as RuleNode;
      }
    }

    return { ...result, treeEvalResult: slotResult.handResult, treeRoot, slotTreeResult: slotResult };
  }

  // Legacy binary tree evaluation
  const treeResult = evaluateTree(config.ruleTree, context);
  const result = treeResultToBiddingRuleResult(treeResult, context);
  if (!result) return null;
  if (!isLegalCall(context.auction, result.call, context.seat)) return null;
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
