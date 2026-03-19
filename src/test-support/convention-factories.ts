/**
 * Shared test factories for convention system types.
 *
 * Consolidates duplicated makeSurface/makeArbitrationInput/buildMachine/makeRanking
 * from pipeline-test-helpers, runtime-test-helpers, and strategy-test-helpers.
 */

import { BidSuit, Seat } from "../engine/types";
import type { Call } from "../engine/types";
import type { MeaningSurface, AuthoredRankingMetadata, RankingMetadata, MeaningClause, MeaningProposal } from "../core/contracts/meaning";
import type { ArbitrationResult, EncodedProposal } from "../core/contracts/module-surface";
import type { CandidateEligibility } from "../core/contracts/tree-evaluation";
import type { DecisionProvenance } from "../core/contracts/provenance";
import type { ExplanationEntry } from "../core/contracts/explanation-catalog";
import type { ConversationMachine, MachineState } from "../conventions/core/runtime/machine-types";

/** Create a minimal MeaningSurface with override support. */
export function makeSurface(overrides: Partial<MeaningSurface> & { meaningId?: string; moduleId?: string } = {}): MeaningSurface {
  return {
    meaningId: "test:meaning",
    semanticClassId: "test:class",
    moduleId: "test",
    encoding: { defaultCall: { type: "bid", level: 2, strain: BidSuit.Clubs } },
    clauses: [],
    ranking: makeRanking(),
    sourceIntent: { type: "TestIntent", params: {} },
    teachingLabel: "Test meaning",
    ...overrides,
  } as MeaningSurface;
}

/** Create a default AuthoredRankingMetadata with override support. */
export function makeRanking(overrides?: Partial<AuthoredRankingMetadata>): AuthoredRankingMetadata {
  return {
    recommendationBand: "should",
    modulePrecedence: 0,
    intraModuleOrder: 0,
    ...overrides,
  };
}

/** Create a minimal ConversationMachine from an array of states. */
export function buildMachine(
  states: MachineState[],
  initialStateId: string,
): ConversationMachine {
  const stateMap = new Map<string, MachineState>();
  for (const s of states) {
    stateMap.set(s.stateId, s);
  }
  return {
    machineId: "test-machine",
    states: stateMap,
    initialStateId,
    seatRole: (_auction, seat, callSeat) => {
      if (seat === callSeat) return "self";
      const samePartnership =
        (seat === Seat.North || seat === Seat.South) ===
        (callSeat === Seat.North || callSeat === Seat.South);
      return samePartnership ? "partner" : "opponent";
    },
  };
}

/** Create a Call for a contract bid. */
export function makeCall(level: 1 | 2 | 3 | 4 | 5 | 6 | 7 = 1, strain: BidSuit = BidSuit.Clubs): Call {
  return { type: "bid", level, strain };
}

/** Create a pass Call. */
export function makePass(): Call {
  return { type: "pass" };
}

/** Create a RankingMetadata (with derived specificity) for teaching tests. */
export function makeRankingMetadata(overrides: Partial<RankingMetadata> = {}): RankingMetadata {
  return {
    recommendationBand: "should",
    specificity: 1,
    modulePrecedence: 1,
    intraModuleOrder: 1,
    ...overrides,
  };
}

/** Create a MeaningClause with defaults. */
export function makeClause(overrides: Partial<MeaningClause> = {}): MeaningClause {
  return {
    factId: "hand.hcp",
    operator: "gte",
    value: 15,
    satisfied: true,
    description: "HCP >= 15",
    ...overrides,
  };
}

/** Create a MeaningProposal with defaults. */
export function makeProposal(overrides: Partial<MeaningProposal> = {}): MeaningProposal {
  return {
    meaningId: "stayman:ask-major",
    moduleId: "stayman",
    clauses: [makeClause()],
    ranking: makeRankingMetadata(),
    evidence: {
      factDependencies: ["hand.hcp"],
      evaluatedConditions: [{ conditionId: "hand.hcp", satisfied: true, description: "HCP >= 15" }],
      provenance: { moduleId: "stayman", nodeName: "ask-major", origin: "tree" },
    },
    sourceIntent: { type: "AskForMajor", params: {} },
    ...overrides,
  };
}

/** Create a CandidateEligibility with defaults. */
export function makeEligibility(overrides: Partial<CandidateEligibility> = {}): CandidateEligibility {
  return {
    hand: { satisfied: true, failedConditions: [] },
    encoding: { legal: true },
    pedagogical: { acceptable: true, reasons: [] },
    ...overrides,
  };
}

/** Create an EncodedProposal with defaults. */
export function makeEncoded(overrides: Partial<EncodedProposal> = {}): EncodedProposal {
  const proposal = overrides.proposal ?? makeProposal();
  const call = overrides.call ?? makeCall(2, BidSuit.Clubs);
  return {
    proposal,
    call,
    isDefaultEncoding: true,
    legal: true,
    allEncodings: [{ call, legal: true }],
    eligibility: makeEligibility(),
    ...overrides,
  };
}

/** Create an ArbitrationResult with defaults. */
export function makeArbitration(overrides: Partial<ArbitrationResult> = {}): ArbitrationResult {
  return {
    selected: null,
    truthSet: [],
    acceptableSet: [],
    recommended: [],
    eliminations: [],
    ...overrides,
  };
}

/** Create a DecisionProvenance with defaults. */
export function makeProvenance(overrides: Partial<DecisionProvenance> = {}): DecisionProvenance {
  return {
    applicability: { factDependencies: [], evaluatedConditions: [] },
    activation: [],
    transforms: [],
    encoding: [],
    legality: [],
    arbitration: [],
    eliminations: [],
    handoffs: [],
    ...overrides,
  };
}

/** Create an ExplanationEntry with defaults. */
export function makeCatalogEntry(overrides: Partial<ExplanationEntry> = {}): ExplanationEntry {
  return {
    explanationId: "test.entry",
    templateKey: "test.entry.template",
    preferredLevel: "mechanical",
    roles: ["supporting"],
    ...overrides,
  };
}
