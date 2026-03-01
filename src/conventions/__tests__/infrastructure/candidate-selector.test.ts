import { describe, test, expect } from "vitest";
import { selectMatchedCandidate } from "../../core/candidate-selector";
import type { ResolvedCandidate } from "../../core/candidate-generator";
import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";

function makeCandidate(
  overrides: Partial<ResolvedCandidate> & { isMatched: boolean; legal: boolean },
): ResolvedCandidate {
  const call: Call = { type: "bid", level: 2, strain: BidSuit.Clubs };
  return {
    bidName: "test-bid",
    nodeId: overrides.bidName ?? "test-bid",
    meaning: "Test",
    call,
    failedConditions: [],
    intent: { type: "Signoff", params: {} },
    source: { conventionId: "test", nodeName: "test-bid" },
    resolvedCall: call,
    isDefaultCall: true,
    ...overrides,
  };
}

describe("selectMatchedCandidate", () => {
  test("returns matched+legal candidate when present", () => {
    const candidates = [
      makeCandidate({ isMatched: true, legal: true }),
      makeCandidate({ isMatched: false, legal: true }),
    ];
    const result = selectMatchedCandidate(candidates);
    expect(result).toBe(candidates[0]);
  });

  test("returns null when no candidates (empty array)", () => {
    expect(selectMatchedCandidate([])).toBeNull();
  });

  test("returns null when matched candidate is illegal", () => {
    const candidates = [
      makeCandidate({ isMatched: true, legal: false }),
      makeCandidate({ isMatched: false, legal: true }),
    ];
    expect(selectMatchedCandidate(candidates)).toBeNull();
  });

  test("skips non-matched candidates even if legal", () => {
    const candidates = [
      makeCandidate({ isMatched: false, legal: true }),
      makeCandidate({ isMatched: false, legal: true }),
    ];
    expect(selectMatchedCandidate(candidates)).toBeNull();
  });

  describe("tiered selection with priority", () => {
    test("matched+legal wins over preferred+legal", () => {
      const matched = makeCandidate({ isMatched: true, legal: true, bidName: "matched" });
      const preferred = makeCandidate({ isMatched: false, legal: true, bidName: "preferred", priority: "preferred" });
      const result = selectMatchedCandidate([preferred, matched]);
      expect(result).toBe(matched);
    });

    test("preferred+legal selected when no matched+legal", () => {
      const preferred = makeCandidate({ isMatched: false, legal: true, bidName: "preferred", priority: "preferred" });
      const other = makeCandidate({ isMatched: false, legal: true, bidName: "other" });
      const result = selectMatchedCandidate([other, preferred]);
      expect(result).toBe(preferred);
    });

    test("preferred+legal selected when matched is illegal", () => {
      const matched = makeCandidate({ isMatched: true, legal: false, bidName: "matched" });
      const preferred = makeCandidate({ isMatched: false, legal: true, bidName: "preferred", priority: "preferred" });
      const result = selectMatchedCandidate([matched, preferred]);
      expect(result).toBe(preferred);
    });

    test("alternative+legal selected when no matched and no preferred", () => {
      const alt = makeCandidate({ isMatched: false, legal: true, bidName: "alt", priority: "alternative" });
      const result = selectMatchedCandidate([alt]);
      expect(result).toBe(alt);
    });

    test("alternative NOT selected when preferred exists", () => {
      const preferred = makeCandidate({ isMatched: false, legal: true, bidName: "preferred", priority: "preferred" });
      const alt = makeCandidate({ isMatched: false, legal: true, bidName: "alt", priority: "alternative" });
      const result = selectMatchedCandidate([alt, preferred]);
      expect(result).toBe(preferred);
    });

    test("alternative+illegal skipped", () => {
      const alt = makeCandidate({ isMatched: false, legal: false, bidName: "alt", priority: "alternative" });
      const result = selectMatchedCandidate([alt]);
      expect(result).toBeNull();
    });

    test("without priority field, behavior unchanged", () => {
      const matched = makeCandidate({ isMatched: true, legal: true });
      const other = makeCandidate({ isMatched: false, legal: true });
      const result = selectMatchedCandidate([other, matched]);
      expect(result).toBe(matched);
    });
  });

  describe("ranking seam", () => {
    test("without ranker: behavior unchanged", () => {
      const candidates = [
        makeCandidate({ isMatched: true, legal: true, bidName: "first" }),
        makeCandidate({ isMatched: true, legal: true, bidName: "second" }),
      ];
      const result = selectMatchedCandidate(candidates);
      expect(result!.bidName).toBe("first");
    });

    test("with ranker: ranker reorders before selection", () => {
      const candidates = [
        makeCandidate({ isMatched: true, legal: true, bidName: "first" }),
        makeCandidate({ isMatched: true, legal: true, bidName: "second" }),
      ];
      const ranker = (cs: readonly ResolvedCandidate[]) => [...cs].reverse();
      const result = selectMatchedCandidate(candidates, ranker);
      expect(result!.bidName).toBe("second");
    });

    test("ranker returns empty array: returns null", () => {
      const candidates = [
        makeCandidate({ isMatched: true, legal: true }),
      ];
      const ranker = () => [] as ResolvedCandidate[];
      const result = selectMatchedCandidate(candidates, ranker);
      expect(result).toBeNull();
    });
  });
});
