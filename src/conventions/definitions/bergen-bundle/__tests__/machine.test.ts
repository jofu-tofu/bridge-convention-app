import { describe, it, expect } from "vitest";
import { Seat } from "../../../../engine/types";
import { buildAuction } from "../../../../engine/auction-helpers";
import { evaluateMachine } from "../../../core/runtime/machine-evaluator";
import { createBergenConversationMachine } from "../machine";

describe("Bergen bundle conversation machine", () => {
  const machine = createBergenConversationMachine();

  it("starts in idle state", () => {
    const auction = buildAuction(Seat.North, []);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("idle");
    expect(result.activeSurfaceGroupIds).toEqual([]);
  });

  it("transitions to major-opened-hearts on 1H", () => {
    const auction = buildAuction(Seat.North, ["1H"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("major-opened-hearts");
    expect(result.activeSurfaceGroupIds).toEqual([]);
  });

  it("transitions to major-opened-spades on 1S", () => {
    const auction = buildAuction(Seat.North, ["1S"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("major-opened-spades");
    expect(result.activeSurfaceGroupIds).toEqual([]);
  });

  it("transitions to responder-r1-hearts on 1H-P", () => {
    const auction = buildAuction(Seat.North, ["1H", "P"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("responder-r1-hearts");
    expect(result.activeSurfaceGroupIds).toContain("responder-r1-hearts");
  });

  it("transitions to responder-r1-spades on 1S-P", () => {
    const auction = buildAuction(Seat.North, ["1S", "P"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("responder-r1-spades");
    expect(result.activeSurfaceGroupIds).toContain("responder-r1-spades");
  });

  it("sets captain to responder on entering R1 state", () => {
    const auction = buildAuction(Seat.North, ["1H", "P"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.registers.captain).toBe("responder");
  });

  it("transitions to terminal after responder bids", () => {
    const auction = buildAuction(Seat.North, ["1H", "P", "3C"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("terminal");
    expect(result.activeSurfaceGroupIds).toEqual([]);
  });

  it("does not transition on non-major opening (1NT)", () => {
    const auction = buildAuction(Seat.North, ["1NT"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("idle");
  });

  it("does not transition on minor opening (1D)", () => {
    const auction = buildAuction(Seat.North, ["1D"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("idle");
  });

  it("records state history through the sequence", () => {
    const auction = buildAuction(Seat.North, ["1H", "P"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.stateHistory).toContain("idle");
    expect(result.context.stateHistory).toContain("major-opened-hearts");
    expect(result.context.stateHistory).toContain("responder-r1-hearts");
  });
});
