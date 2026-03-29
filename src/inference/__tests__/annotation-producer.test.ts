import { describe, it, expect } from "vitest";
import { Seat } from "../../engine/types";
import type { AuctionEntry, Auction } from "../../engine/types";
import type { HandInference } from "../inference-types";
import type { BidAlert } from "../../conventions";
import type { FactConstraint } from "../../conventions/core/agreement-module";
import type { InferenceExtractor, InferenceExtractorInput, InferenceProvider } from "../types";
import { produceAnnotation } from "../annotation-producer";
import { FactOperator } from "../../conventions/pipeline/evaluation/meaning";

const emptyAuction: Auction = { entries: [], isComplete: false };

function makeRuleResult(overrides: Partial<InferenceExtractorInput> = {}): InferenceExtractorInput {
  return {
    rule: "test-rule",
    explanation: "Test explanation",
    meaning: "Asks for a 4-card major",
    ...overrides,
  };
}

function makeStubExtractor(constraints: readonly FactConstraint[] = []): InferenceExtractor {
  return {
    extractConstraints: (_result, _seat) => constraints,
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
      teachingLabel: "Stayman 2C",
    };
    const ruleResult = makeRuleResult({
      alert,
      constraints: [{ factId: "hand.hcp", operator: FactOperator.Gte, value: 8 }],
      meaning: "Asks for a 4-card major",
    });
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

  it("convention bid: constraints from extractor.extractConstraints()", () => {
    const testConstraints: FactConstraint[] = [
      { factId: "hand.hcp", operator: FactOperator.Gte, value: 8 },
    ];
    const ruleResult = makeRuleResult();
    const entry: AuctionEntry = { seat: Seat.South, call: { type: "bid", level: 2, strain: "C" as never } };

    const annotation = produceAnnotation(
      entry,
      ruleResult,
      "stayman",
      makeStubExtractor(testConstraints),
      makeStubNaturalProvider(),
      emptyAuction,
    );

    expect(annotation.constraints).toEqual(testConstraints);
  });

  it("natural bid (null ruleResult): constraints from naturalProvider converted at boundary", () => {
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
    expect(annotation.constraints).toEqual([
      { factId: "hand.hcp", operator: FactOperator.Gte, value: 12 },
    ]);
    expect(annotation.conventionId).toBeNull();
  });

  it("pass: meaning 'Pass', constraints empty", () => {
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
    expect(annotation.constraints).toEqual([]);
  });

  it("double: meaning 'Double', constraints empty", () => {
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
    expect(annotation.constraints).toEqual([]);
  });

  it("redouble: meaning 'Redouble', constraints empty", () => {
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
    expect(annotation.constraints).toEqual([]);
  });

  it("convention bid with constraints on input: passes constraints through directly", () => {
    const alert: BidAlert = {
      teachingLabel: "Transfer to hearts",
    };
    const ruleResult = makeRuleResult({
      alert,
      constraints: [
        { factId: "hand.hcp", operator: FactOperator.Gte, value: 8 },
        { factId: "hand.suitLength.hearts", operator: FactOperator.Gte, value: 5 },
      ],
      meaning: "Transfer to hearts",
    });
    const entry: AuctionEntry = { seat: Seat.South, call: { type: "bid", level: 2, strain: "D" as never } };

    const annotation = produceAnnotation(
      entry,
      ruleResult,
      "jacoby-transfers",
      makeStubExtractor(), // noop — returns []
      makeStubNaturalProvider(), // should NOT be called
      emptyAuction,
    );

    expect(annotation.constraints).toEqual([
      { factId: "hand.hcp", operator: FactOperator.Gte, value: 8 },
      { factId: "hand.suitLength.hearts", operator: FactOperator.Gte, value: 5 },
    ]);
  });

  it("convention bid with no constraints: falls back to natural inference converted to constraints", () => {
    const alert: BidAlert = {
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

    expect(annotation.constraints).toEqual([
      { factId: "hand.hcp", operator: FactOperator.Gte, value: 10 },
    ]);
  });
});
