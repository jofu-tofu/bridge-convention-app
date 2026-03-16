import { describe, it, expect } from "vitest";
import { assembleMachine } from "../machine-assembler";
import type { MachineFragment, HandoffSpec } from "../../modules";
import type { MachineState, MachineTransition } from "../../runtime/machine-types";
import { BidSuit } from "../../../../engine/types";

// ─── Helpers ────────────────────────────────────────────────

function makeState(
  stateId: string,
  overrides: Partial<MachineState> = {},
): MachineState {
  return {
    stateId,
    parentId: null,
    transitions: [],
    ...overrides,
  };
}

function makeTransition(
  target: string,
  overrides: Partial<MachineTransition> = {},
): MachineTransition {
  return {
    transitionId: `t-to-${target}`,
    match: { kind: "any-bid" },
    target,
    ...overrides,
  };
}

function makeFragment(
  _moduleId: string,
  states: readonly MachineState[],
  entryTransitions: readonly MachineTransition[],
  exportedFrontiers: MachineFragment["exportedFrontiers"] = [],
): MachineFragment {
  return { states, entryTransitions, exportedFrontiers };
}

// ─── Tests ──────────────────────────────────────────────────

describe("assembleMachine", () => {
  it("produces a machine with idle initial state when given empty fragments", () => {
    const machine = assembleMachine("test-machine", [], []);
    expect(machine.machineId).toBe("test-machine");
    expect(machine.initialStateId).toBe("idle");
    expect(machine.states.has("idle")).toBe(true);
    expect(machine.states.get("idle")!.transitions).toEqual([]);
  });

  it("collects entry transitions from all fragments into idle state", () => {
    const fragA = makeFragment(
      "mod-a",
      [makeState("a-start", { surfaceGroupId: "group-a" })],
      [makeTransition("a-start", {
        transitionId: "enter-a",
        match: { kind: "call", level: 2, strain: BidSuit.Clubs },
      })],
    );
    const fragB = makeFragment(
      "mod-b",
      [makeState("b-start", { surfaceGroupId: "group-b" })],
      [makeTransition("b-start", {
        transitionId: "enter-b",
        match: { kind: "call", level: 2, strain: BidSuit.Diamonds },
      })],
    );

    const machine = assembleMachine("test", [fragA, fragB], []);
    const idle = machine.states.get("idle")!;
    expect(idle.transitions).toHaveLength(2);
    expect(idle.transitions[0]!.transitionId).toBe("enter-a");
    expect(idle.transitions[1]!.transitionId).toBe("enter-b");
  });

  it("collects all fragment states into the machine", () => {
    const fragA = makeFragment(
      "mod-a",
      [makeState("a-1"), makeState("a-2")],
      [],
    );
    const fragB = makeFragment("mod-b", [makeState("b-1")], []);

    const machine = assembleMachine("test", [fragA, fragB], []);
    // idle + a-1 + a-2 + b-1 = 4
    expect(machine.states.size).toBe(4);
    expect(machine.states.has("a-1")).toBe(true);
    expect(machine.states.has("a-2")).toBe(true);
    expect(machine.states.has("b-1")).toBe(true);
  });

  it("resolves handoff by prepending transitions to the frontier state", () => {
    const frontierState = makeState("stayman-deny", {
      transitions: [makeTransition("stayman-end", { transitionId: "existing" })],
    });
    const fragA = makeFragment(
      "mod-stayman",
      [makeState("stayman-start"), frontierState],
      [makeTransition("stayman-start")],
      [{ frontierId: "stayman:deny-major", stateId: "stayman-deny" }],
    );

    const handoff: HandoffSpec = {
      trigger: { kind: "frontier", frontierId: "stayman:deny-major" },
      transitions: [makeTransition("smolen-start", {
        transitionId: "handoff-to-smolen",
        match: { kind: "call", level: 3, strain: BidSuit.Hearts },
      })],
    };

    const fragB = makeFragment(
      "mod-smolen",
      [makeState("smolen-start")],
      [],
    );

    const machine = assembleMachine("test", [fragA, fragB], [handoff]);
    const denyState = machine.states.get("stayman-deny")!;
    // Handoff transition is prepended, existing transition follows
    expect(denyState.transitions).toHaveLength(2);
    expect(denyState.transitions[0]!.transitionId).toBe("handoff-to-smolen");
    expect(denyState.transitions[1]!.transitionId).toBe("existing");
  });

  it("provides a standard seatRole function", () => {
    const machine = assembleMachine("test", [], []);
    expect(typeof machine.seatRole).toBe("function");
  });
});
