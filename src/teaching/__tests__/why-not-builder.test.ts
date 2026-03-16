import { describe, it, expect } from "vitest";
import { BidSuit } from "../../engine/types";
import type { Call } from "../../engine/types";
import { buildWhyNot } from "../why-not-builder";
import { buildPedagogicalGraph } from "../pedagogical-graph";
import type {
  ArbitrationResult,
  EncodedProposal,
} from "../../core/contracts/module-surface";
import type {
  RankingMetadata,
  MeaningClause,
  MeaningProposal,
} from "../../core/contracts/meaning";
import type { DecisionProvenance } from "../../core/contracts/provenance";
import type { CandidateEligibility } from "../../core/contracts/tree-evaluation";
import type { ExplanationEntry } from "../../core/contracts/explanation-catalog";
import type { PedagogicalRelation } from "../../core/contracts/teaching-projection";
import type { CatalogIndex } from "../teaching-projection-builder";

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

function makeCatalogEntry(overrides: Partial<ExplanationEntry> = {}): ExplanationEntry {
  return {
    explanationId: "test.entry",
    templateKey: "test.entry.template",
    preferredLevel: "mechanical",
    roles: ["supporting"],
    ...overrides,
  };
}

function makeCatalogIndex(
  byFactId: [string, ExplanationEntry][] = [],
  byMeaningId: [string, ExplanationEntry][] = [],
): CatalogIndex {
  return {
    byFactId: new Map(byFactId),
    byMeaningId: new Map(byMeaningId),
  };
}

// -- Tests --

describe("buildWhyNot", () => {
  it("acceptable entries matching truth call are filtered out", () => {
    const call = makeCall(2, BidSuit.Clubs);
    const truthEncoded = makeEncoded({
      proposal: makeProposal({ meaningId: "stayman:ask-major" }),
      call,
    });
    const acceptableEncoded = makeEncoded({
      proposal: makeProposal({ meaningId: "stayman:variant" }),
      call, // same call as truth
    });
    const arbitration = makeArbitration({
      truthSet: [truthEncoded],
      acceptableSet: [acceptableEncoded],
    });
    const provenance = makeProvenance();

    const entries = buildWhyNot(arbitration, provenance);

    expect(entries).toEqual([]);
  });

  it("acceptable entries not matching truth produce WhyNotEntry with grade 'near-miss'", () => {
    const truthEncoded = makeEncoded({
      proposal: makeProposal({ meaningId: "nt:game-raise" }),
      call: makeCall(3, BidSuit.NoTrump),
    });
    const nearMissEncoded = makeEncoded({
      proposal: makeProposal({ meaningId: "nt:invite" }),
      call: makeCall(2, BidSuit.NoTrump),
    });
    const arbitration = makeArbitration({
      truthSet: [truthEncoded],
      acceptableSet: [nearMissEncoded],
    });
    const provenance = makeProvenance({
      eliminations: [
        {
          candidateId: "nt:invite",
          stage: "applicability",
          reason: "HCP too low for invite",
          evidence: [{ conditionId: "hand.hcp", satisfied: false }],
          strength: "preference",
        },
      ],
    });

    const entries = buildWhyNot(arbitration, provenance);

    expect(entries).toHaveLength(1);
    expect(entries[0]!.grade).toBe("near-miss");
    expect(entries[0]!.call).toEqual(makeCall(2, BidSuit.NoTrump));
    expect(entries[0]!.eliminationStage).toBe("applicability");
  });

  it("with elimination trace, explanation includes reason text node and condition nodes", () => {
    const truthEncoded = makeEncoded({
      proposal: makeProposal({ meaningId: "nt:game-raise" }),
      call: makeCall(3, BidSuit.NoTrump),
    });
    const nearMissEncoded = makeEncoded({
      proposal: makeProposal({
        meaningId: "nt:invite",
        clauses: [makeClause({ factId: "hand.hcp", satisfied: false, description: "HCP >= 8" })],
      }),
      call: makeCall(2, BidSuit.NoTrump),
    });
    const arbitration = makeArbitration({
      truthSet: [truthEncoded],
      acceptableSet: [nearMissEncoded],
    });
    const provenance = makeProvenance({
      eliminations: [
        {
          candidateId: "nt:invite",
          stage: "applicability",
          reason: "One or more clauses not satisfied",
          evidence: [{ conditionId: "hand.hcp", satisfied: false }],
          strength: "preference",
        },
      ],
    });

    const entries = buildWhyNot(arbitration, provenance);

    expect(entries).toHaveLength(1);
    const explanation = entries[0]!.explanation;
    // First node: text with elimination reason
    const textNodes = explanation.filter(n => n.kind === "text");
    expect(textNodes).toHaveLength(1);
    expect(textNodes[0]!.content).toBe("One or more clauses not satisfied");
    // Second node: condition with evidence
    const conditionNodes = explanation.filter(n => n.kind === "condition");
    expect(conditionNodes).toHaveLength(1);
    expect(conditionNodes[0]!.passed).toBe(false);
  });

  it("without elimination trace, falls back to clause-level detail from failed clauses", () => {
    const truthEncoded = makeEncoded({
      proposal: makeProposal({ meaningId: "nt:game-raise" }),
      call: makeCall(3, BidSuit.NoTrump),
    });
    const nearMissEncoded = makeEncoded({
      proposal: makeProposal({
        meaningId: "nt:invite",
        clauses: [
          makeClause({ factId: "hand.hcp", satisfied: false, description: "HCP >= 8" }),
          makeClause({ factId: "hand.shape", satisfied: true, description: "Balanced" }),
        ],
      }),
      call: makeCall(2, BidSuit.NoTrump),
    });
    const arbitration = makeArbitration({
      truthSet: [truthEncoded],
      acceptableSet: [nearMissEncoded],
    });
    const provenance = makeProvenance(); // no elimination traces

    const entries = buildWhyNot(arbitration, provenance);

    expect(entries).toHaveLength(1);
    const explanation = entries[0]!.explanation;
    // Fallback: "Hand conditions not satisfied" text + only failed clauses
    const textNodes = explanation.filter(n => n.kind === "text");
    expect(textNodes).toHaveLength(1);
    expect(textNodes[0]!.content).toBe("Hand conditions not satisfied");
    const conditionNodes = explanation.filter(n => n.kind === "condition");
    expect(conditionNodes).toHaveLength(1);
    expect(conditionNodes[0]!.content).toBe("HCP >= 8");
    expect(conditionNodes[0]!.passed).toBe(false);
  });

  it("with pedagogical graph, familyRelation is populated from graph", () => {
    const truthEncoded = makeEncoded({
      proposal: makeProposal({ meaningId: "stayman:ask-major" }),
      call: makeCall(2, BidSuit.Clubs),
    });
    const nearMissEncoded = makeEncoded({
      proposal: makeProposal({ meaningId: "transfer:to-hearts" }),
      call: makeCall(2, BidSuit.Diamonds),
    });
    const arbitration = makeArbitration({
      truthSet: [truthEncoded],
      acceptableSet: [nearMissEncoded],
    });
    const provenance = makeProvenance();
    const relations: PedagogicalRelation[] = [
      { kind: "near-miss-of", a: "stayman:ask-major", b: "transfer:to-hearts" },
    ];
    const pedGraph = buildPedagogicalGraph(relations);
    const truthMeaningIds = new Set(["stayman:ask-major"]);

    const entries = buildWhyNot(arbitration, provenance, undefined, pedGraph, truthMeaningIds);

    expect(entries).toHaveLength(1);
    expect(entries[0]!.familyRelation).toBeDefined();
    expect(entries[0]!.familyRelation!.kind).toBe("near-miss-of");
    expect(entries[0]!.familyRelation!.a).toBe("stayman:ask-major");
    expect(entries[0]!.familyRelation!.b).toBe("transfer:to-hearts");
  });

  it("findNearMissRelation prefers 'near-miss-of' relation kind over others", () => {
    const truthEncoded = makeEncoded({
      proposal: makeProposal({ meaningId: "stayman:ask-major" }),
      call: makeCall(2, BidSuit.Clubs),
    });
    const nearMissEncoded = makeEncoded({
      proposal: makeProposal({ meaningId: "transfer:to-hearts" }),
      call: makeCall(2, BidSuit.Diamonds),
    });
    const arbitration = makeArbitration({
      truthSet: [truthEncoded],
      acceptableSet: [nearMissEncoded],
    });
    const provenance = makeProvenance();
    const relations: PedagogicalRelation[] = [
      // same-family appears first
      { kind: "same-family", a: "stayman:ask-major", b: "transfer:to-hearts" },
      // near-miss-of appears second but should be preferred
      { kind: "near-miss-of", a: "stayman:ask-major", b: "transfer:to-hearts" },
    ];
    const pedGraph = buildPedagogicalGraph(relations);
    const truthMeaningIds = new Set(["stayman:ask-major"]);

    const entries = buildWhyNot(arbitration, provenance, undefined, pedGraph, truthMeaningIds);

    expect(entries).toHaveLength(1);
    expect(entries[0]!.familyRelation!.kind).toBe("near-miss-of");
  });

  it("empty acceptable set produces empty array", () => {
    const truthEncoded = makeEncoded({
      proposal: makeProposal({ meaningId: "nt:game-raise" }),
      call: makeCall(3, BidSuit.NoTrump),
    });
    const arbitration = makeArbitration({
      truthSet: [truthEncoded],
      acceptableSet: [],
    });
    const provenance = makeProvenance();

    const entries = buildWhyNot(arbitration, provenance);

    expect(entries).toEqual([]);
  });

  it("with catalog index, contrastiveTemplateKey is used in explanation nodes", () => {
    const truthEncoded = makeEncoded({
      proposal: makeProposal({ meaningId: "nt:game-raise" }),
      call: makeCall(3, BidSuit.NoTrump),
    });
    const nearMissEncoded = makeEncoded({
      proposal: makeProposal({
        meaningId: "nt:invite",
        clauses: [makeClause({ factId: "hand.hcp", satisfied: false, description: "HCP >= 8" })],
      }),
      call: makeCall(2, BidSuit.NoTrump),
    });
    const arbitration = makeArbitration({
      truthSet: [truthEncoded],
      acceptableSet: [nearMissEncoded],
    });
    const provenance = makeProvenance({
      eliminations: [
        {
          candidateId: "nt:invite",
          stage: "applicability",
          reason: "HCP too low",
          evidence: [{ conditionId: "hand.hcp", satisfied: false }],
          strength: "preference",
        },
      ],
    });
    const catalogEntry = makeCatalogEntry({
      explanationId: "nt.hcp.invite",
      factId: "hand.hcp",
      templateKey: "nt.hcp.invite.supporting",
      contrastiveTemplateKey: "nt.hcp.invite.whyNot",
      contrastiveDisplayText: "Your HCP were too low for an invite",
    });
    const catalogIndex = makeCatalogIndex([["hand.hcp", catalogEntry]]);

    const entries = buildWhyNot(arbitration, provenance, catalogIndex);

    expect(entries).toHaveLength(1);
    const conditionNodes = entries[0]!.explanation.filter(n => n.kind === "condition");
    expect(conditionNodes).toHaveLength(1);
    expect(conditionNodes[0]!.explanationId).toBe("nt.hcp.invite");
    // Uses contrastiveTemplateKey for whyNot context
    expect(conditionNodes[0]!.templateKey).toBe("nt.hcp.invite.whyNot");
    expect(conditionNodes[0]!.content).toBe("Your HCP were too low for an invite");
  });

  it("without pedagogical graph, familyRelation is undefined", () => {
    const truthEncoded = makeEncoded({
      proposal: makeProposal({ meaningId: "stayman:ask-major" }),
      call: makeCall(2, BidSuit.Clubs),
    });
    const nearMissEncoded = makeEncoded({
      proposal: makeProposal({ meaningId: "transfer:to-hearts" }),
      call: makeCall(2, BidSuit.Diamonds),
    });
    const arbitration = makeArbitration({
      truthSet: [truthEncoded],
      acceptableSet: [nearMissEncoded],
    });
    const provenance = makeProvenance();

    const entries = buildWhyNot(arbitration, provenance);

    expect(entries).toHaveLength(1);
    expect(entries[0]!.familyRelation).toBeUndefined();
  });

  it("defaults eliminationStage to 'applicability' when no elimination trace exists", () => {
    const truthEncoded = makeEncoded({
      proposal: makeProposal({ meaningId: "nt:game-raise" }),
      call: makeCall(3, BidSuit.NoTrump),
    });
    const nearMissEncoded = makeEncoded({
      proposal: makeProposal({
        meaningId: "nt:invite",
        clauses: [makeClause({ factId: "hand.hcp", satisfied: false, description: "HCP >= 8" })],
      }),
      call: makeCall(2, BidSuit.NoTrump),
    });
    const arbitration = makeArbitration({
      truthSet: [truthEncoded],
      acceptableSet: [nearMissEncoded],
    });
    const provenance = makeProvenance(); // no elimination traces

    const entries = buildWhyNot(arbitration, provenance);

    expect(entries).toHaveLength(1);
    expect(entries[0]!.eliminationStage).toBe("applicability");
  });
});
