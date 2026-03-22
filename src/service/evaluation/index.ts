// ── Evaluation subfolder barrel ──────────────────────────────────────
//
// Internal to service/. External consumers import via service/index.ts.

export type { AtomGradeResult, PlaythroughHandle, PlaythroughGradeResult, RevealStep } from "./types";
export { buildAtomViewport, gradeAtomBid, validateAtomId, parseAtomId } from "./atom-evaluator";
export { startPlaythrough, getPlaythroughStepViewport, gradePlaythroughBid, getPlaythroughRevealSteps } from "./playthrough-evaluator";
