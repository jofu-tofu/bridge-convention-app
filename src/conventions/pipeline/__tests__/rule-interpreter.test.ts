import { describe, it, expect } from "vitest";
import { collectMatchingClaims } from "../observation/rule-interpreter";
import type { ConventionModule } from "../../core/convention-module";
import type { AuctionContext, CommittedStep } from "../../core/committed-step";
import { INITIAL_NEGOTIATION } from "../../core/committed-step";
import type { NegotiationState } from "../../core/committed-step";
import type { BidMeaning } from "../evaluation/meaning";
import type { PublicSnapshot } from "../../core/module-surface";
import { Seat } from "../../../engine/types";
import { bidName, bidSummary, moduleDescription, modulePurpose, teachingTradeoff, teachingPrinciple } from "../../core/authored-text";
import type { TeachingLabel } from "../../core/authored-text";
import { HandStrength } from "../bid-action";

const tl = (name: string): TeachingLabel => ({ name: bidName(name), summary: bidSummary("[TODO] test") });

function makeSurface(id: string): BidMeaning {
  return {
    meaningId: id,
    semanticClassId: `test:${id}`,
    teachingLabel: tl(id),
    clauses: [],
    sourceIntent: { type: "Test", params: {} },
    encoding: { kind: "direct", defaultCall: { type: "pass" } },
    ranking: {
      recommendationBand: "preferred",
      declarationOrder: 0,
    },
  } as unknown as BidMeaning;
}

function makeStep(
  obs: CommittedStep["publicActions"],
  overrides: Partial<CommittedStep> = {},
): CommittedStep {
  return {
    actor: Seat.South,
    call: { type: "pass" },
    resolvedClaim: null,
    publicActions: obs,
    negotiationDelta: {},
    stateAfter: INITIAL_NEGOTIATION,
    status: "resolved",
    ...overrides,
  };
}

function makeContext(
  log: readonly CommittedStep[] = [],
  kernel?: NegotiationState,
): AuctionContext {
  // The last step's stateAfter is the current kernel
  const snapshot = {} as PublicSnapshot;
  return { snapshot, log };
}

describe("collectMatchingClaims", () => {
  it("returns empty for no modules", () => {
    const result = collectMatchingClaims([], makeContext());
    expect(result).toEqual([]);
  });

  it("collects surfaces from a single matching state entry", () => {
    const surface = makeSurface("stayman-ask");
    const mod: ConventionModule<"idle" | "opened"> = {
      moduleId: "stayman",
      description: moduleDescription("test module description for interpreter"),
      purpose: modulePurpose("test purpose for interpreter module"),
      teaching: { tradeoff: teachingTradeoff("test tradeoff for module"), principle: teachingPrinciple("test principle for module"), commonMistakes: [] },
      local: {
        initial: "idle",
        transitions: [
          { from: "idle", to: "opened", on: { act: "open", strain: "notrump" } },
        ],
      },
      states: [
        { phase: "opened", surfaces: [surface] },
      ],
      facts: { definitions: [], evaluators: new Map() },
      explanationEntries: [],
    };

    const log = [
      makeStep([{ act: "open", strain: "notrump" }]),
    ];

    const result = collectMatchingClaims([mod], makeContext(log));
    expect(result).toHaveLength(1);
    expect(result[0]!.moduleId).toBe("stayman");
    expect(result[0]!.resolved).toHaveLength(1);
    expect(result[0]!.resolved[0]!.surface.meaningId).toBe("stayman-ask");
  });

  it("filters by local phase constraint", () => {
    const surface = makeSurface("stayman-ask");
    const mod: ConventionModule<"idle" | "opened"> = {
      moduleId: "stayman",
      description: moduleDescription("test module description for interpreter"),
      purpose: modulePurpose("test purpose for interpreter module"),
      teaching: { tradeoff: teachingTradeoff("test tradeoff for module"), principle: teachingPrinciple("test principle for module"), commonMistakes: [] },
      local: {
        initial: "idle",
        transitions: [
          { from: "idle", to: "opened", on: { act: "open", strain: "notrump" } },
        ],
      },
      states: [
        { phase: "opened", surfaces: [surface] },
      ],
      facts: { definitions: [], evaluators: new Map() },
      explanationEntries: [],
    };

    // Empty log → module is in "idle" phase, not "opened"
    const result = collectMatchingClaims([mod], makeContext([]));
    expect(result).toHaveLength(0);
  });

  it("filters by kernel constraint", () => {
    const surface = makeSurface("test");
    const mod: ConventionModule<"idle"> = {
      moduleId: "test-mod",
      description: moduleDescription("test module description for interpreter"),
      purpose: modulePurpose("test purpose for interpreter module"),
      teaching: { tradeoff: teachingTradeoff("test tradeoff for module"), principle: teachingPrinciple("test principle for module"), commonMistakes: [] },
      local: { initial: "idle", transitions: [] },
      states: [
        {
          phase: "idle",
          kernel: { kind: "forcing", level: HandStrength.Game },
          surfaces: [surface],
        },
      ],
      facts: { definitions: [], evaluators: new Map() },
      explanationEntries: [],
    };

    // Initial kernel has forcing: "none"
    const result = collectMatchingClaims([mod], makeContext([]));
    expect(result).toHaveLength(0);

    // With game-forcing kernel
    const step = makeStep([], {
      stateAfter: { ...INITIAL_NEGOTIATION, forcing: "game" },
    });
    const result2 = collectMatchingClaims([mod], makeContext([step]));
    expect(result2).toHaveLength(1);
  });

  it("filters by route constraint", () => {
    const surface = makeSurface("smolen-entry");
    const mod: ConventionModule<"idle"> = {
      moduleId: "smolen",
      description: moduleDescription("test module description for interpreter"),
      purpose: modulePurpose("test purpose for interpreter module"),
      teaching: { tradeoff: teachingTradeoff("test tradeoff for module"), principle: teachingPrinciple("test principle for module"), commonMistakes: [] },
      local: { initial: "idle", transitions: [] },
      states: [
        {
          phase: "idle",
          route: {
            kind: "subseq",
            steps: [
              { act: "inquire", feature: "majorSuit" },
              { act: "deny", feature: "majorSuit" },
            ],
          },
          surfaces: [surface],
        },
      ],
      facts: { definitions: [], evaluators: new Map() },
      explanationEntries: [],
    };

    // Log without the subsequence
    const result = collectMatchingClaims(
      [mod],
      makeContext([
        makeStep([{ act: "open", strain: "notrump" }]),
      ]),
    );
    expect(result).toHaveLength(0);

    // Log with the subsequence
    const result2 = collectMatchingClaims(
      [mod],
      makeContext([
        makeStep([{ act: "inquire", feature: "majorSuit" }]),
        makeStep([{ act: "pass" }]),
        makeStep([{ act: "deny", feature: "majorSuit" }]),
      ]),
    );
    expect(result2).toHaveLength(1);
    expect(result2[0]!.resolved[0]!.surface.meaningId).toBe("smolen-entry");
  });

  it("collects surfaces from multiple modules", () => {
    const s1 = makeSurface("s1");
    const s2 = makeSurface("s2");

    const mod1: ConventionModule<"active"> = {
      moduleId: "mod1",
      description: moduleDescription("test module description for interpreter"),
      purpose: modulePurpose("test purpose for interpreter module"),
      teaching: { tradeoff: teachingTradeoff("test tradeoff for module"), principle: teachingPrinciple("test principle for module"), commonMistakes: [] },
      local: { initial: "active", transitions: [] },
      states: [{ phase: "active", surfaces: [s1] }],
      facts: { definitions: [], evaluators: new Map() },
      explanationEntries: [],
    };
    const mod2: ConventionModule<"active"> = {
      moduleId: "mod2",
      description: moduleDescription("test module description for interpreter"),
      purpose: modulePurpose("test purpose for interpreter module"),
      teaching: { tradeoff: teachingTradeoff("test tradeoff for module"), principle: teachingPrinciple("test principle for module"), commonMistakes: [] },
      local: { initial: "active", transitions: [] },
      states: [{ phase: "active", surfaces: [s2] }],
      facts: { definitions: [], evaluators: new Map() },
      explanationEntries: [],
    };

    const result = collectMatchingClaims([mod1, mod2], makeContext([]));
    expect(result).toHaveLength(2);
    expect(result[0]!.moduleId).toBe("mod1");
    expect(result[1]!.moduleId).toBe("mod2");
  });

  it("returns empty when no state entries match", () => {
    const mod: ConventionModule<"idle"> = {
      moduleId: "empty",
      description: moduleDescription("test module description for interpreter"),
      purpose: modulePurpose("test purpose for interpreter module"),
      teaching: { tradeoff: teachingTradeoff("test tradeoff for module"), principle: teachingPrinciple("test principle for module"), commonMistakes: [] },
      local: { initial: "idle", transitions: [] },
      states: [
        {
          phase: "idle",
          kernel: { kind: "forcing", level: HandStrength.Game },
          surfaces: [makeSurface("test")],
        },
      ],
      facts: { definitions: [], evaluators: new Map() },
      explanationEntries: [],
    };

    const result = collectMatchingClaims([mod], makeContext([]));
    expect(result).toHaveLength(0);
  });

  it("collects surfaces from multiple matching state entries in same module", () => {
    const s1 = makeSurface("s1");
    const s2 = makeSurface("s2");

    const mod: ConventionModule<"active"> = {
      moduleId: "multi-rule",
      description: moduleDescription("test module description for interpreter"),
      purpose: modulePurpose("test purpose for interpreter module"),
      teaching: { tradeoff: teachingTradeoff("test tradeoff for module"), principle: teachingPrinciple("test principle for module"), commonMistakes: [] },
      local: { initial: "active", transitions: [] },
      states: [
        { phase: "active", surfaces: [s1] },
        { phase: "active", surfaces: [s2] },
      ],
      facts: { definitions: [], evaluators: new Map() },
      explanationEntries: [],
    };

    const result = collectMatchingClaims([mod], makeContext([]));
    expect(result).toHaveLength(1);
    expect(result[0]!.resolved).toHaveLength(2);
  });
});
