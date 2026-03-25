// ── pipeline/ root barrel ──────────────────────────────────────────────
// Re-exports from subfolders + root files for conventions/index.ts consumption.

// Root-level cross-cutting types
export type { PipelineResult, PipelineCarrier, ArbitrationResult, EncodedProposal, EliminationRecord } from "./pipeline-types";
export type { StrategyEvaluation, ConventionStrategy, MachineDebugSnapshot } from "./strategy-evaluation";
export type { CandidateEligibility, ResolvedCandidateDTO, EvaluationTrace } from "./tree-evaluation";
export { isDtoSelectable, isDtoTeachingAcceptable } from "./tree-evaluation";
export type { EvidenceBundle, ConditionEvidence, ConditionResult, RejectionEvidence, AlternativeEvidence } from "./evidence-bundle";
export type { BidAction, BidSuitName } from "./bid-action";
export { runPipeline } from "./run-pipeline";
export type { PipelineInput, PipelineOutput } from "./run-pipeline";
export { enumerateRuleAtoms, generateRuleCoverageManifest } from "./rule-enumeration";
export type { RuleAtom, RuleCoverageManifest } from "./rule-enumeration";

// Subfolder re-exports
export * from "./facts/index";
export * from "./evaluation/index";
export * from "./observation/index";
