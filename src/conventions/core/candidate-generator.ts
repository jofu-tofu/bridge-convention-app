// Candidate generator — resolves intent proposals through the intent system.
// Uses collectIntentProposals() for traversal, decoupled from sibling-finder display path.

import type { CandidateBid } from "../../shared/types";
import type { Call } from "../../engine/types";
import { isLegalCall } from "../../engine/auction";
import type { EffectiveConventionContext } from "./effective-context";
import type { RuleNode } from "./rule-tree";
import type { TreeEvalResult } from "./tree-evaluator";
import { evaluateTree } from "./tree-evaluator";
import { collectIntentProposals } from "./intent-collector";
import type { CollectedIntent } from "./intent-collector";
import { resolveIntent } from "./intent/intent-resolver";
import type { ResolverResult } from "./intent/intent-resolver";

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
}

/**
 * Result of candidate generation, including suppression tracking.
 * `matchedIntentSuppressed` is true only when the matched intent's proposal
 * was specifically removed by an overlay's `suppressIntent` hook.
 */
export interface CandidateGenerationResult {
  readonly candidates: readonly ResolvedCandidate[];
  readonly matchedIntentSuppressed: boolean;
}

/**
 * Resolve all candidates from a matched hand subtree through the intent system.
 * Uses collectIntentProposals() for traversal — decoupled from display/teaching path.
 *
 * Returns candidates with matched first, then others in tree traversal order.
 * Tracks whether the matched intent was specifically suppressed by an overlay.
 *
 * Overlay patch hooks applied in order:
 * 1. replacementTree: full tree replacement (if set)
 * 2. suppressIntent: filter out proposals
 * 3. addIntents: append proposals (no sourceNode, never matched)
 * 4. overrideResolver: override standard resolver for an intent
 *
 * Error handling: hook throws → onOverlayError callback (if provided) or console.warn.
 * resolver throws → falls back to defaultCall. defaultCall throws → candidate excluded.
 */
export function generateCandidates(
  handTreeRoot: RuleNode,
  handResult: TreeEvalResult,
  effectiveCtx: EffectiveConventionContext,
  onOverlayError?: (overlayId: string, hook: string, error: string) => void,
): CandidateGenerationResult {
  const overlays = effectiveCtx.activeOverlays;

  // Step 1: Overlay tree replacement — first overlay's replacementTree wins
  let activeRoot = handTreeRoot;
  let activeResult = handResult;
  for (const overlay of overlays) {
    if (overlay.replacementTree) {
      activeRoot = overlay.replacementTree;
      activeResult = evaluateTree(activeRoot, effectiveCtx.raw);
      break;
    }
  }

  const { raw, config, protocolResult, dialogueState } = effectiveCtx;
  const matched = activeResult.matched;

  // No matched IntentNode → no candidates
  if (!matched || matched.type !== "intent") return { candidates: [], matchedIntentSuppressed: false };

  const conventionId = config.id;
  const roundName = protocolResult.activeRound?.name;
  const resolvers = config.intentResolvers ?? new Map();

  // Collect all intent proposals from the hand subtree
  let proposals = collectIntentProposals(activeRoot, raw);

  // Step 2: suppressIntent from ALL overlays (any overlay can suppress)
  let matchedIntentSuppressed = false;
  for (const overlay of overlays) {
    if (overlay.suppressIntent) {
      try {
        const hadMatched = proposals.some(p => p.sourceNode !== undefined && p.sourceNode.nodeId === matched.nodeId);
        proposals = proposals.filter(p => !overlay.suppressIntent!(p, effectiveCtx));
        const stillHasMatched = proposals.some(p => p.sourceNode !== undefined && p.sourceNode.nodeId === matched.nodeId);
        if (hadMatched && !stillHasMatched) matchedIntentSuppressed = true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (onOverlayError) onOverlayError(overlay.id, "suppressIntent", msg);
        // eslint-disable-next-line no-console -- intentional: surface hook errors in dev
        else console.warn(`Overlay "${overlay.id}" suppressIntent threw:`, e);
      }
    }
  }

  // Step 3: addIntents from ALL overlays (concatenate in config order)
  for (const overlay of overlays) {
    if (overlay.addIntents) {
      try {
        const added = overlay.addIntents(effectiveCtx);
        proposals = [...proposals, ...added];
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (onOverlayError) onOverlayError(overlay.id, "addIntents", msg);
        // eslint-disable-next-line no-console -- intentional: surface hook errors in dev
        else console.warn(`Overlay "${overlay.id}" addIntents threw:`, e);
      }
    }
  }

  // Resolve each proposal, matched first
  const results: ResolvedCandidate[] = [];

  for (const proposal of proposals) {
    // Match by nodeId (value comparison) — survives spread copies / reconstructions
    const isMatched = proposal.sourceNode !== undefined
      && matched.type === "intent"
      && proposal.sourceNode.nodeId === matched.nodeId;

    // Step 4: overrideResolver — first non-null wins across all overlays
    let overrideResult: ResolverResult | null = null;
    for (const overlay of overlays) {
      if (overlay.overrideResolver) {
        try {
          overrideResult = overlay.overrideResolver(proposal.intent, effectiveCtx);
          if (overrideResult !== null) break;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (onOverlayError) onOverlayError(overlay.id, "overrideResolver", msg);
          // eslint-disable-next-line no-console -- intentional: surface hook errors in dev
          else console.warn(`Overlay "${overlay.id}" overrideResolver threw:`, e);
        }
      }
    }

    const resolved = resolveCollectedIntent(
      proposal, isMatched, raw, dialogueState, resolvers, conventionId, roundName, overrideResult,
    );
    if (resolved) {
      if (isMatched) {
        results.unshift(resolved);
      } else {
        results.push(resolved);
      }
    }
  }

  return { candidates: results, matchedIntentSuppressed };
}

function applyResolverResult(
  result: ResolverResult,
  raw: EffectiveConventionContext["raw"],
): { resolvedCall: Call; isDefaultCall: boolean } | "declined" | "use_default" {
  switch (result.status) {
    case "declined":
      return "declined";
    case "use_default":
      return "use_default";
    case "resolved": {
      if (result.calls.length === 0) return "use_default";
      // Encoding order policy: resolvers return alternatives in priority order.
      // We pick the first LEGAL encoding. The order comes from the resolver,
      // so resolver authors control which encoding is preferred.
      for (const encoding of result.calls) {
        if (isLegalCall(raw.auction, encoding.call, raw.seat)) {
          return { resolvedCall: encoding.call, isDefaultCall: false };
        }
      }
      // If none are legal, use the first encoding (will be marked illegal downstream)
      return { resolvedCall: result.calls[0]!.call, isDefaultCall: false };
    }
  }
}

function resolveCollectedIntent(
  proposal: CollectedIntent,
  isMatched: boolean,
  raw: EffectiveConventionContext["raw"],
  dialogueState: EffectiveConventionContext["dialogueState"],
  resolvers: NonNullable<EffectiveConventionContext["config"]["intentResolvers"]>,
  conventionId: string,
  roundName: string | undefined,
  overrideResult: ResolverResult | null,
): ResolvedCandidate | null {
  // Get the default call
  let call: Call;
  try {
    call = proposal.defaultCall(raw);
  } catch {
    return null;
  }

  // Build failed conditions from path (conditions where actual != required)
  const failedConditions = isMatched ? [] : proposal.pathConditions
    .filter(entry => entry.condition.test(raw) !== entry.requiredResult)
    .map(entry => ({
      name: entry.condition.name,
      description: entry.condition.describe(raw),
    }));

  // Resolve through intent system (override takes precedence)
  let resolvedCall = call;
  let isDefaultCall = true;

  if (overrideResult) {
    const outcome = applyResolverResult(overrideResult, raw);
    if (outcome === "declined") return null;
    if (outcome !== "use_default") {
      resolvedCall = outcome.resolvedCall;
      isDefaultCall = outcome.isDefaultCall;
    }
  } else {
    try {
      const result = resolveIntent(proposal.intent, dialogueState, raw, resolvers);
      // null = no resolver registered → use defaultCall
      if (result !== null) {
        const outcome = applyResolverResult(result, raw);
        if (outcome === "declined") return null;
        if (outcome !== "use_default") {
          resolvedCall = outcome.resolvedCall;
          isDefaultCall = outcome.isDefaultCall;
        }
      }
    } catch {
      // Resolver error — fall back to defaultCall (already set)
    }
  }

  const legal = isLegalCall(raw.auction, resolvedCall, raw.seat);

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
  };
}
