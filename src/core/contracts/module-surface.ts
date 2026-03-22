import type { Call } from "../../engine/types";
import type { CandidateEligibility } from "./tree-evaluation";
import type { ForcingState } from "./bidding";
import type { MeaningProposal } from "./meaning";
import type { DecisionProvenance } from "./provenance";
import type {
  ApplicabilityEvidence,
  ActivationTrace,
  ArbitrationTrace,
  EncodingTrace,
  HandoffTrace,
  LegalityTrace,
  EliminationTrace,
} from "./provenance";
import type { BidMeaning } from "./meaning";
import type { PublicEvent, PublicConstraint } from "./agreement-module";
import type { LatentBranchSet } from "./posterior";
import type { EvidenceBundle } from "./evidence-bundle";

/** Conversation machine register state — shared by PublicSnapshot and debug views. */
export interface MachineRegisters {
  readonly forcingState: ForcingState;
  readonly obligation: {
    readonly kind: string;
    readonly obligatedSide: "opener" | "responder";
  };
  readonly agreedStrain: {
    readonly type: "none" | "suit" | "notrump";
    readonly suit?: string;
    readonly confidence?: string;
  };
  readonly competitionMode: string;
  readonly captain: string;
  readonly systemCapabilities: Readonly<Record<string, string>>;
}

/** Hand-independent public state derived from conversation machine registers.
 *  Pure DTO — caller extracts fields from machine state to avoid
 *  contracts/ importing from conventions/. */
export interface PublicSnapshot extends MachineRegisters {
  readonly activeModuleIds: readonly string[];
  readonly publicRegisters: Readonly<Record<string, unknown>>;
  readonly publicRecord?: readonly PublicEvent[];
  readonly publicCommitments?: readonly PublicConstraint[];
  readonly latentBranches?: readonly LatentBranchSet[];
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
  readonly provenance?: DecisionProvenance;
  readonly evidenceBundle?: EvidenceBundle;
}

/** A surface carried through the entire pipeline with its per-surface traces attached. */
export interface PipelineCarrier {
  readonly proposal: MeaningProposal;
  readonly call: Call;
  readonly isDefaultEncoding: boolean;
  readonly legal: boolean;
  readonly allEncodings: readonly { readonly call: Call; readonly legal: boolean }[];
  readonly eligibility: CandidateEligibility;
  readonly traces: {
    readonly encoding: EncodingTrace;
    readonly legality: LegalityTrace;
    readonly elimination?: EliminationTrace;
  };
}

/** Complete pipeline result — per-surface data on carriers, cross-surface provenance at top level. */
export interface PipelineResult {
  readonly selected: PipelineCarrier | null;
  readonly truthSet: readonly PipelineCarrier[];
  readonly acceptableSet: readonly PipelineCarrier[];
  readonly recommended: readonly PipelineCarrier[];
  readonly eliminated: readonly PipelineCarrier[];
  readonly applicability: ApplicabilityEvidence;
  readonly activation: readonly ActivationTrace[];
  readonly arbitration: readonly ArbitrationTrace[];
  readonly handoffs: readonly HandoffTrace[];
  readonly evidenceBundle?: EvidenceBundle;
}

/** Build a PublicSnapshot from machine state fields.
 *  Takes plain fields to avoid importing from conventions/. */

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
    confidence?: string;
  };
  competitionMode: string;
  captain: string;
  systemCapabilities?: Readonly<Record<string, string>>;
  conventionData?: Readonly<Record<string, unknown>>;
  publicRecord?: readonly PublicEvent[];
  publicCommitments?: readonly PublicConstraint[];
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
  };
}
