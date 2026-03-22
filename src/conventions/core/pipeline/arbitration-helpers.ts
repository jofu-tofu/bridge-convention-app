import type {
  EncodedProposal,
  EliminationRecord,
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
interface ProposalResult {
  encoded?: EncodedProposal;
  elimination?: EliminationRecord;
  provenanceElimination?: EliminationTrace;
  provenanceLegality: LegalityTrace;
  provenanceEncoding: EncodingTrace;
  /** Whether this should be added to encoded array even though eliminated (for acceptableSet). */
  addToEncoded: boolean;
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

  const encodedProposal: EncodedProposal = {
    proposal,
    call,
    isDefaultEncoding: true,
    legal: legalityPassed,
    allEncodings: [{ call, legal: legalityPassed }],
    eligibility,
  };

  if (gateResult.passedAll) {
    return {
      encoded: encodedProposal,
      provenanceLegality,
      provenanceEncoding,
      addToEncoded: true,
    };
  }

  // Gate failed — build elimination
  const failedGate = gateResult.results.find((r) => !r.passed);
  const elimination: EliminationRecord = {
    candidateBidName: proposal.meaningId,
    moduleId: proposal.moduleId,
    reason: failedGate?.reason ?? "Gate check failed",
    gateId: failedGate?.gateId,
  };

  // Provenance elimination trace
  const eliminationStage: EliminationTrace["stage"] =
    failedGate?.gateId === "semantic-applicability" ? "applicability"
      : failedGate?.gateId === "concrete-legality" ? "legality"
        : "arbitration";
  const provenanceElimination: EliminationTrace = {
    candidateId: proposal.meaningId,
    stage: eliminationStage,
    reason: failedGate?.reason ?? "Gate check failed",
    evidence: failedEvidenceConditions,
    strength: eliminationStage === "legality" ? "hard" : "entailed",
  };

  // Check if it belongs in the acceptable set:
  // semantic failed but band is "may" or better, and legality passes
  let addToEncoded = false;
  if (!semanticPassed && legalityPassed) {
    const bandValue = BAND_PRIORITY[proposal.ranking.recommendationBand];
    if (bandValue <= BAND_PRIORITY["may"]) {
      addToEncoded = true;
    }
  }

  return {
    encoded: addToEncoded ? encodedProposal : undefined,
    elimination,
    provenanceElimination,
    provenanceLegality,
    provenanceEncoding,
    addToEncoded,
  };
}

/**
 * Split encoded proposals into truth (hand satisfied + legal) and acceptable
 * (hand not satisfied + legal) partitions.
 */
export function classifyIntoSets(encoded: readonly EncodedProposal[]): {
  truthSet: readonly EncodedProposal[];
  acceptableSet: readonly EncodedProposal[];
} {
  const truthSet = encoded.filter(
    (e) =>
      e.eligibility.hand.satisfied && e.eligibility.encoding.legal,
  );

  const acceptableSet = encoded.filter(
    (e) =>
      !e.eligibility.hand.satisfied && e.eligibility.encoding.legal,
  );

  return { truthSet, acceptableSet };
}
