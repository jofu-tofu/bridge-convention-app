// Pipeline subsystem barrel — candidate generation pipeline.

export { generateCandidates } from "./candidate-generator";
export type {
  ResolvedCandidate,
  CandidateProvenance,
  CandidateGenerationResult,
} from "./candidate-generator";

export { selectMatchedCandidate } from "./candidate-selector";
export type { CandidateRankerFn } from "./candidate-selector";

export { collectIntentProposals } from "./intent-collector";
export type { CollectedIntent, PathConditionEntry } from "./intent-collector";

export { buildEffectiveContext, classifyInterference } from "./effective-context";
export type { EffectiveConventionContext, BeliefData } from "./effective-context";
