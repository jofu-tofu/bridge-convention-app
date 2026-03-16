import type { Call } from "../../engine/types";
import type { BiddingStrategy } from "./bidding";
import type { AlternativeGroup, IntentFamily } from "./tree-evaluation";
import type { ExplanationCatalogIR } from "./explanation-catalog";
import type { ArbitrationResult, MachineRegisters } from "./module-surface";
import type { DecisionProvenance } from "./provenance";
import type { PosteriorFactValue } from "./posterior";
import type { TeachingProjection } from "./teaching-projection";
import type { EvaluatedFacts } from "./fact-catalog";

/** Summary of posterior engine results from the most recent suggest() call. */
export interface PosteriorSummary {
  readonly factValues: readonly PosteriorFactValue[];
  readonly sampleCount: number;
  readonly confidence: number;
}

/** Practical recommendation — what an experienced player might prefer given imperfect information.
 *  Separate from teaching grading (which is deterministic and unchanged by this). */
export interface PracticalRecommendation {
  readonly topCandidateBidName: string;
  readonly topCandidateCall: Call;
  readonly topScore: number;
  readonly rationale: string;
}

/** Lightweight DTO for convention machine state — avoids importing from conventions/core. */
export interface MachineDebugSnapshot {
  readonly currentStateId: string;
  readonly stateHistory: readonly string[];
  readonly transitionHistory: readonly string[];
  readonly activeSurfaceGroupIds: readonly string[];
  readonly registers: MachineRegisters;
  readonly diagnostics: readonly { readonly level: string; readonly message: string; readonly moduleId?: string }[];
  readonly handoffTraces: readonly { readonly fromModuleId: string; readonly toModuleId: string; readonly reason: string }[];
  readonly submachineStack: readonly { readonly parentMachineId: string; readonly returnStateId: string }[];
}

/** Unified evaluation snapshot — all pipeline outputs from the most recent suggest() call. */
export interface StrategyEvaluation {
  /** Practical recommendation (what an experienced player might prefer). Null when not produced. */
  readonly practicalRecommendation: PracticalRecommendation | null;
  /** Convention-level alternative groups for teaching grading. Undefined if not configured. */
  readonly acceptableAlternatives: readonly AlternativeGroup[] | undefined;
  /** Convention-level intent families for relationship-aware grading. Undefined if not configured. */
  readonly intentFamilies: readonly IntentFamily[] | undefined;
  /** Provenance from the meaning-pipeline evaluation. Null when not produced. */
  readonly provenance: DecisionProvenance | null;
  /** Full arbitration result from the meaning-pipeline evaluation. Null when not produced. */
  readonly arbitration: ArbitrationResult | null;
  /** Posterior summary. Null when posterior engine not wired. */
  readonly posteriorSummary: PosteriorSummary | null;
  /** Explanation catalog for enriching teaching projections. Undefined when not available. */
  readonly explanationCatalog: ExplanationCatalogIR | undefined;
  /** Teaching projection from the meaning-pipeline evaluation. Null when not produced. */
  readonly teachingProjection: TeachingProjection | null;
  /** Evaluated facts from the pipeline evaluation. Null before first evaluation. */
  readonly facts: EvaluatedFacts | null;
  /** Machine/protocol state from the evaluation. Null when no machine is wired. */
  readonly machineSnapshot: MachineDebugSnapshot | null;
}

/** Extended strategy interface for convention-based strategies that produce practical recommendations.
 *  Returns the full evaluation snapshot from the most recent suggest() call (null before first suggest()). */
export interface ConventionBiddingStrategy extends BiddingStrategy {
  getLastEvaluation(): StrategyEvaluation | null;
}
