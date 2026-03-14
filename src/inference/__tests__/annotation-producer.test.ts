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
    const alert: BidAlert = { artificial: true, forcingType: "forcing" };
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
