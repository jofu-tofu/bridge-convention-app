import { describe, it, expect } from "vitest";
import { BidSuit, Seat } from "../../../../engine/types";
import { buildAuction } from "../../../../engine/auction-helpers";
import { ForcingState } from "../../../../core/contracts/bidding";
import type {
  MachineState,
  MachineEffect,
} from "../machine-types";
import { buildConversationMachine } from "../machine-types";
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

  it("matches opponent-action bid with level and strain filter", () => {
    expect(
      matchTransition(
        { kind: "opponent-action", callType: "bid", level: 1, strain: BidSuit.NoTrump },
        { type: "bid", level: 1, strain: BidSuit.NoTrump },
        "opponent",
      ),
    ).toBe(true);
  });

  it("rejects opponent-action bid with wrong level", () => {
    expect(
      matchTransition(
        { kind: "opponent-action", callType: "bid", level: 1, strain: BidSuit.NoTrump },
        { type: "bid", level: 2, strain: BidSuit.NoTrump },
        "opponent",
      ),
    ).toBe(false);
  });

  it("rejects opponent-action bid with wrong strain", () => {
    expect(
      matchTransition(
        { kind: "opponent-action", callType: "bid", level: 1, strain: BidSuit.NoTrump },
        { type: "bid", level: 1, strain: BidSuit.Hearts },
        "opponent",
      ),
    ).toBe(false);
  });

  it("matches opponent-action bid with level filter only", () => {
    expect(
      matchTransition(
        { kind: "opponent-action", callType: "bid", level: 2 },
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

describe("submachine invocation", () => {
  it("invokes submachine and returns to parent on submachine-return", () => {
    // RKCB submachine: waits for a bid response, then returns
    const rkcbMachine = buildConversationMachine(
      "rkcb",
      [
        {
          stateId: "rkcb-ask",
          parentId: null,
          transitions: [
            {
              transitionId: "t-rkcb-response",
              match: { kind: "any-bid" },
              target: "rkcb-done",
            },
          ],
        },
        {
          stateId: "rkcb-done",
          parentId: null,
          transitions: [
            {
              transitionId: "t-rkcb-return",
              match: { kind: "submachine-return" },
              target: "",
            },
          ],
        },
      ],
      "rkcb-ask",
    );

    const parentMachine = buildConversationMachine(
      "parent",
      [
        {
          stateId: "idle",
          parentId: null,
          transitions: [
            {
              transitionId: "t-invoke",
              match: { kind: "call", level: 4, strain: BidSuit.NoTrump },
              target: "invoke-rkcb",
            },
          ],
        },
        {
          stateId: "invoke-rkcb",
          parentId: null,
          transitions: [],
          submachineRef: {
            machineId: "rkcb",
            returnTarget: "after-rkcb",
          },
        },
        {
          stateId: "after-rkcb",
          parentId: null,
          transitions: [],
        },
      ],
      "idle",
    );

    const submachines = new Map([["rkcb", rkcbMachine]]);
    // North=4NT, East=P, South=5C
    const auction = buildAuction(Seat.North, ["4NT", "P", "5C"]);

    const result = evaluateMachine(
      parentMachine,
      auction,
      Seat.South,
      submachines,
    );

    expect(result.context.currentStateId).toBe("after-rkcb");
    expect(result.handoffTraces).toHaveLength(1);
    expect(result.handoffTraces[0]!.fromModuleId).toBe("parent");
    expect(result.handoffTraces[0]!.toModuleId).toBe("rkcb");
  });

  it("handles nested submachines: parent → sub1 → sub2 → return chain", () => {
    // Sub2: processes a pass then returns
    const sub2Machine = buildConversationMachine(
      "sub2",
      [
        {
          stateId: "sub2-idle",
          parentId: null,
          transitions: [
            {
              transitionId: "t-sub2-done",
              match: { kind: "pass" },
              target: "sub2-complete",
            },
          ],
        },
        {
          stateId: "sub2-complete",
          parentId: null,
          transitions: [
            {
              transitionId: "t-sub2-return",
              match: { kind: "submachine-return" },
              target: "",
            },
          ],
        },
      ],
      "sub2-idle",
    );

    // Sub1: processes a bid then invokes sub2, returns after sub2 completes
    const sub1Machine = buildConversationMachine(
      "sub1",
      [
        {
          stateId: "sub1-idle",
          parentId: null,
          transitions: [
            {
              transitionId: "t-sub1-step",
              match: { kind: "any-bid" },
              target: "sub1-invoke-sub2",
            },
          ],
        },
        {
          stateId: "sub1-invoke-sub2",
          parentId: null,
          transitions: [],
          submachineRef: {
            machineId: "sub2",
            returnTarget: "sub1-after-sub2",
          },
        },
        {
          stateId: "sub1-after-sub2",
          parentId: null,
          transitions: [
            {
              transitionId: "t-sub1-return",
              match: { kind: "submachine-return" },
              target: "",
            },
          ],
        },
      ],
      "sub1-idle",
    );

    const parentMachine = buildConversationMachine(
      "parent",
      [
        {
          stateId: "idle",
          parentId: null,
          transitions: [
            {
              transitionId: "t-invoke",
              match: { kind: "call", level: 1, strain: BidSuit.Clubs },
              target: "invoke-sub1",
            },
          ],
        },
        {
          stateId: "invoke-sub1",
          parentId: null,
          transitions: [],
          submachineRef: {
            machineId: "sub1",
            returnTarget: "after-sub1",
          },
        },
        {
          stateId: "after-sub1",
          parentId: null,
          transitions: [],
        },
      ],
      "idle",
    );

    const submachines = new Map([
      ["sub1", sub1Machine],
      ["sub2", sub2Machine],
    ]);
    // North=1C (→ parent invokes sub1), East=1D (→ sub1 invokes sub2), South=P (→ sub2 completes → cascade return)
    const auction = buildAuction(Seat.North, ["1C", "1D", "P"]);

    const result = evaluateMachine(
      parentMachine,
      auction,
      Seat.South,
      submachines,
    );

    expect(result.context.currentStateId).toBe("after-sub1");
    expect(result.handoffTraces).toHaveLength(2);
    expect(result.handoffTraces[0]!.toModuleId).toBe("sub1");
    expect(result.handoffTraces[1]!.toModuleId).toBe("sub2");
  });

  it("preserves parent registers on submachine return", () => {
    const subMachine = buildConversationMachine(
      "sub",
      [
        {
          stateId: "sub-idle",
          parentId: null,
          transitions: [
            {
              transitionId: "t-sub-step",
              match: { kind: "any-bid" },
              target: "sub-done",
              effects: { setCaptain: "nobody" },
            },
          ],
        },
        {
          stateId: "sub-done",
          parentId: null,
          transitions: [
            {
              transitionId: "t-sub-return",
              match: { kind: "submachine-return" },
              target: "",
            },
          ],
        },
      ],
      "sub-idle",
    );

    const parentMachine = buildConversationMachine(
      "parent",
      [
        {
          stateId: "idle",
          parentId: null,
          transitions: [
            {
              transitionId: "t-setup",
              match: { kind: "call", level: 1, strain: BidSuit.NoTrump },
              target: "invoke-sub",
              effects: { setCaptain: "responder" },
            },
          ],
        },
        {
          stateId: "invoke-sub",
          parentId: null,
          transitions: [],
          submachineRef: { machineId: "sub", returnTarget: "after-sub" },
        },
        {
          stateId: "after-sub",
          parentId: null,
          transitions: [],
        },
      ],
      "idle",
    );

    const submachines = new Map([["sub", subMachine]]);
    // North=1NT, East=P, South=2C
    const auction = buildAuction(Seat.North, ["1NT", "P", "2C"]);

    const result = evaluateMachine(
      parentMachine,
      auction,
      Seat.South,
      submachines,
    );

    expect(result.context.currentStateId).toBe("after-sub");
    // Parent set captain to "responder" before submachine invocation
    // Submachine changed captain to "nobody" (but this is lost on return)
    // On return, parent's registers should be restored
    expect(result.context.registers.captain).toBe("responder");
  });

  it("empty submachine with no transitions returns immediately", () => {
    const subMachine = buildConversationMachine(
      "sub",
      [
        {
          stateId: "sub-idle",
          parentId: null,
          transitions: [], // No transitions = terminal = immediate return
        },
      ],
      "sub-idle",
    );

    const parentMachine = buildConversationMachine(
      "parent",
      [
        {
          stateId: "idle",
          parentId: null,
          transitions: [
            {
              transitionId: "t-invoke",
              match: { kind: "call", level: 1, strain: BidSuit.Clubs },
              target: "invoke-sub",
            },
          ],
        },
        {
          stateId: "invoke-sub",
          parentId: null,
          transitions: [],
          submachineRef: { machineId: "sub", returnTarget: "after-sub" },
        },
        {
          stateId: "after-sub",
          parentId: null,
          transitions: [],
        },
      ],
      "idle",
    );

    const submachines = new Map([["sub", subMachine]]);
    const auction = buildAuction(Seat.North, ["1C"]);

    const result = evaluateMachine(
      parentMachine,
      auction,
      Seat.South,
      submachines,
    );

    // Submachine initial state has no transitions → immediate return to parent
    expect(result.context.currentStateId).toBe("after-sub");
  });
});

describe("loop evaluation", () => {
  it("loop with explicit exit via exitLoop transition", () => {
    const machine = buildConversationMachine(
      "test",
      [
        {
          stateId: "loop",
          parentId: null,
          loopConfig: { maxIterations: 10, exitTarget: "done" },
          transitions: [
            {
              transitionId: "t-exit",
              match: { kind: "pass" },
              target: "ignored",
              exitLoop: true,
            },
            {
              transitionId: "t-continue",
              match: { kind: "any-bid" },
              target: "loop",
            },
          ],
        },
        {
          stateId: "done",
          parentId: null,
          transitions: [],
        },
      ],
      "loop",
    );

    // 3 bids then a pass → 3 iterations then exit
    const auction = buildAuction(Seat.North, ["1C", "1D", "1H", "P"]);

    const result = evaluateMachine(machine, auction, Seat.South);

    expect(result.context.currentStateId).toBe("done");
    expect(
      result.context.transitionHistory.filter((t) => t === "t-continue"),
    ).toHaveLength(3);
    expect(result.context.transitionHistory).toContain("t-exit");
  });

  it("loop exits automatically when maxIterations reached", () => {
    const machine = buildConversationMachine(
      "test",
      [
        {
          stateId: "loop",
          parentId: null,
          loopConfig: { maxIterations: 3, exitTarget: "done" },
          transitions: [
            {
              transitionId: "t-continue",
              match: { kind: "any-bid" },
              target: "loop",
            },
          ],
        },
        {
          stateId: "done",
          parentId: null,
          transitions: [],
        },
      ],
      "loop",
    );

    const auction = buildAuction(Seat.North, ["1C", "1D", "1H", "1S"]);

    const result = evaluateMachine(machine, auction, Seat.South);

    expect(result.context.currentStateId).toBe("done");
    // 3 iterations: 1C, 1D succeed; 1H fires but redirects to done on re-entry
    expect(
      result.context.transitionHistory.filter((t) => t === "t-continue"),
    ).toHaveLength(3);
  });

  it("loop counter resets on re-entry after exit", () => {
    const machine = buildConversationMachine(
      "test",
      [
        {
          stateId: "loop",
          parentId: null,
          loopConfig: { maxIterations: 2, exitTarget: "between" },
          transitions: [
            {
              transitionId: "t-continue",
              match: { kind: "any-bid" },
              target: "loop",
            },
          ],
        },
        {
          stateId: "between",
          parentId: null,
          transitions: [
            {
              transitionId: "t-reenter",
              match: { kind: "pass" },
              target: "loop",
            },
          ],
        },
      ],
      "loop",
    );

    // First loop: 1C, 1D (hits max 2), auto-exit to "between"
    // P → re-enter loop (counter should reset)
    // Second loop: 1H, 1S (hits max 2), auto-exit to "between"
    const auction = buildAuction(Seat.North, [
      "1C",
      "1D",
      "P",
      "1H",
      "1S",
    ]);

    const result = evaluateMachine(machine, auction, Seat.South);

    expect(result.context.currentStateId).toBe("between");
    // 4 total t-continue transitions (2 per loop entry)
    expect(
      result.context.transitionHistory.filter((t) => t === "t-continue"),
    ).toHaveLength(4);
  });
});
