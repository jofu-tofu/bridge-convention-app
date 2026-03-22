import { describe, it, expect } from "vitest";
import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import { buildWhyNot } from "../why-not-builder";
import { buildTeachingGraph } from "../teaching-graph";
import type {
  ArbitrationResult,
  EncodedProposal,
} from "../../pipeline/pipeline-types";
import type { DecisionProvenance } from "../../../core/contracts/provenance";
import type { ExplanationEntry } from "../../../core/contracts/explanation-catalog";
import type { TeachingRelation } from "../../../core/contracts/teaching-projection";
import type { CatalogIndex } from "../teaching-projection-builder";

import {
  makeCall,
  makeRankingMetadata as makeRanking,
  makeClause,
  makeProposal,
  makeEligibility,
  makeEncoded,
  makeArbitration,
  makeProvenance,
  makeCatalogEntry,
} from "../../../test-support/convention-factories";

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

  it("acceptable entries not matching truth produce WhyNotEntry with grade 'wrong' when no family relation", () => {
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
    expect(entries[0]!.grade).toBe("wrong");
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
    const relations: TeachingRelation[] = [
      { kind: "near-miss-of", a: "stayman:ask-major", b: "transfer:to-hearts" },
    ];
    const teachingGraph = buildTeachingGraph(relations);
    const truthMeaningIds = new Set(["stayman:ask-major"]);

    const entries = buildWhyNot(arbitration, provenance, undefined, teachingGraph, truthMeaningIds);

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
    const relations: TeachingRelation[] = [
      // same-family appears first
      { kind: "same-family", a: "stayman:ask-major", b: "transfer:to-hearts" },
      // near-miss-of appears second but should be preferred
      { kind: "near-miss-of", a: "stayman:ask-major", b: "transfer:to-hearts" },
    ];
    const teachingGraph = buildTeachingGraph(relations);
    const truthMeaningIds = new Set(["stayman:ask-major"]);

    const entries = buildWhyNot(arbitration, provenance, undefined, teachingGraph, truthMeaningIds);

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
