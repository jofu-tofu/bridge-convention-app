import type { ConventionConfig, BiddingContext, ConventionLookup } from "../../conventions/core/types";
import { evaluateBiddingRules } from "../../conventions/core/registry";
import { buildEffectiveContext } from "../../conventions/core/effective-context";
import type { BeliefData, EffectiveConventionContext } from "../../conventions/core/effective-context";
import { generateCandidates } from "../../conventions/core/candidate-generator";
import type { ResolvedCandidate } from "../../conventions/core/candidate-generator";
import { selectMatchedCandidate } from "../../conventions/core/candidate-selector";
import { ForcingState } from "../../contracts";
import type {
  BiddingStrategy,
  BidResult,
  PracticalRecommendation,
} from "../../contracts";
import { formatHandSummary } from "../../display/hand-summary";
import { TraceCollector } from "./trace-collector";
import { computePracticalRecommendation } from "./practical-recommender";
import { generatePragmaticCandidates } from "./pragmatic-generator";
import type { PragmaticCandidate } from "./pragmatic-generator";
import type { PrivateBeliefState } from "../../inference/private-belief";
import type { InferenceProvider } from "../../inference/types";
import { partnerSeat, SUIT_ORDER } from "../../engine/constants";
import {
  mapConditionResult,
  mapTreeEvalResult,
  mapResolvedCandidates,
  extractTreeInferenceData,
  callKeyForDedup,
} from "./tree-eval-mapper";

// Re-export mapper functions for downstream consumers
export { mapConditionResult, mapVisitedWithStructure, extractForkPoint, enrichSiblingsWithResolvedCalls, mapTreeEvalResult, mapResolvedCandidates, extractTreeInferenceData, callKeyForDedup } from "./tree-eval-mapper";

/** Options for customizing convention strategy behavior. */
export interface ConventionStrategyOptions {
  /** Provides public belief data for the effective context. Called per-suggest; exceptions are caught. */
  beliefProvider?: (ctx: BiddingContext) => BeliefData | undefined;
  /** Optional convention lookup override for DI-based tests. */
  lookupConvention?: ConventionLookup;
  /** Additional ranker applied after config.rankCandidates (if any). Both compose: config first, then options. */
  ranker?: (candidates: readonly ResolvedCandidate[], ctx: EffectiveConventionContext) => readonly ResolvedCandidate[];
  /** Inference provider for partner interpretation model. When present, misunderstandingRisk is computed per candidate. */
  interpretationProvider?: InferenceProvider;
}

export function conventionToStrategy(
  config: ConventionConfig,
  options?: ConventionStrategyOptions,
): BiddingStrategy {
  return {
    id: `convention:${config.id}`,
    name: config.name,
    suggest(context): BidResult | null {
      const trace = new TraceCollector();
      trace.setConventionId(config.id);

      const result = evaluateBiddingRules(context, config, options?.lookupConvention);
      if (!result) {
        trace.setProtocolMatched(false);
        return null;
      }

      trace.setProtocolMatched(!!result.protocolResult?.matched);
      if (result.protocolResult?.activeRound) {
        trace.setActiveRound(result.protocolResult.activeRound.name);
      }

      // Candidate generation pipeline: resolve intent through EffectiveConventionContext
      let call = result.call;
      let pipelineCandidates: readonly ResolvedCandidate[] | undefined;
      let publicBelief: BeliefData | undefined;
      if (result.treeEvalResult?.matched?.type === "intent" && result.treeRoot && result.protocolResult) {
        if (options?.beliefProvider) {
          try {
            publicBelief = options.beliefProvider(context);
          } catch {
            publicBelief = undefined;
          }
        }
        const effectiveCtx = buildEffectiveContext(
          context,
          config,
          result.protocolResult,
          publicBelief,
          options?.lookupConvention,
        );

        // Record activated overlays
        for (const overlay of effectiveCtx.activeOverlays) {
          trace.addOverlayActivated(overlay.id);
        }

        const { candidates: generated, matchedIntentSuppressed } = generateCandidates(
          result.treeRoot,
          result.treeEvalResult,
          effectiveCtx,
          (overlayId, hook, error) => trace.addOverlayError(overlayId, hook, error),
        );
        pipelineCandidates = generated;
        trace.setCandidateCount(generated.length);

        // Compose ranker: config.rankCandidates first, then options.ranker
        const configRanker = config.rankCandidates
          ? (cs: readonly ResolvedCandidate[]) => config.rankCandidates!(cs, effectiveCtx)
          : undefined;
        const optionsRanker = options?.ranker
          ? (cs: readonly ResolvedCandidate[]) => options.ranker!(cs, effectiveCtx)
          : undefined;
        let ranker: ((cs: readonly ResolvedCandidate[]) => readonly ResolvedCandidate[]) | undefined;
        if (configRanker && optionsRanker) {
          ranker = (cs) => optionsRanker(configRanker(cs));
        } else {
          ranker = configRanker ?? optionsRanker;
        }
        const selected = selectMatchedCandidate(generated, ranker, effectiveCtx.dialogueState.forcingState);

        if (selected) {
          trace.setSelectedTier(
            selected.isMatched ? "matched"
              : selected.priority === "preferred" ? "preferred"
              : selected.priority === "alternative" ? "alternative"
              : "matched",
          );
          if (!selected.isMatched || !selected.isDefaultCall) {
            trace.setEffectivePath({
              candidateBidName: selected.bidName,
              wasOverlayReplaced: effectiveCtx.activeOverlays.some(o => o.replacementTree !== undefined),
              wasResolverRemapped: !selected.isDefaultCall,
            });
          }
          call = selected.resolvedCall;
        } else {
          trace.setSelectedTier("none");
          const forcingState = effectiveCtx.dialogueState.forcingState;
          if (
            forcingState === ForcingState.GameForcing
            || forcingState === ForcingState.ForcingOneRound
          ) {
            trace.setForcingDeclined(true);
          }
          if (matchedIntentSuppressed) return null;
        }
      }

      // Compute practical recommendation if belief data available
      let practicalRecommendation: PracticalRecommendation | undefined;
      if (publicBelief && pipelineCandidates) {
        const resolvedDTOs = mapResolvedCandidates(pipelineCandidates);

        // Generate pragmatic candidates when belief data is available
        let pragmaticCandidates: PragmaticCandidate[] | undefined;
        try {
          const partner = partnerSeat(context.seat);
          const partnerBeliefs = publicBelief.beliefs[partner];
          const privatePosterior: PrivateBeliefState = {
            seat: context.seat,
            partnerSeat: partner,
            partnerHcpRange: {
              min: Math.max(partnerBeliefs.hcpRange.min, 0),
              max: Math.min(partnerBeliefs.hcpRange.max, 40 - context.evaluation.hcp),
            },
            partnerSuitLengths: Object.fromEntries(
              SUIT_ORDER.map((suit, i) => [
                suit,
                {
                  min: Math.max(partnerBeliefs.suitLengths[suit].min, 0),
                  max: Math.min(partnerBeliefs.suitLengths[suit].max, 13 - (context.evaluation.shape[i] ?? 0)),
                },
              ]),
            ) as PrivateBeliefState["partnerSuitLengths"],
          };
          const existingCalls = new Set(resolvedDTOs.map(c => callKeyForDedup(c.resolvedCall)));

          const rawPragmatic = generatePragmaticCandidates(context, privatePosterior, existingCalls);
          // Forcing guard: exclude pragmatic Pass candidates when forcing state is active
          const effectiveForcingState = result.protocolResult
            ? buildEffectiveContext(
                context,
                config,
                result.protocolResult,
                publicBelief,
                options?.lookupConvention,
              ).dialogueState.forcingState
            : undefined;
          if (effectiveForcingState === ForcingState.ForcingOneRound || effectiveForcingState === ForcingState.GameForcing) {
            pragmaticCandidates = rawPragmatic.filter(c => c.call.type !== "pass");
          } else {
            pragmaticCandidates = rawPragmatic;
          }
        } catch {
          // Pragmatic generation errors don't block recommendation
          pragmaticCandidates = undefined;
        }

        practicalRecommendation = computePracticalRecommendation(
          resolvedDTOs, context, publicBelief, call,
          (err) => trace.setPracticalError(err.message),
          options?.interpretationProvider,
          pragmaticCandidates,
        ) ?? undefined;
      }

      return {
        call,
        ruleName: result.rule,
        explanation: result.explanation,
        meaning: result.meaning,
        handSummary: formatHandSummary(context.evaluation),
        conditions: result.conditionResults
          ? result.conditionResults.map(mapConditionResult)
          : undefined,
        treePath: result.treeEvalResult && result.treeRoot
          ? mapTreeEvalResult(
              result.treeEvalResult,
              result.treeRoot,
              context,
              config.id,
              result.protocolResult?.activeRound?.name,
              pipelineCandidates,
            )
          : undefined,
        evaluationTrace: trace.build(),
        treeInferenceData: result.treeEvalResult
          ? extractTreeInferenceData(result.treeEvalResult)
          : undefined,
        practicalRecommendation,
      };
    },
  };
}
