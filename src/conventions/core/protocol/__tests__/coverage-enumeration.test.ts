import { describe, it, expect, beforeAll } from "vitest";
import { BidSuit } from "../../../../engine/types";
import type { Call } from "../../../../engine/types";
import type { MeaningSurface } from "../../../../core/contracts/meaning";
import type {
  BaseModuleSpec,
  ProtocolModuleSpec,
  FrameStateSpec,
  SurfaceFragment,
  ConventionSpec,
  TransitionSpec,
  EffectSpec,
  EventPattern,
  PublicSemanticSchema,
  BoolExpr,
} from "../types";
import type { FactCatalogExtension } from "../../../../core/contracts/fact-catalog";
import {
  enumerateBaseTrackStates,
  enumerateBaseTrackAtoms,
  enumerateProtocolAtomsAtBaseState,
  generateProtocolCoverageManifest,
  type ProtocolCoverageAtom,
  type BaseTrackPath,
} from "../coverage-enumeration";

// ── Test Helpers ────────────────────────────────────────────────────

/** Minimal fact catalog extension for test fixtures. */
const emptyFacts: FactCatalogExtension = {
  definitions: [],
  evaluators: new Map(),
};

/** Minimal semantic schema for test fixtures. */
const emptySchema: PublicSemanticSchema = {
  registers: {},
  capabilities: {},
};

/** Create a minimal MeaningSurface for tests. */
function makeSurface(overrides?: Partial<MeaningSurface>): MeaningSurface {
  return {
    meaningId: "test:meaning",
    semanticClassId: "test:class",
    moduleId: "test",
    encoding: { defaultCall: { type: "bid", level: 1, strain: BidSuit.NoTrump } },
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

/** Create a minimal SurfaceFragment. */
function makeFragment(
  id: string,
  surfaces: readonly MeaningSurface[] = [],
): SurfaceFragment {
  return {
    id,
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces,
  };
}

/** Create a minimal FrameStateSpec. */
function makeState(
  id: string,
  opts?: {
    surface?: string;
    exportTags?: readonly string[];
    onEnter?: readonly EffectSpec[];
    transitions?: readonly TransitionSpec[];
  },
): FrameStateSpec {
  return {
    id,
    surface: opts?.surface,
    exportTags: opts?.exportTags,
    onEnter: opts?.onEnter,
    eventTransitions: opts?.transitions ?? [],
  };
}

/** Create a transition from one state to another via a call. */
function makeTransition(
  id: string,
  call: Call | undefined,
  goto: string,
  opts?: { callType?: Call["type"]; actor?: EventPattern["actor"] },
): TransitionSpec {
  const when: EventPattern = {};
  if (call) (when as Record<string, unknown>).call = call;
  if (opts?.callType) (when as Record<string, unknown>).callType = opts.callType;
  if (opts?.actor) (when as Record<string, unknown>).actor = opts.actor;
  return { transitionId: id, when, goto };
}

/** Shorthand bid call. */
function bid(level: 1 | 2 | 3 | 4 | 5 | 6 | 7, strain: BidSuit): Call {
  return { type: "bid", level, strain };
}

/** Build a minimal BaseModuleSpec from states. */
function makeTrack(
  id: string,
  states: Record<string, FrameStateSpec>,
  initialStateId: string,
): BaseModuleSpec {
  return {
    role: "base",
    id,
    name: id,
    openingPatterns: [],
    states,
    initialStateId,
    facts: emptyFacts,
  };
}

/** Build a minimal ProtocolModuleSpec. */
function makeProtocol(
  id: string,
  attachWhen: BoolExpr,
  states: Record<string, FrameStateSpec>,
  initialStateId: string,
): ProtocolModuleSpec {
  return {
    role: "protocol",
    id,
    name: id,
    attachWhen,
    initialStateId,
    states,
    facts: emptyFacts,
  };
}

/** Build a minimal FrameStateSpec for protocol states. */
function makeProtocolState(
  id: string,
  opts?: {
    surface?: string;
    mode?: "overlay" | "exclusive";
    transitions?: readonly TransitionSpec[];
  },
): FrameStateSpec {
  return {
    id,
    surface: opts?.surface,
    mode: opts?.mode,
    eventTransitions: opts?.transitions ?? [],
  };
}

/** Build a minimal ConventionSpec. */
function makeConventionSpec(opts: {
  id?: string;
  name?: string;
  baseTracks: readonly BaseModuleSpec[];
  protocols?: readonly ProtocolModuleSpec[];
  surfaces?: Record<string, SurfaceFragment>;
}): ConventionSpec {
  const protocols = opts.protocols ?? [];
  const modules = [...opts.baseTracks, ...protocols];
  return {
    id: opts.id ?? "test-spec",
    name: opts.name ?? "Test Convention",
    schema: emptySchema,
    modules,
    surfaces: opts.surfaces ?? {},
  };
}

// ── enumerateBaseTrackStates ────────────────────────────────────────

describe("enumerateBaseTrackStates", () => {
  it("enumerates a simple linear track: A → B → C", () => {
    const track = makeTrack(
      "linear",
      {
        A: makeState("A", {
          transitions: [makeTransition("A→B", bid(1, BidSuit.Clubs), "B")],
        }),
        B: makeState("B", {
          transitions: [makeTransition("B→C", bid(1, BidSuit.Diamonds), "C")],
        }),
        C: makeState("C"),
      },
      "A",
    );

    const paths = enumerateBaseTrackStates(track);

    expect(paths.size).toBe(3);
    expect(paths.has("A")).toBe(true);
    expect(paths.has("B")).toBe(true);
    expect(paths.has("C")).toBe(true);

    // Initial state has no transitions in its path
    const pathA = paths.get("A")!;
    expect(pathA.stateIds).toEqual(["A"]);
    expect(pathA.transitions).toHaveLength(0);
    expect(pathA.targetStateId).toBe("A");

    // B is one step from A
    const pathB = paths.get("B")!;
    expect(pathB.stateIds).toEqual(["A", "B"]);
    expect(pathB.transitions).toHaveLength(1);
    expect(pathB.transitions[0]!.fromStateId).toBe("A");
    expect(pathB.transitions[0]!.toStateId).toBe("B");

    // C is two steps from A
    const pathC = paths.get("C")!;
    expect(pathC.stateIds).toEqual(["A", "B", "C"]);
    expect(pathC.transitions).toHaveLength(2);
    expect(pathC.targetStateId).toBe("C");
  });

  it("enumerates a branching track: A → B or C", () => {
    const track = makeTrack(
      "branching",
      {
        A: makeState("A", {
          transitions: [
            makeTransition("A→B", bid(1, BidSuit.Clubs), "B"),
            makeTransition("A→C", bid(1, BidSuit.Diamonds), "C"),
          ],
        }),
        B: makeState("B"),
        C: makeState("C"),
      },
      "A",
    );

    const paths = enumerateBaseTrackStates(track);

    expect(paths.size).toBe(3);
    expect(paths.has("A")).toBe(true);
    expect(paths.has("B")).toBe(true);
    expect(paths.has("C")).toBe(true);

    // Both B and C are reachable from A with one transition each
    expect(paths.get("B")!.stateIds).toEqual(["A", "B"]);
    expect(paths.get("C")!.stateIds).toEqual(["A", "C"]);
  });

  it("reports unreachable states (no transitions lead to them)", () => {
    const track = makeTrack(
      "with-island",
      {
        A: makeState("A", {
          transitions: [makeTransition("A→B", bid(1, BidSuit.Clubs), "B")],
        }),
        B: makeState("B"),
        island: makeState("island"), // no transitions point here
      },
      "A",
    );

    const paths = enumerateBaseTrackStates(track);

    expect(paths.size).toBe(2);
    expect(paths.has("A")).toBe(true);
    expect(paths.has("B")).toBe(true);
    expect(paths.has("island")).toBe(false);
  });

  it("handles self-loop (STAY) transitions without infinite loop", () => {
    const track = makeTrack(
      "with-stay",
      {
        A: makeState("A", {
          transitions: [
            makeTransition("A-stay", undefined, "STAY", { callType: "pass" }),
            makeTransition("A→B", bid(1, BidSuit.Clubs), "B"),
          ],
        }),
        B: makeState("B", {
          transitions: [
            makeTransition("B-stay", undefined, "STAY", { callType: "pass" }),
          ],
        }),
      },
      "A",
    );

    const paths = enumerateBaseTrackStates(track);

    // STAY transitions are skipped — they don't create new reachable states
    expect(paths.size).toBe(2);
    expect(paths.has("A")).toBe(true);
    expect(paths.has("B")).toBe(true);
  });

  it("handles POP transitions without following them", () => {
    const track = makeTrack(
      "with-pop",
      {
        A: makeState("A", {
          transitions: [
            makeTransition("A→B", bid(1, BidSuit.Clubs), "B"),
            makeTransition("A-pop", undefined, "POP", { callType: "pass" }),
          ],
        }),
        B: makeState("B"),
      },
      "A",
    );

    const paths = enumerateBaseTrackStates(track);

    expect(paths.size).toBe(2);
    expect(paths.has("A")).toBe(true);
    expect(paths.has("B")).toBe(true);
  });

  it("does not revisit already-visited states (diamond graph)", () => {
    // A → B, A → C, B → D, C → D
    const track = makeTrack(
      "diamond",
      {
        A: makeState("A", {
          transitions: [
            makeTransition("A→B", bid(1, BidSuit.Clubs), "B"),
            makeTransition("A→C", bid(1, BidSuit.Diamonds), "C"),
          ],
        }),
        B: makeState("B", {
          transitions: [makeTransition("B→D", bid(2, BidSuit.Clubs), "D")],
        }),
        C: makeState("C", {
          transitions: [makeTransition("C→D", bid(2, BidSuit.Diamonds), "D")],
        }),
        D: makeState("D"),
      },
      "A",
    );

    const paths = enumerateBaseTrackStates(track);

    expect(paths.size).toBe(4);
    // D should be reached via the first BFS path found (through B)
    const pathD = paths.get("D")!;
    expect(pathD.stateIds).toEqual(["A", "B", "D"]);
  });

  it("extracts call from event pattern for transitions", () => {
    const track = makeTrack(
      "call-extract",
      {
        A: makeState("A", {
          transitions: [
            makeTransition("A→B", bid(2, BidSuit.Clubs), "B"),
          ],
        }),
        B: makeState("B", {
          transitions: [
            makeTransition("B→C", undefined, "C", { callType: "pass" }),
          ],
        }),
        C: makeState("C"),
      },
      "A",
    );

    const paths = enumerateBaseTrackStates(track);

    // Transition A→B has a concrete call
    const pathB = paths.get("B")!;
    expect(pathB.transitions[0]!.call).toEqual(bid(2, BidSuit.Clubs));

    // Transition B→C has callType: "pass" → extracted as { type: "pass" }
    const pathC = paths.get("C")!;
    expect(pathC.transitions[1]!.call).toEqual({ type: "pass" });
  });
});

// ── enumerateBaseTrackAtoms ─────────────────────────────────────────

describe("enumerateBaseTrackAtoms", () => {
  it("generates atoms for states with surfaces", () => {
    const surf1 = makeSurface({
      meaningId: "m:stayman-ask",
      teachingLabel: "Stayman 2C",
    });
    const surf2 = makeSurface({
      meaningId: "m:natural-3nt",
      teachingLabel: "Natural 3NT",
    });
    const surfaces: Record<string, SurfaceFragment> = {
      "sf:responder": makeFragment("sf:responder", [surf1, surf2]),
    };

    const track = makeTrack(
      "with-surfaces",
      {
        A: makeState("A", {
          transitions: [makeTransition("A→B", bid(1, BidSuit.Clubs), "B")],
        }),
        B: makeState("B", {
          surface: "sf:responder",
          transitions: [],
        }),
      },
      "A",
    );

    const atoms = enumerateBaseTrackAtoms(track, surfaces);

    expect(atoms).toHaveLength(2);

    // Each MeaningSurface in the fragment generates one atom
    expect(atoms[0]).toEqual(
      expect.objectContaining({
        baseStateId: "B",
        surfaceId: "sf:responder",
        meaningId: "m:stayman-ask",
        meaningLabel: "Stayman 2C",
        involvesProtocol: false,
        activeProtocols: [],
      }),
    );
    expect(atoms[1]).toEqual(
      expect.objectContaining({
        baseStateId: "B",
        surfaceId: "sf:responder",
        meaningId: "m:natural-3nt",
        meaningLabel: "Natural 3NT",
        involvesProtocol: false,
      }),
    );
  });

  it("generates no atoms for states without surfaces", () => {
    const track = makeTrack(
      "no-surfaces",
      {
        A: makeState("A", {
          transitions: [makeTransition("A→B", bid(1, BidSuit.Clubs), "B")],
        }),
        B: makeState("B"), // no surface
      },
      "A",
    );

    const atoms = enumerateBaseTrackAtoms(track, {});
    expect(atoms).toHaveLength(0);
  });

  it("generates no atoms when surface fragment is missing from registry", () => {
    const track = makeTrack(
      "missing-fragment",
      {
        A: makeState("A", {
          surface: "sf:nonexistent",
        }),
      },
      "A",
    );

    const atoms = enumerateBaseTrackAtoms(track, {});
    expect(atoms).toHaveLength(0);
  });

  it("skips unreachable states (no atoms for island states)", () => {
    const surf = makeSurface({ meaningId: "m:island", teachingLabel: "Island" });
    const surfaces: Record<string, SurfaceFragment> = {
      "sf:island": makeFragment("sf:island", [surf]),
    };

    const track = makeTrack(
      "island-with-surface",
      {
        A: makeState("A"),
        island: makeState("island", { surface: "sf:island" }), // unreachable
      },
      "A",
    );

    const atoms = enumerateBaseTrackAtoms(track, surfaces);
    // Only reachable states generate atoms; island is unreachable
    expect(atoms).toHaveLength(0);
  });

  it("atom has correct baseStateId, surfaceId, meaningId, and meaningLabel", () => {
    const surf = makeSurface({
      meaningId: "m:transfer-hearts",
      teachingLabel: "Transfer to hearts",
    });
    const surfaces: Record<string, SurfaceFragment> = {
      "sf:transfer": makeFragment("sf:transfer", [surf]),
    };

    const track = makeTrack(
      "atom-fields",
      {
        start: makeState("start", {
          surface: "sf:transfer",
        }),
      },
      "start",
    );

    const atoms = enumerateBaseTrackAtoms(track, surfaces);

    expect(atoms).toHaveLength(1);
    const atom = atoms[0]!;
    expect(atom.baseStateId).toBe("start");
    expect(atom.surfaceId).toBe("sf:transfer");
    expect(atom.meaningId).toBe("m:transfer-hearts");
    expect(atom.meaningLabel).toBe("Transfer to hearts");
    expect(atom.involvesProtocol).toBe(false);
    expect(atom.activeProtocols).toEqual([]);
  });
});

// ── enumerateProtocolAtomsAtBaseState ────────────────────────────────

describe("enumerateProtocolAtomsAtBaseState", () => {
  const protocolSurface = makeSurface({
    meaningId: "m:blackwood-4nt",
    teachingLabel: "Blackwood 4NT",
  });
  const protocolSurface2 = makeSurface({
    meaningId: "m:blackwood-response",
    teachingLabel: "Blackwood response",
  });

  const surfaces: Record<string, SurfaceFragment> = {
    "sf:blackwood-ask": makeFragment("sf:blackwood-ask", [protocolSurface]),
    "sf:blackwood-respond": makeFragment("sf:blackwood-respond", [protocolSurface2]),
  };

  function makeBlackwoodProtocol(attachWhen: BoolExpr): ProtocolModuleSpec {
    return makeProtocol(
      "blackwood",
      attachWhen,
      {
        "bw-ask": makeProtocolState("bw-ask", { surface: "sf:blackwood-ask" }),
        "bw-respond": makeProtocolState("bw-respond", { surface: "sf:blackwood-respond" }),
      },
      "bw-ask",
    );
  }

  it("generates protocol atoms when register condition is met via onEnter effects", () => {
    const track = makeTrack(
      "with-reg",
      {
        A: makeState("A", {
          onEnter: [
            { op: "setReg", path: "agreement.strain", value: "hearts" },
          ],
          transitions: [makeTransition("A→B", bid(1, BidSuit.Clubs), "B")],
        }),
        B: makeState("B", {
          onEnter: [
            { op: "exportTag", tag: "agreement.final" },
          ],
        }),
      },
      "A",
    );

    const protocol = makeBlackwoodProtocol({
      op: "and",
      args: [
        { op: "exists", ref: { kind: "reg", path: "agreement.strain" } },
        { op: "activeTag", tag: "agreement.final" },
      ],
    });

    const paths = enumerateBaseTrackStates(track);
    const pathB = paths.get("B")!;

    const atoms = enumerateProtocolAtomsAtBaseState(
      "B",
      pathB,
      track,
      [protocol],
      surfaces,
    );

    // Both protocol states with surfaces should produce atoms
    expect(atoms).toHaveLength(2);
    expect(atoms.every((a) => a.involvesProtocol)).toBe(true);
    expect(atoms.every((a) => a.baseStateId === "B")).toBe(true);

    const askAtom = atoms.find((a) => a.meaningId === "m:blackwood-4nt")!;
    expect(askAtom.activeProtocols).toEqual([
      { protocolId: "blackwood", stateId: "bw-ask" },
    ]);
    expect(askAtom.surfaceId).toBe("sf:blackwood-ask");

    const respondAtom = atoms.find((a) => a.meaningId === "m:blackwood-response")!;
    expect(respondAtom.activeProtocols).toEqual([
      { protocolId: "blackwood", stateId: "bw-respond" },
    ]);
  });

  it("does NOT generate protocol atoms when condition is not met", () => {
    const track = makeTrack(
      "no-reg",
      {
        A: makeState("A"), // no onEnter effects → no registers set
      },
      "A",
    );

    const protocol = makeBlackwoodProtocol({
      op: "exists",
      ref: { kind: "reg", path: "agreement.strain" },
    });

    const paths = enumerateBaseTrackStates(track);
    const pathA = paths.get("A")!;

    const atoms = enumerateProtocolAtomsAtBaseState(
      "A",
      pathA,
      track,
      [protocol],
      surfaces,
    );

    expect(atoms).toHaveLength(0);
  });

  it("generates atoms from multiple protocol states", () => {
    const track = makeTrack(
      "multi-state",
      {
        A: makeState("A", {
          exportTags: ["slam.ready"],
        }),
      },
      "A",
    );

    const protocol = makeProtocol(
      "cuebid",
      { op: "activeTag", tag: "slam.ready" },
      {
        "cue-ask": makeProtocolState("cue-ask", { surface: "sf:blackwood-ask" }),
        "cue-wait": makeProtocolState("cue-wait", { surface: "sf:blackwood-respond" }),
        "cue-done": makeProtocolState("cue-done"), // no surface
      },
      "cue-ask",
    );

    const paths = enumerateBaseTrackStates(track);
    const pathA = paths.get("A")!;

    const atoms = enumerateProtocolAtomsAtBaseState(
      "A",
      pathA,
      track,
      [protocol],
      surfaces,
    );

    // 2 states with surfaces × 1 surface each = 2 atoms
    // cue-done has no surface → no atom
    expect(atoms).toHaveLength(2);
    expect(atoms.every((a) => a.involvesProtocol)).toBe(true);
    expect(atoms.some((a) => a.activeProtocols[0]?.stateId === "cue-ask")).toBe(true);
    expect(atoms.some((a) => a.activeProtocols[0]?.stateId === "cue-wait")).toBe(true);
  });

  it("protocol atoms have involvesProtocol: true", () => {
    const track = makeTrack(
      "flag-check",
      {
        A: makeState("A", {
          onEnter: [{ op: "setReg", path: "forcing.state", value: "game" }],
        }),
      },
      "A",
    );

    const protocol = makeProtocol(
      "simple",
      { op: "exists", ref: { kind: "reg", path: "forcing.state" } },
      {
        s1: makeProtocolState("s1", { surface: "sf:blackwood-ask" }),
      },
      "s1",
    );

    const paths = enumerateBaseTrackStates(track);
    const atoms = enumerateProtocolAtomsAtBaseState(
      "A",
      paths.get("A")!,
      track,
      [protocol],
      surfaces,
    );

    expect(atoms).toHaveLength(1);
    expect(atoms[0]!.involvesProtocol).toBe(true);
  });

  it("evaluates tag-based attachWhen from exportTags on states along path", () => {
    const track = makeTrack(
      "tag-path",
      {
        A: makeState("A", {
          exportTags: ["agreement.pending"],
          transitions: [makeTransition("A→B", bid(1, BidSuit.Clubs), "B")],
        }),
        B: makeState("B"),
      },
      "A",
    );

    const protocol = makeProtocol(
      "tag-proto",
      { op: "activeTag", tag: "agreement.pending" },
      {
        p1: makeProtocolState("p1", { surface: "sf:blackwood-ask" }),
      },
      "p1",
    );

    const paths = enumerateBaseTrackStates(track);
    const pathB = paths.get("B")!;

    const atoms = enumerateProtocolAtomsAtBaseState(
      "B",
      pathB,
      track,
      [protocol],
      surfaces,
    );

    // Tag "agreement.pending" was exported by A (along the path to B)
    expect(atoms).toHaveLength(1);
  });

  it("handles eq-based attachWhen condition", () => {
    const track = makeTrack(
      "eq-condition",
      {
        A: makeState("A", {
          onEnter: [{ op: "setReg", path: "forcing.state", value: "game" }],
        }),
      },
      "A",
    );

    const matchingProtocol = makeProtocol(
      "eq-match",
      { op: "eq", ref: { kind: "reg", path: "forcing.state" }, value: "game" },
      { s1: makeProtocolState("s1", { surface: "sf:blackwood-ask" }) },
      "s1",
    );

    const nonMatchingProtocol = makeProtocol(
      "eq-nomatch",
      { op: "eq", ref: { kind: "reg", path: "forcing.state" }, value: "slam" },
      { s2: makeProtocolState("s2", { surface: "sf:blackwood-respond" }) },
      "s2",
    );

    const paths = enumerateBaseTrackStates(track);
    const pathA = paths.get("A")!;

    const matchAtoms = enumerateProtocolAtomsAtBaseState(
      "A", pathA, track, [matchingProtocol], surfaces,
    );
    expect(matchAtoms).toHaveLength(1);

    const noMatchAtoms = enumerateProtocolAtomsAtBaseState(
      "A", pathA, track, [nonMatchingProtocol], surfaces,
    );
    expect(noMatchAtoms).toHaveLength(0);
  });

  it("handles 'not' expressions in attachWhen", () => {
    const track = makeTrack(
      "not-check",
      {
        A: makeState("A", {
          exportTags: ["slam.done"],
        }),
      },
      "A",
    );

    const protocol = makeProtocol(
      "not-proto",
      { op: "not", arg: { op: "activeTag", tag: "slam.done" } },
      { s1: makeProtocolState("s1", { surface: "sf:blackwood-ask" }) },
      "s1",
    );

    const paths = enumerateBaseTrackStates(track);
    const atoms = enumerateProtocolAtomsAtBaseState(
      "A", paths.get("A")!, track, [protocol], surfaces,
    );

    // Tag is present, so NOT makes attachWhen false
    expect(atoms).toHaveLength(0);
  });

  it("handles 'or' expressions in attachWhen", () => {
    const track = makeTrack(
      "or-check",
      {
        A: makeState("A", {
          exportTags: ["verification.available"],
        }),
      },
      "A",
    );

    const protocol = makeProtocol(
      "or-proto",
      {
        op: "or",
        args: [
          { op: "activeTag", tag: "verification.available" },
          { op: "exists", ref: { kind: "reg", path: "nonexistent" } },
        ],
      },
      { s1: makeProtocolState("s1", { surface: "sf:blackwood-ask" }) },
      "s1",
    );

    const paths = enumerateBaseTrackStates(track);
    const atoms = enumerateProtocolAtomsAtBaseState(
      "A", paths.get("A")!, track, [protocol], surfaces,
    );

    // OR: first arg is true → protocol attaches
    expect(atoms).toHaveLength(1);
  });

  it("handles 'true' / 'false' literal expressions", () => {
    const track = makeTrack("literal", { A: makeState("A") }, "A");
    const paths = enumerateBaseTrackStates(track);
    const pathA = paths.get("A")!;

    const alwaysProto = makeProtocol(
      "always",
      { op: "true" },
      { s1: makeProtocolState("s1", { surface: "sf:blackwood-ask" }) },
      "s1",
    );

    const neverProto = makeProtocol(
      "never",
      { op: "false" },
      { s1: makeProtocolState("s1", { surface: "sf:blackwood-ask" }) },
      "s1",
    );

    const alwaysAtoms = enumerateProtocolAtomsAtBaseState(
      "A", pathA, track, [alwaysProto], surfaces,
    );
    expect(alwaysAtoms).toHaveLength(1);

    const neverAtoms = enumerateProtocolAtomsAtBaseState(
      "A", pathA, track, [neverProto], surfaces,
    );
    expect(neverAtoms).toHaveLength(0);
  });
});

// ── generateProtocolCoverageManifest ────────────────────────────────

describe("generateProtocolCoverageManifest", () => {
  it("generates a manifest with base atoms and protocol atoms", () => {
    const baseSurf = makeSurface({
      meaningId: "m:resp-stayman",
      teachingLabel: "Stayman 2C",
    });
    const protoSurf = makeSurface({
      meaningId: "m:slam-ask",
      teachingLabel: "Slam ask",
    });

    const surfaces: Record<string, SurfaceFragment> = {
      "sf:resp": makeFragment("sf:resp", [baseSurf]),
      "sf:slam": makeFragment("sf:slam", [protoSurf]),
    };

    const track = makeTrack(
      "base",
      {
        init: makeState("init", {
          transitions: [makeTransition("init→resp", bid(1, BidSuit.NoTrump), "resp")],
        }),
        resp: makeState("resp", {
          surface: "sf:resp",
          onEnter: [
            { op: "setReg", path: "agreement.strain", value: "notrump" },
            { op: "exportTag", tag: "agreement.final" },
          ],
        }),
      },
      "init",
    );

    const protocol = makeProtocol(
      "slam",
      {
        op: "and",
        args: [
          { op: "exists", ref: { kind: "reg", path: "agreement.strain" } },
          { op: "activeTag", tag: "agreement.final" },
        ],
      },
      {
        "slam-ask": makeProtocolState("slam-ask", { surface: "sf:slam" }),
      },
      "slam-ask",
    );

    const spec = makeConventionSpec({
      id: "test-manifest",
      name: "Test Manifest Convention",
      baseTracks: [track],
      protocols: [protocol],
      surfaces,
    });

    const manifest = generateProtocolCoverageManifest(spec);

    expect(manifest.specId).toBe("test-manifest");
    expect(manifest.specName).toBe("Test Manifest Convention");
    expect(manifest.totalBaseStates).toBe(2); // init + resp

    // Base atoms: only "resp" has a surface
    expect(manifest.baseAtoms).toHaveLength(1);
    expect(manifest.baseAtoms[0]!.baseStateId).toBe("resp");
    expect(manifest.baseAtoms[0]!.involvesProtocol).toBe(false);

    // Protocol atoms: slam protocol attaches at "resp" (has reg + tag)
    // but NOT at "init" (no register set yet)
    expect(manifest.protocolAtoms.length).toBeGreaterThan(0);
    expect(manifest.protocolAtoms.every((a) => a.involvesProtocol)).toBe(true);

    // Total atoms = base + protocol
    expect(manifest.totalAtoms).toBe(
      manifest.baseAtoms.length + manifest.protocolAtoms.length,
    );

    // No unreachable states
    expect(manifest.unreachable).toHaveLength(0);
  });

  it("reports unreachable states", () => {
    const track = makeTrack(
      "with-unreachable",
      {
        start: makeState("start"),
        orphan: makeState("orphan"), // no transitions lead here
      },
      "start",
    );

    const spec = makeConventionSpec({
      baseTracks: [track],
    });

    const manifest = generateProtocolCoverageManifest(spec);

    expect(manifest.totalBaseStates).toBe(1); // only "start" reachable
    expect(manifest.unreachable).toHaveLength(1);
    expect(manifest.unreachable[0]!.stateId).toBe("with-unreachable:orphan");
    expect(manifest.unreachable[0]!.reason).toContain("BFS");
  });

  it("counts totalProtocolStates across all protocols", () => {
    const track = makeTrack("simple", { init: makeState("init") }, "init");

    const proto1 = makeProtocol(
      "p1",
      { op: "true" },
      {
        "p1-s1": makeProtocolState("p1-s1"),
        "p1-s2": makeProtocolState("p1-s2"),
      },
      "p1-s1",
    );
    const proto2 = makeProtocol(
      "p2",
      { op: "true" },
      {
        "p2-s1": makeProtocolState("p2-s1"),
      },
      "p2-s1",
    );

    const spec = makeConventionSpec({
      baseTracks: [track],
      protocols: [proto1, proto2],
    });

    const manifest = generateProtocolCoverageManifest(spec);

    expect(manifest.totalProtocolStates).toBe(3); // 2 from p1 + 1 from p2
  });

  it("correctly separates baseAtoms and protocolAtoms", () => {
    const baseSurf = makeSurface({
      meaningId: "m:base-meaning",
      teachingLabel: "Base meaning",
    });
    const protoSurf = makeSurface({
      meaningId: "m:proto-meaning",
      teachingLabel: "Proto meaning",
    });

    const surfaces: Record<string, SurfaceFragment> = {
      "sf:base": makeFragment("sf:base", [baseSurf]),
      "sf:proto": makeFragment("sf:proto", [protoSurf]),
    };

    const track = makeTrack(
      "sep",
      {
        init: makeState("init", {
          surface: "sf:base",
          onEnter: [{ op: "exportTag", tag: "ready" }],
        }),
      },
      "init",
    );

    const protocol = makeProtocol(
      "p",
      { op: "activeTag", tag: "ready" },
      { ps: makeProtocolState("ps", { surface: "sf:proto" }) },
      "ps",
    );

    const spec = makeConventionSpec({
      baseTracks: [track],
      protocols: [protocol],
      surfaces,
    });

    const manifest = generateProtocolCoverageManifest(spec);

    // Base atoms: all have involvesProtocol=false
    for (const atom of manifest.baseAtoms) {
      expect(atom.involvesProtocol).toBe(false);
      expect(atom.activeProtocols).toEqual([]);
    }

    // Protocol atoms: all have involvesProtocol=true
    for (const atom of manifest.protocolAtoms) {
      expect(atom.involvesProtocol).toBe(true);
      expect(atom.activeProtocols.length).toBeGreaterThan(0);
    }
  });

  it("handles a convention with no protocols", () => {
    const track = makeTrack(
      "solo",
      {
        init: makeState("init", {
          surface: "sf:base",
          transitions: [makeTransition("init→end", bid(1, BidSuit.Clubs), "end")],
        }),
        end: makeState("end"),
      },
      "init",
    );

    const surfaces: Record<string, SurfaceFragment> = {
      "sf:base": makeFragment("sf:base", [
        makeSurface({ meaningId: "m:solo", teachingLabel: "Solo" }),
      ]),
    };

    const spec = makeConventionSpec({
      baseTracks: [track],
      protocols: [],
      surfaces,
    });

    const manifest = generateProtocolCoverageManifest(spec);

    expect(manifest.baseAtoms).toHaveLength(1);
    expect(manifest.protocolAtoms).toHaveLength(0);
    expect(manifest.totalAtoms).toBe(1);
    expect(manifest.totalProtocolStates).toBe(0);
  });

  it("handles multiple base tracks", () => {
    const track1 = makeTrack(
      "track-1",
      {
        t1a: makeState("t1a", {
          transitions: [makeTransition("t1a→t1b", bid(1, BidSuit.Clubs), "t1b")],
        }),
        t1b: makeState("t1b"),
      },
      "t1a",
    );

    const track2 = makeTrack(
      "track-2",
      {
        t2a: makeState("t2a"),
        t2b: makeState("t2b"), // unreachable
      },
      "t2a",
    );

    const spec = makeConventionSpec({
      baseTracks: [track1, track2],
    });

    const manifest = generateProtocolCoverageManifest(spec);

    // track-1: 2 reachable, track-2: 1 reachable
    expect(manifest.totalBaseStates).toBe(3);
    // track-2:t2b is unreachable
    expect(manifest.unreachable).toHaveLength(1);
    expect(manifest.unreachable[0]!.stateId).toBe("track-2:t2b");
  });
});

// ── Integration test with real NT base track ────────────────────────

describe("integration: NT base track coverage", () => {
  // Lazy import to avoid pulling in the full NT bundle for unit tests
  let ntBaseTrack: BaseModuleSpec;
  let ntSurfaces: Record<string, SurfaceFragment>;

  beforeAll(async () => {
    const trackModule = await import(
      "../../../../conventions/definitions/nt-bundle/base-track"
    );
    ntBaseTrack = trackModule.ntBaseTrack;
    ntSurfaces = trackModule.NT_SURFACE_FRAGMENTS;
  });

  it("enumerates all expected NT base track states", () => {
    const paths = enumerateBaseTrackStates(ntBaseTrack);

    // The NT track should have many reachable states
    expect(paths.size).toBeGreaterThan(10);

    // Key states should be reachable
    expect(paths.has("nt-opened")).toBe(true);
    expect(paths.has("responder-r1")).toBe(true);
    expect(paths.has("terminal")).toBe(true);
    expect(paths.has("opener-stayman")).toBe(true);
    expect(paths.has("opener-transfer-hearts")).toBe(true);
    expect(paths.has("opener-transfer-spades")).toBe(true);
  });

  it("generates atoms for NT base track surface states", () => {
    const atoms = enumerateBaseTrackAtoms(ntBaseTrack, ntSurfaces);

    // States with surfaces should produce atoms
    expect(atoms.length).toBeGreaterThan(0);

    // All atoms should be base-track-only
    expect(atoms.every((a) => !a.involvesProtocol)).toBe(true);
    expect(atoms.every((a) => a.activeProtocols.length === 0)).toBe(true);

    // responder-r1 has a surface with multiple meanings
    const responderAtoms = atoms.filter((a) => a.baseStateId === "responder-r1");
    expect(responderAtoms.length).toBeGreaterThan(0);
  });

  it("reports no unreachable states in the well-formed NT track", () => {
    const paths = enumerateBaseTrackStates(ntBaseTrack);
    const allStateIds = Object.keys(ntBaseTrack.states);

    // Every state should be reachable
    for (const stateId of allStateIds) {
      expect(paths.has(stateId)).toBe(true);
    }
  });

  it("generates a full coverage manifest for a minimal NT ConventionSpec", () => {
    const spec = makeConventionSpec({
      id: "nt-integration",
      name: "NT Integration Test",
      baseTracks: [ntBaseTrack],
      protocols: [],
      surfaces: ntSurfaces,
    });

    const manifest = generateProtocolCoverageManifest(spec);

    expect(manifest.specId).toBe("nt-integration");
    expect(manifest.totalBaseStates).toBeGreaterThan(10);
    expect(manifest.totalAtoms).toBeGreaterThan(0);
    expect(manifest.baseAtoms.length).toBe(manifest.totalAtoms); // no protocols
    expect(manifest.protocolAtoms).toHaveLength(0);
  });
});
