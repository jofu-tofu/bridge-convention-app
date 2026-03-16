import { describe, it, expect } from "vitest";
import { BidSuit } from "../../engine/types";
import type { Call } from "../../engine/types";
import { buildMeaningViews } from "../meaning-view-builder";
import type {
  ArbitrationResult,
  EncodedProposal,
  EliminationRecord,
} from "../../core/contracts/module-surface";
import type {
  RankingMetadata,
  MeaningClause,
  MeaningProposal,
} from "../../core/contracts/meaning";
import type { DecisionProvenance } from "../../core/contracts/provenance";
import type { CandidateEligibility } from "../../core/contracts/tree-evaluation";

// -- Factories --

function makeCall(level: 1 | 2 | 3 | 4 | 5 | 6 | 7, strain: BidSuit): Call {
  return { type: "bid", level, strain };
}

function makeRanking(overrides: Partial<RankingMetadata> = {}): RankingMetadata {
  return {
    recommendationBand: "should",
    specificity: 1,
    modulePrecedence: 1,
    intraModuleOrder: 1,
    ...overrides,
  };
}

function makeClause(overrides: Partial<MeaningClause> = {}): MeaningClause {
  return {
    factId: "hand.hcp",
    operator: "gte",
    value: 15,
    satisfied: true,
    description: "HCP >= 15",
    ...overrides,
  };
}

function makeProposal(overrides: Partial<MeaningProposal> = {}): MeaningProposal {
  return {
    meaningId: "stayman:ask-major",
    moduleId: "stayman",
    clauses: [makeClause()],
    ranking: makeRanking(),
    evidence: {
      factDependencies: ["hand.hcp"],
      evaluatedConditions: [{ conditionId: "hand.hcp", satisfied: true, description: "HCP >= 15" }],
      provenance: { moduleId: "stayman", nodeName: "ask-major", origin: "tree" },
    },
    sourceIntent: { type: "AskForMajor", params: {} },
    ...overrides,
  };
}

function makeEligibility(overrides: Partial<CandidateEligibility> = {}): CandidateEligibility {
  return {
    hand: { satisfied: true, failedConditions: [] },
    encoding: { legal: true },
    pedagogical: { acceptable: true, reasons: [] },
    ...overrides,
  };
}

function makeEncoded(overrides: Partial<EncodedProposal> = {}): EncodedProposal {
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

function makeArbitration(overrides: Partial<ArbitrationResult> = {}): ArbitrationResult {
  return {
    selected: null,
    truthSet: [],
    acceptableSet: [],
    recommended: [],
    eliminations: [],
    ...overrides,
  };
}

function makeProvenance(overrides: Partial<DecisionProvenance> = {}): DecisionProvenance {
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

// -- Tests --

describe("buildMeaningViews", () => {
  it("truth set entries produce status 'live' with supportingEvidence from clauses", () => {
    const encoded = makeEncoded({
      proposal: makeProposal({
        meaningId: "stayman:ask-major",
        semanticClassId: "bridge:major-explore",
        clauses: [
          makeClause({ factId: "hand.hcp", satisfied: true, observedValue: 16 }),
          makeClause({ factId: "hand.shape", satisfied: true, observedValue: "balanced" }),
        ],
      }),
    });
    const arbitration = makeArbitration({ truthSet: [encoded] });
    const provenance = makeProvenance();

    const views = buildMeaningViews(arbitration, provenance);

    expect(views).toHaveLength(1);
    expect(views[0]!.meaningId).toBe("stayman:ask-major");
    expect(views[0]!.semanticClassId).toBe("bridge:major-explore");
    expect(views[0]!.status).toBe("live");
    expect(views[0]!.supportingEvidence).toHaveLength(2);
    expect(views[0]!.supportingEvidence[0]!.conditionId).toBe("hand.hcp");
    expect(views[0]!.supportingEvidence[0]!.satisfied).toBe(true);
    expect(views[0]!.supportingEvidence[1]!.conditionId).toBe("hand.shape");
  });

  it("eliminated meanings produce status 'eliminated' with eliminationReason", () => {
    const eliminations: EliminationRecord[] = [
      {
        candidateBidName: "transfer:hearts",
        moduleId: "jacoby-transfers",
        reason: "One or more clauses not satisfied",
        gateId: "semantic-applicability",
      },
    ];
    const provenance = makeProvenance({
      eliminations: [
        {
          candidateId: "transfer:hearts",
          stage: "applicability",
          reason: "One or more clauses not satisfied",
          evidence: [{ conditionId: "hand.suitLength.hearts", satisfied: false }],
          strength: "entailed",
        },
      ],
    });
    const arbitration = makeArbitration({ eliminations });

    const views = buildMeaningViews(arbitration, provenance);

    expect(views).toHaveLength(1);
    expect(views[0]!.meaningId).toBe("transfer:hearts");
    expect(views[0]!.status).toBe("eliminated");
    expect(views[0]!.eliminationReason).toBe("One or more clauses not satisfied");
    expect(views[0]!.supportingEvidence).toHaveLength(1);
    expect(views[0]!.supportingEvidence[0]!.conditionId).toBe("hand.suitLength.hearts");
    expect(views[0]!.supportingEvidence[0]!.satisfied).toBe(false);
  });

  it("acceptable-but-not-truth entries produce status 'eliminated' with generic reason", () => {
    const acceptableEncoded = makeEncoded({
      proposal: makeProposal({
        meaningId: "nt:invite",
        clauses: [makeClause({ factId: "hand.hcp", satisfied: false })],
      }),
    });
    const arbitration = makeArbitration({ acceptableSet: [acceptableEncoded] });
    const provenance = makeProvenance();

    const views = buildMeaningViews(arbitration, provenance);

    expect(views).toHaveLength(1);
    expect(views[0]!.meaningId).toBe("nt:invite");
    expect(views[0]!.status).toBe("eliminated");
    expect(views[0]!.eliminationReason).toBe("Hand conditions not fully satisfied");
  });

  it("same meaningId in truth and eliminated — only truth appears (deduplication)", () => {
    const encoded = makeEncoded({
      proposal: makeProposal({ meaningId: "stayman:ask-major" }),
    });
    const eliminations: EliminationRecord[] = [
      {
        candidateBidName: "stayman:ask-major",
        moduleId: "stayman",
        reason: "Duplicate",
        gateId: "dedup",
      },
    ];
    const arbitration = makeArbitration({
      truthSet: [encoded],
      eliminations,
    });
    const provenance = makeProvenance();

    const views = buildMeaningViews(arbitration, provenance);

    expect(views).toHaveLength(1);
    expect(views[0]!.status).toBe("live");
    expect(views[0]!.meaningId).toBe("stayman:ask-major");
  });

  it("same meaningId in truth and acceptable — only truth appears", () => {
    const truthEncoded = makeEncoded({
      proposal: makeProposal({ meaningId: "stayman:ask-major" }),
    });
    const acceptableEncoded = makeEncoded({
      proposal: makeProposal({ meaningId: "stayman:ask-major" }),
    });
    const arbitration = makeArbitration({
      truthSet: [truthEncoded],
      acceptableSet: [acceptableEncoded],
    });
    const provenance = makeProvenance();

    const views = buildMeaningViews(arbitration, provenance);

    const matchingViews = views.filter(v => v.meaningId === "stayman:ask-major");
    expect(matchingViews).toHaveLength(1);
    expect(matchingViews[0]!.status).toBe("live");
  });

  it("displayLabel falls back to meaningId when teachingLabel is absent", () => {
    const encoded = makeEncoded({
      proposal: makeProposal({
        meaningId: "stayman:ask-major",
        teachingLabel: undefined,
      }),
    });
    const arbitration = makeArbitration({ truthSet: [encoded] });
    const provenance = makeProvenance();

    const views = buildMeaningViews(arbitration, provenance);

    expect(views[0]!.displayLabel).toBe("stayman:ask-major");
  });

  it("displayLabel uses teachingLabel when present", () => {
    const encoded = makeEncoded({
      proposal: makeProposal({
        meaningId: "stayman:ask-major",
        teachingLabel: "Stayman — Ask for a 4-card major",
      }),
    });
    const arbitration = makeArbitration({ truthSet: [encoded] });
    const provenance = makeProvenance();

    const views = buildMeaningViews(arbitration, provenance);

    expect(views[0]!.displayLabel).toBe("Stayman — Ask for a 4-card major");
  });

  it("clauseToEvidence correctly maps clause fields to ConditionEvidenceIR", () => {
    const encoded = makeEncoded({
      proposal: makeProposal({
        clauses: [
          makeClause({
            factId: "hand.hcp",
            satisfied: true,
            observedValue: 17,
          }),
        ],
      }),
    });
    const arbitration = makeArbitration({ truthSet: [encoded] });
    const provenance = makeProvenance();

    const views = buildMeaningViews(arbitration, provenance);

    const evidence = views[0]!.supportingEvidence[0]!;
    expect(evidence.conditionId).toBe("hand.hcp");
    expect(evidence.satisfied).toBe(true);
    expect(evidence.factId).toBe("hand.hcp");
    expect(evidence.observedValue).toBe(17);
  });

  it("empty truth set, empty eliminations, empty acceptable set produce empty array", () => {
    const arbitration = makeArbitration({
      truthSet: [],
      eliminations: [],
      acceptableSet: [],
    });
    const provenance = makeProvenance();

    const views = buildMeaningViews(arbitration, provenance);

    expect(views).toEqual([]);
  });
});
