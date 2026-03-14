import { describe, it, expect } from "vitest";
import { Seat } from "../../../../engine/types";
import { buildAuction } from "../../../../engine/auction-helpers";
import { evaluateMachine } from "../../../core/runtime/machine-evaluator";
import { createBergenConversationMachine } from "../machine";

describe("Bergen bundle conversation machine", () => {
  const machine = createBergenConversationMachine();

  // ─── Basic setup ──────────────────────────────────────────────

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

  it("has the expected number of states", () => {
    // idle, major-opened-hearts, major-opened-spades,
    // responder-r1-hearts, responder-r1-spades,
    // opener-after-constructive-hearts, opener-after-constructive-spades,
    // opener-after-limit-hearts, opener-after-limit-spades,
    // opener-after-preemptive-hearts, opener-after-preemptive-spades,
    // responder-after-opener-rebid-hearts, responder-after-opener-rebid-spades,
    // terminal, bergen-contested
    expect(machine.states.size).toBe(15);
  });

  // ─── R1 → R2 routing (hearts) ────────────────────────────────

  describe("R1 → R2 routing after 1H-P", () => {
    it("3C (constructive) → opener-after-constructive-hearts", () => {
      const auction = buildAuction(Seat.North, ["1H", "P", "3C"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("opener-after-constructive-hearts");
      expect(result.activeSurfaceGroupIds).toContain("opener-after-constructive-hearts");
      expect(result.context.registers.captain).toBe("opener");
    });

    it("3D (limit) → opener-after-limit-hearts", () => {
      const auction = buildAuction(Seat.North, ["1H", "P", "3D"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("opener-after-limit-hearts");
      expect(result.activeSurfaceGroupIds).toContain("opener-after-limit-hearts");
      expect(result.context.registers.captain).toBe("opener");
    });

    it("3H (preemptive) → opener-after-preemptive-hearts", () => {
      const auction = buildAuction(Seat.North, ["1H", "P", "3H"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("opener-after-preemptive-hearts");
      expect(result.activeSurfaceGroupIds).toContain("opener-after-preemptive-hearts");
      expect(result.context.registers.captain).toBe("opener");
    });

    it("3S (splinter) → terminal", () => {
      const auction = buildAuction(Seat.North, ["1H", "P", "3S"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("terminal");
      expect(result.activeSurfaceGroupIds).toEqual([]);
    });

    it("4H (game raise) → terminal", () => {
      const auction = buildAuction(Seat.North, ["1H", "P", "4H"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("terminal");
    });

    it("pass → terminal", () => {
      const auction = buildAuction(Seat.North, ["1H", "P", "P"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("terminal");
    });
  });

  // ─── R1 → R2 routing (spades) ────────────────────────────────

  describe("R1 → R2 routing after 1S-P", () => {
    it("3C (constructive) → opener-after-constructive-spades", () => {
      const auction = buildAuction(Seat.North, ["1S", "P", "3C"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("opener-after-constructive-spades");
      expect(result.activeSurfaceGroupIds).toContain("opener-after-constructive-spades");
    });

    it("3D (limit) → opener-after-limit-spades", () => {
      const auction = buildAuction(Seat.North, ["1S", "P", "3D"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("opener-after-limit-spades");
    });

    it("3S (preemptive) → opener-after-preemptive-spades", () => {
      const auction = buildAuction(Seat.North, ["1S", "P", "3S"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("opener-after-preemptive-spades");
    });

    it("3H (splinter) → terminal", () => {
      const auction = buildAuction(Seat.North, ["1S", "P", "3H"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("terminal");
    });

    it("4S (game raise) → terminal", () => {
      const auction = buildAuction(Seat.North, ["1S", "P", "4S"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("terminal");
    });

    it("pass → terminal", () => {
      const auction = buildAuction(Seat.North, ["1S", "P", "P"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("terminal");
    });
  });

  // ─── R2 opener rebids ────────────────────────────────────────

  describe("R2 opener rebids (hearts)", () => {
    it("constructive: opponent pass keeps state, opener bid → responder-after-opener-rebid", () => {
      // 1H(N) P(E) 3C(S) P(W) 4H(N)
      const auction = buildAuction(Seat.North, ["1H", "P", "3C", "P", "4H"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("responder-after-opener-rebid-hearts");
      expect(result.activeSurfaceGroupIds).toContain("responder-after-opener-rebid-hearts");
      expect(result.context.registers.captain).toBe("responder");
    });

    it("limit: opener bids game → responder-after-opener-rebid", () => {
      // 1H(N) P(E) 3D(S) P(W) 4H(N)
      const auction = buildAuction(Seat.North, ["1H", "P", "3D", "P", "4H"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("responder-after-opener-rebid-hearts");
    });

    it("limit: opener signs off at 3H → responder-after-opener-rebid", () => {
      // 1H(N) P(E) 3D(S) P(W) 3H(N)
      const auction = buildAuction(Seat.North, ["1H", "P", "3D", "P", "3H"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("responder-after-opener-rebid-hearts");
    });

    it("preemptive: opener bids game → terminal", () => {
      // 1H(N) P(E) 3H(S) P(W) 4H(N)
      const auction = buildAuction(Seat.North, ["1H", "P", "3H", "P", "4H"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("terminal");
    });

    it("preemptive: after opponent pass, stays in preemptive state waiting for opener", () => {
      // 1H(N) P(E) 3H(S) P(W)
      const auction = buildAuction(Seat.North, ["1H", "P", "3H", "P"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("opener-after-preemptive-hearts");
      expect(result.activeSurfaceGroupIds).toContain("opener-after-preemptive-hearts");
    });
  });

  describe("R2 opener rebids (spades)", () => {
    it("constructive: opener bids → responder-after-opener-rebid-spades", () => {
      // 1S(N) P(E) 3C(S) P(W) 4S(N)
      const auction = buildAuction(Seat.North, ["1S", "P", "3C", "P", "4S"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("responder-after-opener-rebid-spades");
      expect(result.activeSurfaceGroupIds).toContain("responder-after-opener-rebid-spades");
    });

    it("preemptive: opener bids game → terminal", () => {
      // 1S(N) P(E) 3S(S) P(W) 4S(N)
      const auction = buildAuction(Seat.North, ["1S", "P", "3S", "P", "4S"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("terminal");
    });
  });

  // ─── R3 responder continuation ────────────────────────────────

  describe("R3 responder continuation", () => {
    it("responder passes after opener rebid → terminal (hearts)", () => {
      // 1H(N) P(E) 3C(S) P(W) 4H(N) P(E) P(S)
      const auction = buildAuction(Seat.North, ["1H", "P", "3C", "P", "4H", "P", "P"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("terminal");
    });

    it("responder bids after opener rebid → terminal (hearts)", () => {
      // 1H(N) P(E) 3D(S) P(W) 3H(N) P(E) 4H(S)
      const auction = buildAuction(Seat.North, ["1H", "P", "3D", "P", "3H", "P", "4H"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("terminal");
    });

    it("responder passes after opener rebid → terminal (spades)", () => {
      // 1S(N) P(E) 3C(S) P(W) 4S(N) P(E) P(S)
      const auction = buildAuction(Seat.North, ["1S", "P", "3C", "P", "4S", "P", "P"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("terminal");
    });
  });

  // ─── Interference handling ────────────────────────────────────

  describe("interference handling", () => {
    it("opponent double after 1H → bergen-contested", () => {
      const auction = buildAuction(Seat.North, ["1H", "X"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("bergen-contested");
      expect(result.context.registers.competitionMode).toBe("Contested");
      expect(result.activeSurfaceGroupIds).toEqual([]);
    });

    it("opponent overcall after 1H → bergen-contested", () => {
      const auction = buildAuction(Seat.North, ["1H", "2C"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("bergen-contested");
      expect(result.context.registers.competitionMode).toBe("Contested");
    });

    it("opponent double after 1S → bergen-contested", () => {
      const auction = buildAuction(Seat.North, ["1S", "X"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("bergen-contested");
    });

    it("opponent overcall after 1S → bergen-contested", () => {
      const auction = buildAuction(Seat.North, ["1S", "2D"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("bergen-contested");
    });

    it("bergen-contested emits no surfaces", () => {
      const auction = buildAuction(Seat.North, ["1H", "X"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.activeSurfaceGroupIds).toEqual([]);
    });
  });

  // ─── Full sequence state history ─────────────────────────────

  describe("full sequence tracking", () => {
    it("records complete state history: idle → major-opened → R1 → R2 → R3 → terminal", () => {
      // 1H(N) P(E) 3C(S) P(W) 4H(N) P(E) P(S)
      const auction = buildAuction(Seat.North, ["1H", "P", "3C", "P", "4H", "P", "P"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.stateHistory).toContain("idle");
      expect(result.context.stateHistory).toContain("major-opened-hearts");
      expect(result.context.stateHistory).toContain("responder-r1-hearts");
      expect(result.context.stateHistory).toContain("opener-after-constructive-hearts");
      expect(result.context.stateHistory).toContain("responder-after-opener-rebid-hearts");
      expect(result.context.stateHistory).toContain("terminal");
    });

    it("records transition history through the sequence", () => {
      const auction = buildAuction(Seat.North, ["1H", "P", "3D"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.transitionHistory).toContain("idle-to-major-opened-hearts");
      expect(result.context.transitionHistory).toContain("hearts-pass-to-responder");
      expect(result.context.transitionHistory).toContain("r1-hearts-limit");
    });
  });

  // ─── seatRole ─────────────────────────────────────────────────

  it("seatRole correctly identifies partner/self/opponent", () => {
    const auction = buildAuction(Seat.North, ["1H"]);
    expect(machine.seatRole(auction, Seat.South, Seat.North)).toBe("partner");
    expect(machine.seatRole(auction, Seat.South, Seat.South)).toBe("self");
    expect(machine.seatRole(auction, Seat.South, Seat.East)).toBe("opponent");
    expect(machine.seatRole(auction, Seat.South, Seat.West)).toBe("opponent");
  });
});
