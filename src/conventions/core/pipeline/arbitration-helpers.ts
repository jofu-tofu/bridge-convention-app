import type {
  PipelineCarrier,
} from "../../../core/contracts/module-surface";
import type { CandidateEligibility } from "../../../core/contracts/tree-evaluation";
import type {
  EliminationTrace,
  LegalityTrace,
  EncodingTrace,
} from "../../../core/contracts/provenance";
import type { Call } from "../../../engine/types";
import { BAND_PRIORITY } from "../../../core/contracts/meaning";
import { evaluateGates, type GateId } from "./gate-order";
import type { ArbitrationInput } from "./meaning-arbitrator";
import { resolveEncoding } from "./encoder-resolver";
import type { DeclaredEncoderKind } from "../../../core/contracts/agreement-module";

/** Result of evaluating a single proposal through the gate pipeline. */
export interface ProposalResult {
  /** The carrier with all per-surface data and traces attached. */
  carrier: PipelineCarrier;
  /** Whether this carrier passed all gates (eligible for truth/acceptable sets). */
  passedAllGates: boolean;
  /** Whether this should be included in the acceptable set even though gates failed. */
  addToAcceptable: boolean;
}

/**
 * Evaluate a single proposal through gate checks, eligibility building, and classification.
 */
export function evaluateProposal(
  input: ArbitrationInput,
  legalCalls?: readonly Call[],
): ProposalResult {
  const { proposal, surface } = input;
  const declaredEncoderKind: DeclaredEncoderKind = surface.encoderKind ?? "direct";
  const defaultCall = surface.encoding.defaultCall;

  // Resolve encoding based on declared encoder kind
  const encodingResult = resolveEncoding({
    encoderKind: declaredEncoderKind,
    defaultCall,
    legalCalls: legalCalls ?? [],
    encoderConfig: surface.encoderConfig,
  });

  const call = encodingResult.chosenCall ?? defaultCall;

  // Gate checks
  const semanticPassed = proposal.clauses.every((c) => c.satisfied);

  // Legality: if the encoder resolved a call, check it against legal calls.
  // If no legal calls provided, assume legal (backwards compatible).
  const legalityPassed =
    legalCalls
      ? encodingResult.chosenCall !== undefined
      : true;

  // Collect legality trace
  const provenanceLegality: LegalityTrace = {
    call,
    legal: legalityPassed,
    reason: legalityPassed ? undefined : "Call not legal in current auction",
  };

  // Collect encoding trace using encoder resolution result
  const provenanceEncoding: EncodingTrace = {
    encoderId: proposal.meaningId,
    encoderKind: encodingResult.encoderKind,
    consideredCalls: encodingResult.consideredCalls,
    chosenCall: encodingResult.chosenCall,
    blockedCalls: encodingResult.blockedCalls,
  };

  const checks: { gateId: GateId; passed: boolean; reason?: string }[] = [
    {
      gateId: "semantic-applicability",
      passed: semanticPassed,
      reason: semanticPassed
        ? undefined
        : "One or more clauses not satisfied",
    },
    {
      // Obligation enforcement is handled at the strategy-chain level (createForcingFilter),
      // not in pipeline gates.
      gateId: "obligation-satisfaction",
      passed: true,
    },
    {
      // Encoder availability is subsumed by the concrete-legality gate's check of
      // encodingResult.chosenCall.
      gateId: "encoder-availability",
      passed: true,
    },
    {
      gateId: "concrete-legality",
      passed: legalityPassed,
      reason: legalityPassed ? undefined : "Call not legal in current auction",
    },
  ];

  const gateResult = evaluateGates(checks);

  const unsatisfiedClauses = proposal.clauses.filter((c) => !c.satisfied);
  const failedConditions = unsatisfiedClauses.map((c) => ({
    name: c.factId,
    description: c.description,
  }));
  const failedEvidenceConditions = unsatisfiedClauses.map((c) => ({
    conditionId: c.factId,
    factId: c.factId,
    satisfied: false as const,
    observedValue: c.observedValue,
    threshold: c.value,
  }));

  const eligibility: CandidateEligibility = {
    hand: {
      satisfied: semanticPassed,
      failedConditions,
    },
    encoding: {
      legal: legalityPassed,
      reason: legalityPassed ? undefined : "illegal_in_auction",
    },
    pedagogical: {
      acceptable: true,
      reasons: [],
    },
  };

  if (gateResult.passedAll) {
    const carrier: PipelineCarrier = {
      proposal,
      call,
      isDefaultEncoding: true,
      legal: legalityPassed,
      allEncodings: [{ call, legal: legalityPassed }],
      eligibility,
      traces: {
        encoding: provenanceEncoding,
        legality: provenanceLegality,
      },
    };
    return { carrier, passedAllGates: true, addToAcceptable: false };
  }

  // Gate failed — build elimination trace
  const failedGate = gateResult.results.find((r) => !r.passed);
  const eliminationStage: EliminationTrace["stage"] =
    failedGate?.gateId === "semantic-applicability" ? "applicability"
      : failedGate?.gateId === "concrete-legality" ? "legality"
        : "arbitration";
  const eliminationTrace: EliminationTrace = {
    candidateId: proposal.meaningId,
    stage: eliminationStage,
    reason: failedGate?.reason ?? "Gate check failed",
    evidence: failedEvidenceConditions,
    strength: eliminationStage === "legality" ? "hard" : "entailed",
  };

  // Check if it belongs in the acceptable set:
  // semantic failed but band is "may" or better, and legality passes
  let addToAcceptable = false;
  if (!semanticPassed && legalityPassed) {
    const bandValue = BAND_PRIORITY[proposal.ranking.recommendationBand];
    if (bandValue <= BAND_PRIORITY["may"]) {
      addToAcceptable = true;
    }
  }

  const carrier: PipelineCarrier = {
    proposal,
    call,
    isDefaultEncoding: true,
    legal: legalityPassed,
    allEncodings: [{ call, legal: legalityPassed }],
    eligibility,
    traces: {
      encoding: provenanceEncoding,
      legality: provenanceLegality,
      elimination: eliminationTrace,
    },
  };

  return { carrier, passedAllGates: false, addToAcceptable };
}

/**
 * Split carriers into truth (hand satisfied + legal) and acceptable
 * (hand not satisfied + legal) partitions.
 */
export function classifyIntoSets(carriers: readonly PipelineCarrier[]): {
  truthSet: readonly PipelineCarrier[];
  acceptableSet: readonly PipelineCarrier[];
} {
  const truthSet = carriers.filter(
    (c) =>
      c.eligibility.hand.satisfied && c.eligibility.encoding.legal,
  );

  const acceptableSet = carriers.filter(
    (c) =>
      !c.eligibility.hand.satisfied && c.eligibility.encoding.legal,
  );

  return { truthSet, acceptableSet };
}
