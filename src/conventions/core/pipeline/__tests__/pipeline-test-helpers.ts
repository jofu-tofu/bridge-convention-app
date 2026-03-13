// Minimal test helpers for meaning pipeline tests.

import type { Call } from "../../../../engine/types";
import { BidSuit } from "../../../../engine/types";
import type { MeaningProposal, RankingMetadata } from "../../../../core/contracts/meaning";
import type { ArbitrationInput } from "../meaning-arbitrator";
import type { CandidateEligibility } from "../../../../core/contracts/evaluation-dtos";

export function makeCall(level: 1 | 2 | 3 | 4 | 5 | 6 | 7 = 1, strain: BidSuit = BidSuit.Clubs): Call {
  return { type: "bid", level, strain };
}

export function makePass(): Call {
  return { type: "pass" };
}

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

export function makeRanking(overrides?: Partial<RankingMetadata>): RankingMetadata {
  return {
    recommendationBand: "should",
    specificity: 1,
    modulePrecedence: 0,
    intraModuleOrder: 0,
    ...overrides,
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
