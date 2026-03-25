import type { Call } from "../../../engine/types";
import type { ConditionEvidence } from "../evidence-bundle";

/** Kind of encoder used for call assignment. */
export type EncoderKind = "default-call" | "resolver" | "alternate-encoding" | "frontier-step" | "relay-map";

/** Full decision provenance — why this candidate was selected. */
export interface DecisionProvenance {
  /** Applicability evidence for the winning candidate. */
  readonly applicability: ApplicabilityEvidence;
  /** Module activation traces (which modules were live and why). */
  readonly activation: readonly ActivationTrace[];
  /** Encoding traces (how meanings became concrete calls). */
  readonly encoding: readonly EncodingTrace[];
  /** Legality traces (which calls were legal/illegal). */
  readonly legality: readonly LegalityTrace[];
  /** Arbitration traces (truth-set, ranking inputs per candidate). */
  readonly arbitration: readonly ArbitrationTrace[];
  /** Elimination traces (why candidates were dropped). */
  readonly eliminations: readonly EliminationTrace[];
  /** Handoff traces (module-to-module delegation). */
  readonly handoffs: readonly HandoffTrace[];
}

/** Evidence for why a candidate's conditions were or weren't satisfied. */
export interface ApplicabilityEvidence {
  readonly factDependencies: readonly string[];
  readonly evaluatedConditions: readonly ConditionEvidence[];
}

/** Trace of a candidate eliminated during the pipeline. */
export interface EliminationTrace {
  /** meaningId or callRef of the eliminated candidate. */
  readonly candidateId: string;
  /** Pipeline stage where elimination occurred. */
  readonly stage: "activation" | "applicability" | "encoding" | "legality" | "arbitration";
  /** Human-readable reason for elimination. */
  readonly reason: string;
  /** Supporting evidence (evaluated conditions). */
  readonly evidence: readonly ConditionEvidence[];
  /** How definitive is this elimination? */
  readonly strength: "hard" | "entailed" | "preference";
}

/** Trace of module activation/deactivation. */
export interface ActivationTrace {
  readonly moduleId: string;
  readonly activated: boolean;
  readonly matchedPattern?: string;
  readonly reason?: string;
}

/** Arbitration trace per candidate — truth-set membership, ranking inputs. */
export interface ArbitrationTrace {
  readonly candidateId: string;
  readonly truthSetMember: boolean;
  readonly acceptableSetMember: boolean;
  readonly recommendationRank?: number;
  readonly rankingInputs: {
    readonly recommendationBand: number;
    readonly handFitScore?: number;
    readonly modulePrecedence: number;
    readonly specificity: number;
  };
}

/** How a meaning was encoded into a concrete call. */
export interface EncodingTrace {
  readonly encoderId: string;
  readonly encoderKind: EncoderKind;
  readonly consideredCalls: readonly Call[];
  readonly chosenCall?: Call;
  readonly blockedCalls: readonly { readonly call: Call; readonly reason: string }[];
}

/** Legality check trace for a specific call. */
export interface LegalityTrace {
  readonly call: Call;
  readonly legal: boolean;
  readonly reason?: string;
}

/** Module-to-module handoff trace. */
export interface HandoffTrace {
  readonly fromModuleId: string;
  readonly toModuleId: string;
  readonly reason: string;
}
