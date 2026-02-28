import { describe, it, expect } from "vitest";
import { Seat } from "../../engine/types";
import type { AuctionEntry, Auction } from "../../engine/types";
import type { HandInference } from "../../shared/types";
import type { BiddingRuleResult } from "../../conventions/core/registry";
import type { InferenceExtractor, InferenceProvider } from "../types";
import type { BidAlert } from "../../conventions/core/rule-tree";
import { produceAnnotation } from "../annotation-producer";
import { protocolInferenceExtractor } from "../protocol-inference-extractor";

const emptyAuction: Auction = { entries: [], isComplete: false };

function makeRuleResult(overrides: Partial<BiddingRuleResult> = {}): BiddingRuleResult {
  return {
    call: { type: "bid", level: 2, strain: "C" as never },
    rule: "test-rule",
    explanation: "Test explanation",
    meaning: "Asks for a 4-card major",
    ...overrides,
  };
}

function makeStubExtractor(inferences: readonly HandInference[] = []): InferenceExtractor {
  return {
    extractInferences: (_result, _seat) => inferences,
  };
}

function makeStubNaturalProvider(inference: HandInference | null = null): InferenceProvider {
  return {
    id: "natural",
    name: "Natural",
    inferFromBid: () => inference,
  };
}

describe("produceAnnotation", () => {
  it("convention bid: alert from ruleResult.alert, meaning from ruleResult.meaning", () => {
    const alert: BidAlert = { artificial: true, forcingType: "forcing" };
    const ruleResult = makeRuleResult({ alert, meaning: "Asks for a 4-card major" });
    const entry: AuctionEntry = { seat: Seat.South, call: ruleResult.call };

    const annotation = produceAnnotation(
      entry,
      ruleResult,
      "stayman",
      makeStubExtractor(),
      makeStubNaturalProvider(),
      emptyAuction,
    );

    expect(annotation.alert).toEqual(alert);
    expect(annotation.meaning).toBe("Asks for a 4-card major");
    expect(annotation.conventionId).toBe("stayman");
    expect(annotation.ruleName).toBe("test-rule");
  });

  it("convention bid: inferences from extractor.extractInferences()", () => {
    const testInference: HandInference = {
      seat: Seat.South,
      minHcp: 8,
      suits: {},
      source: "test",
    };
    const ruleResult = makeRuleResult();
    const entry: AuctionEntry = { seat: Seat.South, call: ruleResult.call };

    const annotation = produceAnnotation(
      entry,
      ruleResult,
      "stayman",
      makeStubExtractor([testInference]),
      makeStubNaturalProvider(),
      emptyAuction,
    );

    expect(annotation.inferences).toEqual([testInference]);
  });

  it("natural bid (null ruleResult): alert null, inferences from naturalProvider", () => {
    const naturalInference: HandInference = {
      seat: Seat.East,
      minHcp: 12,
      suits: {},
      source: "natural:1H-opening",
    };
    const entry: AuctionEntry = {
      seat: Seat.East,
      call: { type: "bid", level: 1, strain: "H" as never },
    };

    const annotation = produceAnnotation(
      entry,
      null,
      null,
      makeStubExtractor(),
      makeStubNaturalProvider(naturalInference),
      emptyAuction,
    );

    expect(annotation.alert).toBeNull();
    expect(annotation.meaning).toBe("Natural bid");
    expect(annotation.inferences).toEqual([naturalInference]);
    expect(annotation.ruleName).toBeNull();
    expect(annotation.conventionId).toBeNull();
  });

  it("pass: meaning 'Pass', alert null, inferences empty", () => {
    const entry: AuctionEntry = { seat: Seat.North, call: { type: "pass" } };

    const annotation = produceAnnotation(
      entry,
      null,
      null,
      makeStubExtractor(),
      makeStubNaturalProvider(),
      emptyAuction,
    );

    expect(annotation.meaning).toBe("Pass");
    expect(annotation.alert).toBeNull();
    expect(annotation.inferences).toEqual([]);
  });

  it("double: meaning 'Double', alert null, inferences empty", () => {
    const entry: AuctionEntry = { seat: Seat.West, call: { type: "double" } };

    const annotation = produceAnnotation(
      entry,
      null,
      null,
      makeStubExtractor(),
      makeStubNaturalProvider(),
      emptyAuction,
    );

    expect(annotation.meaning).toBe("Double");
    expect(annotation.alert).toBeNull();
    expect(annotation.inferences).toEqual([]);
  });

  it("redouble: meaning 'Redouble', alert null, inferences empty", () => {
    const entry: AuctionEntry = { seat: Seat.South, call: { type: "redouble" } };

    const annotation = produceAnnotation(
      entry,
      null,
      null,
      makeStubExtractor(),
      makeStubNaturalProvider(),
      emptyAuction,
    );

    expect(annotation.meaning).toBe("Redouble");
    expect(annotation.alert).toBeNull();
    expect(annotation.inferences).toEqual([]);
  });
});

function makeHandCondition(
  name: string,
  label: string,
  inference?: import("../../conventions/core/types").ConditionInference,
) {
  return {
    name,
    label,
    category: "hand" as const,
    test: () => true,
    describe: () => label,
    inference,
  };
}

describe("protocolInferenceExtractor", () => {
  it("missing protocolResult and treeEvalResult: returns empty array", () => {
    const result = makeRuleResult();
    expect(protocolInferenceExtractor.extractInferences(result, Seat.South)).toEqual([]);
  });

  it("null/empty path and rejectedDecisions: returns empty array", () => {
    const result = makeRuleResult({
      treeEvalResult: {
        matched: null,
        path: [],
        rejectedDecisions: [],
        visited: [],
      },
    });
    expect(protocolInferenceExtractor.extractInferences(result, Seat.South)).toEqual([]);
  });

  it("extracts positive inferences from handResult.path hand conditions", () => {
    const condition = makeHandCondition("hcp-min-15", "15+ HCP", {
      type: "hcp-min",
      params: { min: 15 },
    });
    const result = makeRuleResult({
      treeEvalResult: {
        matched: null,
        path: [
          {
            node: {
              type: "decision",
              name: "hcp-check",
              condition,
              yes: { type: "fallback" },
              no: { type: "fallback" },
            },
            passed: true,
            description: "15+ HCP",
          },
        ],
        rejectedDecisions: [],
        visited: [],
      },
    });

    const inferences = protocolInferenceExtractor.extractInferences(result, Seat.South);
    expect(inferences.length).toBeGreaterThan(0);
    expect(inferences[0]!.minHcp).toBe(15);
  });

  it("extracts negative inferences from handResult.rejectedDecisions", () => {
    const condition = makeHandCondition("suit-min-hearts-4", "4+ hearts", {
      type: "suit-min",
      params: { min: 4, suitIndex: 1 },
    });
    const result = makeRuleResult({
      treeEvalResult: {
        matched: null,
        path: [],
        rejectedDecisions: [
          {
            node: {
              type: "decision",
              name: "has-4-hearts",
              condition,
              yes: { type: "fallback" },
              no: { type: "fallback" },
            },
            passed: false,
            description: "4+ hearts",
          },
        ],
        visited: [],
      },
    });

    const inferences = protocolInferenceExtractor.extractInferences(result, Seat.South);
    expect(inferences.length).toBeGreaterThan(0);
    // Inverted: suit-min 4 → suit-max 3
    const suitInf = inferences.find((i) => i.suits["H"]);
    expect(suitInf?.suits["H"]?.maxLength).toBe(3);
  });
});
