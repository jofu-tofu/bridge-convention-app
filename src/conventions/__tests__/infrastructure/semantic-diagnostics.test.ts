// Integration tests for semantic overlap/unreachability/transition-rule analyzers.

import { describe, test, expect } from "vitest";
import { BidSuit } from "../../../engine/types";
import type { AuctionCondition, ConventionConfig } from "../../core/types";
import { ConventionCategory } from "../../core/types";
import type { SemanticTrigger } from "../../core/protocol/protocol";
import type { TransitionRule, TransitionRuleDescriptor } from "../../core/dialogue/dialogue-transitions";
import { ObligationKind, ForcingState } from "../../core/dialogue/dialogue-state";
import { intentBid } from "../../core/intent/intent-node";
import { SemanticIntentType } from "../../core/intent/semantic-intent";
import {
  analyzeIntraRoundShadowing,
  analyzeCrossRoundUnreachable,
  analyzeTransitionRuleOverlap,
} from "../../core/diagnostics";

// ─── Helpers ─────────────────────────────────────────────────

function makeTree() {
  return intentBid(
    "test-bid",
    "Test",
    { type: SemanticIntentType.NaturalBid, params: {} },
    () => ({ type: "bid" as const, level: 1, strain: BidSuit.Clubs }),
  );
}

function makeTrigger(condition: AuctionCondition): SemanticTrigger {
  return { condition, establishes: {} };
}

function makeConfig(overrides: Partial<ConventionConfig> & { id: string }): ConventionConfig {
  const tree = makeTree();
  return {
    name: overrides.id,
    description: "Test",
    category: ConventionCategory.Asking,
    dealConstraints: { seats: [] },
    protocol: {
      id: `${overrides.id}-protocol`,
      rounds: [{ name: "round1", triggers: [makeTrigger({
        name: "dummy",
        label: "Dummy",
        category: "auction",
        test: () => true,
        describe: () => "dummy",
      })], handTree: () => tree }],
    },
    ...overrides,
  };
}

function condWithDescriptor(name: string, descriptor: AuctionCondition["descriptor"]): AuctionCondition {
  return {
    name,
    label: name,
    category: "auction",
    descriptor,
    test: () => true,
    describe: () => name,
  };
}

// ─── analyzeIntraRoundShadowing ──────────────────────────────

describe("analyzeIntraRoundShadowing", () => {
  test("cursorReached subsumes bidMade → shadow warning", () => {
    const tree = makeTree();
    const config = makeConfig({
      id: "shadow-test",
      protocol: {
        id: "shadow-protocol",
        rounds: [{
          name: "round1",
          triggers: [
            makeTrigger(condWithDescriptor("cursor-reached", { kind: "cursor-reached" })),
            makeTrigger(condWithDescriptor("bid-made-1NT", { kind: "bid-made", level: 1, strain: BidSuit.NoTrump, actor: "any" })),
          ],
          handTree: () => tree,
        }],
      },
    });

    const warnings = analyzeIntraRoundShadowing(config);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.type).toBe("trigger-shadow");
    expect(warnings[0]!.message).toContain("subsumes");
  });

  test("bidMadeAtLevel(3) subsumes bidMade(3, C) → shadow warning", () => {
    const tree = makeTree();
    const config = makeConfig({
      id: "level-shadow",
      protocol: {
        id: "level-shadow-protocol",
        rounds: [{
          name: "round1",
          triggers: [
            makeTrigger(condWithDescriptor("bid-at-level-3", { kind: "bid-at-level", level: 3, actor: "any" })),
            makeTrigger(condWithDescriptor("bid-made-3C", { kind: "bid-made", level: 3, strain: BidSuit.Clubs, actor: "any" })),
          ],
          handTree: () => tree,
        }],
      },
    });

    const warnings = analyzeIntraRoundShadowing(config);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.type).toBe("trigger-shadow");
  });

  test("bidMade(1, NT) and bidMade(2, C) → no shadow", () => {
    const tree = makeTree();
    const config = makeConfig({
      id: "no-shadow",
      protocol: {
        id: "no-shadow-protocol",
        rounds: [{
          name: "round1",
          triggers: [
            makeTrigger(condWithDescriptor("bid-1NT", { kind: "bid-made", level: 1, strain: BidSuit.NoTrump, actor: "any" })),
            makeTrigger(condWithDescriptor("bid-2C", { kind: "bid-made", level: 2, strain: BidSuit.Clubs, actor: "any" })),
          ],
          handTree: () => tree,
        }],
      },
    });

    const warnings = analyzeIntraRoundShadowing(config);
    expect(warnings).toHaveLength(0);
  });

  test("triggers without descriptors → no warning (conservative)", () => {
    const tree = makeTree();
    const config = makeConfig({
      id: "no-desc-shadow",
      protocol: {
        id: "no-desc-shadow-protocol",
        rounds: [{
          name: "round1",
          triggers: [
            makeTrigger({ name: "a", label: "A", category: "auction", test: () => true, describe: () => "a" }),
            makeTrigger({ name: "b", label: "B", category: "auction", test: () => true, describe: () => "b" }),
          ],
          handTree: () => tree,
        }],
      },
    });

    const warnings = analyzeIntraRoundShadowing(config);
    expect(warnings).toHaveLength(0);
  });
});

// ─── analyzeCrossRoundUnreachable ────────────────────────────

describe("analyzeCrossRoundUnreachable", () => {
  test("two rounds with same trigger, no seatFilter → unreachable warning", () => {
    const tree = makeTree();
    const desc = { kind: "bid-made" as const, level: 1, strain: BidSuit.NoTrump, actor: "any" as const };
    const config = makeConfig({
      id: "cross-unreachable",
      protocol: {
        id: "cross-unreachable-protocol",
        rounds: [
          { name: "round1", triggers: [makeTrigger(condWithDescriptor("bid-1NT", desc))], handTree: () => tree },
          { name: "round2", triggers: [makeTrigger(condWithDescriptor("bid-1NT", desc))], handTree: () => tree },
        ],
      },
    });

    const warnings = analyzeCrossRoundUnreachable(config);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.type).toBe("unreachable-node");
  });

  test("two rounds with same trigger, disjoint seatFilters → NO warning (Bergen pattern)", () => {
    const tree = makeTree();
    const desc = { kind: "cursor-reached" as const };
    const config = makeConfig({
      id: "bergen-pattern",
      protocol: {
        id: "bergen-protocol",
        rounds: [
          {
            name: "opener-round",
            triggers: [makeTrigger(condWithDescriptor("cursor", desc))],
            handTree: () => tree,
            seatFilter: condWithDescriptor("isOpener", { kind: "role", role: "opener" }),
          },
          {
            name: "responder-round",
            triggers: [makeTrigger(condWithDescriptor("cursor", desc))],
            handTree: () => tree,
            seatFilter: condWithDescriptor("isResponder", { kind: "role", role: "responder" }),
          },
        ],
      },
    });

    const warnings = analyzeCrossRoundUnreachable(config);
    expect(warnings).toHaveLength(0);
  });

  test("two rounds with cursorReached, disjoint seatFilters → NO warning (Weak Twos pattern)", () => {
    const tree = makeTree();
    const config = makeConfig({
      id: "weak-twos-pattern",
      protocol: {
        id: "weak-twos-protocol",
        rounds: [
          {
            name: "round2",
            triggers: [makeTrigger(condWithDescriptor("cursor", { kind: "cursor-reached" }))],
            handTree: () => tree,
            seatFilter: condWithDescriptor("isResponder", { kind: "role", role: "responder" }),
          },
          {
            name: "round3",
            triggers: [makeTrigger(condWithDescriptor("cursor", { kind: "cursor-reached" }))],
            handTree: () => tree,
            seatFilter: condWithDescriptor("isOpener", { kind: "role", role: "opener" }),
          },
        ],
      },
    });

    const warnings = analyzeCrossRoundUnreachable(config);
    expect(warnings).toHaveLength(0);
  });

  test("two rounds with non-overlapping triggers → no warning", () => {
    const tree = makeTree();
    const config = makeConfig({
      id: "non-overlap",
      protocol: {
        id: "non-overlap-protocol",
        rounds: [
          { name: "round1", triggers: [makeTrigger(condWithDescriptor("bid-1NT", { kind: "bid-made", level: 1, strain: BidSuit.NoTrump, actor: "any" }))], handTree: () => tree },
          { name: "round2", triggers: [makeTrigger(condWithDescriptor("bid-2C", { kind: "bid-made", level: 2, strain: BidSuit.Clubs, actor: "any" }))], handTree: () => tree },
        ],
      },
    });

    const warnings = analyzeCrossRoundUnreachable(config);
    expect(warnings).toHaveLength(0);
  });
});

// ─── analyzeTransitionRuleOverlap ────────────────────────────

describe("analyzeTransitionRuleOverlap", () => {
  function makeRule(id: string, matchDescriptor?: TransitionRuleDescriptor): TransitionRule {
    return {
      id,
      matchDescriptor,
      matches: () => true,
      effects: () => ({ setForcingState: ForcingState.Nonforcing }),
    };
  }

  test("two rules with same familyId + same call → overlap warning", () => {
    const config = makeConfig({
      id: "transition-overlap",
      transitionRules: [
        makeRule("rule-a", { familyId: "1nt", callType: "bid", level: 2, strain: BidSuit.Clubs }),
        makeRule("rule-b", { familyId: "1nt", callType: "bid", level: 2, strain: BidSuit.Clubs }),
      ],
    });

    const warnings = analyzeTransitionRuleOverlap(config);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.type).toBe("transition-rule-overlap");
    expect(warnings[0]!.message).toContain("rule-a");
    expect(warnings[0]!.message).toContain("rule-b");
  });

  test("rules with different familyId → no warning", () => {
    const config = makeConfig({
      id: "diff-family",
      transitionRules: [
        makeRule("rule-a", { familyId: "1nt", callType: "bid", level: 2, strain: BidSuit.Clubs }),
        makeRule("rule-b", { familyId: "2nt", callType: "bid", level: 2, strain: BidSuit.Clubs }),
      ],
    });

    const warnings = analyzeTransitionRuleOverlap(config);
    expect(warnings).toHaveLength(0);
  });

  test("rules without descriptors → no warning", () => {
    const config = makeConfig({
      id: "no-desc-rules",
      transitionRules: [
        makeRule("rule-a"),
        makeRule("rule-b"),
      ],
    });

    const warnings = analyzeTransitionRuleOverlap(config);
    expect(warnings).toHaveLength(0);
  });

  test("rules with different obligationKind → no warning", () => {
    const config = makeConfig({
      id: "diff-obligation",
      transitionRules: [
        makeRule("rule-a", { familyId: "1nt", obligationKind: ObligationKind.ShowMajor }),
        makeRule("rule-b", { familyId: "1nt", obligationKind: ObligationKind.None }),
      ],
    });

    const warnings = analyzeTransitionRuleOverlap(config);
    expect(warnings).toHaveLength(0);
  });
});
