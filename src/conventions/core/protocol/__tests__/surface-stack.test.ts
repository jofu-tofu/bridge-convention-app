import { describe, it, expect } from "vitest";
import {
  composeSurfaceStack,
  buildSurfaceStack,
  type SurfaceStackEntry,
  type ComposedSurface,
} from "../surface-stack";
import type { MeaningSurface } from "../../../../core/contracts/meaning";
import type {
  SurfaceFragment,
  RuntimeSnapshot,
  ConventionSpec,
  BaseModuleSpec,
  ProtocolModuleSpec,
  FrameStateSpec,
} from "../types";
import { BidSuit, Seat } from "../../../../engine/types";
import type { Call } from "../../../../engine/types";

// ── Helpers ─────────────────────────────────────────────────────────

function makeSurface(overrides?: Partial<MeaningSurface>): MeaningSurface {
  return {
    meaningId: "test:meaning",
    semanticClassId: "test:class",
    moduleId: "test",
    encoding: { defaultCall: { type: "bid", level: 1, strain: BidSuit.NoTrump } },
    clauses: [],
    ranking: {
      recommendationBand: "should",
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    sourceIntent: { type: "test", params: {} },
    teachingLabel: "Test meaning",
    ...overrides,
  } as MeaningSurface;
}

function makeFragment(
  overrides?: Partial<SurfaceFragment>,
): SurfaceFragment {
  return {
    id: "frag-default",
    relation: "augment",
    layerPriority: 0,
    actionCoverage: "all",
    surfaces: [],
    ...overrides,
  };
}

function makeEntry(
  fragment: SurfaceFragment,
  overrides?: Partial<SurfaceStackEntry>,
): SurfaceStackEntry {
  return {
    fragment,
    ownerType: "baseTrack",
    ownerId: "base-1",
    stateId: "s1",
    ...overrides,
  };
}

const bid1NT: Call = { type: "bid", level: 1, strain: BidSuit.NoTrump };
const bid2C: Call = { type: "bid", level: 2, strain: BidSuit.Clubs };
const bid2D: Call = { type: "bid", level: 2, strain: BidSuit.Diamonds };
const bid2H: Call = { type: "bid", level: 2, strain: BidSuit.Hearts };
const pass: Call = { type: "pass" };

// ── composeSurfaceStack ─────────────────────────────────────────────

describe("composeSurfaceStack", () => {
  it("returns empty surface for empty stack", () => {
    const result = composeSurfaceStack([]);

    expect(result.visibleSurfaces).toHaveLength(0);
    expect(result.actionResolutions).toHaveLength(0);
    expect(result.requiredFactEvaluatorIds).toHaveLength(0);
    expect(result.compositionTrace).toHaveLength(0);
  });

  it("augment relation: both fragments' surfaces are visible", () => {
    const surfA = makeSurface({ meaningId: "a", encoding: { defaultCall: bid2C } });
    const surfB = makeSurface({ meaningId: "b", encoding: { defaultCall: bid2D } });

    const fragA = makeFragment({
      id: "frag-a",
      relation: "augment",
      layerPriority: 10,
      surfaces: [surfA],
    });
    const fragB = makeFragment({
      id: "frag-b",
      relation: "augment",
      layerPriority: 5,
      surfaces: [surfB],
    });

    const result = composeSurfaceStack([
      makeEntry(fragA, { ownerId: "base" }),
      makeEntry(fragB, { ownerType: "protocol", ownerId: "proto-1" }),
    ]);

    expect(result.visibleSurfaces).toHaveLength(2);
    const ids = result.visibleSurfaces.map((s) => s.meaningId);
    expect(ids).toContain("a");
    expect(ids).toContain("b");
  });

  it("shadow fragment hides lower layer's surfaces for covered actions", () => {
    const baseSurface = makeSurface({
      meaningId: "base-2c",
      encoding: { defaultCall: bid2C },
      teachingLabel: "Natural 2C",
    });
    const shadowSurface = makeSurface({
      meaningId: "stayman-2c",
      encoding: { defaultCall: bid2C },
      teachingLabel: "Stayman 2C",
    });

    const baseFrag = makeFragment({
      id: "frag-base",
      relation: "augment",
      layerPriority: 0,
      surfaces: [baseSurface],
    });
    const shadowFrag = makeFragment({
      id: "frag-shadow",
      relation: "shadow",
      layerPriority: 10,
      actionCoverage: [bid2C],
      surfaces: [shadowSurface],
    });

    const result = composeSurfaceStack([
      makeEntry(baseFrag, { ownerId: "base-track" }),
      makeEntry(shadowFrag, {
        ownerType: "protocol",
        ownerId: "stayman",
      }),
    ]);

    // Only the shadow surface for 2C should be visible.
    expect(result.visibleSurfaces).toHaveLength(1);
    expect(result.visibleSurfaces[0]!.meaningId).toBe("stayman-2c");
  });

  it("shadow with 'all' coverage hides all lower augment surfaces", () => {
    const baseSurf1 = makeSurface({ meaningId: "b1", encoding: { defaultCall: bid2C } });
    const baseSurf2 = makeSurface({ meaningId: "b2", encoding: { defaultCall: bid2D } });
    const shadowSurf = makeSurface({
      meaningId: "exclusive",
      encoding: { defaultCall: bid2H },
    });

    const baseFrag = makeFragment({
      id: "frag-base",
      relation: "augment",
      layerPriority: 0,
      surfaces: [baseSurf1, baseSurf2],
    });
    const shadowFrag = makeFragment({
      id: "frag-exclusive",
      relation: "shadow",
      layerPriority: 20,
      actionCoverage: "all",
      surfaces: [shadowSurf],
    });

    const result = composeSurfaceStack([
      makeEntry(baseFrag, { ownerId: "base" }),
      makeEntry(shadowFrag, { ownerType: "protocol", ownerId: "exclusive-proto" }),
    ]);

    // Only shadow surface visible — base surfaces all hidden.
    expect(result.visibleSurfaces).toHaveLength(1);
    expect(result.visibleSurfaces[0]!.meaningId).toBe("exclusive");

    // Trace shows the base fragment was shadowed.
    const baseTrace = result.compositionTrace.find(
      (t) => t.surfaceId === "frag-base",
    );
    expect(baseTrace?.shadowedBy).toBe("frag-exclusive");
  });

  it("compete fragments: both visible, ranking decides", () => {
    const surf1 = makeSurface({
      meaningId: "compete-a",
      encoding: { defaultCall: bid2C },
      ranking: {
        recommendationBand: "should",
        modulePrecedence: 0,
        intraModuleOrder: 0,
      },
    });
    const surf2 = makeSurface({
      meaningId: "compete-b",
      encoding: { defaultCall: bid2C },
      ranking: {
        recommendationBand: "may",
        modulePrecedence: 0,
        intraModuleOrder: 0,
      },
    });

    const frag1 = makeFragment({
      id: "frag-1",
      relation: "compete",
      layerPriority: 10,
      surfaces: [surf1],
    });
    const frag2 = makeFragment({
      id: "frag-2",
      relation: "compete",
      layerPriority: 5,
      surfaces: [surf2],
    });

    const result = composeSurfaceStack([
      makeEntry(frag1, { ownerId: "proto-a" }),
      makeEntry(frag2, { ownerId: "proto-b" }),
    ]);

    // Both surfaces visible — compete doesn't hide.
    expect(result.visibleSurfaces).toHaveLength(2);
    const ids = result.visibleSurfaces.map((s) => s.meaningId);
    expect(ids).toContain("compete-a");
    expect(ids).toContain("compete-b");

    // Action resolution has supporting rules from both.
    const resolution = result.actionResolutions.find(
      (r) => r.call.type === "bid" && (r.call as { level: number }).level === 2,
    );
    expect(resolution).toBeDefined();
    expect(resolution!.supportingRules.length).toBeGreaterThanOrEqual(2);
  });

  it("legalMask bans specific actions", () => {
    const surf = makeSurface({
      meaningId: "banned-action",
      encoding: { defaultCall: bid2D },
    });

    const frag = makeFragment({
      id: "frag-with-ban",
      relation: "augment",
      layerPriority: 10,
      surfaces: [surf],
      legalMask: { "2D": "ban" },
    });

    const result = composeSurfaceStack([
      makeEntry(frag, { ownerId: "proto" }),
    ]);

    // Surface is added, but the action resolution is blocked.
    expect(result.visibleSurfaces).toHaveLength(1);
    const resolution = result.actionResolutions.find(
      (r) => r.call.type === "bid" && (r.call as { level: number }).level === 2,
    );
    expect(resolution).toBeDefined();
    expect(resolution!.status).toBe("blocked");
    expect(resolution!.blockedBy).toBeDefined();
    expect(resolution!.blockedBy![0]!.reason).toBe("ban");
  });

  it("legalMask ban on action not in any surface creates blocked resolution", () => {
    const surf = makeSurface({
      meaningId: "other",
      encoding: { defaultCall: bid2C },
    });

    const frag = makeFragment({
      id: "frag-ban-extra",
      relation: "augment",
      layerPriority: 5,
      surfaces: [surf],
      legalMask: { "3NT": "ban" },
    });

    const result = composeSurfaceStack([
      makeEntry(frag, { ownerId: "base" }),
    ]);

    // The banned action (3NT) should appear as blocked even without a surface.
    const banned = result.actionResolutions.find(
      (r) => r.status === "blocked" && r.effectiveMeaning === "(banned)",
    );
    expect(banned).toBeDefined();
  });

  it("collects requiredFactEvaluatorIds from all fragments", () => {
    const frag1 = makeFragment({
      id: "f1",
      surfaces: [],
      factEvaluatorIds: ["eval:hcp", "eval:shape"],
    });
    const frag2 = makeFragment({
      id: "f2",
      surfaces: [],
      factEvaluatorIds: ["eval:shape", "eval:points"],
    });

    const result = composeSurfaceStack([
      makeEntry(frag1),
      makeEntry(frag2),
    ]);

    // Deduplicated.
    expect(result.requiredFactEvaluatorIds).toHaveLength(3);
    expect(result.requiredFactEvaluatorIds).toContain("eval:hcp");
    expect(result.requiredFactEvaluatorIds).toContain("eval:shape");
    expect(result.requiredFactEvaluatorIds).toContain("eval:points");
  });

  it("composition trace records all fragments with correct metadata", () => {
    const frag1 = makeFragment({
      id: "f1",
      relation: "shadow",
      layerPriority: 10,
      surfaces: [],
    });
    const frag2 = makeFragment({
      id: "f2",
      relation: "augment",
      layerPriority: 5,
      surfaces: [],
    });

    const result = composeSurfaceStack([
      makeEntry(frag1, { ownerId: "proto" }),
      makeEntry(frag2, { ownerId: "base" }),
    ]);

    expect(result.compositionTrace).toHaveLength(2);
    const shadowTrace = result.compositionTrace.find(
      (t) => t.surfaceId === "f1",
    );
    expect(shadowTrace).toBeDefined();
    expect(shadowTrace!.relation).toBe("shadow");
    expect(shadowTrace!.layerPriority).toBe(10);
  });
});

// ── buildSurfaceStack ───────────────────────────────────────────────

describe("buildSurfaceStack", () => {
  function makeBaseTrack(overrides?: Partial<BaseModuleSpec>): BaseModuleSpec {
    return {
      role: "base" as const,
      id: "nt-track",
      name: "1NT Opening",
      openingPatterns: [],
      states: {
        opened: {
          id: "opened",
          surface: "nt-opened-surface",
          eventTransitions: [],
        },
      },
      initialStateId: "opened",
      facts: { definitions: [], evaluators: new Map() },
      ...overrides,
    };
  }

  function makeProtocol(overrides?: Partial<ProtocolModuleSpec>): ProtocolModuleSpec {
    return {
      role: "protocol" as const,
      id: "stayman",
      name: "Stayman",
      attachWhen: { op: "true" },
      initialStateId: "ask",
      facts: { definitions: [], evaluators: new Map() },
      states: {
        ask: {
          id: "ask",
          mode: "overlay",
          surface: "stayman-ask-surface",
          eventTransitions: [],
        } as FrameStateSpec,
      },
      ...overrides,
    };
  }

  function makeSpec(
    baseTracks: BaseModuleSpec[],
    protocols: ProtocolModuleSpec[],
    surfaces: Record<string, SurfaceFragment>,
  ): ConventionSpec {
    return {
      id: "test-spec",
      name: "Test",
      schema: { registers: {}, capabilities: {} },
      modules: [...baseTracks, ...protocols],
      surfaces,
    };
  }

  it("builds stack with base track surface", () => {
    const spec = makeSpec(
      [makeBaseTrack()],
      [],
      {
        "nt-opened-surface": makeFragment({
          id: "nt-opened-surface",
          layerPriority: 0,
          surfaces: [makeSurface({ meaningId: "nt:base" })],
        }),
      },
    );

    const snapshot: RuntimeSnapshot = {
      bootNodeId: "root",
      base: { trackId: "nt-track", stateId: "opened" },
      protocols: [],
      registers: {},
      activeTags: new Set(),
      doneLatches: new Set(),
      ply: 2,
    };

    const stack = buildSurfaceStack(snapshot, spec);

    expect(stack).toHaveLength(1);
    expect(stack[0]!.ownerType).toBe("baseTrack");
    expect(stack[0]!.ownerId).toBe("nt-track");
    expect(stack[0]!.fragment.id).toBe("nt-opened-surface");
  });

  it("builds stack with protocol surface above base", () => {
    const spec = makeSpec(
      [makeBaseTrack()],
      [makeProtocol()],
      {
        "nt-opened-surface": makeFragment({
          id: "nt-opened-surface",
          layerPriority: 0,
        }),
        "stayman-ask-surface": makeFragment({
          id: "stayman-ask-surface",
          layerPriority: 10,
          relation: "shadow",
          actionCoverage: [bid2C],
        }),
      },
    );

    const snapshot: RuntimeSnapshot = {
      bootNodeId: "root",
      base: { trackId: "nt-track", stateId: "opened" },
      protocols: [
        {
          protocolId: "stayman",
          instanceKey: "stayman:0",
          stateId: "ask",
          anchor: "base",
          depth: 1,
          attachedAtPly: 1,
          localState: {},
        },
      ],
      registers: {},
      activeTags: new Set(),
      doneLatches: new Set(),
      ply: 3,
    };

    const stack = buildSurfaceStack(snapshot, spec);

    expect(stack).toHaveLength(2);
    // Protocol surface first (added before base).
    expect(stack[0]!.ownerType).toBe("protocol");
    expect(stack[0]!.ownerId).toBe("stayman");
    // Base surface second.
    expect(stack[1]!.ownerType).toBe("baseTrack");
  });

  it("exclusive protocol with inheritBaseSurface=none excludes base", () => {
    const spec = makeSpec(
      [makeBaseTrack()],
      [
        makeProtocol({
          id: "exclusive-proto",
          states: {
            ask: {
              id: "ask",
              mode: "exclusive",
              inheritBaseSurface: "none",
              surface: "exclusive-surface",
              eventTransitions: [],
            } as FrameStateSpec,
          },
        }),
      ],
      {
        "nt-opened-surface": makeFragment({
          id: "nt-opened-surface",
          layerPriority: 0,
        }),
        "exclusive-surface": makeFragment({
          id: "exclusive-surface",
          layerPriority: 20,
          relation: "shadow",
          actionCoverage: "all",
        }),
      },
    );

    const snapshot: RuntimeSnapshot = {
      bootNodeId: "root",
      base: { trackId: "nt-track", stateId: "opened" },
      protocols: [
        {
          protocolId: "exclusive-proto",
          instanceKey: "exclusive-proto:0",
          stateId: "ask",
          anchor: "base",
          depth: 1,
          attachedAtPly: 1,
          localState: {},
        },
      ],
      registers: {},
      activeTags: new Set(),
      doneLatches: new Set(),
      ply: 3,
    };

    const stack = buildSurfaceStack(snapshot, spec);

    // Only protocol surface — base excluded.
    expect(stack).toHaveLength(1);
    expect(stack[0]!.ownerType).toBe("protocol");
    expect(stack[0]!.ownerId).toBe("exclusive-proto");
  });

  it("skips protocol when surfaceWhen evaluates to false", () => {
    const spec = makeSpec(
      [makeBaseTrack()],
      [
        makeProtocol({
          id: "conditional-proto",
          surfaceWhen: { op: "activeTag", tag: "show-proto" },
          states: {
            ask: {
              id: "ask",
              mode: "overlay",
              surface: "conditional-surface",
              eventTransitions: [],
            } as FrameStateSpec,
          },
        }),
      ],
      {
        "nt-opened-surface": makeFragment({
          id: "nt-opened-surface",
          layerPriority: 0,
        }),
        "conditional-surface": makeFragment({
          id: "conditional-surface",
          layerPriority: 10,
        }),
      },
    );

    const snapshot: RuntimeSnapshot = {
      bootNodeId: "root",
      base: { trackId: "nt-track", stateId: "opened" },
      protocols: [
        {
          protocolId: "conditional-proto",
          instanceKey: "conditional-proto:0",
          stateId: "ask",
          anchor: "base",
          depth: 1,
          attachedAtPly: 1,
          localState: {},
        },
      ],
      registers: {},
      activeTags: new Set(), // "show-proto" NOT present
      doneLatches: new Set(),
      ply: 3,
    };

    const stack = buildSurfaceStack(snapshot, spec);

    // Only base — conditional proto skipped.
    expect(stack).toHaveLength(1);
    expect(stack[0]!.ownerType).toBe("baseTrack");
  });

  it("returns empty stack when no base and no protocols", () => {
    const spec = makeSpec([], [], {});
    const snapshot: RuntimeSnapshot = {
      bootNodeId: "root",
      protocols: [],
      registers: {},
      activeTags: new Set(),
      doneLatches: new Set(),
      ply: 0,
    };

    const stack = buildSurfaceStack(snapshot, spec);
    expect(stack).toHaveLength(0);
  });
});
