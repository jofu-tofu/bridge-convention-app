// Candidate generator — resolves intent proposals through the intent system.
// Uses collectIntentProposals() for traversal, decoupled from sibling-finder display path.

import type { CandidateBid, CandidateEligibility, SiblingConditionDetail } from "../../../core/contracts";
import type { Call } from "../../../engine/types";
import { isLegalCall } from "../../../engine/auction";
import type { EffectiveConventionContext } from "./effective-context";
import type { RuleNode } from "../tree/rule-tree";
import type { TreeEvalResult } from "../tree/tree-evaluator";
import { applyOverlayTreeReplacement } from "../overlay/overlay-tree-replacement";
import { collectIntentProposals } from "./intent-collector";
import type { CollectedIntent } from "./intent-collector";
import { resolveIntent } from "../intent/intent-resolver";
import type { ResolverResult } from "../intent/intent-resolver";
import type { ConventionOverlayPatch } from "../overlay/overlay";

/**
 * A CandidateBid enriched with resolver output and legality.
 * Extends the existing CandidateBid (no new traversal model).
 */
export interface ResolvedCandidate extends CandidateBid {
  readonly resolvedCall: Call;
  readonly isDefaultCall: boolean;
  readonly legal: boolean;
  readonly isMatched: boolean;
  readonly priority?: "preferred" | "alternative";
  readonly provenance?: CandidateProvenance;
  readonly eligibility: CandidateEligibility;
  /** DFS traversal order from intent collection. Used for deterministic tie-breaking within selection tiers. */
  readonly orderKey: number;
}

export type CandidateProvenance =
  | { readonly origin: "tree" }
  | { readonly origin: "replacement-tree"; readonly overlayId: string }
  | { readonly origin: "overlay-injected"; readonly overlayId: string }
  | { readonly origin: "overlay-override"; readonly overlayId: string };

/**
 * Result of candidate generation, including suppression tracking.
 * `matchedIntentSuppressed` is true only when the matched intent's proposal
 * was specifically removed by an overlay's `suppressIntent` hook.
 */
export interface CandidateGenerationResult {
  readonly candidates: readonly ResolvedCandidate[];
  readonly matchedIntentSuppressed: boolean;
}

/** Overlay error handler that throws immediately (fail-fast for tests/dev tooling). */
export const throwingOverlayErrorHandler = (
  overlayId: string,
  hook: string,
  error: string,
): never => {
  throw new Error(`Overlay "${overlayId}" ${hook} error: ${error}`);
};

// ─── Internal helpers ────────────────────────────────────────

type CollectedIntentWithProvenance = CollectedIntent & {
  provenance?: CandidateProvenance;
  suppressedBy?: string[];
};
type OverlayErrorHandler = (overlayId: string, hook: string, error: string) => void;

/** Build a CandidateEligibility from existing candidate fields. */
export function buildEligibility(
  failedConditions: readonly SiblingConditionDetail[],
  legal: boolean,
  protocolSatisfied: boolean = true,
  protocolReasons: readonly string[] = [],
  pedagogicalAcceptable: boolean = true,
  pedagogicalReasons: readonly string[] = [],
  encodingReason?: "all_encodings_illegal" | "illegal_in_auction",
): CandidateEligibility {
  return {
    hand: {
      satisfied: failedConditions.length === 0,
      failedConditions,
    },
    protocol: {
      satisfied: protocolSatisfied,
      reasons: protocolReasons,
    },
    encoding: encodingReason
      ? { legal, reason: encodingReason }
      : { legal },
    pedagogical: {
      acceptable: pedagogicalAcceptable,
      reasons: pedagogicalReasons,
    },
  };
}

/** Step 1: Apply first overlay's replacementTree (first wins).
 *  When a protocol branch is active (activeBranch non-null), overlay replacementTree
 *  hooks are skipped — the branch already provides the replacement tree.
 *  Other overlay hooks (suppress, add, override) still apply on top. */
function applyReplacementTreeStep(
  root: RuleNode,
  result: TreeEvalResult,
  overlays: readonly ConventionOverlayPatch[],
  raw: EffectiveConventionContext["raw"],
  hasBranch: boolean,
): { activeRoot: RuleNode; activeResult: TreeEvalResult; provenance: CandidateProvenance } {
  if (hasBranch) {
    // Branch already replaced the tree — skip overlay replacementTree hooks
    return { activeRoot: root, activeResult: result, provenance: { origin: "tree" } };
  }
  const replaced = applyOverlayTreeReplacement(overlays, root, raw, result);
  const provenance: CandidateProvenance = replaced.overlayId
    ? { origin: "replacement-tree", overlayId: replaced.overlayId }
    : { origin: "tree" };
  return { activeRoot: replaced.root, activeResult: replaced.result, provenance };
}

/** Step 2: Apply suppressIntent from ALL overlays (any can suppress).
 *  Tags suppressed proposals with `suppressedBy` instead of filtering them out.
 *  All proposals pass through — suppressed ones get protocol.satisfied=false during resolution. */
function applySuppressHooks(
  proposals: CollectedIntentWithProvenance[],
  overlays: readonly ConventionOverlayPatch[],
  matchedNodeId: string,
  ctx: EffectiveConventionContext,
  onError?: OverlayErrorHandler,
): { proposals: CollectedIntentWithProvenance[]; matchedSuppressed: boolean } {
  let matchedSuppressed = false;

  for (const overlay of overlays) {
    if (!overlay.suppressIntent) continue;
    try {
      for (const p of proposals) {
        if (overlay.suppressIntent(p, ctx)) {
          if (!p.suppressedBy) p.suppressedBy = [];
          p.suppressedBy.push(overlay.id);
          if (p.sourceNode?.nodeId === matchedNodeId) matchedSuppressed = true;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (onError) onError(overlay.id, "suppressIntent", msg);
      // eslint-disable-next-line no-console -- intentional: surface hook errors in dev
      else console.warn(`Overlay "${overlay.id}" suppressIntent threw:`, e);
    }
  }

  return { proposals, matchedSuppressed };
}

/** Step 3: Apply addIntents from ALL overlays (concatenate in config order).
 *  Overlay-injected intents get orderKey = 10_000 + index (generous gap — no real tree exceeds ~30 leaves). */
function applyAddIntentHooks(
  proposals: CollectedIntentWithProvenance[],
  overlays: readonly ConventionOverlayPatch[],
  ctx: EffectiveConventionContext,
  onError?: OverlayErrorHandler,
): CollectedIntentWithProvenance[] {
  let result = proposals;
  let overlayIndex = 0;

  for (const overlay of overlays) {
    if (!overlay.addIntents) continue;
    try {
      const added = overlay.addIntents(ctx);
      const tagged = added.map<CollectedIntentWithProvenance>(p => ({
        ...p,
        orderKey: p.orderKey ?? 10_000 + overlayIndex++,
        provenance: { origin: "overlay-injected", overlayId: overlay.id },
      }));
      result = [...result, ...tagged];
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (onError) onError(overlay.id, "addIntents", msg);
      // eslint-disable-next-line no-console -- intentional: surface hook errors in dev
      else console.warn(`Overlay "${overlay.id}" addIntents threw:`, e);
    }
  }

  return result;
}

/** Step 4 (per-proposal): Find first non-null overrideResolver result. */
function findOverrideResult(
  intent: CollectedIntent["intent"],
  overlays: readonly ConventionOverlayPatch[],
  ctx: EffectiveConventionContext,
  onError?: OverlayErrorHandler,
): { result: ResolverResult; overlayId: string } | null {
  for (const overlay of overlays) {
    if (!overlay.overrideResolver) continue;
    try {
      const maybe = overlay.overrideResolver(intent, ctx);
      if (maybe !== null) return { result: maybe, overlayId: overlay.id };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (onError) onError(overlay.id, "overrideResolver", msg);
      // eslint-disable-next-line no-console -- intentional: surface hook errors in dev
      else console.warn(`Overlay "${overlay.id}" overrideResolver threw:`, e);
    }
  }
  return null;
}

type ResolverOutcome =
  | { resolvedCall: Call; isDefaultCall: boolean; encodingFailed?: undefined }
  | { resolvedCall: Call; isDefaultCall: boolean; encodingFailed: true }
  | "declined"
  | "use_default";

function applyResolverResult(
  result: ResolverResult,
  raw: EffectiveConventionContext["raw"],
): ResolverOutcome {
  switch (result.status) {
    case "declined":
      return "declined";
    case "use_default":
      return "use_default";
    case "resolved": {
      if (result.calls.length === 0) return "use_default";
      for (const encoding of result.calls) {
        if (isLegalCall(raw.auction, encoding.call, raw.seat)) {
          return { resolvedCall: encoding.call, isDefaultCall: false };
        }
      }
      // All resolver encodings are illegal — keep first for diagnostics
      return { resolvedCall: result.calls[0]!.call, isDefaultCall: false, encodingFailed: true };
    }
  }
}

/** Resolve a single collected intent proposal into a ResolvedCandidate.
 *  Suppressed and declined candidates are kept with protocol.satisfied=false. */
function resolveCollectedIntent(
  proposal: CollectedIntentWithProvenance,
  isMatched: boolean,
  effectiveCtx: EffectiveConventionContext,
  overrideResult: { result: ResolverResult; overlayId: string } | null,
): ResolvedCandidate | null {
  const { raw, config, protocolResult, dialogueState } = effectiveCtx;
  const resolvers = config.intentResolvers ?? new Map();
  const conventionId = config.id;
  const roundName = protocolResult.activeRound?.name;

  let call: Call;
  try {
    call = proposal.defaultCall(raw);
  } catch {
    return null;
  }

  const failedConditions = isMatched ? [] : proposal.pathConditions
    .filter(entry => entry.condition.test(raw) !== entry.requiredResult)
    .map(entry => ({
      name: entry.condition.name,
      description: entry.condition.describe(raw),
    }));

  let resolvedCall = call;
  let isDefaultCall = true;
  let provenance = proposal.provenance;
  let allEncodingsIllegal = false;
  const protocolReasons: string[] = [];

  // Carry over suppression info from overlay hooks
  if (proposal.suppressedBy && proposal.suppressedBy.length > 0) {
    for (const overlayId of proposal.suppressedBy) {
      protocolReasons.push(`Suppressed by overlay: ${overlayId}`);
    }
  }

  if (overrideResult) {
    const outcome = applyResolverResult(overrideResult.result, raw);
    if (outcome === "declined") {
      protocolReasons.push(`Resolver declined: ${proposal.intent.type}`);
    } else if (outcome !== "use_default") {
      resolvedCall = outcome.resolvedCall;
      isDefaultCall = outcome.isDefaultCall;
      if (outcome.encodingFailed) allEncodingsIllegal = true;
      provenance = { origin: "overlay-override", overlayId: overrideResult.overlayId };
    }
  } else {
    try {
      const result = resolveIntent(proposal.intent, dialogueState, raw, resolvers);
      if (result !== null) {
        const outcome = applyResolverResult(result, raw);
        if (outcome === "declined") {
          protocolReasons.push(`Resolver declined: ${proposal.intent.type}`);
        } else if (outcome !== "use_default") {
          resolvedCall = outcome.resolvedCall;
          isDefaultCall = outcome.isDefaultCall;
          if (outcome.encodingFailed) allEncodingsIllegal = true;
        }
      }
    } catch {
      // Resolver error — fall back to defaultCall (already set)
    }
  }

  const legal = isLegalCall(raw.auction, resolvedCall, raw.seat);
  const protocolSatisfied = protocolReasons.length === 0;

  // Determine encoding reason when illegal
  let encodingReason: "all_encodings_illegal" | "illegal_in_auction" | undefined;
  if (!legal) {
    encodingReason = allEncodingsIllegal ? "all_encodings_illegal" : "illegal_in_auction";
  }

  // Pedagogical dimension — convention hook (fail-open)
  let pedagogicalAcceptable = true;
  let pedagogicalReasons: string[] = [];
  if (config.pedagogicalCheck) {
    try {
      const result = config.pedagogicalCheck(
        { intentType: proposal.intent.type, call, resolvedCall, isMatched },
        effectiveCtx,
      );
      pedagogicalAcceptable = result.acceptable;
      pedagogicalReasons = result.reasons;
    } catch {
      // Fail-open: pedagogical hook errors → acceptable
    }
  }

  return {
    bidName: proposal.nodeName,
    nodeId: proposal.sourceNode?.nodeId ?? proposal.nodeName,
    meaning: proposal.meaning,
    call,
    failedConditions,
    intent: {
      type: proposal.intent.type,
      params: proposal.intent.params,
    },
    source: {
      conventionId,
      roundName,
      nodeName: proposal.nodeName,
    },
    resolvedCall,
    isDefaultCall,
    legal,
    isMatched,
    priority: proposal.priority,
    provenance,
    eligibility: buildEligibility(failedConditions, legal, protocolSatisfied, protocolReasons, pedagogicalAcceptable, pedagogicalReasons, encodingReason),
    orderKey: proposal.orderKey ?? 0,
  };
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Resolve all candidates from a matched hand subtree through the intent system.
 *
 * Overlay patch hooks applied in order:
 * 1. replacementTree: full tree replacement (first wins)
 * 2. suppressIntent: filter out proposals (all compose)
 * 3. addIntents: append proposals (all concatenate)
 * 4. overrideResolver: override standard resolver (first non-null wins)
 */
export function generateCandidates(
  handTreeRoot: RuleNode,
  handResult: TreeEvalResult,
  effectiveCtx: EffectiveConventionContext,
  onOverlayError?: OverlayErrorHandler,
): CandidateGenerationResult {
  const hasBranch = effectiveCtx.protocolResult.activeBranch != null;
  const { activeRoot, activeResult, provenance } =
    applyReplacementTreeStep(handTreeRoot, handResult, effectiveCtx.activeOverlays, effectiveCtx.raw, hasBranch);

  const matched = activeResult.matched;
  const hasTreeMatch = matched !== null && matched.type === "intent";

  if (!hasTreeMatch) {
    // No tree match — skip tree collection/suppression, but let addIntents rescue
    const overlayProposals = applyAddIntentHooks([], effectiveCtx.activeOverlays, effectiveCtx, onOverlayError);
    if (overlayProposals.length === 0) {
      return { candidates: [], matchedIntentSuppressed: false };
    }

    // Resolve overlay-injected intents only
    const results: ResolvedCandidate[] = [];
    for (const proposal of overlayProposals) {
      const overrideResult = findOverrideResult(proposal.intent, effectiveCtx.activeOverlays, effectiveCtx, onOverlayError);
      const resolved = resolveCollectedIntent(proposal, false, effectiveCtx, overrideResult);
      if (resolved) results.push(resolved);
    }

    return { candidates: results, matchedIntentSuppressed: false };
  }

  let proposals: CollectedIntentWithProvenance[] = collectIntentProposals(activeRoot, effectiveCtx.raw)
    .map(p => ({ ...p, provenance }));

  const { proposals: afterSuppress, matchedSuppressed } =
    applySuppressHooks(proposals, effectiveCtx.activeOverlays, matched.nodeId, effectiveCtx, onOverlayError);
  proposals = afterSuppress;

  proposals = applyAddIntentHooks(proposals, effectiveCtx.activeOverlays, effectiveCtx, onOverlayError);

  const results: ResolvedCandidate[] = [];
  for (const proposal of proposals) {
    const isMatched = proposal.sourceNode !== undefined
      && matched.type === "intent"
      && proposal.sourceNode.nodeId === matched.nodeId;

    const overrideResult = findOverrideResult(proposal.intent, effectiveCtx.activeOverlays, effectiveCtx, onOverlayError);
    const resolved = resolveCollectedIntent(proposal, isMatched, effectiveCtx, overrideResult);

    if (resolved) {
      if (isMatched) results.unshift(resolved);
      else results.push(resolved);
    }
  }

  return { candidates: results, matchedIntentSuppressed: matchedSuppressed };
}
