import { describe, it, expect } from "vitest";
import { Seat } from "../../engine/types";
import type { AuctionEntry, Auction } from "../../engine/types";
import type { HandInference, BidAlert } from "../../core/contracts";
import type { InferenceExtractor, InferenceExtractorInput, InferenceProvider } from "../types";
import { produceAnnotation } from "../annotation-producer";

const emptyAuction: Auction = { entries: [], isComplete: false };

function makeRuleResult(overrides: Partial<InferenceExtractorInput> = {}): InferenceExtractorInput {
  return {
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
    const alert: BidAlert = {
      publicConstraints: [{ factId: "hand.hcp", operator: "gte", value: 8 }],
      teachingLabel: "Stayman 2C",
    };
    const ruleResult = makeRuleResult({ alert, meaning: "Asks for a 4-card major" });
    const entry: AuctionEntry = { seat: Seat.South, call: { type: "bid", level: 2, strain: "C" as never } };

    const annotation = produceAnnotation(
      entry,
      ruleResult,
      "stayman",
      makeStubExtractor(),
      makeStubNaturalProvider(),
      emptyAuction,
    );

    expect(annotation.meaning).toBe("Asks for a 4-card major");
    expect(annotation.conventionId).toBe("stayman");
  });

  it("convention bid: inferences from extractor.extractInferences()", () => {
    const testInference: HandInference = {
      seat: Seat.South,
      minHcp: 8,
      suits: {},
      source: "test",
    };
    const ruleResult = makeRuleResult();
    const entry: AuctionEntry = { seat: Seat.South, call: { type: "bid", level: 2, strain: "C" as never } };

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

  it("natural bid (null ruleResult): inferences from naturalProvider", () => {
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

    expect(annotation.meaning).toBe("Natural bid");
    expect(annotation.inferences).toEqual([naturalInference]);
    expect(annotation.conventionId).toBeNull();
  });

  it("pass: meaning 'Pass', inferences empty", () => {
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
    expect(annotation.inferences).toEqual([]);
  });

  it("double: meaning 'Double', inferences empty", () => {
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
    expect(annotation.inferences).toEqual([]);
  });

  it("redouble: meaning 'Redouble', inferences empty", () => {
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
    expect(annotation.inferences).toEqual([]);
  });

  it("convention bid with alert publicConstraints: derives inference from constraints instead of natural", () => {
    const alert: BidAlert = {
      publicConstraints: [
        { factId: "hand.hcp", operator: "gte", value: 8 },
        { factId: "hand.suitLength.hearts", operator: "gte", value: 5 },
      ],
      teachingLabel: "Transfer to hearts",
    };
    const ruleResult = makeRuleResult({ alert, meaning: "Transfer to hearts" });
    const entry: AuctionEntry = { seat: Seat.South, call: { type: "bid", level: 2, strain: "D" as never } };

    const annotation = produceAnnotation(
      entry,
      ruleResult,
      "jacoby-transfers",
      makeStubExtractor(), // noop — returns []
      makeStubNaturalProvider(), // should NOT be called
      emptyAuction,
    );

    expect(annotation.inferences).toHaveLength(1);
    expect(annotation.inferences[0]!.minHcp).toBe(8);
    expect(annotation.inferences[0]!.suits).toEqual({
      H: { minLength: 5 },
    });
    expect(annotation.inferences[0]!.source).toBe("alert:test-rule");
  });

  it("convention bid with empty publicConstraints: falls back to natural inference", () => {
    const alert: BidAlert = {
      publicConstraints: [],
      teachingLabel: "DONT bid",
    };
    const naturalInference: HandInference = {
      seat: Seat.South,
      minHcp: 10,
      suits: {},
      source: "natural:2C",
    };
    const ruleResult = makeRuleResult({ alert, meaning: "DONT clubs + higher" });
    const entry: AuctionEntry = { seat: Seat.South, call: { type: "bid", level: 2, strain: "C" as never } };

    const annotation = produceAnnotation(
      entry,
      ruleResult,
      "dont",
      makeStubExtractor(), // noop
      makeStubNaturalProvider(naturalInference),
      emptyAuction,
    );

    expect(annotation.inferences).toEqual([naturalInference]);
  });
});
