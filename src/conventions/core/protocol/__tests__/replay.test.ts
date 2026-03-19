import { describe, it, expect } from "vitest";
import { replay, computeActiveSurfaces } from "../replay";
import type {
  ConventionSpec,
  BaseModuleSpec,
  ProtocolModuleSpec,
  FrameStateSpec,
  SurfaceFragment,
  TransitionSpec,
  RuntimeSnapshot,
} from "../types";
import type { MeaningSurface } from "../../../../core/contracts/meaning";
import { BidSuit, Seat } from "../../../../engine/types";
import type { Call } from "../../../../engine/types";

// ── Call constants ──────────────────────────────────────────────────

const bid1NT: Call = { type: "bid", level: 1, strain: BidSuit.NoTrump };
const bid2C: Call = { type: "bid", level: 2, strain: BidSuit.Clubs };
const bid2D: Call = { type: "bid", level: 2, strain: BidSuit.Diamonds };
const bid2H: Call = { type: "bid", level: 2, strain: BidSuit.Hearts };
const bid3NT: Call = { type: "bid", level: 3, strain: BidSuit.NoTrump };
const pass: Call = { type: "pass" };

// ── Helpers ─────────────────────────────────────────────────────────

function makeSurface(overrides?: Partial<MeaningSurface>): MeaningSurface {
  return {
    meaningId: "test:meaning",
    semanticClassId: "test:class",
    moduleId: "test",
    encoding: { defaultCall: bid1NT },
    clauses: [],
    ranking: {
      recommendationBand: "should",
      specificity: 1,
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

function makeTransition(
  overrides?: Partial<TransitionSpec>,
): TransitionSpec {
  return {
    transitionId: "t-default",
    when: { actor: "self", callType: "bid" },
    goto: "STAY",
    ...overrides,
  };
}

function makeBaseTrack(overrides?: Partial<BaseModuleSpec>): BaseModuleSpec {
  return {
    role: "base" as const,
    id: "nt-track",
    name: "1NT Opening",
    openingPatterns: [
      {
        prefix: [{ actor: "self", call: bid1NT }],
        startState: "opened",
        priority: 0,
      },
    ],
    states: {
      opened: {
        id: "opened",
        surface: "nt-surface",
        eventTransitions: [
          makeTransition({
            transitionId: "t-2c-response",
            when: { actor: "partner", call: bid2C },
            goto: "responded-2c",
          }),
          makeTransition({
            transitionId: "t-3nt-response",
            when: { actor: "partner", call: bid3NT },
            goto: "game",
          }),
        ],
      },
      "responded-2c": {
        id: "responded-2c",
        surface: "nt-after-2c-surface",
        eventTransitions: [],
      },
      game: {
        id: "game",
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
    attachWhen: {
      op: "eq",
      ref: { kind: "base", path: "stateId" },
      value: "opened",
    },
    initialStateId: "ask",
    facts: { definitions: [], evaluators: new Map() },
    states: {
      ask: {
        id: "ask",
        mode: "overlay",
        surface: "stayman-ask-surface",
        eventTransitions: [
          makeTransition({
            transitionId: "stayman-bid",
            when: { actor: "partner", call: bid2C },
            goto: "awaiting-response",
            routing: "consume",
          }),
        ],
      } as FrameStateSpec,
      "awaiting-response": {
        id: "awaiting-response",
        mode: "overlay",
        surface: "stayman-response-surface",
        eventTransitions: [
          makeTransition({
            transitionId: "stayman-hearts",
            when: { actor: "self", call: bid2H },
            goto: "POP",
            effects: [
              { op: "setReg", path: "stayman.result", value: "hearts" },
            ],
          }),
        ],
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
    name: "Test Convention",
    schema: { registers: {}, capabilities: {} },
    modules: [...baseTracks, ...protocols],
    surfaces,
  };
}

// ── replay ──────────────────────────────────────────────────────────

describe("replay", () => {
  it("opening selects base track", () => {
    const spec = makeSpec(
      [makeBaseTrack()],
      [],
      {},
    );

    // South opens 1NT.
    const snapshot = replay(
      [{ call: bid1NT, seat: Seat.South }],
      spec,
      Seat.South,
    );

    expect(snapshot.base).toBeDefined();
    expect(snapshot.base!.trackId).toBe("nt-track");
    expect(snapshot.base!.stateId).toBe("opened");
    expect(snapshot.ply).toBe(1);
  });

  it("opening with unrecognized call does not select a track", () => {
    const spec = makeSpec(
      [makeBaseTrack()],
      [],
      {},
    );

    // Open with 2D, which doesn't match 1NT pattern.
    const snapshot = replay(
      [{ call: bid2D, seat: Seat.South }],
      spec,
      Seat.South,
    );

    expect(snapshot.base).toBeUndefined();
    expect(snapshot.ply).toBe(1);
  });

  it("replay with protocol activation mid-conversation", () => {
    const spec = makeSpec(
      [makeBaseTrack()],
      [makeProtocol()],
      {
        "nt-surface": makeFragment({ id: "nt-surface" }),
        "stayman-ask-surface": makeFragment({
          id: "stayman-ask-surface",
          layerPriority: 10,
        }),
      },
    );

    // 1. South opens 1NT → base track selected.
    // 2. Settle phase: stayman protocol attaches (attachWhen: base.stateId == "opened").
    const snapshot = replay(
      [{ call: bid1NT, seat: Seat.South }],
      spec,
      Seat.South,
    );

    expect(snapshot.base).toBeDefined();
    expect(snapshot.base!.trackId).toBe("nt-track");
    expect(snapshot.protocols).toHaveLength(1);
    expect(snapshot.protocols[0]!.protocolId).toBe("stayman");
    expect(snapshot.protocols[0]!.stateId).toBe("ask");
  });

  it("protocol consumes event, base does not advance", () => {
    const spec = makeSpec(
      [makeBaseTrack()],
      [makeProtocol()],
      {},
    );

    // 1. South opens 1NT (base selected, stayman attaches in settle).
    // 2. North bids 2C — stayman consumes it, base should NOT advance.
    const snapshot = replay(
      [
        { call: bid1NT, seat: Seat.South },
        { call: bid2C, seat: Seat.North },
      ],
      spec,
      Seat.South,
    );

    // Base should still be in "opened" — the stayman protocol consumed 2C.
    expect(snapshot.base!.stateId).toBe("opened");

    // Stayman should have advanced to "awaiting-response".
    const stayman = snapshot.protocols.find(
      (p) => p.protocolId === "stayman",
    );
    expect(stayman).toBeDefined();
    expect(stayman!.stateId).toBe("awaiting-response");
  });

  it("observed routing lets base also process the event", () => {
    const observedProtocol = makeProtocol({
      id: "observer",
      states: {
        ask: {
          id: "ask",
          mode: "overlay",
          eventTransitions: [
            makeTransition({
              transitionId: "observe-2c",
              when: { actor: "partner", call: bid2C },
              goto: "observed",
              routing: "observe", // let base also process!
            }),
          ],
        } as FrameStateSpec,
        observed: {
          id: "observed",
          mode: "overlay",
          eventTransitions: [],
        } as FrameStateSpec,
      },
    });

    const spec = makeSpec(
      [makeBaseTrack()],
      [observedProtocol],
      {},
    );

    const snapshot = replay(
      [
        { call: bid1NT, seat: Seat.South },
        { call: bid2C, seat: Seat.North },
      ],
      spec,
      Seat.South,
    );

    // Protocol advanced to "observed".
    const observer = snapshot.protocols.find(
      (p) => p.protocolId === "observer",
    );
    expect(observer).toBeDefined();
    expect(observer!.stateId).toBe("observed");

    // Base ALSO advanced (because routing was "observe").
    expect(snapshot.base!.stateId).toBe("responded-2c");
  });

  it("protocol exit (POP) removes protocol and sets done latch", () => {
    const spec = makeSpec(
      [makeBaseTrack()],
      [makeProtocol()],
      {},
    );

    // 1. South opens 1NT → base selected, stayman attaches.
    // 2. North bids 2C → stayman consumes, advances to awaiting-response.
    // 3. South bids 2H → stayman POPs (exits), sets register.
    const snapshot = replay(
      [
        { call: bid1NT, seat: Seat.South },
        { call: bid2C, seat: Seat.North },
        { call: bid2H, seat: Seat.South },
      ],
      spec,
      Seat.South,
    );

    // Stayman should be gone.
    expect(snapshot.protocols).toHaveLength(0);

    // Done latch should be set.
    expect(snapshot.doneLatches.has("stayman:stayman")).toBe(true);

    // Register should have been set by the POP transition's effects.
    expect(snapshot.registers["stayman.result"]).toBeDefined();
    expect(snapshot.registers["stayman.result"]!.value).toBe("hearts");
  });

  it("exclusive protocol hides base surface via computeActiveSurfaces", () => {
    const exclusiveProto: ProtocolModuleSpec = {
      role: "protocol" as const,
      id: "exclusive-proto",
      name: "Exclusive Protocol",
      attachWhen: {
        op: "eq",
        ref: { kind: "base", path: "stateId" },
        value: "opened",
      },
      initialStateId: "active",
      facts: { definitions: [], evaluators: new Map() },
      states: {
        active: {
          id: "active",
          mode: "exclusive",
          inheritBaseSurface: "none",
          surface: "exclusive-surface",
          eventTransitions: [],
        } as FrameStateSpec,
      },
    };

    const spec = makeSpec(
      [makeBaseTrack()],
      [exclusiveProto],
      {
        "nt-surface": makeFragment({
          id: "nt-surface",
          layerPriority: 0,
          surfaces: [makeSurface({ meaningId: "nt:base", encoding: { defaultCall: bid2C } })],
        }),
        "exclusive-surface": makeFragment({
          id: "exclusive-surface",
          layerPriority: 20,
          relation: "shadow",
          actionCoverage: "all",
          surfaces: [
            makeSurface({
              meaningId: "exclusive:bid",
              encoding: { defaultCall: bid2D },
            }),
          ],
        }),
      },
    );

    const snapshot = replay(
      [{ call: bid1NT, seat: Seat.South }],
      spec,
      Seat.South,
    );

    // Protocol attached.
    expect(snapshot.protocols).toHaveLength(1);
    expect(snapshot.protocols[0]!.protocolId).toBe("exclusive-proto");

    // Compute surfaces — base should be hidden.
    const composed = computeActiveSurfaces(snapshot, spec);

    // Only exclusive surface visible — base is excluded by inheritBaseSurface="none".
    expect(composed.visibleSurfaces).toHaveLength(1);
    expect(composed.visibleSurfaces[0]!.meaningId).toBe("exclusive:bid");
  });

  it("base track reaction fires after protocol exit", () => {
    const baseWithReaction = makeBaseTrack({
      states: {
        opened: {
          id: "opened",
          surface: "nt-surface",
          eventTransitions: [],
          reactions: [
            {
              reactionId: "react-to-stayman-exit",
              when: {
                op: "exists",
                ref: { kind: "reg", path: "stayman.result" },
              },
              goto: "post-stayman",
              effects: [
                { op: "exportTag", tag: "stayman-completed" },
              ],
            },
          ],
        },
        "post-stayman": {
          id: "post-stayman",
          eventTransitions: [],
        },
      },
    });

    const spec = makeSpec(
      [baseWithReaction],
      [makeProtocol()],
      {},
    );

    // Full stayman cycle: open → 2C → 2H (POP).
    const snapshot = replay(
      [
        { call: bid1NT, seat: Seat.South },
        { call: bid2C, seat: Seat.North },
        { call: bid2H, seat: Seat.South },
      ],
      spec,
      Seat.South,
    );

    // After stayman POPs and sets the register, the base reaction fires.
    expect(snapshot.base!.stateId).toBe("post-stayman");
    expect(snapshot.activeTags.has("stayman-completed")).toBe(true);
  });

  it("replay is deterministic — same inputs produce same output", () => {
    const spec = makeSpec(
      [makeBaseTrack()],
      [makeProtocol()],
      {},
    );

    const history = [
      { call: bid1NT, seat: Seat.South },
      { call: bid2C, seat: Seat.North },
    ];

    const snap1 = replay(history, spec, Seat.South);
    const snap2 = replay(history, spec, Seat.South);

    expect(snap1.base).toEqual(snap2.base);
    expect(snap1.ply).toEqual(snap2.ply);
    expect(snap1.protocols.length).toEqual(snap2.protocols.length);
    expect(snap1.protocols[0]?.stateId).toEqual(snap2.protocols[0]?.stateId);
  });

  it("protocol does not re-attach after done latch", () => {
    // Create a protocol that pops immediately via a transition.
    const quickProto: ProtocolModuleSpec = {
      role: "protocol" as const,
      id: "quick",
      name: "Quick",
      attachWhen: {
        op: "eq",
        ref: { kind: "base", path: "stateId" },
        value: "opened",
      },
      initialStateId: "active",
      facts: { definitions: [], evaluators: new Map() },
      states: {
        active: {
          id: "active",
          mode: "overlay",
          eventTransitions: [
            makeTransition({
              transitionId: "quick-pop",
              when: { actor: "any", callType: "pass" },
              goto: "POP",
              routing: "observe",
            }),
          ],
        } as FrameStateSpec,
      },
    };

    const spec = makeSpec(
      [makeBaseTrack()],
      [quickProto],
      {},
    );

    // 1. South opens 1NT → base selected, quick attaches.
    // 2. Pass → quick POPs.
    // 3. Settle: quick should NOT re-attach (done latch set).
    const snapshot = replay(
      [
        { call: bid1NT, seat: Seat.South },
        { call: pass, seat: Seat.East },
      ],
      spec,
      Seat.South,
    );

    expect(snapshot.protocols).toHaveLength(0);
    expect(snapshot.doneLatches.has("quick:quick")).toBe(true);
  });

  it("transition effects modify registers with provenance", () => {
    const baseWithEffects = makeBaseTrack({
      states: {
        opened: {
          id: "opened",
          eventTransitions: [
            makeTransition({
              transitionId: "t-with-effects",
              when: { actor: "partner", call: bid3NT },
              goto: "game",
              effects: [
                { op: "setReg", path: "contract.level", value: "game" },
                { op: "exportTag", tag: "game-reached" },
              ],
            }),
          ],
        },
        game: {
          id: "game",
          eventTransitions: [],
        },
      },
    });

    const spec = makeSpec([baseWithEffects], [], {});

    const snapshot = replay(
      [
        { call: bid1NT, seat: Seat.South },
        { call: bid3NT, seat: Seat.North },
      ],
      spec,
      Seat.South,
    );

    // Register set with provenance.
    const reg = snapshot.registers["contract.level"];
    expect(reg).toBeDefined();
    expect(reg!.value).toBe("game");
    expect(reg!.writtenBy.ownerType).toBe("baseTrack");
    expect(reg!.writtenBy.ownerId).toBe("nt-track");
    expect(reg!.writtenAtPly).toBe(1);

    // Tag exported.
    expect(snapshot.activeTags.has("game-reached")).toBe(true);
  });
});

// ── computeActiveSurfaces ───────────────────────────────────────────

describe("computeActiveSurfaces", () => {
  it("returns empty surface when no base or protocols", () => {
    const spec = makeSpec([], [], {});
    const snapshot: RuntimeSnapshot = {
      bootNodeId: "root",
      protocols: [],
      registers: {},
      activeTags: new Set(),
      doneLatches: new Set(),
      ply: 0,
    };

    const composed = computeActiveSurfaces(snapshot, spec);

    expect(composed.visibleSurfaces).toHaveLength(0);
    expect(composed.actionResolutions).toHaveLength(0);
  });
});
