import { describe, expect, test } from "vitest";
import { BidSuit, Seat } from "../../engine/types";
import type { BidResult } from "../../core/contracts";
import type { BiddingRuleResult } from "../../conventions/core/registry";
import { protocolInferenceExtractor } from "../../inference/protocol-inference-extractor";

/**
 * Characterization seam: mirrors current `toBiddingRuleResultLike()` in game.svelte.ts.
 * This intentionally verifies the current adapter shape (hollow adapter).
 */
function adaptBidResultLikeGameStore(bidResult: BidResult): BiddingRuleResult {
  return {
    call: bidResult.call,
    rule: bidResult.ruleName ?? "unknown",
    explanation: bidResult.explanation,
    meaning: bidResult.meaning,
  };
}

function makeBidResult(overrides: Partial<BidResult> = {}): BidResult {
  return {
    call: { type: "bid", level: 2, strain: BidSuit.Clubs },
    ruleName: "stayman-ask",
    explanation: "Asks for a 4-card major",
    meaning: "Asks for a 4-card major",
    ...overrides,
  };
}

describe("game inference adapter characterization", () => {
  test("without tree data: adapter emits current 4-field shape", () => {
    const bidResult = makeBidResult();

    const adapted = adaptBidResultLikeGameStore(bidResult);

    expect(adapted).toEqual({
      call: bidResult.call,
      rule: "stayman-ask",
      explanation: "Asks for a 4-card major",
      meaning: "Asks for a 4-card major",
    });
    expect("treeEvalResult" in adapted).toBe(false);
    expect("protocolResult" in adapted).toBe(false);
  });

  test("with tree/display fields present: adapter still emits hollow shape", () => {
    const bidResult = makeBidResult({
      ruleName: null,
      treePath: {
        matchedNodeName: "ask-for-major",
        path: [],
        visited: [],
      },
      evaluationTrace: {
        conventionId: "stayman",
        protocolMatched: true,
        overlaysActivated: [],
        overlayErrors: [],
        candidateCount: 1,
        strategyChainPath: [],
      },
    });

    const adapted = adaptBidResultLikeGameStore(bidResult);

    expect(adapted).toEqual({
      call: bidResult.call,
      rule: "unknown",
      explanation: bidResult.explanation,
      meaning: bidResult.meaning,
    });
    expect("treeEvalResult" in adapted).toBe(false);
    expect("protocolResult" in adapted).toBe(false);
    expect("treeRoot" in adapted).toBe(false);
  });

  test("protocolInferenceExtractor returns empty for hollow adapter (current behavior)", () => {
    const adapted = adaptBidResultLikeGameStore(makeBidResult());

    const inferences = protocolInferenceExtractor.extractInferences(adapted, Seat.South);

    expect(inferences).toEqual([]);
  });
});
