import { describe, it, expect } from "vitest";
import { collectMatchingClaims } from "../rule-interpreter";
import type { RuleModule } from "../../rule-module";
import type { AuctionContext, CommittedStep } from "../../../../core/contracts/committed-step";
import { INITIAL_NEGOTIATION } from "../../../../core/contracts/committed-step";
import type { NegotiationState } from "../../../../core/contracts/committed-step";
import type { BidMeaning } from "../../../../core/contracts/meaning";
import type { PublicSnapshot } from "../../../../core/contracts/module-surface";
import { Seat } from "../../../../engine/types";

function makeSurface(id: string): BidMeaning {
  return {
    meaningId: id,
    semanticClassId: `test:${id}`,
    teachingLabel: id,
    clauses: [],
    sourceIntent: { type: "Test", params: {} },
    encoding: { kind: "direct", defaultCall: { type: "pass" } },
    ranking: {
      recommendationBand: "preferred",
      intraModuleOrder: 0,
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

  it("collects surfaces from a single matching rule", () => {
    const surface = makeSurface("stayman-ask");
    const mod: RuleModule<"idle" | "opened"> = {
      id: "stayman",
      local: {
        initial: "idle",
        transitions: [
          { from: "idle", to: "opened", on: { act: "open", strain: "notrump" } },
        ],
      },
      rules: [
        {
          match: { local: "opened" },
          claims: [{ surface }],
        },
      ],
      facts: { definitions: [], evaluators: new Map() },
    };

    const log = [
      makeStep([{ act: "open", strain: "notrump" }]),
    ];

    const result = collectMatchingClaims([mod], makeContext(log));
    expect(result).toHaveLength(1);
    expect(result[0]!.moduleId).toBe("stayman");
    expect(result[0]!.surfaces).toHaveLength(1);
    expect(result[0]!.surfaces[0]!.meaningId).toBe("stayman-ask");
  });

  it("filters by local phase constraint", () => {
    const surface = makeSurface("stayman-ask");
    const mod: RuleModule<"idle" | "opened"> = {
      id: "stayman",
      local: {
        initial: "idle",
        transitions: [
          { from: "idle", to: "opened", on: { act: "open", strain: "notrump" } },
        ],
      },
      rules: [
        {
          match: { local: "opened" },
          claims: [{ surface }],
        },
      ],
      facts: { definitions: [], evaluators: new Map() },
    };

    // Empty log → module is in "idle" phase, not "opened"
    const result = collectMatchingClaims([mod], makeContext([]));
    expect(result).toHaveLength(0);
  });

  it("filters by kernel constraint", () => {
    const surface = makeSurface("test");
    const mod: RuleModule<"idle"> = {
      id: "test-mod",
      local: { initial: "idle", transitions: [] },
      rules: [
        {
          match: {
            local: "idle",
            kernel: { kind: "forcing", level: "game" },
          },
          claims: [{ surface }],
        },
      ],
      facts: { definitions: [], evaluators: new Map() },
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
    const mod: RuleModule<"idle"> = {
      id: "smolen",
      local: { initial: "idle", transitions: [] },
      rules: [
        {
          match: {
            local: "idle",
            route: {
              kind: "subseq",
              steps: [
                { act: "inquire", feature: "majorSuit" },
                { act: "deny", feature: "majorSuit" },
              ],
            },
          },
          claims: [{ surface }],
        },
      ],
      facts: { definitions: [], evaluators: new Map() },
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
    expect(result2[0]!.surfaces[0]!.meaningId).toBe("smolen-entry");
  });

  it("collects surfaces from multiple modules", () => {
    const s1 = makeSurface("s1");
    const s2 = makeSurface("s2");

    const mod1: RuleModule<"active"> = {
      id: "mod1",
      local: { initial: "active", transitions: [] },
      rules: [{ match: { local: "active" }, claims: [{ surface: s1 }] }],
      facts: { definitions: [], evaluators: new Map() },
    };
    const mod2: RuleModule<"active"> = {
      id: "mod2",
      local: { initial: "active", transitions: [] },
      rules: [{ match: { local: "active" }, claims: [{ surface: s2 }] }],
      facts: { definitions: [], evaluators: new Map() },
    };

    const result = collectMatchingClaims([mod1, mod2], makeContext([]));
    expect(result).toHaveLength(2);
    expect(result[0]!.moduleId).toBe("mod1");
    expect(result[1]!.moduleId).toBe("mod2");
  });

  it("returns empty when no rules match", () => {
    const mod: RuleModule<"idle"> = {
      id: "empty",
      local: { initial: "idle", transitions: [] },
      rules: [
        {
          match: { local: "idle", kernel: { kind: "forcing", level: "game" } },
          claims: [{ surface: makeSurface("test") }],
        },
      ],
      facts: { definitions: [], evaluators: new Map() },
    };

    const result = collectMatchingClaims([mod], makeContext([]));
    expect(result).toHaveLength(0);
  });

  it("collects surfaces from multiple matching rules in same module", () => {
    const s1 = makeSurface("s1");
    const s2 = makeSurface("s2");

    const mod: RuleModule<"active"> = {
      id: "multi-rule",
      local: { initial: "active", transitions: [] },
      rules: [
        { match: { local: "active" }, claims: [{ surface: s1 }] },
        { match: { local: "active" }, claims: [{ surface: s2 }] },
      ],
      facts: { definitions: [], evaluators: new Map() },
    };

    const result = collectMatchingClaims([mod], makeContext([]));
    expect(result).toHaveLength(1);
    expect(result[0]!.surfaces).toHaveLength(2);
  });
});
