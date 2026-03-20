// ── Evaluation module ────────────────────────────────────────────────
//
// Type-enforced viewport boundary. All exports use viewport types only.
// CLI commands import from here — never from strategy/, teaching/, or
// conventions/core/ directly.
//
// The ESLint rules in eslint.config.js enforce this at the import level.

// Types — all composed from viewport types + basic engine types
export type {
  AtomGradeResult,
  PlaythroughHandle,
  PlaythroughGradeResult,
  RevealStep,
  BiddingViewport,
  ViewportBidFeedback,
  TeachingDetail,
  BidGrade,
} from "./types";

// Atom evaluation (Phase 1)
export {
  buildAtomViewport,
  gradeAtomBid,
  validateAtomId,
  parseAtomId,
} from "./atom-evaluator";

// Playthrough evaluation (Phase 2)
export {
  startPlaythrough,
  getPlaythroughStepViewport,
  gradePlaythroughBid,
  getPlaythroughRevealSteps,
} from "./playthrough-evaluator";
