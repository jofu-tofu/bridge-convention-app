// ── Bid Feedback Builder ─────────────────────────────────────────────
//
// Assembles a BidFeedback DTO from strategy evaluation output.
// Encapsulates the teaching resolution + field extraction that was
// previously duplicated in stores/bidding.svelte.ts and CLI files.
//
// The returned object satisfies the BidFeedbackLike interface required
// by buildViewportFeedback() and buildTeachingDetail().

import type { Call } from "../engine/types";
import type { BidResult } from "../strategy/bidding/bidding-types";
import type { BidGrade } from "../conventions/teaching/teaching-types";
import type {
  PracticalRecommendation,
  PracticalScoreBreakdown,
} from "../strategy/recommendation-types";
import type { StrategyEvaluation } from "../conventions";
import type { TeachingProjection } from "../conventions/teaching/teaching-types";
import type { TeachingResolution } from "../conventions/teaching/teaching-types";
import {
  resolveTeachingAnswer,
  gradeBid,
} from "../conventions";

/** Assembled bid feedback — produced by grading a user's bid against strategy output.
 *  Satisfies the BidFeedbackLike interface required by buildViewportFeedback(). */
export interface BidFeedbackDTO {
  readonly grade: BidGrade;
  readonly userCall: Call;
  readonly expectedResult: BidResult;
  readonly teachingResolution: TeachingResolution;
  readonly practicalRecommendation: PracticalRecommendation | null;
  readonly teachingProjection: TeachingProjection | null;
  readonly practicalScoreBreakdown: PracticalScoreBreakdown | null;
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
    practicalScoreBreakdown: strategyEval?.practicalRecommendation?.scoreBreakdown ?? null,
  };
}

// Re-export grading utilities for callers that need just the grade
export { BidGrade } from "../conventions/teaching/teaching-types";
export { resolveTeachingAnswer, gradeBid } from "../conventions";
