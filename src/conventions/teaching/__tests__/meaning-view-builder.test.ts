import { describe, it, expect } from "vitest";
import { buildMeaningViews } from "../meaning-view-builder";
import type {
  EliminationRecord,
} from "../../pipeline/pipeline-types";

import {
  makeClause,
  makeProposal,
  makeEncoded,
  makeArbitration,
  makeProvenance,
} from "../../../test-support/convention-factories";

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
        reason: "Your hand doesn't meet one or more requirements",
        gateId: "semantic-applicability",
      },
    ];
    const provenance = makeProvenance({
      eliminations: [
        {
          candidateId: "transfer:hearts",
          stage: "applicability",
          reason: "Your hand doesn't meet one or more requirements",
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
    expect(views[0]!.eliminationReason).toBe("Your hand doesn't meet one or more requirements");
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
    expect(views[0]!.eliminationReason).toBe("Your hand doesn't fully match");
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

  it("clauseToEvidence correctly maps clause fields to ConditionEvidence", () => {
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
