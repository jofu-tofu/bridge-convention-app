import type { Call } from "../../engine/types";
import type { CandidateEligibility } from "./tree-evaluation";
import type { ForcingState } from "./bidding";
import type { MeaningProposal, TransformTrace } from "./meaning";
import type { DecisionProvenance } from "./provenance";
import type { MeaningSurface } from "./meaning-surface";
import type { PublicEvent, PublicConstraint } from "./agreement-module";
import type { BeliefView, LatentBranchSet } from "./posterior";
import type { EvidenceBundleIR } from "./evidence-bundle";

/** Hand-independent public state derived from conversation machine registers.
 *  Pure DTO — caller extracts fields from machine state to avoid
 *  contracts/ importing from conventions/. */
export interface PublicSnapshot {
  readonly activeModuleIds: readonly string[];
  readonly forcingState: ForcingState;
  readonly obligation: {
    readonly kind: string;
    readonly obligatedSide: "opener" | "responder";
  };
  readonly agreedStrain: {
    readonly type: "none" | "suit" | "notrump";
    readonly suit?: string;
    readonly confidence?: "tentative" | "agreed" | "forced";
  };
  readonly competitionMode: string;
  readonly captain: string;
  readonly systemCapabilities: Readonly<Record<string, string>>;
  readonly publicRegisters: Readonly<Record<string, unknown>>;
  readonly publicRecord?: readonly PublicEvent[];
  readonly publicCommitments?: readonly PublicConstraint[];
  readonly publicBeliefs?: readonly BeliefView[];
  readonly latentBranches?: readonly LatentBranchSet[];
}

/** One module's evaluation output. */
export interface ModuleSurface {
  readonly moduleId: string;
  readonly active: boolean;
  readonly activationReason: string;
  readonly proposals: readonly MeaningProposal[];
  readonly localRegisters: Readonly<Record<string, unknown>>;
  readonly capabilities: readonly string[];
}

/** Aggregation of all module surfaces. */
export interface MultiModuleSurface {
  readonly modules: readonly ModuleSurface[];
  readonly allProposals: readonly MeaningProposal[];
  readonly publicSnapshot: PublicSnapshot;
}

/** Meaning after call assignment. */
export interface EncodedProposal {
  readonly proposal: MeaningProposal;
  readonly call: Call;
  readonly isDefaultEncoding: boolean;
  readonly legal: boolean;
  readonly allEncodings: readonly {
    readonly call: Call;
    readonly legal: boolean;
  }[];
  readonly eligibility: CandidateEligibility;
}

/** Gate attribution for eliminated candidates. */
export interface EliminationRecord {
  readonly candidateBidName: string;
  readonly moduleId: string;
  readonly reason: string;
  readonly gateId?: string;
}

/** Arbitration result after all gates and dedup. */
export interface ArbitrationResult {
  readonly selected: EncodedProposal | null;
  readonly truthSet: readonly EncodedProposal[];
  readonly acceptableSet: readonly EncodedProposal[];
  readonly recommended: readonly EncodedProposal[];
  readonly eliminations: readonly EliminationRecord[];
  readonly transformTraces?: readonly TransformTrace[];
  readonly provenance?: DecisionProvenance;
  readonly evidenceBundle?: EvidenceBundleIR;
}

/** Build a PublicSnapshot from machine state fields.
 *  Takes plain fields to avoid importing from conventions/. */
/** Result of upstream surface composition (transform application before pipeline). */
export interface SurfaceEvaluationResult {
  readonly composedSurfaces: readonly MeaningSurface[];
  readonly appliedTransforms: readonly TransformApplication[];
  readonly diagnostics: readonly SurfaceCompositionDiagnostic[];
}

/** Record of a single transform applied during surface composition. */
export interface TransformApplication extends TransformTrace {
  readonly affectedMeaningIds: readonly string[];
}

/** Diagnostic emitted during surface composition. */
export interface SurfaceCompositionDiagnostic {
  readonly level: "info" | "warn";
  readonly message: string;
}

export function buildPublicSnapshot(params: {
  activeModuleIds: readonly string[];
  forcingState: ForcingState;
  obligation: {
    kind: string;
    obligatedSide: "opener" | "responder";
  };
  agreedStrain: {
    type: "none" | "suit" | "notrump";
    suit?: string;
    confidence?: "tentative" | "agreed" | "forced";
  };
  competitionMode: string;
  captain: string;
  systemCapabilities?: Readonly<Record<string, string>>;
  conventionData?: Readonly<Record<string, unknown>>;
  publicRecord?: readonly PublicEvent[];
  publicCommitments?: readonly PublicConstraint[];
  publicBeliefs?: readonly BeliefView[];
}): PublicSnapshot {
  return {
    activeModuleIds: params.activeModuleIds,
    forcingState: params.forcingState,
    obligation: params.obligation,
    agreedStrain: params.agreedStrain,
    competitionMode: params.competitionMode,
    captain: params.captain,
    systemCapabilities: params.systemCapabilities ?? {},
    publicRegisters: params.conventionData ?? {},
    publicRecord: params.publicRecord,
    publicCommitments: params.publicCommitments,
    publicBeliefs: params.publicBeliefs,
  };
}
