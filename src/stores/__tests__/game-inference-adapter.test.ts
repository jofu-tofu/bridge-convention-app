import { describe, expect, test } from "vitest";
import { BidSuit, Seat } from "../../engine/types";
import type { BidResult } from "../../service";
import { noopExtractor } from "../../inference/noop-extractor";

/**
 * Characterization seam: mirrors current `toExtractorInput()` in game.svelte.ts.
 * This intentionally verifies the current adapter shape (hollow adapter).
 */
function adaptBidResultLikeGameStore(bidResult: BidResult): { rule: string; explanation: string; meaning?: string } {
  return {
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
  test("adapter emits minimal 3-field shape", () => {
    const bidResult = makeBidResult();

    const adapted = adaptBidResultLikeGameStore(bidResult);

    expect(adapted).toEqual({
      rule: "stayman-ask",
      explanation: "Asks for a 4-card major",
      meaning: "Asks for a 4-card major",
    });
  });

  test("with evaluationTrace present: adapter still emits minimal shape", () => {
    const bidResult = makeBidResult({
      ruleName: null,
      evaluationTrace: {
        conventionId: "stayman",
        candidateCount: 1,
        strategyChainPath: [],
      },
    });

    const adapted = adaptBidResultLikeGameStore(bidResult);

    expect(adapted).toEqual({
      rule: "unknown",
      explanation: bidResult.explanation,
      meaning: bidResult.meaning,
    });
  });

  test("noopExtractor returns empty for any input", () => {
    const adapted = adaptBidResultLikeGameStore(makeBidResult());

    const inferences = noopExtractor.extractConstraints(adapted, Seat.South);

    expect(inferences).toEqual([]);
  });
});
