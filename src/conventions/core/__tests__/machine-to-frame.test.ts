/**
 * Tests for MachineState → FrameStateSpec converter.
 *
 * Verifies conversion rules: TransitionMatch → EventPattern,
 * MachineEffect → EffectSpec[], hierarchy flattening, surfaceGroupId → surface.
 */
import { describe, it, expect } from "vitest";
import {
  machineStatesToFrameStates,
  matchToEventPattern,
  effectToSpecs,
} from "../composition/machine-to-frame";
import type { MachineState, MachineEffect, TransitionMatch } from "../runtime/machine-types";
import { BidSuit } from "../../../engine/types";

// ── matchToEventPattern ─────────────────────────────────────────────

describe("matchToEventPattern", () => {
  it("converts call match to bid EventPattern", () => {
    const match: TransitionMatch = { kind: "call", level: 2, strain: BidSuit.Clubs };
    const result = matchToEventPattern(match);
    expect(result).toEqual({
      call: { type: "bid", level: 2, strain: BidSuit.Clubs },
    });
  });

  it("converts pass match without seatRole", () => {
    const match: TransitionMatch = { kind: "pass" };
    expect(matchToEventPattern(match)).toEqual({ callType: "pass" });
  });

  it("converts pass match with seatRole", () => {
    const match: TransitionMatch = { kind: "pass", seatRole: "self" };
    expect(matchToEventPattern(match)).toEqual({ actor: "self", callType: "pass" });
  });

  it("converts opponent-action match", () => {
    const match: TransitionMatch = { kind: "opponent-action" };
    expect(matchToEventPattern(match)).toEqual({ actor: "opponent" });
  });

  it("converts any-bid match", () => {
    const match: TransitionMatch = { kind: "any-bid" };
    expect(matchToEventPattern(match)).toEqual({ callType: "bid" });
  });

  it("throws on predicate match", () => {
    const match: TransitionMatch = {
      kind: "predicate",
      test: () => true,
    };
    expect(() => matchToEventPattern(match)).toThrow(/predicate transitions not supported/);
  });

  it("throws on submachine-return match", () => {
    const match: TransitionMatch = { kind: "submachine-return" };
    expect(() => matchToEventPattern(match)).toThrow(/submachine-return/);
  });
});

// ── effectToSpecs ───────────────────────────────────────────────────

describe("effectToSpecs", () => {
  it("converts setObligation to two setReg effects", () => {
    const effect: MachineEffect = {
      setObligation: { kind: "ShowMajor", obligatedSide: "opener" },
    };
    const specs = effectToSpecs(effect);
    expect(specs).toEqual([
      { op: "setReg", path: "obligation.kind", value: "ShowMajor" },
      { op: "setReg", path: "obligation.side", value: "opener" },
    ]);
  });

  it("converts setAgreedStrain with suit", () => {
    const effect: MachineEffect = {
      setAgreedStrain: { type: "suit", suit: "hearts", confidence: "tentative" },
    };
    const specs = effectToSpecs(effect);
    expect(specs).toEqual([
      { op: "setReg", path: "agreement.strain", value: { type: "suit", suit: "hearts" } },
      { op: "setReg", path: "agreement.status", value: "tentative" },
    ]);
  });

  it("converts setAgreedStrain none to clearReg", () => {
    const effect: MachineEffect = {
      setAgreedStrain: { type: "none" },
    };
    const specs = effectToSpecs(effect);
    expect(specs).toEqual([
      { op: "clearReg", path: "agreement.strain" },
      { op: "clearReg", path: "agreement.status" },
    ]);
  });

  it("converts setCompetitionMode", () => {
    const effect: MachineEffect = { setCompetitionMode: "contested" };
    const specs = effectToSpecs(effect);
    expect(specs).toEqual([
      { op: "setReg", path: "competition.mode", value: "contested" },
    ]);
  });

  it("converts setCaptain", () => {
    const effect: MachineEffect = { setCaptain: "responder" };
    const specs = effectToSpecs(effect);
    expect(specs).toEqual([
      { op: "setReg", path: "captain.side", value: "responder" },
    ]);
  });

  it("converts multiple effects in one MachineEffect", () => {
    const effect: MachineEffect = {
      setCaptain: "opener",
      setCompetitionMode: "contested",
    };
    const specs = effectToSpecs(effect);
    expect(specs).toHaveLength(2);
    expect(specs.some((s) => s.op === "setReg" && s.path === "captain.side")).toBe(true);
    expect(specs.some((s) => s.op === "setReg" && s.path === "competition.mode")).toBe(true);
  });
});

// ── machineStatesToFrameStates ──────────────────────────────────────

describe("machineStatesToFrameStates", () => {
  it("converts a simple state with surfaceGroupId and transitions", () => {
    const states: MachineState[] = [
      {
        stateId: "my-state",
        parentId: null,
        transitions: [
          {
            transitionId: "t1",
            match: { kind: "call", level: 2, strain: BidSuit.Clubs },
            target: "next",
          },
        ],
        surfaceGroupId: "my-group",
      },
    ];

    const result = machineStatesToFrameStates(states);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("my-state");
    expect(result[0]!.surface).toBe("sf:my-group");
    expect(result[0]!.eventTransitions).toHaveLength(1);
    expect(result[0]!.eventTransitions[0]!.when).toEqual({
      call: { type: "bid", level: 2, strain: BidSuit.Clubs },
    });
  });

  it("converts self-targeting transitions to STAY", () => {
    const states: MachineState[] = [
      {
        stateId: "waiting",
        parentId: null,
        transitions: [
          {
            transitionId: "absorb",
            match: { kind: "pass" },
            target: "waiting", // self-target
          },
        ],
      },
    ];

    const result = machineStatesToFrameStates(states);
    expect(result[0]!.eventTransitions[0]!.goto).toBe("STAY");
  });

  it("passes through exportTags", () => {
    const states: MachineState[] = [
      {
        stateId: "tagged",
        parentId: null,
        transitions: [],
        exportTags: ["agreement.pending"],
      },
    ];

    const result = machineStatesToFrameStates(states);
    expect(result[0]!.exportTags).toEqual(["agreement.pending"]);
  });

  it("converts entryEffects to onEnter", () => {
    const states: MachineState[] = [
      {
        stateId: "with-effects",
        parentId: null,
        transitions: [],
        entryEffects: { setCaptain: "responder" },
      },
    ];

    const result = machineStatesToFrameStates(states);
    expect(result[0]!.onEnter).toEqual([
      { op: "setReg", path: "captain.side", value: "responder" },
    ]);
  });

  it("flattens parent transitions into child states", () => {
    const states: MachineState[] = [
      {
        stateId: "parent",
        parentId: null,
        transitions: [
          {
            transitionId: "parent-interrupt",
            match: { kind: "opponent-action" },
            target: "interrupted",
          },
        ],
      },
      {
        stateId: "child",
        parentId: "parent",
        transitions: [
          {
            transitionId: "child-action",
            match: { kind: "call", level: 2, strain: BidSuit.Hearts },
            target: "next",
          },
        ],
        surfaceGroupId: "child-group",
        allowedParentTransitions: ["parent-interrupt"],
      },
    ];

    const result = machineStatesToFrameStates(states);
    // Parent is abstract (only provides transitions for child) → excluded
    const childState = result.find((s) => s.id === "child");
    expect(childState).toBeDefined();
    expect(childState!.eventTransitions).toHaveLength(2); // own + inherited
    expect(childState!.eventTransitions[1]!.transitionId).toBe("parent-interrupt");
  });

  it("excludes abstract scope states from output", () => {
    const states: MachineState[] = [
      {
        stateId: "scope",
        parentId: null,
        transitions: [
          {
            transitionId: "scope-interrupt",
            match: { kind: "opponent-action" },
            target: "interrupted",
          },
        ],
      },
      {
        stateId: "child-a",
        parentId: "scope",
        transitions: [],
        surfaceGroupId: "group-a",
        allowedParentTransitions: ["scope-interrupt"],
      },
    ];

    const result = machineStatesToFrameStates(states);
    // scope state should be excluded (abstract parent)
    expect(result.find((s) => s.id === "scope")).toBeUndefined();
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("child-a");
  });

  it("converts Stayman opener state faithfully", () => {
    // Golden-master test using actual Stayman machine state shape
    const states: MachineState[] = [
      {
        stateId: "scope",
        parentId: null,
        transitions: [
          {
            transitionId: "opp-interrupt",
            match: { kind: "opponent-action" },
            target: "interrupted",
          },
        ],
      },
      {
        stateId: "opener-stayman",
        parentId: "scope",
        allowedParentTransitions: ["opp-interrupt"],
        transitions: [
          {
            transitionId: "stayman-pass",
            match: { kind: "pass" },
            target: "opener-stayman",
          },
          {
            transitionId: "stayman-2h",
            match: { kind: "call", level: 2, strain: BidSuit.Hearts },
            target: "r3-2h",
          },
        ],
        surfaceGroupId: "opener-stayman-response",
        exportTags: ["agreement.pending"],
        entryEffects: {
          setObligation: { kind: "ShowMajor", obligatedSide: "opener" },
        },
      },
    ];

    const result = machineStatesToFrameStates(states);
    const openerState = result.find((s) => s.id === "opener-stayman")!;

    expect(openerState.surface).toBe("sf:opener-stayman-response");
    expect(openerState.exportTags).toEqual(["agreement.pending"]);
    expect(openerState.onEnter).toEqual([
      { op: "setReg", path: "obligation.kind", value: "ShowMajor" },
      { op: "setReg", path: "obligation.side", value: "opener" },
    ]);
    // Own transitions + inherited parent interrupt
    expect(openerState.eventTransitions).toHaveLength(3);
    // Self-target → STAY
    expect(openerState.eventTransitions[0]!.goto).toBe("STAY");
    // Call transition
    expect(openerState.eventTransitions[1]!.goto).toBe("r3-2h");
    // Inherited opponent interrupt
    expect(openerState.eventTransitions[2]!.when).toEqual({ actor: "opponent" });
  });
});
