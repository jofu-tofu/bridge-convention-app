import { describe, test, expect } from "vitest";
import { selectMatchedCandidate, isSelectable, isPedagogicallyAcceptable } from "../../core/pipeline/candidate-selector";
import type { ResolvedCandidate } from "../../core/pipeline/candidate-generator";
import { buildEligibility } from "../../core/pipeline/candidate-generator";
import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import { ForcingState, ObligationKind } from "../../core/dialogue/dialogue-state";
import type { Obligation } from "../../core/dialogue/dialogue-state";

function makeCandidate(
  overrides: Partial<ResolvedCandidate> & { isMatched: boolean; legal: boolean },
): ResolvedCandidate {
  const call: Call = { type: "bid", level: 2, strain: BidSuit.Clubs };
  const failedConditions = overrides.failedConditions ?? [];
  const legal = overrides.legal;
  return {
    bidName: "test-bid",
    nodeId: overrides.bidName ?? "test-bid",
    meaning: "Test",
    call,
    failedConditions,
    intent: { type: "Signoff", params: {} },
    source: { conventionId: "test", nodeName: "test-bid" },
    resolvedCall: call,
    isDefaultCall: true,
    eligibility: buildEligibility(failedConditions, legal),
    orderKey: 0,
    ...overrides,
  };
}

describe("selectMatchedCandidate", () => {
  describe("characterization: tiered predicate permutations", () => {
    const passCall: Call = { type: "pass" };
    const bidCall: Call = { type: "bid", level: 2, strain: BidSuit.Hearts };

    type Scenario = {
      readonly name: string;
      readonly forcingState?: ForcingState;
      readonly candidates: readonly ResolvedCandidate[];
      readonly expectedBidName: string | null;
      readonly excludedBidNames: readonly string[];
    };

    const scenarios: readonly Scenario[] = [
      {
        name: "matched+legal wins over all lower tiers",
        candidates: [
          makeCandidate({ bidName: "matched-legal", isMatched: true, legal: true }),
          makeCandidate({ bidName: "preferred-legal", isMatched: false, legal: true, priority: "preferred" }),
          makeCandidate({ bidName: "alternative-legal", isMatched: false, legal: true, priority: "alternative" }),
        ],
        expectedBidName: "matched-legal",
        excludedBidNames: ["preferred-legal", "alternative-legal"],
      },
      {
        name: "matched+illegal is skipped, preferred+legal+satisfiable selected",
        candidates: [
          makeCandidate({ bidName: "matched-illegal", isMatched: true, legal: false }),
          makeCandidate({ bidName: "preferred-satisfiable", isMatched: false, legal: true, priority: "preferred" }),
          makeCandidate({ bidName: "preferred-unsatisfiable", isMatched: false, legal: true, priority: "preferred", failedConditions: [{ name: "hcp-min", description: "Need 10+ HCP" }] }),
          makeCandidate({ bidName: "alternative-satisfiable", isMatched: false, legal: true, priority: "alternative" }),
        ],
        expectedBidName: "preferred-satisfiable",
        excludedBidNames: ["matched-illegal", "preferred-unsatisfiable", "alternative-satisfiable"],
      },
      {
        name: "preferred+unsatisfiable skipped, alternative+legal+satisfiable selected",
        candidates: [
          makeCandidate({ bidName: "preferred-unsatisfiable", isMatched: false, legal: true, priority: "preferred", failedConditions: [{ name: "suit-min", description: "Need 5+ cards" }] }),
          makeCandidate({ bidName: "alternative-satisfiable", isMatched: false, legal: true, priority: "alternative" }),
        ],
        expectedBidName: "alternative-satisfiable",
        excludedBidNames: ["preferred-unsatisfiable"],
      },
      {
        name: "ForcingOneRound excludes Pass and selects non-Pass preferred",
        forcingState: ForcingState.ForcingOneRound,
        candidates: [
          makeCandidate({ bidName: "matched-pass", isMatched: true, legal: true, resolvedCall: passCall }),
          makeCandidate({ bidName: "preferred-bid", isMatched: false, legal: true, priority: "preferred", resolvedCall: bidCall }),
        ],
        expectedBidName: "preferred-bid",
        excludedBidNames: ["matched-pass"],
      },
      {
        name: "GameForcing excludes Pass and selects non-Pass alternative",
        forcingState: ForcingState.GameForcing,
        candidates: [
          makeCandidate({ bidName: "preferred-pass", isMatched: false, legal: true, priority: "preferred", resolvedCall: passCall }),
          makeCandidate({ bidName: "alternative-bid", isMatched: false, legal: true, priority: "alternative", resolvedCall: bidCall }),
        ],
        expectedBidName: "alternative-bid",
        excludedBidNames: ["preferred-pass"],
      },
      {
        name: "Nonforcing allows Pass matched candidate",
        forcingState: ForcingState.Nonforcing,
        candidates: [
          makeCandidate({ bidName: "matched-pass", isMatched: true, legal: true, resolvedCall: passCall }),
          makeCandidate({ bidName: "preferred-bid", isMatched: false, legal: true, priority: "preferred", resolvedCall: bidCall }),
        ],
        expectedBidName: "matched-pass",
        excludedBidNames: ["preferred-bid"],
      },
    ];

    test.each(scenarios)("$name", ({ candidates, forcingState, expectedBidName, excludedBidNames }) => {
      const { selected } = selectMatchedCandidate(candidates, undefined, forcingState);
      if (expectedBidName === null) {
        expect(selected).toBeNull();
      } else {
        expect(selected).not.toBeNull();
        expect(selected!.bidName).toBe(expectedBidName);
      }
      for (const excluded of excludedBidNames) {
        if (selected) {
          expect(selected.bidName).not.toBe(excluded);
        }
      }
    });
  });

  test("returns matched+legal candidate when present", () => {
    const candidates = [
      makeCandidate({ isMatched: true, legal: true }),
      makeCandidate({ isMatched: false, legal: true }),
    ];
    const result = selectMatchedCandidate(candidates);
    expect(result.selected).toBe(candidates[0]);
  });

  test("returns null when no candidates (empty array)", () => {
    expect(selectMatchedCandidate([]).selected).toBeNull();
  });

  test("returns null when matched candidate is illegal", () => {
    const candidates = [
      makeCandidate({ isMatched: true, legal: false }),
      makeCandidate({ isMatched: false, legal: true }),
    ];
    expect(selectMatchedCandidate(candidates).selected).toBeNull();
  });

  test("skips non-matched candidates even if legal", () => {
    const candidates = [
      makeCandidate({ isMatched: false, legal: true }),
      makeCandidate({ isMatched: false, legal: true }),
    ];
    expect(selectMatchedCandidate(candidates).selected).toBeNull();
  });

  describe("tiered selection with priority", () => {
    test("matched+legal wins over preferred+legal", () => {
      const matched = makeCandidate({ isMatched: true, legal: true, bidName: "matched" });
      const preferred = makeCandidate({ isMatched: false, legal: true, bidName: "preferred", priority: "preferred" });
      const result = selectMatchedCandidate([preferred, matched]);
      expect(result.selected).toBe(matched);
    });

    test("preferred+legal selected when no matched+legal", () => {
      const preferred = makeCandidate({ isMatched: false, legal: true, bidName: "preferred", priority: "preferred" });
      const other = makeCandidate({ isMatched: false, legal: true, bidName: "other" });
      const result = selectMatchedCandidate([other, preferred]);
      expect(result.selected).toBe(preferred);
    });

    test("preferred+legal selected when matched is illegal", () => {
      const matched = makeCandidate({ isMatched: true, legal: false, bidName: "matched" });
      const preferred = makeCandidate({ isMatched: false, legal: true, bidName: "preferred", priority: "preferred" });
      const result = selectMatchedCandidate([matched, preferred]);
      expect(result.selected).toBe(preferred);
    });

    test("alternative+legal selected when no matched and no preferred", () => {
      const alt = makeCandidate({ isMatched: false, legal: true, bidName: "alt", priority: "alternative" });
      const result = selectMatchedCandidate([alt]);
      expect(result.selected).toBe(alt);
    });

    test("alternative NOT selected when preferred exists", () => {
      const preferred = makeCandidate({ isMatched: false, legal: true, bidName: "preferred", priority: "preferred" });
      const alt = makeCandidate({ isMatched: false, legal: true, bidName: "alt", priority: "alternative" });
      const result = selectMatchedCandidate([alt, preferred]);
      expect(result.selected).toBe(preferred);
    });

    test("alternative+illegal skipped", () => {
      const alt = makeCandidate({ isMatched: false, legal: false, bidName: "alt", priority: "alternative" });
      const result = selectMatchedCandidate([alt]);
      expect(result.selected).toBeNull();
    });

    test("without priority field, behavior unchanged", () => {
      const matched = makeCandidate({ isMatched: true, legal: true });
      const other = makeCandidate({ isMatched: false, legal: true });
      const result = selectMatchedCandidate([other, matched]);
      expect(result.selected).toBe(matched);
    });
  });

  describe("satisfiability guard", () => {
    test("preferred+legal candidate with failedConditions is excluded", () => {
      const candidate = makeCandidate({
        isMatched: false,
        legal: true,
        priority: "preferred",
        failedConditions: [{ name: "hcp-min", description: "Need 10+ HCP" }],
      });

      expect(selectMatchedCandidate([candidate]).selected).toBeNull();
    });

    test("alternative+legal candidate with failedConditions is excluded", () => {
      const candidate = makeCandidate({
        isMatched: false,
        legal: true,
        priority: "alternative",
        failedConditions: [{ name: "suit-min", description: "Need 4+ hearts" }],
      });

      expect(selectMatchedCandidate([candidate]).selected).toBeNull();
    });

    test("overlay-injected candidate with empty failedConditions passes through", () => {
      const candidate = makeCandidate({
        isMatched: false,
        legal: true,
        priority: "preferred",
        failedConditions: [],
      });

      expect(selectMatchedCandidate([candidate]).selected).toBe(candidate);
    });

    test("satisfiable preferred beats unsatisfiable preferred", () => {
      const good = makeCandidate({
        bidName: "good",
        isMatched: false,
        legal: true,
        priority: "preferred",
        failedConditions: [],
      });
      const bad = makeCandidate({
        bidName: "bad",
        isMatched: false,
        legal: true,
        priority: "preferred",
        failedConditions: [{ name: "hcp-min", description: "Need 10+ HCP" }],
      });

      const result = selectMatchedCandidate([bad, good]);
      expect(result.selected).toBe(good);
    });

    test("matched candidate selection unchanged", () => {
      const matched = makeCandidate({ isMatched: true, legal: true });
      const result = selectMatchedCandidate([matched]);
      expect(result.selected).toBe(matched);
    });
  });

  describe("forcing state enforcement", () => {
    const passCall: Call = { type: "pass" };
    const bidCall: Call = { type: "bid", level: 2, strain: BidSuit.Hearts };

    test("excludes Pass candidate when ForcingOneRound → null", () => {
      const candidates = [
        makeCandidate({ isMatched: true, legal: true, resolvedCall: passCall }),
      ];
      expect(selectMatchedCandidate(candidates, undefined, ForcingState.ForcingOneRound).selected).toBeNull();
    });

    test("excludes Pass candidate when GameForcing → null", () => {
      const candidates = [
        makeCandidate({ isMatched: true, legal: true, resolvedCall: passCall }),
      ];
      expect(selectMatchedCandidate(candidates, undefined, ForcingState.GameForcing).selected).toBeNull();
    });

    test("allows Pass when Nonforcing → returns candidate", () => {
      const candidates = [
        makeCandidate({ isMatched: true, legal: true, resolvedCall: passCall }),
      ];
      expect(selectMatchedCandidate(candidates, undefined, ForcingState.Nonforcing).selected).toBe(candidates[0]);
    });

    test("selects non-Pass when Pass is force-filtered → returns non-Pass candidate", () => {
      const passCand = makeCandidate({ isMatched: true, legal: true, resolvedCall: passCall, bidName: "pass" });
      const bidCand = makeCandidate({ isMatched: false, legal: true, resolvedCall: bidCall, bidName: "bid", priority: "preferred" });
      const result = selectMatchedCandidate([passCand, bidCand], undefined, ForcingState.ForcingOneRound);
      expect(result.selected).toBe(bidCand);
    });

    test("non-Pass candidates unaffected by forcing filter", () => {
      const candidates = [
        makeCandidate({ isMatched: true, legal: true, resolvedCall: bidCall }),
      ];
      expect(selectMatchedCandidate(candidates, undefined, ForcingState.ForcingOneRound).selected).toBe(candidates[0]);
    });

    test("PassForcing allows only Pass candidates (non-Pass matched is excluded)", () => {
      const passPreferred = makeCandidate({
        bidName: "pass-preferred",
        isMatched: false,
        legal: true,
        priority: "preferred",
        resolvedCall: passCall,
      });
      const nonPassMatched = makeCandidate({
        bidName: "non-pass-matched",
        isMatched: true,
        legal: true,
        resolvedCall: bidCall,
      });

      const { selected } = selectMatchedCandidate(
        [nonPassMatched, passPreferred],
        undefined,
        ForcingState.PassForcing,
      );

      expect(selected).toBe(passPreferred);
    });

    test("PassForcing returns null when only non-Pass candidates exist", () => {
      const nonPassOnly = makeCandidate({
        bidName: "non-pass-only",
        isMatched: true,
        legal: true,
        resolvedCall: bidCall,
      });

      const { selected } = selectMatchedCandidate(
        [nonPassOnly],
        undefined,
        ForcingState.PassForcing,
      );

      expect(selected).toBeNull();
    });
  });

  describe("selection invariants", () => {
    test("candidate without isMatched and without priority is never selected", () => {
      const plainCandidate = makeCandidate({
        bidName: "plain",
        isMatched: false,
        legal: true,
      });
      const { selected } = selectMatchedCandidate([plainCandidate]);
      expect(selected).toBeNull();
    });
  });

  describe("ranking seam", () => {
    test("without ranker: behavior unchanged", () => {
      const candidates = [
        makeCandidate({ isMatched: true, legal: true, bidName: "first" }),
        makeCandidate({ isMatched: true, legal: true, bidName: "second" }),
      ];
      const result = selectMatchedCandidate(candidates);
      expect(result.selected!.bidName).toBe("first");
    });

    test("with ranker: ranker reorders before selection", () => {
      const candidates = [
        makeCandidate({ isMatched: true, legal: true, bidName: "first" }),
        makeCandidate({ isMatched: true, legal: true, bidName: "second" }),
      ];
      const ranker = (cs: readonly ResolvedCandidate[]) => [...cs].reverse();
      const result = selectMatchedCandidate(candidates, ranker);
      expect(result.selected!.bidName).toBe("second");
    });

    test("ranker returns empty array: returns null", () => {
      const candidates = [
        makeCandidate({ isMatched: true, legal: true }),
      ];
      const ranker = () => [] as ResolvedCandidate[];
      const result = selectMatchedCandidate(candidates, ranker);
      expect(result.selected).toBeNull();
    });
  });

  describe("obligation-aware filtering", () => {
    const passCall: Call = { type: "pass" };
    const bidCall: Call = { type: "bid", level: 2, strain: BidSuit.Hearts };
    const ntCall: Call = { type: "bid", level: 1, strain: BidSuit.NoTrump };

    const bidSuitObligation: Obligation = { kind: ObligationKind.BidSuit, obligatedSide: "responder" };
    const showMajorObligation: Obligation = { kind: ObligationKind.ShowMajor, obligatedSide: "opener" };
    const noneObligation: Obligation = { kind: ObligationKind.None, obligatedSide: "opener" };

    test("BidSuit obligation filters out Pass candidates", () => {
      const passCand = makeCandidate({ bidName: "pass", isMatched: true, legal: true, resolvedCall: passCall });
      const bidCand = makeCandidate({ bidName: "bid", isMatched: false, legal: true, priority: "preferred", resolvedCall: bidCall });
      const { selected } = selectMatchedCandidate([passCand, bidCand], undefined, undefined, bidSuitObligation);
      expect(selected).not.toBeNull();
      expect(selected!.bidName).toBe("bid");
    });

    test("BidSuit obligation allows NT candidates (context-dependent)", () => {
      const ntCand = makeCandidate({ bidName: "nt", isMatched: true, legal: true, resolvedCall: ntCall });
      const { selected } = selectMatchedCandidate([ntCand], undefined, undefined, bidSuitObligation);
      expect(selected).not.toBeNull();
      expect(selected!.bidName).toBe("nt");
    });

    test("BidSuit obligation returns null when only Pass candidates exist", () => {
      const passCand = makeCandidate({ bidName: "pass", isMatched: true, legal: true, resolvedCall: passCall });
      expect(selectMatchedCandidate([passCand], undefined, undefined, bidSuitObligation).selected).toBeNull();
    });

    test("ShowMajor obligation does not filter (informational)", () => {
      const passCand = makeCandidate({ bidName: "pass", isMatched: true, legal: true, resolvedCall: passCall });
      const { selected } = selectMatchedCandidate([passCand], undefined, undefined, showMajorObligation);
      expect(selected).not.toBeNull();
      expect(selected!.bidName).toBe("pass");
    });

    test("None obligation = no change from current behavior", () => {
      const passCand = makeCandidate({ bidName: "pass", isMatched: true, legal: true, resolvedCall: passCall });
      const { selected } = selectMatchedCandidate([passCand], undefined, undefined, noneObligation);
      expect(selected).not.toBeNull();
      expect(selected!.bidName).toBe("pass");
    });

    test("no obligation parameter = no change from current behavior", () => {
      const passCand = makeCandidate({ bidName: "pass", isMatched: true, legal: true, resolvedCall: passCall });
      const { selected } = selectMatchedCandidate([passCand]);
      expect(selected).not.toBeNull();
      expect(selected!.bidName).toBe("pass");
    });

    test("BidSuit obligation composes with forcing state", () => {
      // Both forcing state AND obligation reject Pass — non-Pass preferred wins
      const passCand = makeCandidate({ bidName: "pass", isMatched: true, legal: true, resolvedCall: passCall });
      const bidCand = makeCandidate({ bidName: "bid", isMatched: false, legal: true, priority: "preferred", resolvedCall: bidCall });
      const { selected } = selectMatchedCandidate([passCand, bidCand], undefined, ForcingState.ForcingOneRound, bidSuitObligation);
      expect(selected).not.toBeNull();
      expect(selected!.bidName).toBe("bid");
    });
  });

  describe("orderKey-based selection within tier", () => {
    test("same-tier candidates: lower orderKey wins", () => {
      const candidates = [
        makeCandidate({ bidName: "second", isMatched: true, legal: true, orderKey: 2 }),
        makeCandidate({ bidName: "first", isMatched: true, legal: true, orderKey: 1 }),
      ];
      const result = selectMatchedCandidate(candidates);
      expect(result.selected!.bidName).toBe("first");
    });

    test("preferred tier: lower orderKey wins", () => {
      const candidates = [
        makeCandidate({ bidName: "pref-b", isMatched: false, legal: true, priority: "preferred", orderKey: 5 }),
        makeCandidate({ bidName: "pref-a", isMatched: false, legal: true, priority: "preferred", orderKey: 3 }),
      ];
      const result = selectMatchedCandidate(candidates);
      expect(result.selected!.bidName).toBe("pref-a");
    });
  });

  describe("tier-peer detection", () => {
    test("single matched → tierPeers empty", () => {
      const candidates = [
        makeCandidate({ bidName: "sole-match", isMatched: true, legal: true }),
      ];
      const result = selectMatchedCandidate(candidates);
      expect(result.selected).toBe(candidates[0]);
      expect(result.tierPeers).toEqual([]);
      expect(result.rankerApplied).toBe(false);
    });

    test("2+ matched, no ranker → tierPeers has extras, selected is first", () => {
      const candidates = [
        makeCandidate({ bidName: "first-match", isMatched: true, legal: true }),
        makeCandidate({ bidName: "second-match", isMatched: true, legal: true }),
      ];
      const result = selectMatchedCandidate(candidates);
      expect(result.selected!.bidName).toBe("first-match");
      expect(result.tierPeers).toHaveLength(1);
      expect(result.tierPeers[0]!.bidName).toBe("second-match");
    });

    test("2+ matched, ranker applied → tierPeers empty, rankerApplied: true", () => {
      const candidates = [
        makeCandidate({ bidName: "first-match", isMatched: true, legal: true }),
        makeCandidate({ bidName: "second-match", isMatched: true, legal: true }),
      ];
      const ranker = (cs: readonly ResolvedCandidate[]) => [...cs].reverse();
      const result = selectMatchedCandidate(candidates, ranker);
      expect(result.selected!.bidName).toBe("second-match");
      expect(result.tierPeers).toEqual([]);
      expect(result.rankerApplied).toBe(true);
    });

    test("tier peers in preferred tier (no matched candidates)", () => {
      const candidates = [
        makeCandidate({ bidName: "pref-a", isMatched: false, legal: true, priority: "preferred" }),
        makeCandidate({ bidName: "pref-b", isMatched: false, legal: true, priority: "preferred" }),
      ];
      const result = selectMatchedCandidate(candidates);
      expect(result.selected!.bidName).toBe("pref-a");
      expect(result.tierPeers).toHaveLength(1);
      expect(result.tierPeers[0]!.bidName).toBe("pref-b");
    });

    test("tier peers in alternative tier", () => {
      const candidates = [
        makeCandidate({ bidName: "alt-a", isMatched: false, legal: true, priority: "alternative" }),
        makeCandidate({ bidName: "alt-b", isMatched: false, legal: true, priority: "alternative" }),
      ];
      const result = selectMatchedCandidate(candidates);
      expect(result.selected!.bidName).toBe("alt-a");
      expect(result.tierPeers).toHaveLength(1);
      expect(result.tierPeers[0]!.bidName).toBe("alt-b");
    });

    test("2+ matched with ranker → preRankingPeers contains all matched, tierPeers empty", () => {
      const candidates = [
        makeCandidate({ bidName: "first-match", isMatched: true, legal: true, orderKey: 0 }),
        makeCandidate({ bidName: "second-match", isMatched: true, legal: true, orderKey: 1 }),
      ];
      const ranker = (cs: readonly ResolvedCandidate[]) => [...cs].reverse();
      const result = selectMatchedCandidate(candidates, ranker);
      expect(result.selected!.bidName).toBe("second-match");
      expect(result.tierPeers).toEqual([]);
      expect(result.preRankingPeers).toHaveLength(2);
      expect(result.preRankingPeers.map(c => c.bidName)).toContain("first-match");
      expect(result.preRankingPeers.map(c => c.bidName)).toContain("second-match");
    });

    test("no ranker → preRankingPeers equals tierPeers + selected", () => {
      const candidates = [
        makeCandidate({ bidName: "first-match", isMatched: true, legal: true, orderKey: 0 }),
        makeCandidate({ bidName: "second-match", isMatched: true, legal: true, orderKey: 1 }),
      ];
      const result = selectMatchedCandidate(candidates);
      expect(result.selected!.bidName).toBe("first-match");
      expect(result.tierPeers).toHaveLength(1);
      // Without ranker, preRankingPeers equals the full tier set
      expect(result.preRankingPeers).toHaveLength(2);
    });

    test("single candidate → preRankingPeers has 1 entry", () => {
      const candidates = [
        makeCandidate({ bidName: "sole", isMatched: true, legal: true }),
      ];
      const result = selectMatchedCandidate(candidates);
      expect(result.preRankingPeers).toHaveLength(1);
    });

    test("rankerApplied true even with single candidate when ranker provided", () => {
      const candidates = [
        makeCandidate({ bidName: "sole", isMatched: true, legal: true }),
      ];
      const ranker = (cs: readonly ResolvedCandidate[]) => cs;
      const result = selectMatchedCandidate(candidates, ranker);
      expect(result.selected!.bidName).toBe("sole");
      expect(result.tierPeers).toEqual([]);
      expect(result.rankerApplied).toBe(true);
    });
  });
});

describe("isSelectable", () => {
  test("all dimensions satisfied → selectable", () => {
    const c = makeCandidate({ isMatched: true, legal: true });
    expect(isSelectable(c)).toBe(true);
  });

  test("hand unsatisfied → not selectable", () => {
    const c = makeCandidate({
      isMatched: true,
      legal: true,
      failedConditions: [{ name: "hcp", description: "Need 10+ HCP" }],
    });
    expect(isSelectable(c)).toBe(false);
  });

  test("protocol unsatisfied → not selectable", () => {
    const c = makeCandidate({
      isMatched: true,
      legal: true,
      eligibility: buildEligibility([], true, false, ["suppressed by overlay"]),
    });
    expect(isSelectable(c)).toBe(false);
  });

  test("encoding illegal → not selectable", () => {
    const c = makeCandidate({ isMatched: true, legal: false });
    expect(isSelectable(c)).toBe(false);
  });

  test("pedagogically unacceptable → still selectable (pedagogy is post-selection annotation)", () => {
    const c = makeCandidate({
      isMatched: true,
      legal: true,
      eligibility: {
        hand: { satisfied: true, failedConditions: [] },
        protocol: { satisfied: true, reasons: [] },
        encoding: { legal: true },
        pedagogical: { acceptable: false, reasons: ["not teachable"] },
      },
    });
    expect(isSelectable(c)).toBe(true);
  });

  test("multiple dimensions unsatisfied → not selectable", () => {
    const c = makeCandidate({
      isMatched: true,
      legal: false,
      failedConditions: [{ name: "hcp", description: "Need 10+ HCP" }],
    });
    expect(isSelectable(c)).toBe(false);
  });
});

describe("isPedagogicallyAcceptable", () => {
  test("acceptable pedagogical dimension → true", () => {
    const c = makeCandidate({ isMatched: true, legal: true });
    expect(isPedagogicallyAcceptable(c)).toBe(true);
  });

  test("unacceptable pedagogical dimension → false", () => {
    const c = makeCandidate({
      isMatched: true,
      legal: true,
      eligibility: {
        hand: { satisfied: true, failedConditions: [] },
        protocol: { satisfied: true, reasons: [] },
        encoding: { legal: true },
        pedagogical: { acceptable: false, reasons: ["not teachable"] },
      },
    });
    expect(isPedagogicallyAcceptable(c)).toBe(false);
  });
});
