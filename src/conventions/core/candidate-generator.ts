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
 * Error handling: hook throws → console.warn, graceful degradation.
 * resolver throws → falls back to defaultCall. defaultCall throws → candidate excluded.
 */
export function generateCandidates(
  handTreeRoot: RuleNode,
  handResult: TreeEvalResult,
  effectiveCtx: EffectiveConventionContext,
): CandidateGenerationResult {
  const overlay = effectiveCtx.activeOverlay;

  // Step 1: Overlay tree replacement
  let activeRoot = handTreeRoot;
  let activeResult = handResult;
  if (overlay?.replacementTree) {
    activeRoot = overlay.replacementTree;
    activeResult = evaluateTree(activeRoot, effectiveCtx.raw);
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

  // Step 2: suppressIntent hook — track whether matched proposal is removed
  let matchedIntentSuppressed = false;
  if (overlay?.suppressIntent) {
    try {
      const hadMatched = proposals.some(p => p.sourceNode !== undefined && p.sourceNode.nodeId === matched.nodeId);
      proposals = proposals.filter(p => !overlay.suppressIntent!(p, effectiveCtx));
      const stillHasMatched = proposals.some(p => p.sourceNode !== undefined && p.sourceNode.nodeId === matched.nodeId);
      matchedIntentSuppressed = hadMatched && !stillHasMatched;
    } catch (e) {
      // eslint-disable-next-line no-console -- intentional: surface hook errors in dev
      console.warn(`Overlay "${overlay.id}" suppressIntent threw:`, e);
    }
  }

  // Step 3: addIntents hook
  if (overlay?.addIntents) {
    try {
      const added = overlay.addIntents(effectiveCtx);
      proposals = [...proposals, ...added];
    } catch (e) {
      // eslint-disable-next-line no-console -- intentional: surface hook errors in dev
      console.warn(`Overlay "${overlay.id}" addIntents threw:`, e);
    }
  }

  // Resolve each proposal, matched first
  const results: ResolvedCandidate[] = [];

  for (const proposal of proposals) {
    // Match by nodeId (value comparison) — survives spread copies / reconstructions
    const isMatched = proposal.sourceNode !== undefined
      && matched.type === "intent"
      && proposal.sourceNode.nodeId === matched.nodeId;

    // Step 4: overrideResolver hook
    let overrideCall: Call | null = null;
    if (overlay?.overrideResolver) {
      try {
        overrideCall = overlay.overrideResolver(proposal.intent, effectiveCtx);
      } catch (e) {
        // eslint-disable-next-line no-console -- intentional: surface hook errors in dev
        console.warn(`Overlay "${overlay.id}" overrideResolver threw:`, e);
      }
    }

    const resolved = resolveCollectedIntent(
      proposal, isMatched, raw, dialogueState, resolvers, conventionId, roundName, overrideCall,
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

function resolveCollectedIntent(
  proposal: CollectedIntent,
  isMatched: boolean,
  raw: EffectiveConventionContext["raw"],
  dialogueState: EffectiveConventionContext["dialogueState"],
  resolvers: NonNullable<EffectiveConventionContext["config"]["intentResolvers"]>,
  conventionId: string,
  roundName: string | undefined,
  overrideCall: Call | null,
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

  if (overrideCall) {
    resolvedCall = overrideCall;
    isDefaultCall = false;
  } else {
    try {
      const resolved = resolveIntent(proposal.intent, dialogueState, raw, resolvers);
      if (resolved && resolved.length > 0) {
        // Try encodings in order — use first legal one
        let foundLegal = false;
        for (const encoding of resolved) {
          if (isLegalCall(raw.auction, encoding.call, raw.seat)) {
            resolvedCall = encoding.call;
            isDefaultCall = false;
            foundLegal = true;
            break;
          }
        }
        // If none are legal, use the first encoding (will be marked illegal downstream)
        if (!foundLegal) {
          resolvedCall = resolved[0]!.call;
          isDefaultCall = false;
        }
      }
    } catch {
      // Resolver error — fall back to defaultCall (already set)
    }
  }

  const legal = isLegalCall(raw.auction, resolvedCall, raw.seat);

  return {
    bidName: proposal.nodeName,
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
