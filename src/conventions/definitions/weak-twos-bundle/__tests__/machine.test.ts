import { describe, it, expect } from "vitest";
import { Seat } from "../../../../engine/types";
import { buildAuction } from "../../../../engine/auction-helpers";
import { evaluateMachine } from "../../../core/runtime/machine-evaluator";
import { validateTransitionCompleteness, formatLeak } from "../../../core/runtime/machine-validation";
import { createWeakTwoConversationMachine } from "../machine";

describe("Weak Two bundle conversation machine", () => {
  const machine = createWeakTwoConversationMachine();

  // ─── Basic setup ──────────────────────────────────────────────

  it("starts in idle state with opener-r1 surface group", () => {
    const auction = buildAuction(Seat.North, []);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("idle");
    expect(result.activeSurfaceGroupIds).toContain("opener-r1");
  });

  it("contains all required states", () => {
    const requiredStates = [
      "idle", "weak-two-opened-h", "weak-two-opened-s", "weak-two-opened-d",
      "responder-r2-h", "responder-r2-s", "responder-r2-d",
      "ogust-response-h", "ogust-response-s", "ogust-response-d",
      "terminal", "weak-two-contested",
    ];
    for (const stateId of requiredStates) {
      expect(machine.states.has(stateId), `missing state: ${stateId}`).toBe(true);
    }
  });

  // ─── R1: Opening transitions ──────────────────────────────────

  it("transitions to weak-two-opened-h on 2H", () => {
    const auction = buildAuction(Seat.North, ["2H"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("weak-two-opened-h");
    expect(result.activeSurfaceGroupIds).toEqual([]);
  });

  it("transitions to weak-two-opened-s on 2S", () => {
    const auction = buildAuction(Seat.North, ["2S"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("weak-two-opened-s");
  });

  it("transitions to weak-two-opened-d on 2D", () => {
    const auction = buildAuction(Seat.North, ["2D"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("weak-two-opened-d");
  });

  it("does not transition on 1-level opening", () => {
    const auction = buildAuction(Seat.North, ["1H"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("idle");
  });

  it("does not transition on 2C (reserved for strong)", () => {
    const auction = buildAuction(Seat.North, ["2C"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("idle");
  });

  // ─── Opponent pass → responder R2 ────────────────────────────

  it("transitions to responder-r2-h on 2H-P", () => {
    const auction = buildAuction(Seat.North, ["2H", "P"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("responder-r2-h");
    expect(result.activeSurfaceGroupIds).toContain("responder-r2-hearts");
  });

  it("transitions to responder-r2-s on 2S-P", () => {
    const auction = buildAuction(Seat.North, ["2S", "P"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("responder-r2-s");
    expect(result.activeSurfaceGroupIds).toContain("responder-r2-spades");
  });

  it("transitions to responder-r2-d on 2D-P", () => {
    const auction = buildAuction(Seat.North, ["2D", "P"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("responder-r2-d");
    expect(result.activeSurfaceGroupIds).toContain("responder-r2-diamonds");
  });

  it("sets captain to responder on entering R2 state", () => {
    const auction = buildAuction(Seat.North, ["2H", "P"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.registers.captain).toBe("responder");
  });

  // ─── R2 responder actions (hearts) ────────────────────────────

  describe("R2 responder actions after 2H-P", () => {
    it("4H game raise → terminal", () => {
      const auction = buildAuction(Seat.North, ["2H", "P", "4H"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("terminal");
    });

    it("2NT Ogust ask → ogust-response-h", () => {
      const auction = buildAuction(Seat.North, ["2H", "P", "2NT"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("ogust-response-h");
      expect(result.activeSurfaceGroupIds).toContain("ogust-response-hearts");
      expect(result.context.registers.captain).toBe("opener");
    });

    it("3H invite raise → terminal", () => {
      const auction = buildAuction(Seat.North, ["2H", "P", "3H"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("terminal");
    });

    it("pass → terminal", () => {
      const auction = buildAuction(Seat.North, ["2H", "P", "P"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("terminal");
    });
  });

  // ─── R2 responder actions (spades) ────────────────────────────

  describe("R2 responder actions after 2S-P", () => {
    it("4S game raise → terminal", () => {
      const auction = buildAuction(Seat.North, ["2S", "P", "4S"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("terminal");
    });

    it("2NT Ogust ask → ogust-response-s", () => {
      const auction = buildAuction(Seat.North, ["2S", "P", "2NT"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("ogust-response-s");
      expect(result.activeSurfaceGroupIds).toContain("ogust-response-spades");
    });

    it("3S invite raise → terminal", () => {
      const auction = buildAuction(Seat.North, ["2S", "P", "3S"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("terminal");
    });
  });

  // ─── R2 responder actions (diamonds) ──────────────────────────

  describe("R2 responder actions after 2D-P", () => {
    it("5D game raise → terminal", () => {
      const auction = buildAuction(Seat.North, ["2D", "P", "5D"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("terminal");
    });

    it("2NT Ogust ask → ogust-response-d", () => {
      const auction = buildAuction(Seat.North, ["2D", "P", "2NT"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("ogust-response-d");
      expect(result.activeSurfaceGroupIds).toContain("ogust-response-diamonds");
    });

    it("3D invite raise → terminal", () => {
      const auction = buildAuction(Seat.North, ["2D", "P", "3D"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("terminal");
    });
  });

  // ─── Ogust response → terminal ───────────────────────────────

  describe("Ogust response transitions", () => {
    it("pass self-loops in ogust-response-h (opponent pass)", () => {
      // 2H(N) P(E) 2NT(S) P(W) — waiting for opener
      const auction = buildAuction(Seat.North, ["2H", "P", "2NT", "P"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("ogust-response-h");
      expect(result.activeSurfaceGroupIds).toContain("ogust-response-hearts");
    });

    it("3C Ogust response → terminal (hearts)", () => {
      // 2H(N) P(E) 2NT(S) P(W) 3C(N)
      const auction = buildAuction(Seat.North, ["2H", "P", "2NT", "P", "3C"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("terminal");
    });

    it("3D Ogust response → terminal (hearts)", () => {
      const auction = buildAuction(Seat.North, ["2H", "P", "2NT", "P", "3D"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("terminal");
    });

    it("3H Ogust response → terminal (hearts)", () => {
      const auction = buildAuction(Seat.North, ["2H", "P", "2NT", "P", "3H"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("terminal");
    });

    it("3S Ogust response → terminal (hearts)", () => {
      const auction = buildAuction(Seat.North, ["2H", "P", "2NT", "P", "3S"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("terminal");
    });

    it("3NT Ogust solid → terminal (hearts)", () => {
      const auction = buildAuction(Seat.North, ["2H", "P", "2NT", "P", "3NT"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("terminal");
    });

    it("Ogust response → terminal (spades)", () => {
      const auction = buildAuction(Seat.North, ["2S", "P", "2NT", "P", "3C"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("terminal");
    });

    it("Ogust response → terminal (diamonds)", () => {
      const auction = buildAuction(Seat.North, ["2D", "P", "2NT", "P", "3NT"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("terminal");
    });
  });

  // ─── Interference handling ────────────────────────────────────

  describe("interference handling", () => {
    it("opponent double after 2H → weak-two-contested", () => {
      const auction = buildAuction(Seat.North, ["2H", "X"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("weak-two-contested");
      expect(result.context.registers.competitionMode).toBe("Contested");
      expect(result.activeSurfaceGroupIds).toEqual([]);
    });

    it("opponent overcall after 2H → weak-two-contested", () => {
      const auction = buildAuction(Seat.North, ["2H", "3C"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("weak-two-contested");
    });

    it("opponent double after 2S → weak-two-contested", () => {
      const auction = buildAuction(Seat.North, ["2S", "X"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("weak-two-contested");
    });

    it("opponent overcall after 2D → weak-two-contested", () => {
      const auction = buildAuction(Seat.North, ["2D", "3C"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("weak-two-contested");
    });
  });

  // ─── State history ────────────────────────────────────────────

  describe("state history tracking", () => {
    it("records complete state history through Ogust path", () => {
      // 2H(N) P(E) 2NT(S) P(W) 3C(N)
      const auction = buildAuction(Seat.North, ["2H", "P", "2NT", "P", "3C"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.stateHistory).toContain("idle");
      expect(result.context.stateHistory).toContain("weak-two-opened-h");
      expect(result.context.stateHistory).toContain("responder-r2-h");
      expect(result.context.stateHistory).toContain("ogust-response-h");
      expect(result.context.stateHistory).toContain("terminal");
    });

    it("records transition history", () => {
      const auction = buildAuction(Seat.North, ["2H", "P", "2NT"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.transitionHistory).toContain("idle-to-weak-two-opened-h");
      expect(result.context.transitionHistory).toContain("opened-h-pass-to-responder");
      expect(result.context.transitionHistory).toContain("r2-h-ogust-ask");
    });
  });

  // ─── Transition completeness ──────────────────────────────────

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
