// ── Bid Feedback Builder ─────────────────────────────────────────────
//
// Assembles a BidFeedback DTO from strategy evaluation output.
// Encapsulates the teaching resolution + field extraction that was
// previously duplicated in stores/bidding.svelte.ts and CLI files.
//
// The returned object satisfies the BidFeedbackLike interface required
// by buildViewportFeedback() and buildTeachingDetail().

import type { Call } from "../engine/types";
import type { BidResult } from "../core/contracts/bidding";
import type { BidGrade } from "../core/contracts/teaching-grading";
import type {
  StrategyEvaluation,
  PracticalRecommendation,
  PracticalScoreBreakdown,
} from "../core/contracts/recommendation";
import type { TeachingProjection } from "../core/contracts/teaching-projection";
import type { TeachingResolution } from "../core/contracts/teaching-grading";
import type { EncodingTrace } from "../core/contracts/provenance";
import {
  resolveTeachingAnswer,
  gradeBid,
} from "../teaching/teaching-resolution";

/** Assembled bid feedback — produced by grading a user's bid against strategy output.
 *  Satisfies the BidFeedbackLike interface required by buildViewportFeedback(). */
export interface BidFeedbackDTO {
  readonly grade: BidGrade;
  readonly userCall: Call;
  readonly expectedResult: BidResult;
  readonly teachingResolution: TeachingResolution;
  readonly practicalRecommendation: PracticalRecommendation | null;
  readonly teachingProjection: TeachingProjection | null;
  readonly encodingTrace: EncodingTrace | null;
  readonly practicalScoreBreakdown: PracticalScoreBreakdown | null;
  readonly evaluationExhaustive: boolean;
  readonly fallbackReached: boolean;
}

/** Grade a user's bid and assemble feedback from strategy evaluation.
 *  Encapsulates teaching resolution + field extraction from StrategyEvaluation. */
export function assembleBidFeedback(
  userCall: Call,
  expectedResult: BidResult,
  strategyEval: StrategyEvaluation | null,
): BidFeedbackDTO {
  const teachingResolution = resolveTeachingAnswer(
    expectedResult,
    strategyEval?.acceptableAlternatives ?? undefined,
    strategyEval?.surfaceGroups ?? undefined,
  );
  const grade = gradeBid(userCall, teachingResolution);
  return {
    grade,
    userCall,
    expectedResult,
    teachingResolution,
    practicalRecommendation: strategyEval?.practicalRecommendation ?? null,
    teachingProjection: strategyEval?.teachingProjection ?? null,
    encodingTrace: strategyEval?.provenance?.encoding[0] ?? null,
    practicalScoreBreakdown: strategyEval?.practicalRecommendation?.scoreBreakdown ?? null,
    evaluationExhaustive: strategyEval?.arbitration?.evidenceBundle?.exhaustive ?? false,
    fallbackReached: strategyEval?.arbitration?.evidenceBundle?.fallbackReached ?? false,
  };
}

// Re-export grading utilities for callers that need just the grade
export { BidGrade } from "../core/contracts/teaching-grading";
export { resolveTeachingAnswer, gradeBid } from "../teaching/teaching-resolution";
