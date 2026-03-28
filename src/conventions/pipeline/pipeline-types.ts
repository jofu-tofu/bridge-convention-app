import type { Call } from "../../engine/types";
import type { CandidateEligibility } from "./tree-evaluation";
import type { MeaningProposal } from "./evaluation/meaning";
import type { DecisionProvenance } from "./evaluation/provenance";
import type {
  ApplicabilityEvidence,
  ActivationTrace,
  ArbitrationTrace,
  EncodingTrace,
  HandoffTrace,
  LegalityTrace,
  EliminationTrace,
} from "./evaluation/provenance";
import type { EvidenceBundle } from "./evidence-bundle";

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
export interface PipelineCarrier extends EncodedProposal {
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
