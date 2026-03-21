import { describe, test, expect } from "vitest";
import { BidSuit, Seat } from "../../engine/types";
import type { BiddingContext } from "../../core/contracts/bidding";
import type { HandEvaluation } from "../../engine/types";
import {
  makeArbitration,
  makeEncoded,
  makeProposal,
  makeCall,
  makeClause,
  makeEligibility,
} from "../../test-support/convention-factories";
import { buildBidResult, buildTeachingProjection } from "../bidding/bid-result-builder";
import { makeProvenance } from "../../test-support/convention-factories";

// ─── Helpers ─────────────────────────────────────────────────────

function makeEvaluation(overrides: Partial<HandEvaluation> = {}): HandEvaluation {
  return {
    hcp: 16,
    distribution: { shortness: 0, length: 0, total: 0 },
    shape: [3, 3, 4, 3] as const,
    totalPoints: 16,
    strategy: "standard",
    ...overrides,
  };
}

function makeBiddingContext(overrides: Partial<BiddingContext> = {}): BiddingContext {
  return {
    hand: { cards: [] },
    auction: { calls: [], dealer: Seat.North },
    seat: Seat.South,
    evaluation: makeEvaluation(),
    opponentConventionIds: [],
    ...overrides,
  };
}

// ─── buildBidResult ──────────────────────────────────────────────

describe("buildBidResult", () => {
  test("maps selected call to BidResult.call", () => {
    const call = makeCall(2, BidSuit.Hearts);
    const selected = makeEncoded({
      call,
      proposal: makeProposal({ meaningId: "transfer:hearts" }),
    });
    const arbitration = makeArbitration({ selected, truthSet: [selected] });

    const result = buildBidResult(selected, makeBiddingContext(), "nt", arbitration);

    expect(result.call).toEqual(call);
  });

  test("maps meaningId to ruleName", () => {
    const selected = makeEncoded({
      proposal: makeProposal({ meaningId: "stayman:ask-major" }),
    });
    const arbitration = makeArbitration({ selected, truthSet: [selected] });

    const result = buildBidResult(selected, makeBiddingContext(), "nt", arbitration);

    expect(result.ruleName).toBe("stayman:ask-major");
  });

  test("maps provenance nodeName to explanation", () => {
    const selected = makeEncoded({
      proposal: makeProposal({
        evidence: {
          factDependencies: [],
          evaluatedConditions: [],
          provenance: { moduleId: "stayman", nodeName: "Stayman convention bid", origin: "meaning-pipeline" },
        },
      }),
    });
    const arbitration = makeArbitration({ selected, truthSet: [selected] });

    const result = buildBidResult(selected, makeBiddingContext(), "nt", arbitration);

    expect(result.explanation).toBe("Stayman convention bid");
  });

  test("uses teachingLabel for meaning when present", () => {
    const selected = makeEncoded({
      proposal: makeProposal({
        meaningId: "stayman:ask-major",
        teachingLabel: "Stayman 2C",
      }),
    });
    const arbitration = makeArbitration({ selected, truthSet: [selected] });

    const result = buildBidResult(selected, makeBiddingContext(), "nt", arbitration);

    expect(result.meaning).toBe("Stayman 2C");
  });

  test("falls back to meaningId for meaning when teachingLabel is absent", () => {
    const selected = makeEncoded({
      proposal: makeProposal({
        meaningId: "natural:pass",
        teachingLabel: undefined,
      }),
    });
    const arbitration = makeArbitration({ selected, truthSet: [selected] });

    const result = buildBidResult(selected, makeBiddingContext(), "nt", arbitration);

    expect(result.meaning).toBe("natural:pass");
  });

  // ─── Alert ───────────────────────────────────────────────────

  test("includes alert with publicConstraints when bid is alertable", () => {
    const publicConstraints = [
      { factId: "hand.hcp", operator: "range" as const, min: 8, max: 9 },
    ];
    const selected = makeEncoded({
      proposal: makeProposal({
        isAlertable: true,
        publicConstraints,
        teachingLabel: "Stayman 2C",
      }),
    });
    const arbitration = makeArbitration({ selected, truthSet: [selected] });

    const result = buildBidResult(selected, makeBiddingContext(), "nt", arbitration);

    expect(result.alert).toEqual({
      publicConstraints,
      teachingLabel: "Stayman 2C",
    });
  });

  test("alert is null when bid is not alertable", () => {
    const selected = makeEncoded({
      proposal: makeProposal({
        isAlertable: false,
      }),
    });
    const arbitration = makeArbitration({ selected, truthSet: [selected] });

    const result = buildBidResult(selected, makeBiddingContext(), "nt", arbitration);

    expect(result.alert).toBeNull();
  });

  test("alert uses meaningId as teachingLabel fallback", () => {
    const selected = makeEncoded({
      proposal: makeProposal({
        meaningId: "weak:two-hearts",
        teachingLabel: undefined,
        isAlertable: true,
        publicConstraints: [],
      }),
    });
    const arbitration = makeArbitration({ selected, truthSet: [selected] });

    const result = buildBidResult(selected, makeBiddingContext(), "nt", arbitration);

    expect(result.alert).toEqual({
      publicConstraints: [],
      teachingLabel: "weak:two-hearts",
    });
  });

  // ─── Hand summary ─────────────────────────────────────────────

  test("includes hand summary from evaluation", () => {
    const evaluation = makeEvaluation({ hcp: 16, shape: [4, 3, 3, 3] });
    const context = makeBiddingContext({ evaluation });
    const selected = makeEncoded();
    const arbitration = makeArbitration({ selected, truthSet: [selected] });

    const result = buildBidResult(selected, context, "nt", arbitration);

    expect(result.handSummary).toContain("16 HCP");
    expect(result.handSummary).toBeDefined();
  });

  // ─── Evaluation trace ─────────────────────────────────────────

  test("evaluationTrace includes candidateCount from truthSet + acceptableSet", () => {
    const ep1 = makeEncoded({ proposal: makeProposal({ meaningId: "a" }) });
    const ep2 = makeEncoded({ proposal: makeProposal({ meaningId: "b" }) });
    const ep3 = makeEncoded({ proposal: makeProposal({ meaningId: "c" }) });
    const arbitration = makeArbitration({
      selected: ep1,
      truthSet: [ep1, ep2],
      acceptableSet: [ep3],
    });

    const result = buildBidResult(ep1, makeBiddingContext(), "nt-bundle", arbitration);

    expect(result.evaluationTrace).toBeDefined();
    expect(result.evaluationTrace!.candidateCount).toBe(3);
    expect(result.evaluationTrace!.conventionId).toBe("nt-bundle");
  });

  test("evaluationTrace includes posterior fields when posteriorSummary provided", () => {
    const selected = makeEncoded();
    const arbitration = makeArbitration({ selected, truthSet: [selected] });
    const posteriorSummary = { sampleCount: 500, confidence: 0.85 };

    const result = buildBidResult(selected, makeBiddingContext(), "nt", arbitration, posteriorSummary);

    expect(result.evaluationTrace!.posteriorSampleCount).toBe(500);
    expect(result.evaluationTrace!.posteriorConfidence).toBe(0.85);
  });

  test("evaluationTrace omits posterior fields when no posteriorSummary", () => {
    const selected = makeEncoded();
    const arbitration = makeArbitration({ selected, truthSet: [selected] });

    const result = buildBidResult(selected, makeBiddingContext(), "nt", arbitration);

    expect(result.evaluationTrace!.posteriorSampleCount).toBeUndefined();
    expect(result.evaluationTrace!.posteriorConfidence).toBeUndefined();
  });

  // ─── Resolved candidates ──────────────────────────────────────

  test("resolvedCandidates includes truthSet and acceptableSet entries", () => {
    const truth1 = makeEncoded({
      call: makeCall(2, BidSuit.Clubs),
      proposal: makeProposal({ meaningId: "stayman:ask-major", teachingLabel: "Stayman" }),
    });
    const acceptable1 = makeEncoded({
      call: makeCall(2, BidSuit.Diamonds),
      proposal: makeProposal({ meaningId: "transfer:hearts", teachingLabel: "Transfer" }),
    });
    const arbitration = makeArbitration({
      selected: truth1,
      truthSet: [truth1],
      acceptableSet: [acceptable1],
    });

    const result = buildBidResult(truth1, makeBiddingContext(), "nt", arbitration);

    expect(result.resolvedCandidates).toHaveLength(2);
    expect(result.resolvedCandidates![0].bidName).toBe("stayman:ask-major");
    expect(result.resolvedCandidates![1].bidName).toBe("transfer:hearts");
  });

  test("resolvedCandidates maps failed conditions from unsatisfied clauses", () => {
    const failedClause = makeClause({ factId: "hand.hcp", satisfied: false, description: "HCP >= 15" });
    const passedClause = makeClause({ factId: "bridge.majorFit", satisfied: true, description: "Major fit" });
    const selected = makeEncoded({
      proposal: makeProposal({
        clauses: [failedClause, passedClause],
      }),
    });
    const arbitration = makeArbitration({ selected, truthSet: [selected] });

    const result = buildBidResult(selected, makeBiddingContext(), "nt", arbitration);

    const candidate = result.resolvedCandidates![0];
    expect(candidate.failedConditions).toHaveLength(1);
    expect(candidate.failedConditions[0]).toEqual({
      name: "hand.hcp",
      passed: false,
      description: "HCP >= 15",
    });
  });

  test("resolvedCandidates carries moduleId and semanticClassId", () => {
    const selected = makeEncoded({
      proposal: makeProposal({
        moduleId: "stayman",
        semanticClassId: "stayman:ask",
      }),
    });
    const arbitration = makeArbitration({ selected, truthSet: [selected] });

    const result = buildBidResult(selected, makeBiddingContext(), "nt", arbitration);

    expect(result.resolvedCandidates![0].moduleId).toBe("stayman");
    expect(result.resolvedCandidates![0].semanticClassId).toBe("stayman:ask");
  });

  test("output is a clean DTO with no internal pipeline types", () => {
    const selected = makeEncoded();
    const arbitration = makeArbitration({ selected, truthSet: [selected] });

    const result = buildBidResult(selected, makeBiddingContext(), "nt", arbitration);

    // BidResult should be a plain object serializable to JSON
    const serialized = JSON.stringify(result);
    const deserialized = JSON.parse(serialized);
    expect(deserialized.call).toEqual(result.call);
    expect(deserialized.ruleName).toEqual(result.ruleName);
    expect(deserialized.explanation).toEqual(result.explanation);
  });
});

// ─── buildTeachingProjection ─────────────────────────────────────

describe("buildTeachingProjection", () => {
  test("returns null when provenance is null", () => {
    const arbitration = makeArbitration();

    const result = buildTeachingProjection(arbitration, null);

    expect(result).toBeNull();
  });

  test("returns a TeachingProjection when provenance is provided", () => {
    const selected = makeEncoded();
    const arbitration = makeArbitration({ selected, truthSet: [selected] });
    const provenance = makeProvenance();

    const result = buildTeachingProjection(arbitration, provenance);

    expect(result).not.toBeNull();
    // TeachingProjection should have callViews
    expect(result).toHaveProperty("callViews");
  });
});
