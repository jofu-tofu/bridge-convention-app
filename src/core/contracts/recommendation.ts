import type { Call } from "../../engine/types";
import type { BiddingStrategy } from "./bidding";
import type { AlternativeGroup, IntentFamily } from "./tree-evaluation";
import type { ExplanationCatalogIR } from "./explanation-catalog";
import type { ArbitrationResult } from "./module-surface";
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
  readonly registers: {
    readonly forcingState: string;
    readonly obligation: { readonly kind: string; readonly obligatedSide: string };
    readonly agreedStrain: { readonly type: string; readonly suit?: string; readonly confidence?: string };
    readonly competitionMode: string;
    readonly captain: string;
    readonly systemCapabilities: Readonly<Record<string, string>>;
  };
  readonly diagnostics: readonly { readonly level: string; readonly message: string; readonly moduleId?: string }[];
  readonly handoffTraces: readonly { readonly fromModuleId: string; readonly toModuleId: string; readonly reason: string }[];
  readonly submachineStack: readonly { readonly parentMachineId: string; readonly returnStateId: string }[];
}

/** Extended strategy interface for convention-based strategies that produce practical recommendations.
 *  The accessor returns the recommendation from the most recent suggest() call (reset to null at start of each suggest()). */
export interface ConventionBiddingStrategy extends BiddingStrategy {
  getLastPracticalRecommendation(): PracticalRecommendation | null;
  /** Convention-level alternative groups for teaching grading.
   *  Returns the groups from the convention config, or undefined if not set. */
  getAcceptableAlternatives(): readonly AlternativeGroup[] | undefined;
  /** Convention-level intent families for relationship-aware grading.
   *  Returns the families from the convention config, or undefined if not set. */
  getIntentFamilies(): readonly IntentFamily[] | undefined;
  /** Provenance from the most recent meaning-pipeline evaluation. Null when strategy doesn't produce this. */
  getLastProvenance(): DecisionProvenance | null;
  /** Full arbitration result from the most recent meaning-pipeline evaluation. Null when strategy doesn't produce this. */
  getLastArbitration(): ArbitrationResult | null;
  /** Posterior summary from the most recent suggest() call. Null when posterior engine not wired. */
  getLastPosteriorSummary(): PosteriorSummary | null;
  /** Explanation catalog for enriching teaching projections. Undefined when not available. */
  getExplanationCatalog(): ExplanationCatalogIR | undefined;
  /** Teaching projection from the most recent meaning-pipeline evaluation. Null when strategy doesn't produce this. */
  getLastTeachingProjection(): TeachingProjection | null;
  /** Debug: evaluated facts from the most recent pipeline evaluation. */
  getLastFacts(): EvaluatedFacts | null;
  /** Debug: machine/protocol state from the most recent evaluation. */
  getLastMachineSnapshot(): MachineDebugSnapshot | null;
}
