// Minimal test helpers for meaning pipeline tests.

import type { Call } from "../../../../engine/types";
import { BidSuit } from "../../../../engine/types";
import type { MeaningProposal } from "../../../../core/contracts/meaning";
import type { ArbitrationInput } from "../meaning-arbitrator";
import type { CandidateEligibility } from "../../../../core/contracts/tree-evaluation";
import { makeCall, makePass, makeRanking } from "../../../../test-support/convention-factories";

// Re-export shared factories so existing consumers don't break.
export { makeCall, makePass, makeRanking };

export function makeEligibility(overrides?: {
  hand?: Partial<CandidateEligibility["hand"]>;
  protocol?: Partial<CandidateEligibility["protocol"]>;
  encoding?: Partial<CandidateEligibility["encoding"]>;
  pedagogical?: Partial<CandidateEligibility["pedagogical"]>;
}): CandidateEligibility {
  return {
    hand: { satisfied: true, failedConditions: [], ...overrides?.hand },
    protocol: { satisfied: true, reasons: [], ...overrides?.protocol },
    encoding: { legal: true, ...overrides?.encoding },
    pedagogical: { acceptable: true, reasons: [], ...overrides?.pedagogical },
  };
}

export function makeMeaningProposal(
  overrides?: Partial<MeaningProposal> & { allSatisfied?: boolean },
): MeaningProposal {
  const { allSatisfied = true, ...rest } = overrides ?? {};
  return {
    meaningId: "test:meaning",
    moduleId: "test",
    clauses: [{
      factId: "hand.hcp",
      operator: "gte",
      value: 8,
      satisfied: allSatisfied,
      description: "8+ HCP",
    }],
    ranking: makeRanking(),
    evidence: {
      factDependencies: ["hand.hcp"],
      evaluatedConditions: [{ name: "hcp", passed: allSatisfied, description: "8+ HCP" }],
      provenance: { moduleId: "test", nodeName: "test-node", origin: "tree" },
    },
    sourceIntent: { type: "test-intent", params: {} },
    ...rest,
  };
}

export function makeArbitrationInput(
  proposalOverrides?: Partial<MeaningProposal> & { allSatisfied?: boolean },
  call: Call = makeCall(2, BidSuit.Clubs),
): ArbitrationInput {
  return {
    proposal: makeMeaningProposal(proposalOverrides),
    surface: { encoding: { defaultCall: call } },
  };
}
