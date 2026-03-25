import type { BiddingStrategy } from "../core/strategy-types";
import type { MachineRegisters } from "../core/module-surface";
import type { PipelineResult } from "./pipeline-types";
import type { HandoffTrace } from "./evaluation/provenance";
import type { TeachingProjection } from "../teaching/teaching-types";
import type { PracticalRecommendation, PosteriorSummary } from "../core/strategy-types";
import type { SurfaceGroup } from "../teaching/teaching-types";
import type { ExplanationCatalog } from "../core/explanation-catalog";
import type { EvaluatedFacts } from "../core/fact-catalog";
import type { AuctionContext } from "../core/committed-step";

/** Lightweight DTO for convention machine state — avoids importing from conventions/core. */
export interface MachineDebugSnapshot {
  readonly currentStateId: string;
  readonly stateHistory: readonly string[];
  readonly transitionHistory: readonly string[];
  readonly activeSurfaceGroupIds: readonly string[];
  readonly registers: MachineRegisters;
  readonly diagnostics: readonly { readonly level: string; readonly message: string; readonly moduleId?: string }[];
  readonly handoffTraces: readonly HandoffTrace[];
  readonly submachineStack: readonly { readonly parentMachineId: string; readonly returnStateId: string }[];
}

/** Unified evaluation snapshot — all pipeline outputs from the most recent suggest() call. */
export interface StrategyEvaluation {
  /** Practical recommendation (what an experienced player might prefer). Null when not produced. */
  readonly practicalRecommendation: PracticalRecommendation | null;
  /** Convention-level surface groups for relationship-aware grading. Null if not configured. */
  readonly surfaceGroups: readonly SurfaceGroup[] | null;
  /** Full pipeline result from the meaning-pipeline evaluation. Null when not produced. */
  readonly pipelineResult: PipelineResult | null;
  /** Posterior summary. Null when posterior engine not wired. */
  readonly posteriorSummary: PosteriorSummary | null;
  /** Explanation catalog for enriching teaching projections. Null when not available. */
  readonly explanationCatalog: ExplanationCatalog | null;
  /** Teaching projection from the meaning-pipeline evaluation. Null when not produced. */
  readonly teachingProjection: TeachingProjection | null;
  /** Evaluated facts from the pipeline evaluation. Null before first evaluation. */
  readonly facts: EvaluatedFacts | null;
  /** Machine/protocol state from the evaluation. Null when no machine is wired. */
  readonly machineSnapshot: MachineDebugSnapshot | null;
  /** Observation log and snapshot for rule-based surface selection. Null when not produced. */
  readonly auctionContext: AuctionContext | null;
}

/** Extended strategy interface for convention-based strategies that produce practical recommendations.
 *  Returns the full evaluation snapshot from the most recent suggest() call (null before first suggest()). */
export interface ConventionStrategy extends BiddingStrategy {
  getLastEvaluation(): StrategyEvaluation | null;
}
