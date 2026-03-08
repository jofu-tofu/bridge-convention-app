import type {
  ConventionConfig,
  BiddingRule,
  BiddingContext,
  BiddingRuleResult,
  ConditionResult,
  ConventionLookup,
} from "./types";
export type { BiddingRuleResult } from "./types";
import type { Call } from "../../engine/types";
import { isLegalCall } from "../../engine/auction";
import {
  isConditionedRule,
  evaluateConditions,
} from "./condition-evaluator";
import type { RuleNode } from "./rule-tree";
import { applyOverlayTreeReplacement } from "./overlay-tree-replacement";
import { treeResultToBiddingRuleResult, flattenProtocol } from "./tree-compat";
import type { ProtocolEvalResult, SemanticTrigger } from "./protocol";
import { validateProtocol } from "./protocol";
import { validateOverlayPatches, collectTriggerOverrides } from "./overlay";
import { evaluateProtocol } from "./protocol-evaluator";
import { buildEffectiveContext } from "./effective-context";
import { computeDialogueState } from "./dialogue/dialogue-manager";
import { baselineTransitionRules } from "./dialogue/baseline-transitions";
import { analyzeConvention } from "./diagnostics";
import type { DiagnosticWarning } from "./diagnostics";
import type { Auction } from "../../engine/types";

const registry = new Map<string, ConventionConfig>();
const diagnosticsCache = new Map<string, DiagnosticWarning[]>();

export function registerConvention(config: ConventionConfig): void {
  if (registry.has(config.id)) {
    throw new Error(`Convention "${config.id}" is already registered.`);
  }
  if (config.protocol) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- protocol generic is any by design (see ConventionConfig.protocol)
    validateProtocol(config.protocol);
  }
  if (config.baselineRules && config.transitionRules) {
    const baselineIds = new Set(config.baselineRules.map(r => r.id));
    for (const rule of config.transitionRules) {
      if (baselineIds.has(rule.id)) {
        throw new Error(
          `Convention "${config.id}": rule "${rule.id}" appears in both ` +
          `transitionRules and baselineRules. When using two-pass mode, ` +
          `transitionRules must not contain baseline rules.`,
        );
      }
    }
  }
  if (config.overlays) {
    if (!config.protocol) {
      throw new Error(`Convention "${config.id}" has overlays but no protocol.`);
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- protocol generic is any by design
    validateOverlayPatches(config.overlays, config.protocol);
  }
  // Run diagnostics at registration time (cached for test/dev consumption)
  diagnosticsCache.set(config.id, analyzeConvention(config));

  registry.set(config.id, config);
}

/** Get registration-time diagnostics for a convention. Returns [] if no issues. */
export function getDiagnostics(conventionId: string): readonly DiagnosticWarning[] {
  return diagnosticsCache.get(conventionId) ?? [];
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

/** Backward-compatible helper retained for callers migrating from tree-based APIs. */
export function isTreeConvention(config: ConventionConfig): boolean {
  return config.protocol !== undefined;
}

/** Get the flattened bidding rules from a config (computed from protocol on demand). */
export function getEffectiveRules(config: ConventionConfig): readonly BiddingRule[] {
  if (config.protocol) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- protocol generic is any by design
    return flattenProtocol(config.protocol);
  }
  return config.biddingRules ?? [];
}

/** Get the flattened bidding rules for a convention by ID. */
export function getConventionRules(id: string): readonly BiddingRule[] {
  return getEffectiveRules(getConvention(id));
}

export function evaluateBiddingRules(
  context: BiddingContext,
  config: ConventionConfig,
  lookupConvention?: ConventionLookup,
): BiddingRuleResult | null {
  // Protocol convention dispatch
  if (config.protocol) {
    const triggerOverrides = computeTriggerOverridesForConfig(config, context.auction);
    const protoResult = evaluateProtocol(config.protocol, context, triggerOverrides);
    const { handResult, treeRoot } = applyProtocolOverlays(
      config,
      context,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- ProtocolEvalResult<any> propagates from protocol generic
      protoResult,
      lookupConvention,
    );

    const result = treeResultToBiddingRuleResult(handResult, context);
    if (!result) return null;
    if (!isLegalCall(context.auction, result.call, context.seat)) return null;

    return {
      ...result,
      treeEvalResult: handResult,
      treeRoot,
      protocolResult: protoResult,
    };
  }

  throw new Error(
    `Convention "${config.id}" has no protocol. All conventions must use protocols.`,
  );
}

/**
 * @internal Computes trigger overrides from active overlays for a convention/auction pair.
 */
export function computeTriggerOverridesForConfig(
  config: ConventionConfig,
  auction: Auction,
): ReadonlyMap<string, readonly SemanticTrigger[]> | undefined {
  if (!config.overlays) return undefined;
  const dialogueState = config.baselineRules
    ? computeDialogueState(auction, config.transitionRules ?? [], config.baselineRules)
    : computeDialogueState(auction, config.transitionRules ?? baselineTransitionRules);

  return collectTriggerOverrides(config.overlays, dialogueState);
}

/**
 * @internal Applies active overlay tree replacements to protocol evaluation output.
 */
export function applyProtocolOverlays(
  config: ConventionConfig,
  context: BiddingContext,
  protoResult: ProtocolEvalResult,
  lookupConvention?: ConventionLookup,
): { handResult: ProtocolEvalResult["handResult"]; treeRoot: RuleNode | undefined } {
  let handResult = protoResult.handResult;
  let treeRoot = protoResult.handTreeRoot as RuleNode | undefined;
  if (config.overlays && protoResult.activeRound) {
    const effectiveCtx = buildEffectiveContext(context, config, protoResult, undefined, lookupConvention);
    const replaced = applyOverlayTreeReplacement(
      effectiveCtx.activeOverlays,
      treeRoot!,
      context,
      handResult,
    );
    treeRoot = replaced.root;
    handResult = replaced.result;
  }
  return { handResult, treeRoot };
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
  diagnosticsCache.clear();
}
