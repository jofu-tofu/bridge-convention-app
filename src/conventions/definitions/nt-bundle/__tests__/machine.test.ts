import { describe, it, expect } from "vitest";
import { Seat } from "../../../../engine/types";
import { buildAuction } from "../../../../engine/auction-helpers";
import { evaluateMachine } from "../../../core/runtime/machine-evaluator";
import { validateMachine, validateTransitionCompleteness, formatLeak } from "../../../core/runtime/machine-validation";
import { createNtConversationMachine } from "../machine";

describe("createNtConversationMachine", () => {
  const machine = createNtConversationMachine();

  it("passes validation with no errors", () => {
    const diagnostics = validateMachine(machine);
    const errors = diagnostics.filter((d) => d.level === "error");
    expect(errors).toEqual([]);
  });

  it("contains all required states", () => {
    const requiredStates = [
      "idle", "nt-opened", "responder-r1",
      "opener-stayman", "opener-transfer-hearts", "opener-transfer-spades",
      "responder-r3-stayman-2h", "responder-r3-stayman-2s", "responder-r3-stayman-2d",
      "responder-r3-transfer-hearts", "responder-r3-transfer-spades",
      "smolen-invoke-hearts", "smolen-invoke-spades",
      "terminal", "nt-contested",
    ];
    for (const stateId of requiredStates) {
      expect(machine.states.has(stateId), `missing state: ${stateId}`).toBe(true);
    }
  });

  it("idle → nt-opened on 1NT bid by partner", () => {
    // South evaluating, North opens 1NT
    const auction = buildAuction(Seat.North, ["1NT"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("nt-opened");
  });

  it("nt-opened → responder-r1 on pass by opponent", () => {
    // North=1NT, East=P
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("responder-r1");
    expect(result.activeSurfaceGroupIds).toContain("responder-r1");
  });

  it("responder-r1 entry effects set captain to responder", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.registers.captain).toBe("responder");
  });

  it("responder-r1 → opener-stayman on 2C", () => {
    // North=1NT, East=P, South=2C
    const auction = buildAuction(Seat.North, ["1NT", "P", "2C"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("opener-stayman");
    expect(result.activeSurfaceGroupIds).toContain(
      "opener-stayman-response",
    );
  });

  it("opener-stayman entry effects set obligation ShowMajor", () => {
    const auction = buildAuction(Seat.North, ["1NT", "P", "2C"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.registers.obligation.kind).toBe("ShowMajor");
    expect(result.context.registers.obligation.obligatedSide).toBe("opener");
  });

  it("full sequence 1NT-P-2C-P reaches opener-stayman with correct registers", () => {
    // North=1NT, East=P, South=2C, West=P
    const auction = buildAuction(Seat.North, ["1NT", "P", "2C", "P"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    // After West passes, still in opener-stayman (no transition for pass here
    // unless we have one on opener-stayman — the spec shows opener responds)
    expect(result.context.registers.captain).toBe("responder");
    expect(result.context.registers.obligation.kind).toBe("ShowMajor");
  });

  it("full sequence 1NT-P-2C-P-2H reaches responder-r3-stayman-2h", () => {
    // North=1NT, East=P, South=2C, West=P, North=2H
    const auction = buildAuction(Seat.North, [
      "1NT",
      "P",
      "2C",
      "P",
      "2H",
    ]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("responder-r3-stayman-2h");
    expect(result.activeSurfaceGroupIds).toContain(
      "responder-r3-after-stayman-2h",
    );
  });

  it("full sequence 1NT-P-2D-P-2H reaches responder-r3-transfer-hearts", () => {
    // North=1NT, East=P, South=2D (transfer), West=P, North=2H (accept)
    const auction = buildAuction(Seat.North, [
      "1NT",
      "P",
      "2D",
      "P",
      "2H",
    ]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe(
      "responder-r3-transfer-hearts",
    );
    expect(result.context.registers.agreedStrain).toEqual({
      type: "suit",
      suit: "hearts",
      confidence: "tentative",
    });
  });

  it("full sequence 1NT-P-2H-P-2S reaches responder-r3-transfer-spades", () => {
    // North=1NT, East=P, South=2H (transfer), West=P, North=2S (accept)
    const auction = buildAuction(Seat.North, [
      "1NT",
      "P",
      "2H",
      "P",
      "2S",
    ]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe(
      "responder-r3-transfer-spades",
    );
    expect(result.context.registers.agreedStrain).toEqual({
      type: "suit",
      suit: "spades",
      confidence: "tentative",
    });
  });

  it("1NT-P-2C-P-2H-P stays at responder-r3-stayman-2h (opponent pass absorbed)", () => {
    const auction = buildAuction(Seat.North, [
      "1NT",
      "P",
      "2C",
      "P",
      "2H",
      "P",
    ]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("responder-r3-stayman-2h");
    expect(result.activeSurfaceGroupIds).toContain(
      "responder-r3-after-stayman-2h",
    );
  });

  it("1NT-P-2C-P-2S-P stays at responder-r3-stayman-2s (opponent pass absorbed)", () => {
    const auction = buildAuction(Seat.North, [
      "1NT",
      "P",
      "2C",
      "P",
      "2S",
      "P",
    ]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("responder-r3-stayman-2s");
    expect(result.activeSurfaceGroupIds).toContain(
      "responder-r3-after-stayman-2s",
    );
  });

  it("1NT-P-2C-P-2D-P stays at responder-r3-stayman-2d (opponent pass absorbed)", () => {
    const auction = buildAuction(Seat.North, [
      "1NT",
      "P",
      "2C",
      "P",
      "2D",
      "P",
    ]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("responder-r3-stayman-2d");
    expect(result.activeSurfaceGroupIds).toContain(
      "responder-r3-after-stayman-2d",
    );
  });

  it("1NT-P-2D-P-2H-P stays at responder-r3-transfer-hearts (opponent pass absorbed)", () => {
    const auction = buildAuction(Seat.North, [
      "1NT",
      "P",
      "2D",
      "P",
      "2H",
      "P",
    ]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe(
      "responder-r3-transfer-hearts",
    );
    expect(result.activeSurfaceGroupIds).toContain(
      "responder-r3-after-transfer-hearts",
    );
  });

  it("1NT-P-2H-P-2S-P stays at responder-r3-transfer-spades (opponent pass absorbed)", () => {
    const auction = buildAuction(Seat.North, [
      "1NT",
      "P",
      "2H",
      "P",
      "2S",
      "P",
    ]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe(
      "responder-r3-transfer-spades",
    );
    expect(result.activeSurfaceGroupIds).toContain(
      "responder-r3-after-transfer-spades",
    );
  });

  it("1NT-P-2C-P-2S-P-2NT transitions to terminal (R3 bid absorbed)", () => {
    const auction = buildAuction(Seat.North, [
      "1NT", "P", "2C", "P", "2S", "P", "2NT",
    ]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("terminal");
    expect(result.activeSurfaceGroupIds).toContain("terminal-pass");
  });

  it("1NT-P-2C-P-2H-P-4H transitions to terminal (game bid)", () => {
    const auction = buildAuction(Seat.North, [
      "1NT", "P", "2C", "P", "2H", "P", "4H",
    ]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("terminal");
  });

  it("1NT-P-2D-P-2H-P-3NT transitions to terminal (transfer R3 game)", () => {
    const auction = buildAuction(Seat.North, [
      "1NT", "P", "2D", "P", "2H", "P", "3NT",
    ]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("terminal");
  });

  it("terminal state absorbs passes and stays terminal", () => {
    const auction = buildAuction(Seat.North, [
      "1NT", "P", "2C", "P", "2S", "P", "2NT", "P",
    ]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("terminal");
    expect(result.activeSurfaceGroupIds).toContain("terminal-pass");
  });

  it("interference: 1NT-X produces competitionMode Doubled", () => {
    // North=1NT, East=X
    const auction = buildAuction(Seat.North, ["1NT", "X"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("nt-contested");
    expect(result.context.registers.competitionMode).toBe("Doubled");
  });

  it("responder-r1 → terminal on 3NT", () => {
    // North=1NT, East=P, South=3NT
    const auction = buildAuction(Seat.North, ["1NT", "P", "3NT"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("terminal");
  });

  it("responder-r1 → terminal on pass", () => {
    // North=1NT, East=P, South=P
    const auction = buildAuction(Seat.North, ["1NT", "P", "P"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("terminal");
  });

  it("responder-r1 → terminal on 2NT", () => {
    // North=1NT, East=P, South=2NT
    const auction = buildAuction(Seat.North, ["1NT", "P", "2NT"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("terminal");
  });

  it("opener-stayman → responder-r3-stayman-2d on 2D response", () => {
    const auction = buildAuction(Seat.North, [
      "1NT",
      "P",
      "2C",
      "P",
      "2D",
    ]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("responder-r3-stayman-2d");
    expect(result.activeSurfaceGroupIds).toContain(
      "responder-r3-after-stayman-2d",
    );
  });

  it("opener-stayman → responder-r3-stayman-2s on 2S response", () => {
    const auction = buildAuction(Seat.North, [
      "1NT",
      "P",
      "2C",
      "P",
      "2S",
    ]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("responder-r3-stayman-2s");
    expect(result.activeSurfaceGroupIds).toContain(
      "responder-r3-after-stayman-2s",
    );
  });

  it("children of nt-opened inherit interference transitions", () => {
    // Verify responder-r1 inherits nt-opened's double transition
    const responderR1 = machine.states.get("responder-r1");
    expect(responderR1?.parentId).toBe("nt-opened");

    // After 1NT-P (responder-r1), if opponent doubles, it should transition
    // to nt-contested via inherited transition from nt-opened
    // Note: 1NT-P-X is illegal because X requires a preceding bid by opponents
    // We test that the parentId hierarchy is set up correctly instead
    const openerStayman = machine.states.get("opener-stayman");
    expect(openerStayman?.parentId).toBe("nt-opened");

    const openerTransferH = machine.states.get("opener-transfer-hearts");
    expect(openerTransferH?.parentId).toBe("nt-opened");
  });

  it("seatRole correctly identifies partner/self/opponent", () => {
    // North opens 1NT (partner of South)
    const auction = buildAuction(Seat.North, ["1NT"]);
    expect(machine.seatRole(auction, Seat.South, Seat.North)).toBe("partner");
    expect(machine.seatRole(auction, Seat.South, Seat.South)).toBe("self");
    expect(machine.seatRole(auction, Seat.South, Seat.East)).toBe("opponent");
    expect(machine.seatRole(auction, Seat.South, Seat.West)).toBe("opponent");
  });

  it("has zero parent-transition leaks (transition completeness)", () => {
    const leaks = validateTransitionCompleteness(machine);
    if (leaks.length > 0) {
      const report = leaks.map(formatLeak).join("\n");
      expect.fail(
        `Found ${leaks.length} parent-transition leak(s):\n${report}`,
      );
    }
    expect(leaks).toHaveLength(0);
  });
});
