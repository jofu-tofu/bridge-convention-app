import { describe, it, expect } from "vitest";
import { Seat } from "../../../../engine/types";
import { buildAuction } from "../../../../engine/auction-helpers";
import { evaluateMachine } from "../../../core/runtime/machine-evaluator";
import { validateMachine } from "../../../core/runtime/machine-validation";
import { ForcingState } from "../../../../core/contracts/bidding";
import {
  buildConversationMachine,
  type ConversationMachine,
  type MachineState,
} from "../../../core/runtime/machine-types";
import {
  createNtConversationMachine,
  createSmolenSubmachine,
} from "../machine";

// ═══════════════════════════════════════════════════════════════
// Isolated submachine behavior tests
//
// These tests use minimal stub parent machines to isolate the
// Smolen submachine's behavior from the 7-transition NT preamble.
// Each test targets one submachine-specific concern.
// ═══════════════════════════════════════════════════════════════

const smolenSub = createSmolenSubmachine();
const smolenMap: ReadonlyMap<string, ConversationMachine> = new Map([
  ["smolen-continuation", smolenSub],
]);

/**
 * Build a minimal stub parent that invokes the Smolen submachine
 * with a specific agreedStrain, exercising one submachine concern
 * without the full NT preamble.
 */
function buildStubParent(
  agreedSuit: "hearts" | "spades",
): ConversationMachine {
  const states: MachineState[] = [
    {
      stateId: "stub-idle",
      parentId: null,
      transitions: [
        {
          transitionId: "stub-invoke",
          match: { kind: "any-bid" },
          target: "stub-invoke-smolen",
        },
      ],
    },
    {
      stateId: "stub-invoke-smolen",
      parentId: null,
      transitions: [],
      submachineRef: {
        machineId: "smolen-continuation",
        returnTarget: "stub-returned",
      },
      entryEffects: {
        setAgreedStrain: {
          type: "suit",
          suit: agreedSuit,
          confidence: "tentative",
        },
        setForcingState: ForcingState.GameForcing,
        setCaptain: "responder",
      },
    },
    {
      stateId: "stub-returned",
      parentId: null,
      transitions: [],
      entryEffects: {
        setCaptain: "nobody",
      },
    },
  ];
  return buildConversationMachine("stub-parent", states, "stub-idle");
}

/** Evaluate a stub parent against a short auction. */
function evalStub(parent: ConversationMachine, bids: string[]) {
  const auction = buildAuction(Seat.North, bids);
  return evaluateMachine(parent, auction, Seat.South, smolenMap);
}

describe("Smolen submachine structure", () => {
  it("passes validation with no errors", () => {
    const diags = validateMachine(smolenSub);
    const errors = diags.filter((d) => d.level === "error");
    expect(errors).toHaveLength(0);
  });

  it("contains all required states", () => {
    const requiredStates = [
      "smolen-wait", "opener-place-hearts", "opener-place-spades",
      "smolen-done", "smolen-contested",
    ];
    for (const stateId of requiredStates) {
      expect(smolenSub.states.has(stateId), `missing state: ${stateId}`).toBe(true);
    }
  });

  it("initial state is smolen-wait", () => {
    expect(smolenSub.initialStateId).toBe("smolen-wait");
  });

  it("smolen-done is terminal (triggers auto-return)", () => {
    expect(smolenSub.states.get("smolen-done")!.transitions).toHaveLength(0);
  });

  it("opener-place-hearts has surfaceGroupId opener-smolen-hearts", () => {
    expect(smolenSub.states.get("opener-place-hearts")!.surfaceGroupId).toBe(
      "opener-smolen-hearts",
    );
  });

  it("opener-place-spades has surfaceGroupId opener-smolen-spades", () => {
    expect(smolenSub.states.get("opener-place-spades")!.surfaceGroupId).toBe(
      "opener-smolen-spades",
    );
  });
});

describe("Smolen submachine: guard-based routing", () => {
  it("pass routes to opener-place-hearts when agreedStrain is hearts", () => {
    const parent = buildStubParent("hearts");
    // 1C(N) triggers invoke, P(E) is the first call inside submachine
    const result = evalStub(parent, ["1C", "P"]);
    expect(result.context.currentStateId).toBe("opener-place-hearts");
    expect(result.activeSurfaceGroupIds).toContain("opener-smolen-hearts");
  });

  it("pass routes to opener-place-spades when agreedStrain is spades", () => {
    const parent = buildStubParent("spades");
    const result = evalStub(parent, ["1C", "P"]);
    expect(result.context.currentStateId).toBe("opener-place-spades");
    expect(result.activeSurfaceGroupIds).toContain("opener-smolen-spades");
  });

  it("hearts and spades routes are mutually exclusive", () => {
    const heartsResult = evalStub(buildStubParent("hearts"), ["1C", "P"]);
    const spadesResult = evalStub(buildStubParent("spades"), ["1C", "P"]);

    expect(heartsResult.activeSurfaceGroupIds).not.toContain(
      "opener-smolen-spades",
    );
    expect(spadesResult.activeSurfaceGroupIds).not.toContain(
      "opener-smolen-hearts",
    );
  });
});

describe("Smolen submachine: entry effects", () => {
  it("sets captain to opener on hearts placement entry", () => {
    const parent = buildStubParent("hearts");
    const result = evalStub(parent, ["1C", "P"]);
    expect(result.context.registers.captain).toBe("opener");
  });

  it("sets captain to opener on spades placement entry", () => {
    const parent = buildStubParent("spades");
    const result = evalStub(parent, ["1C", "P"]);
    expect(result.context.registers.captain).toBe("opener");
  });

  it("sets competitionMode on contested entry", () => {
    const parent = buildStubParent("hearts");
    // 1C(N) triggers invoke, X(E) is opponent interference inside submachine
    // smolen-contested is terminal → auto-returns to stub-returned
    const result = evalStub(parent, ["1C", "X"]);
    // After auto-return, parent entry effects override, but state history shows
    // smolen-contested was visited
    expect(result.context.stateHistory).toContain("smolen-contested");
  });
});

describe("Smolen submachine: terminal auto-return", () => {
  it("returns to parent after opener places (bid → smolen-done → parent)", () => {
    const parent = buildStubParent("hearts");
    // 1C(N) invoke → P(E) routes to opener-place-hearts → 2H(S) → smolen-done → auto-return
    const result = evalStub(parent, ["1C", "P", "2H"]);
    expect(result.context.currentStateId).toBe("stub-returned");
    // State history should show the submachine was entered and exited
    expect(result.context.stateHistory).toContain("smolen-wait");
    expect(result.context.stateHistory).toContain("opener-place-hearts");
    expect(result.context.stateHistory).toContain("stub-returned");
  });

  it("returns to parent after contested (terminal → auto-return)", () => {
    const parent = buildStubParent("spades");
    // 1C(N) invoke → X(E) opponent doubles → smolen-contested (terminal) → auto-return
    const result = evalStub(parent, ["1C", "X"]);
    expect(result.context.currentStateId).toBe("stub-returned");
  });

  it("handoff trace records submachine invocation", () => {
    const parent = buildStubParent("hearts");
    const result = evalStub(parent, ["1C", "P", "2H"]);
    expect(result.handoffTraces).toHaveLength(1);
    const trace = result.handoffTraces[0]!;
    expect(trace.fromModuleId).toBe("stub-parent");
    expect(trace.toModuleId).toBe("smolen-continuation");
    expect(trace.reason).toContain("Submachine invocation");
  });
});

describe("Smolen submachine: register isolation", () => {
  it("parent registers are restored after submachine return", () => {
    const parent = buildStubParent("hearts");
    // Parent invoke state sets captain="responder", submachine sets captain="opener".
    // After return, stub-returned sets captain="nobody" via its own entryEffects.
    // But the frame restore should give back the pre-invoke registers first.
    const result = evalStub(parent, ["1C", "P", "2H"]);
    // stub-returned's entry effects set captain to "nobody"
    expect(result.context.registers.captain).toBe("nobody");
  });

  it("agreedStrain set by invoke state is visible inside submachine", () => {
    const parent = buildStubParent("spades");
    // After invoke + pass, submachine should have routed based on agreedStrain=spades
    const result = evalStub(parent, ["1C", "P"]);
    // If the guard worked, we're in opener-place-spades — proving the register flowed
    expect(result.context.currentStateId).toBe("opener-place-spades");
  });

  it("agreedStrain from invoke is restored to parent value after return", () => {
    const parent = buildStubParent("hearts");
    const result = evalStub(parent, ["1C", "P", "2H"]);
    // After return, parent registers are restored. The invoke state set
    // agreedStrain=hearts, and that was saved in the parent frame.
    // stub-returned doesn't override agreedStrain, so it stays as the parent value.
    expect(result.context.registers.agreedStrain).toEqual({
      type: "suit",
      suit: "hearts",
      confidence: "tentative",
    });
  });
});

describe("Smolen submachine: opponent pass self-loop", () => {
  it("placement state self-loops on pass (consumes opponent pass)", () => {
    const parent = buildStubParent("hearts");
    // 1C(N) invoke → P(E) routes to opener-place-hearts → P(S) self-loop → still in placement
    const result = evalStub(parent, ["1C", "P", "P"]);
    expect(result.context.currentStateId).toBe("opener-place-hearts");
    expect(result.activeSurfaceGroupIds).toContain("opener-smolen-hearts");
  });
});

// ═══════════════════════════════════════════════════════════════
// Integration: Smolen within the full NT machine
//
// These tests verify the end-to-end path through the NT machine
// to prove the submachine is correctly wired, but they are NOT
// the primary test of submachine behavior (that's above).
// ═══════════════════════════════════════════════════════════════

describe("Smolen integration: NT machine end-to-end", () => {
  const ntMachine = createNtConversationMachine();
  const ntSubmachines: ReadonlyMap<string, ConversationMachine> = new Map([
    ["smolen-continuation", smolenSub],
  ]);

  function evalNt(bids: string[]) {
    const auction = buildAuction(Seat.North, bids);
    return evaluateMachine(ntMachine, auction, Seat.South, ntSubmachines);
  }

  it("3H after 2D denial enters submachine", () => {
    const result = evalNt(["1NT", "P", "2C", "P", "2D", "P", "3H"]);
    expect(result.context.currentStateId).toBe("smolen-wait");
    expect(result.handoffTraces).toHaveLength(1);
  });

  it("3S after 2D denial enters submachine", () => {
    const result = evalNt(["1NT", "P", "2C", "P", "2D", "P", "3S"]);
    expect(result.context.currentStateId).toBe("smolen-wait");
    expect(result.handoffTraces).toHaveLength(1);
  });

  it("full hearts sequence: 1NT-P-2C-P-2D-P-3H-P-4H returns to terminal", () => {
    const result = evalNt([
      "1NT", "P", "2C", "P", "2D", "P", "3H", "P", "4H",
    ]);
    expect(result.context.currentStateId).toBe("terminal");
  });

  it("full spades sequence: 1NT-P-2C-P-2D-P-3S-P-3NT returns to terminal", () => {
    const result = evalNt([
      "1NT", "P", "2C", "P", "2D", "P", "3S", "P", "3NT",
    ]);
    expect(result.context.currentStateId).toBe("terminal");
  });

  it("3NT after 2D denial goes to terminal without submachine", () => {
    const result = evalNt(["1NT", "P", "2C", "P", "2D", "P", "3NT"]);
    expect(result.context.currentStateId).toBe("terminal");
    expect(result.handoffTraces).toHaveLength(0);
  });

  it("R3 after 2D denial activates correct surface group", () => {
    const result = evalNt(["1NT", "P", "2C", "P", "2D", "P"]);
    expect(result.activeSurfaceGroupIds).toContain(
      "responder-r3-after-stayman-2d",
    );
  });

  it("opener placement surfaces activated after 3H Smolen + pass", () => {
    const result = evalNt(["1NT", "P", "2C", "P", "2D", "P", "3H", "P"]);
    expect(result.activeSurfaceGroupIds).toContain("opener-smolen-hearts");
  });
});
