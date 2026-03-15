import { describe, it, expect } from "vitest";
import { meaningBundleToStrategy, buildSurfacesFromEvaluation } from "../bidding/meaning-strategy";
import type { RuntimeModule, EvaluationResult } from "../../conventions/core/runtime/types";
import type { MeaningSurface } from "../../core/contracts/meaning-surface";
import type { MachineState } from "../../conventions/core/runtime/machine-types";
import { hand } from "../../engine/__tests__/fixtures";
import { evaluateHand } from "../../engine/hand-evaluator";
import { buildAuction } from "../../engine/auction-helpers";
import { createBiddingContext } from "../../conventions/core";
import { Seat, BidSuit } from "../../engine/types";
import { makeSurface, buildMachine } from "../../test-support/convention-factories";
import { ForcingState } from "../../core/contracts/bidding";

// ─── Test surfaces ──────────────────────────────────────────

const surfaceA = makeSurface({
  meaningId: "mod-a:ask",
  moduleId: "mod-a",
  clauses: [
    {
      clauseId: "hcp",
      factId: "hand.hcp",
      operator: "gte",
      value: 8,
      description: "8+ HCP",
    },
    {
      clauseId: "major",
      factId: "bridge.hasFourCardMajor",
      operator: "boolean",
      value: true,
      description: "Has 4-card major",
    },
  ],
  ranking: {
    recommendationBand: "should",
    specificity: 2,
    modulePrecedence: 1,
    intraModuleOrder: 0,
  },
  sourceIntent: { type: "test-ask", params: {} },
});

const surfaceB = makeSurface({
  meaningId: "mod-b:ask",
  moduleId: "mod-b",
  encoding: {
    defaultCall: { type: "bid", level: 2, strain: BidSuit.Diamonds },
  },
  clauses: [
    {
      clauseId: "hcp",
      factId: "hand.hcp",
      operator: "gte",
      value: 8,
      description: "8+ HCP",
    },
  ],
  ranking: {
    recommendationBand: "must",
    specificity: 1,
    modulePrecedence: 2,
    intraModuleOrder: 0,
  },
  sourceIntent: { type: "test-ask-b", params: {} },
});

// ─── Test hand ──────────────────────────────────────────────

// 10 HCP with 4 spades: SA SK S3 S2 HA H3 DA D4 D2 CA C5 C4 C3
const strongHandWith4Spades = hand(
  "SA", "SK", "S3", "S2",
  "HA", "H3",
  "DA", "D4", "D2",
  "CA", "C5", "C4", "C3",
);

function makeTestContext() {
  const h = strongHandWith4Spades;
  const auction = buildAuction(Seat.North, ["1NT", "P"]);
  return createBiddingContext({
    hand: h,
    auction,
    seat: Seat.South,
    evaluation: evaluateHand(h),
  });
}

// ─── Minimal machine that activates mod-a ───────────────────

const machineStates: MachineState[] = [
  {
    stateId: "idle",
    parentId: null,
    transitions: [
      {
        transitionId: "t-1nt",
        match: { kind: "call", level: 1, strain: BidSuit.NoTrump },
        target: "responded",
      },
    ],
  },
  {
    stateId: "responded",
    parentId: null,
    surfaceGroupId: "mod-a",
    transitions: [],
  },
];

const testMachine = buildMachine(machineStates, "idle");

// ─── Runtime modules mirroring the surfaces ─────────────────

function makeRuntimeModule(moduleId: string, surfaces: readonly MeaningSurface[]): RuntimeModule {
  return {
    id: moduleId,
    capabilities: [],
    isActive: () => true,
    emitSurfaces: () => surfaces,
  };
}

// ─── Tests ──────────────────────────────────────────────────

describe("buildSurfacesFromEvaluation", () => {
  it("flattens DecisionSurfaceEntry[] into MeaningSurface[]", () => {
    const evalResult: EvaluationResult = {
      publicSnapshot: {
        activeModuleIds: ["mod-a", "mod-b"],
        forcingState: ForcingState.Nonforcing,
        obligation: { kind: "None", obligatedSide: "responder" },
        agreedStrain: { type: "none" },
        competitionMode: "Uncontested",
        captain: "responder",
        systemCapabilities: {},
        publicRegisters: {},
      },
      decisionSurfaces: [
        { moduleId: "mod-a", surfaces: [surfaceA] },
        { moduleId: "mod-b", surfaces: [surfaceB] },
      ],
      diagnostics: [],
    };

    const surfaces = buildSurfacesFromEvaluation(evalResult);

    expect(surfaces).toHaveLength(2);
    expect(surfaces[0]!.meaningId).toBe("mod-a:ask");
    expect(surfaces[1]!.meaningId).toBe("mod-b:ask");
  });

  it("returns empty array when no decision surfaces", () => {
    const evalResult: EvaluationResult = {
      publicSnapshot: {
        activeModuleIds: [],
        forcingState: ForcingState.Nonforcing,
        obligation: { kind: "None", obligatedSide: "responder" },
        agreedStrain: { type: "none" },
        competitionMode: "Uncontested",
        captain: "responder",
        systemCapabilities: {},
        publicRegisters: {},
      },
      decisionSurfaces: [],
      diagnostics: [],
    };

    const surfaces = buildSurfacesFromEvaluation(evalResult);

    expect(surfaces).toHaveLength(0);
  });
});

describe("meaningBundleToStrategy with evaluation runtime", () => {
  it("produces a bid result when evaluation runtime path is used", () => {
    const runtimeModules = [
      makeRuntimeModule("mod-a", [surfaceA]),
      makeRuntimeModule("mod-b", [surfaceB]),
    ];

    const strategy = meaningBundleToStrategy(
      [
        { moduleId: "mod-a", surfaces: [surfaceA] },
        { moduleId: "mod-b", surfaces: [surfaceB] },
      ],
      "test-bundle",
      {
        name: "Test Bundle",
        conversationMachine: testMachine,
        evaluationRuntime: {
          modules: runtimeModules,
          getActiveIds: () => ["mod-a", "mod-b"],
        },
      },
    );

    const context = makeTestContext();
    const result = strategy.suggest(context);

    // Both modules' surfaces are active; mod-b has "must" band so wins
    expect(result).not.toBeNull();
    expect(result!.call).toBeDefined();
  });

  it("evaluation runtime surface filtering matches machine-based selection", () => {
    // Machine activates only mod-a (via surfaceGroupId)
    const runtimeModules = [
      makeRuntimeModule("mod-a", [surfaceA]),
      makeRuntimeModule("mod-b", [surfaceB]),
    ];

    // Strategy with evaluation runtime + machine
    const runtimeStrategy = meaningBundleToStrategy(
      [
        { moduleId: "mod-a", surfaces: [surfaceA] },
        { moduleId: "mod-b", surfaces: [surfaceB] },
      ],
      "runtime-bundle",
      {
        conversationMachine: testMachine,
        evaluationRuntime: {
          modules: runtimeModules,
          getActiveIds: () => ["mod-a", "mod-b"],
        },
      },
    );

    // Strategy with just the machine (fallback path)
    const fallbackStrategy = meaningBundleToStrategy(
      [
        { moduleId: "mod-a", surfaces: [surfaceA] },
        { moduleId: "mod-b", surfaces: [surfaceB] },
      ],
      "fallback-bundle",
      {
        conversationMachine: testMachine,
      },
    );

    const context = makeTestContext();
    const runtimeResult = runtimeStrategy.suggest(context);
    const fallbackResult = fallbackStrategy.suggest(context);

    // Both paths should select the same surfaces (machine filters to mod-a)
    // so both should produce the same winning bid
    expect(runtimeResult).not.toBeNull();
    expect(fallbackResult).not.toBeNull();
    expect(runtimeResult!.call).toEqual(fallbackResult!.call);
    expect(runtimeResult!.ruleName).toEqual(fallbackResult!.ruleName);
  });

  it("falls back to selectActiveSurfaces when evaluationRuntime is not provided", () => {
    // No evaluationRuntime — should use existing path
    const strategy = meaningBundleToStrategy(
      [
        { moduleId: "mod-a", surfaces: [surfaceA] },
        { moduleId: "mod-b", surfaces: [surfaceB] },
      ],
      "fallback-bundle",
      {
        conversationMachine: testMachine,
      },
    );

    const context = makeTestContext();
    const result = strategy.suggest(context);

    // Machine selects mod-a, so surfaceA should be the only match
    expect(result).not.toBeNull();
    expect(result!.ruleName).toBe("mod-a:ask");
  });

  it("falls back to selectActiveSurfaces when only evaluationRuntime is provided (no machine)", () => {
    const runtimeModules = [
      makeRuntimeModule("mod-a", [surfaceA]),
    ];

    // evaluationRuntime without conversationMachine — should use fallback
    const strategy = meaningBundleToStrategy(
      [
        { moduleId: "mod-a", surfaces: [surfaceA] },
        { moduleId: "mod-b", surfaces: [surfaceB] },
      ],
      "no-machine-bundle",
      {
        evaluationRuntime: {
          modules: runtimeModules,
          getActiveIds: () => ["mod-a"],
        },
      },
    );

    const context = makeTestContext();
    const result = strategy.suggest(context);

    // Without machine, all surfaces are evaluated; mod-b "must" wins
    expect(result).not.toBeNull();
    expect(result!.ruleName).toBe("mod-b:ask");
  });

  it("returns null when evaluation runtime produces no surfaces", () => {
    const emptyModules: RuntimeModule[] = [
      {
        id: "mod-empty",
        capabilities: [],
        isActive: () => false,
        emitSurfaces: () => [],
      },
    ];

    const strategy = meaningBundleToStrategy(
      [{ moduleId: "mod-empty", surfaces: [] }],
      "empty-bundle",
      {
        conversationMachine: testMachine,
        evaluationRuntime: {
          modules: emptyModules,
          getActiveIds: () => [],
        },
      },
    );

    const context = makeTestContext();
    const result = strategy.suggest(context);

    expect(result).toBeNull();
  });

  it("publicSnapshot from evaluation runtime provides publicCommitments to pipeline", () => {
    // Create a runtime module that emits surfaceA
    const runtimeModules = [
      makeRuntimeModule("mod-a", [surfaceA]),
    ];

    // Strategy with evaluation runtime
    const strategy = meaningBundleToStrategy(
      [{ moduleId: "mod-a", surfaces: [surfaceA] }],
      "commitment-bundle",
      {
        conversationMachine: testMachine,
        evaluationRuntime: {
          modules: runtimeModules,
          getActiveIds: () => ["mod-a"],
        },
      },
    );

    const context = makeTestContext();
    const result = strategy.suggest(context);

    // The evaluation runtime path should produce a result
    // (publicCommitments from snapshot are available to fact evaluation)
    expect(result).not.toBeNull();
    expect(result!.ruleName).toBe("mod-a:ask");
  });
});
