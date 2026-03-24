import { describe, test, expect } from "vitest";
import { BidSuit, Seat } from "../../engine/types";
import type { BiddingContext } from "../../strategy/bidding/bidding-types";
import type { HandEvaluation } from "../../engine/types";
import {
  makeCarrier,
  makePipelineResult,
  makeProposal,
  makeCall,
  makeClause,
} from "../../test-support/convention-factories";
import { buildBidResult } from "../bidding/bid-result-builder";

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
    auction: { entries: [], isComplete: false },
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
    const selected = makeCarrier({
      call,
      proposal: makeProposal({ meaningId: "transfer:hearts" }),
    });
    const result = makePipelineResult({ selected, truthSet: [selected] });

    const bidResult = buildBidResult(selected, makeBiddingContext(), "nt", result);

    expect(bidResult.call).toEqual(call);
  });

  test("maps meaningId to ruleName", () => {
    const selected = makeCarrier({
      proposal: makeProposal({ meaningId: "stayman:ask-major" }),
    });
    const result = makePipelineResult({ selected, truthSet: [selected] });

    const bidResult = buildBidResult(selected, makeBiddingContext(), "nt", result);

    expect(bidResult.ruleName).toBe("stayman:ask-major");
  });

  test("maps provenance nodeName to explanation", () => {
    const selected = makeCarrier({
      proposal: makeProposal({
        evidence: {
          factDependencies: [],
          evaluatedConditions: [],
          provenance: { moduleId: "stayman", nodeName: "Stayman convention bid", origin: "meaning-pipeline" },
        },
      }),
    });
    const result = makePipelineResult({ selected, truthSet: [selected] });

    const bidResult = buildBidResult(selected, makeBiddingContext(), "nt", result);

    expect(bidResult.explanation).toBe("Stayman convention bid");
  });

  test("uses teachingLabel for meaning when present", () => {
    const selected = makeCarrier({
      proposal: makeProposal({
        meaningId: "stayman:ask-major",
        teachingLabel: "Stayman 2C",
      }),
    });
    const result = makePipelineResult({ selected, truthSet: [selected] });

    const bidResult = buildBidResult(selected, makeBiddingContext(), "nt", result);

    expect(bidResult.meaning).toBe("Stayman 2C");
  });

  test("falls back to meaningId for meaning when teachingLabel is absent", () => {
    const selected = makeCarrier({
      proposal: makeProposal({
        meaningId: "natural:pass",
        teachingLabel: undefined,
      }),
    });
    const result = makePipelineResult({ selected, truthSet: [selected] });

    const bidResult = buildBidResult(selected, makeBiddingContext(), "nt", result);

    expect(bidResult.meaning).toBe("natural:pass");
  });

  // ─── Alert ───────────────────────────────────────────────────

  test("includes alert with teachingLabel when bid is alertable", () => {
    const selected = makeCarrier({
      proposal: makeProposal({
        isAlertable: true,
        teachingLabel: "Stayman 2C",
      }),
    });
    const result = makePipelineResult({ selected, truthSet: [selected] });

    const bidResult = buildBidResult(selected, makeBiddingContext(), "nt", result);

    expect(bidResult.alert).toEqual({
      teachingLabel: "Stayman 2C",
    });
  });

  test("alert is null when bid is not alertable", () => {
    const selected = makeCarrier({
      proposal: makeProposal({
        isAlertable: false,
      }),
    });
    const result = makePipelineResult({ selected, truthSet: [selected] });

    const bidResult = buildBidResult(selected, makeBiddingContext(), "nt", result);

    expect(bidResult.alert).toBeNull();
  });

  test("alert uses meaningId as teachingLabel fallback", () => {
    const selected = makeCarrier({
      proposal: makeProposal({
        meaningId: "weak:two-hearts",
        teachingLabel: undefined,
        isAlertable: true,
      }),
    });
    const result = makePipelineResult({ selected, truthSet: [selected] });

    const bidResult = buildBidResult(selected, makeBiddingContext(), "nt", result);

    expect(bidResult.alert).toEqual({
      teachingLabel: "weak:two-hearts",
    });
  });

  // ─── Hand summary ─────────────────────────────────────────────

  test("includes hand summary from evaluation", () => {
    const evaluation = makeEvaluation({ hcp: 16, shape: [4, 3, 3, 3] });
    const context = makeBiddingContext({ evaluation });
    const selected = makeCarrier();
    const result = makePipelineResult({ selected, truthSet: [selected] });

    const bidResult = buildBidResult(selected, context, "nt", result);

    expect(bidResult.handSummary).toContain("16 HCP");
    expect(bidResult.handSummary).toBeDefined();
  });

  // ─── Evaluation trace ─────────────────────────────────────────

  test("evaluationTrace includes candidateCount from truthSet + acceptableSet", () => {
    const ep1 = makeCarrier({ proposal: makeProposal({ meaningId: "a" }) });
    const ep2 = makeCarrier({ proposal: makeProposal({ meaningId: "b" }) });
    const ep3 = makeCarrier({ proposal: makeProposal({ meaningId: "c" }) });
    const result = makePipelineResult({
      selected: ep1,
      truthSet: [ep1, ep2],
      acceptableSet: [ep3],
    });

    const bidResult = buildBidResult(ep1, makeBiddingContext(), "nt-bundle", result);

    expect(bidResult.evaluationTrace).toBeDefined();
    expect(bidResult.evaluationTrace!.candidateCount).toBe(3);
    expect(bidResult.evaluationTrace!.conventionId).toBe("nt-bundle");
  });

  test("evaluationTrace includes posterior fields when posteriorSummary provided", () => {
    const selected = makeCarrier();
    const result = makePipelineResult({ selected, truthSet: [selected] });
    const posteriorSummary = { sampleCount: 500, confidence: 0.85, factValues: [] };

    const bidResult = buildBidResult(selected, makeBiddingContext(), "nt", result, posteriorSummary);

    expect(bidResult.evaluationTrace!.posteriorSampleCount).toBe(500);
    expect(bidResult.evaluationTrace!.posteriorConfidence).toBe(0.85);
  });

  test("evaluationTrace omits posterior fields when no posteriorSummary", () => {
    const selected = makeCarrier();
    const result = makePipelineResult({ selected, truthSet: [selected] });

    const bidResult = buildBidResult(selected, makeBiddingContext(), "nt", result);

    expect(bidResult.evaluationTrace!.posteriorSampleCount).toBeUndefined();
    expect(bidResult.evaluationTrace!.posteriorConfidence).toBeUndefined();
  });

  // ─── Resolved candidates ──────────────────────────────────────

  test("resolvedCandidates includes truthSet and acceptableSet entries", () => {
    const truth1 = makeCarrier({
      call: makeCall(2, BidSuit.Clubs),
      proposal: makeProposal({ meaningId: "stayman:ask-major", teachingLabel: "Stayman" }),
    });
    const acceptable1 = makeCarrier({
      call: makeCall(2, BidSuit.Diamonds),
      proposal: makeProposal({ meaningId: "transfer:hearts", teachingLabel: "Transfer" }),
    });
    const result = makePipelineResult({
      selected: truth1,
      truthSet: [truth1],
      acceptableSet: [acceptable1],
    });

    const bidResult = buildBidResult(truth1, makeBiddingContext(), "nt", result);

    expect(bidResult.resolvedCandidates).toHaveLength(2);
    expect(bidResult.resolvedCandidates![0]!.bidName).toBe("stayman:ask-major");
    expect(bidResult.resolvedCandidates![1]!.bidName).toBe("transfer:hearts");
  });

  test("resolvedCandidates maps failed conditions from unsatisfied clauses", () => {
    const failedClause = makeClause({ factId: "hand.hcp", satisfied: false, description: "HCP >= 15" });
    const passedClause = makeClause({ factId: "bridge.majorFit", satisfied: true, description: "Major fit" });
    const selected = makeCarrier({
      proposal: makeProposal({
        clauses: [failedClause, passedClause],
      }),
    });
    const result = makePipelineResult({ selected, truthSet: [selected] });

    const bidResult = buildBidResult(selected, makeBiddingContext(), "nt", result);

    const candidate = bidResult.resolvedCandidates![0]!;
    expect(candidate.failedConditions).toHaveLength(1);
    expect(candidate.failedConditions[0]!).toEqual({
      name: "hand.hcp",
      passed: false,
      description: "HCP >= 15",
    });
  });

  test("resolvedCandidates carries moduleId and semanticClassId", () => {
    const selected = makeCarrier({
      proposal: makeProposal({
        moduleId: "stayman",
        semanticClassId: "stayman:ask",
      }),
    });
    const result = makePipelineResult({ selected, truthSet: [selected] });

    const bidResult = buildBidResult(selected, makeBiddingContext(), "nt", result);

    expect(bidResult.resolvedCandidates![0]!.moduleId).toBe("stayman");
    expect(bidResult.resolvedCandidates![0]!.semanticClassId).toBe("stayman:ask");
  });

  test("output is a clean DTO with no internal pipeline types", () => {
    const selected = makeCarrier();
    const result = makePipelineResult({ selected, truthSet: [selected] });

    const bidResult = buildBidResult(selected, makeBiddingContext(), "nt", result);

    // BidResult should be a plain object serializable to JSON
    const serialized = JSON.stringify(bidResult);
    const deserialized = JSON.parse(serialized);
    expect(deserialized.call).toEqual(bidResult.call);
    expect(deserialized.ruleName).toEqual(bidResult.ruleName);
    expect(deserialized.explanation).toEqual(bidResult.explanation);
  });
});
