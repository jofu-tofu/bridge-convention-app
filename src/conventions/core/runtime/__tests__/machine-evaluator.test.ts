import { describe, it, expect } from "vitest";
import { BidSuit, Seat } from "../../../../engine/types";
import { buildAuction } from "../../../../engine/auction-helpers";
import { ForcingState } from "../../../../core/contracts/bidding";
import type {
  MachineState,
  MachineEffect,
} from "../machine-types";
import type { CandidateTransform } from "../../../../core/contracts/meaning";
import type { PublicSnapshot } from "../../../../core/contracts/module-surface";
import {
  evaluateMachine,
  collectAncestorChain,
  applyMachineEffect,
  matchTransition,
  collectInheritedTransforms,
  createDefaultRegisters,
} from "../machine-evaluator";
import { buildMachine } from "./runtime-test-helpers";

describe("evaluateMachine", () => {
  it("stays in initial state for empty auction", () => {
    const idle: MachineState = {
      stateId: "idle",
      parentId: null,
      transitions: [],
    };
    const machine = buildMachine([idle], "idle");
    const auction = buildAuction(Seat.North, []);

    const result = evaluateMachine(machine, auction, Seat.South);

    expect(result.context.currentStateId).toBe("idle");
    expect(result.context.stateHistory).toEqual(["idle"]);
    expect(result.context.transitionHistory).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });

  it("fires single transition on matching call", () => {
    const idle: MachineState = {
      stateId: "idle",
      parentId: null,
      transitions: [
        {
          transitionId: "t1",
          match: { kind: "call", level: 1, strain: BidSuit.NoTrump },
          target: "nt-opened",
        },
      ],
    };
    const ntOpened: MachineState = {
      stateId: "nt-opened",
      parentId: null,
      transitions: [],
      surfaceGroupId: "responder-r1",
    };
    const machine = buildMachine([idle, ntOpened], "idle");
    // North opens 1NT
    const auction = buildAuction(Seat.North, ["1NT"]);

    const result = evaluateMachine(machine, auction, Seat.South);

    expect(result.context.currentStateId).toBe("nt-opened");
    expect(result.context.stateHistory).toEqual(["idle", "nt-opened"]);
    expect(result.context.transitionHistory).toEqual(["t1"]);
    expect(result.activeSurfaceGroupIds).toContain("responder-r1");
  });

  it("applies entry effects on target state", () => {
    const idle: MachineState = {
      stateId: "idle",
      parentId: null,
      transitions: [
        {
          transitionId: "t1",
          match: { kind: "call", level: 1, strain: BidSuit.NoTrump },
          target: "nt-opened",
        },
      ],
    };
    const ntOpened: MachineState = {
      stateId: "nt-opened",
      parentId: null,
      transitions: [],
      entryEffects: {
        setCaptain: "responder",
        setForcingState: ForcingState.ForcingOneRound,
      },
    };
    const machine = buildMachine([idle, ntOpened], "idle");
    const auction = buildAuction(Seat.North, ["1NT"]);

    const result = evaluateMachine(machine, auction, Seat.South);

    expect(result.context.registers.captain).toBe("responder");
    expect(result.context.registers.forcingState).toBe(
      ForcingState.ForcingOneRound,
    );
  });

  it("fires inherited transition when child has no match", () => {
    const parent: MachineState = {
      stateId: "parent",
      parentId: null,
      transitions: [
        {
          transitionId: "t-parent",
          match: { kind: "pass" },
          target: "after-pass",
        },
      ],
    };
    const child: MachineState = {
      stateId: "child",
      parentId: "parent",
      transitions: [
        {
          transitionId: "t-child",
          match: { kind: "call", level: 2, strain: BidSuit.Clubs },
          target: "after-2c",
        },
      ],
    };
    const afterPass: MachineState = {
      stateId: "after-pass",
      parentId: null,
      transitions: [],
    };
    const after2c: MachineState = {
      stateId: "after-2c",
      parentId: null,
      transitions: [],
    };

    // Start in child, receive a pass — child has no pass transition, parent does
    const machine = buildMachine(
      [parent, child, afterPass, after2c],
      "child",
    );
    const auction = buildAuction(Seat.North, ["P"]);

    const result = evaluateMachine(machine, auction, Seat.South);

    expect(result.context.currentStateId).toBe("after-pass");
    expect(result.context.transitionHistory).toContain("t-parent");
  });

  it("child transition preempts parent transition (descendant-first)", () => {
    const parent: MachineState = {
      stateId: "parent",
      parentId: null,
      transitions: [
        {
          transitionId: "t-parent-pass",
          match: { kind: "pass" },
          target: "parent-pass-target",
        },
      ],
    };
    const child: MachineState = {
      stateId: "child",
      parentId: "parent",
      transitions: [
        {
          transitionId: "t-child-pass",
          match: { kind: "pass" },
          target: "child-pass-target",
        },
      ],
    };
    const parentTarget: MachineState = {
      stateId: "parent-pass-target",
      parentId: null,
      transitions: [],
    };
    const childTarget: MachineState = {
      stateId: "child-pass-target",
      parentId: null,
      transitions: [],
    };

    const machine = buildMachine(
      [parent, child, parentTarget, childTarget],
      "child",
    );
    const auction = buildAuction(Seat.North, ["P"]);

    const result = evaluateMachine(machine, auction, Seat.South);

    expect(result.context.currentStateId).toBe("child-pass-target");
    expect(result.context.transitionHistory).toEqual(["t-child-pass"]);
  });

  it("accumulates effects through multiple transitions", () => {
    const s1: MachineState = {
      stateId: "s1",
      parentId: null,
      transitions: [
        {
          transitionId: "t1",
          match: { kind: "call", level: 1, strain: BidSuit.NoTrump },
          target: "s2",
          effects: { setCaptain: "responder" },
        },
      ],
    };
    const s2: MachineState = {
      stateId: "s2",
      parentId: null,
      transitions: [
        {
          transitionId: "t2",
          match: { kind: "pass" },
          target: "s3",
          effects: { setCompetitionMode: "uncontested" },
        },
      ],
      entryEffects: { setForcingState: ForcingState.ForcingOneRound },
    };
    const s3: MachineState = {
      stateId: "s3",
      parentId: null,
      transitions: [],
      entryEffects: {
        setObligation: { kind: "ShowMajor", obligatedSide: "opener" },
      },
    };

    const machine = buildMachine([s1, s2, s3], "s1");
    // North=1NT, East=P
    const auction = buildAuction(Seat.North, ["1NT", "P"]);

    const result = evaluateMachine(machine, auction, Seat.South);

    expect(result.context.registers.captain).toBe("responder");
    expect(result.context.registers.forcingState).toBe(
      ForcingState.ForcingOneRound,
    );
    expect(result.context.registers.competitionMode).toBe("uncontested");
    expect(result.context.registers.obligation.kind).toBe("ShowMajor");
  });

  it("guard prevents transition when condition fails", () => {
    const s1: MachineState = {
      stateId: "s1",
      parentId: null,
      transitions: [
        {
          transitionId: "t-guarded",
          match: { kind: "pass" },
          target: "guarded-target",
          guard: (_snapshot: PublicSnapshot) => false,
        },
        {
          transitionId: "t-fallback",
          match: { kind: "pass" },
          target: "fallback-target",
        },
      ],
    };
    const guardedTarget: MachineState = {
      stateId: "guarded-target",
      parentId: null,
      transitions: [],
    };
    const fallbackTarget: MachineState = {
      stateId: "fallback-target",
      parentId: null,
      transitions: [],
    };

    const machine = buildMachine(
      [s1, guardedTarget, fallbackTarget],
      "s1",
    );
    const auction = buildAuction(Seat.North, ["P"]);

    const result = evaluateMachine(machine, auction, Seat.South);

    expect(result.context.currentStateId).toBe("fallback-target");
  });

  it("opponent-action match fires on opponent bid", () => {
    const s1: MachineState = {
      stateId: "s1",
      parentId: null,
      transitions: [
        {
          transitionId: "t-opp",
          match: { kind: "opponent-action", callType: "double" },
          target: "contested",
        },
      ],
    };
    const contested: MachineState = {
      stateId: "contested",
      parentId: null,
      transitions: [],
      entryEffects: { setCompetitionMode: "Doubled" },
    };

    const machine = buildMachine([s1, contested], "s1");
    // North opens 1NT, East doubles — South evaluates, East is opponent
    const auction = buildAuction(Seat.North, ["1NT", "X"]);

    const result = evaluateMachine(machine, auction, Seat.South);

    expect(result.context.currentStateId).toBe("contested");
    expect(result.context.registers.competitionMode).toBe("Doubled");
  });

  it("opponent-action does not fire on partner bid", () => {
    const s1: MachineState = {
      stateId: "s1",
      parentId: null,
      transitions: [
        {
          transitionId: "t-opp",
          match: { kind: "opponent-action", callType: "double" },
          target: "contested",
        },
      ],
    };
    const contested: MachineState = {
      stateId: "contested",
      parentId: null,
      transitions: [],
    };

    const machine = buildMachine([s1, contested], "s1");
    // East opens 1NT, South (partner of North) doubles — North evaluates, South is partner
    const auction = buildAuction(Seat.East, ["1NT", "X"]);

    const result = evaluateMachine(machine, auction, Seat.North);

    expect(result.context.currentStateId).toBe("s1");
  });

  it("collects surfaceGroupId from active state and ancestors", () => {
    const parent: MachineState = {
      stateId: "parent",
      parentId: null,
      transitions: [],
      surfaceGroupId: "parent-surfaces",
    };
    const child: MachineState = {
      stateId: "child",
      parentId: "parent",
      transitions: [],
      surfaceGroupId: "child-surfaces",
    };

    const machine = buildMachine([parent, child], "child");
    const auction = buildAuction(Seat.North, []);

    const result = evaluateMachine(machine, auction, Seat.South);

    // Descendant-first: child surface group appears first
    expect(result.activeSurfaceGroupIds).toEqual([
      "child-surfaces",
      "parent-surfaces",
    ]);
  });

  it("collects transforms from ancestry (descendant-first)", () => {
    const parentTransform: CandidateTransform = {
      transformId: "t-parent",
      kind: "suppress",
      targetId: "some-meaning",
      sourceModuleId: "test",
      reason: "parent suppress",
    };
    const childTransform: CandidateTransform = {
      transformId: "t-child",
      kind: "suppress",
      targetId: "other-meaning",
      sourceModuleId: "test",
      reason: "child suppress",
    };

    const parent: MachineState = {
      stateId: "parent",
      parentId: null,
      transitions: [],
      transforms: [parentTransform],
    };
    const child: MachineState = {
      stateId: "child",
      parentId: "parent",
      transitions: [],
      transforms: [childTransform],
    };

    const machine = buildMachine([parent, child], "child");
    const auction = buildAuction(Seat.North, []);

    const result = evaluateMachine(machine, auction, Seat.South);

    expect(result.collectedTransforms).toEqual([
      childTransform,
      parentTransform,
    ]);
  });
});

describe("collectAncestorChain", () => {
  it("returns single state for root", () => {
    const root: MachineState = {
      stateId: "root",
      parentId: null,
      transitions: [],
    };
    const states = new Map([["root", root]]);
    const chain = collectAncestorChain(states, "root");
    expect(chain).toEqual([root]);
  });

  it("walks from child to root", () => {
    const root: MachineState = {
      stateId: "root",
      parentId: null,
      transitions: [],
    };
    const child: MachineState = {
      stateId: "child",
      parentId: "root",
      transitions: [],
    };
    const grandchild: MachineState = {
      stateId: "grandchild",
      parentId: "child",
      transitions: [],
    };
    const states = new Map([
      ["root", root],
      ["child", child],
      ["grandchild", grandchild],
    ]);
    const chain = collectAncestorChain(states, "grandchild");
    expect(chain.map((s) => s.stateId)).toEqual([
      "grandchild",
      "child",
      "root",
    ]);
  });
});

describe("applyMachineEffect", () => {
  it("updates forcingState", () => {
    const regs = createDefaultRegisters();
    const effect: MachineEffect = {
      setForcingState: ForcingState.GameForcing,
    };
    const updated = applyMachineEffect(regs, effect);
    expect(updated.forcingState).toBe(ForcingState.GameForcing);
    // Original unchanged
    expect(regs.forcingState).toBe(ForcingState.Nonforcing);
  });

  it("merges registers", () => {
    const regs = createDefaultRegisters();
    const effect: MachineEffect = {
      mergeRegisters: { foo: "bar" },
    };
    const updated = applyMachineEffect(regs, effect);
    expect(updated.systemCapabilities).toEqual({});
    // mergeRegisters doesn't affect typed fields — it's a separate concern
    // but the function should not crash
    expect(updated.forcingState).toBe(ForcingState.Nonforcing);
  });

  it("sets multiple fields at once", () => {
    const regs = createDefaultRegisters();
    const effect: MachineEffect = {
      setCaptain: "opener",
      setCompetitionMode: "Doubled",
      setObligation: { kind: "ShowMajor", obligatedSide: "opener" },
    };
    const updated = applyMachineEffect(regs, effect);
    expect(updated.captain).toBe("opener");
    expect(updated.competitionMode).toBe("Doubled");
    expect(updated.obligation).toEqual({
      kind: "ShowMajor",
      obligatedSide: "opener",
    });
  });
});

describe("matchTransition", () => {
  it("matches call by level and strain", () => {
    expect(
      matchTransition(
        { kind: "call", level: 1, strain: BidSuit.NoTrump },
        { type: "bid", level: 1, strain: BidSuit.NoTrump },
        "partner",
      ),
    ).toBe(true);
  });

  it("rejects call with wrong strain", () => {
    expect(
      matchTransition(
        { kind: "call", level: 1, strain: BidSuit.NoTrump },
        { type: "bid", level: 1, strain: BidSuit.Hearts },
        "partner",
      ),
    ).toBe(false);
  });

  it("matches pass", () => {
    expect(
      matchTransition({ kind: "pass" }, { type: "pass" }, "opponent"),
    ).toBe(true);
  });

  it("rejects pass for bid", () => {
    expect(
      matchTransition(
        { kind: "pass" },
        { type: "bid", level: 1, strain: BidSuit.Clubs },
        "opponent",
      ),
    ).toBe(false);
  });

  it("matches any-bid for any contract bid", () => {
    expect(
      matchTransition(
        { kind: "any-bid" },
        { type: "bid", level: 3, strain: BidSuit.Diamonds },
        "partner",
      ),
    ).toBe(true);
  });

  it("rejects any-bid for pass", () => {
    expect(
      matchTransition({ kind: "any-bid" }, { type: "pass" }, "partner"),
    ).toBe(false);
  });

  it("matches opponent-action with callType", () => {
    expect(
      matchTransition(
        { kind: "opponent-action", callType: "double" },
        { type: "double" },
        "opponent",
      ),
    ).toBe(true);
  });

  it("rejects opponent-action when seatRole is not opponent", () => {
    expect(
      matchTransition(
        { kind: "opponent-action", callType: "double" },
        { type: "double" },
        "partner",
      ),
    ).toBe(false);
  });

  it("matches opponent-action without callType for any opponent action", () => {
    expect(
      matchTransition(
        { kind: "opponent-action" },
        { type: "bid", level: 2, strain: BidSuit.Hearts },
        "opponent",
      ),
    ).toBe(true);
  });
});

describe("collectInheritedTransforms", () => {
  it("collects transforms descendant-first", () => {
    const t1: CandidateTransform = {
      transformId: "t1",
      kind: "suppress",
      targetId: "a",
      sourceModuleId: "m",
      reason: "r",
    };
    const t2: CandidateTransform = {
      transformId: "t2",
      kind: "suppress",
      targetId: "b",
      sourceModuleId: "m",
      reason: "r",
    };
    const parent: MachineState = {
      stateId: "parent",
      parentId: null,
      transitions: [],
      transforms: [t2],
    };
    const child: MachineState = {
      stateId: "child",
      parentId: "parent",
      transitions: [],
      transforms: [t1],
    };
    const states = new Map([
      ["parent", parent],
      ["child", child],
    ]);

    const result = collectInheritedTransforms(states, "child");
    expect(result).toEqual([t1, t2]);
  });

  it("returns empty for state with no transforms", () => {
    const s: MachineState = {
      stateId: "s",
      parentId: null,
      transitions: [],
    };
    const states = new Map([["s", s]]);
    expect(collectInheritedTransforms(states, "s")).toEqual([]);
  });
});
