import { describe, it, expect } from "vitest";
import { Seat } from "../../../../engine/types";
import { buildAuction } from "../../../../engine/auction-helpers";
import { evaluateMachine } from "../../../core/runtime/machine-evaluator";
import { validateTransitionCompleteness, formatLeak } from "../../../core/runtime/machine-validation";
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

  it("contains all required states", () => {
    const requiredStates = [
      "idle", "major-opened-hearts", "major-opened-spades",
      "responder-r1-hearts", "responder-r1-spades",
      "opener-after-constructive-hearts", "opener-after-constructive-spades",
      "opener-after-limit-hearts", "opener-after-limit-spades",
      "opener-after-preemptive-hearts", "opener-after-preemptive-spades",
      "responder-after-game", "responder-after-signoff",
      "responder-after-game-try-hearts", "responder-after-game-try-spades",
      "opener-r4-accept",
      "terminal", "bergen-contested",
    ];
    for (const stateId of requiredStates) {
      expect(machine.states.has(stateId), `missing state: ${stateId}`).toBe(true);
    }
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
    it("constructive: opponent pass keeps state, opener bids game → responder-after-game", () => {
      // 1H(N) P(E) 3C(S) P(W) 4H(N)
      const auction = buildAuction(Seat.North, ["1H", "P", "3C", "P", "4H"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("responder-after-game");
      expect(result.activeSurfaceGroupIds).toContain("responder-after-game");
      expect(result.context.registers.captain).toBe("responder");
    });

    it("limit: opener bids game → responder-after-game", () => {
      // 1H(N) P(E) 3D(S) P(W) 4H(N)
      const auction = buildAuction(Seat.North, ["1H", "P", "3D", "P", "4H"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("responder-after-game");
    });

    it("limit: opener signs off at 3H → responder-after-signoff", () => {
      // 1H(N) P(E) 3D(S) P(W) 3H(N)
      const auction = buildAuction(Seat.North, ["1H", "P", "3D", "P", "3H"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("responder-after-signoff");
    });

    it("constructive: opener makes game try → responder-after-game-try-hearts", () => {
      // 1H(N) P(E) 3C(S) P(W) 3D(N) — game try in a new suit
      const auction = buildAuction(Seat.North, ["1H", "P", "3C", "P", "3D"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("responder-after-game-try-hearts");
      expect(result.activeSurfaceGroupIds).toContain("responder-after-game-try-hearts");
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
    it("constructive: opener bids game → responder-after-game", () => {
      // 1S(N) P(E) 3C(S) P(W) 4S(N)
      const auction = buildAuction(Seat.North, ["1S", "P", "3C", "P", "4S"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("responder-after-game");
      expect(result.activeSurfaceGroupIds).toContain("responder-after-game");
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
    it("after game (4H): all passes self-loop (convention stays active)", () => {
      // 1H(N) P(E) 3C(S) P(W) 4H(N) P(E) P(S) — both passes self-loop
      const auction = buildAuction(Seat.North, ["1H", "P", "3C", "P", "4H", "P", "P"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("responder-after-game");
    });

    it("after game (4H): opponent pass activates responder-after-game surface", () => {
      // 1H(N) P(E) 3C(S) P(W) 4H(N) P(E) — before S acts
      const auction = buildAuction(Seat.North, ["1H", "P", "3C", "P", "4H", "P"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("responder-after-game");
      expect(result.activeSurfaceGroupIds).toContain("responder-after-game");
    });

    it("after signoff (3H): opponent pass activates responder-after-signoff surface", () => {
      // 1H(N) P(E) 3D(S) P(W) 3H(N) P(E) — before S acts
      const auction = buildAuction(Seat.North, ["1H", "P", "3D", "P", "3H", "P"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("responder-after-signoff");
      expect(result.activeSurfaceGroupIds).toContain("responder-after-signoff");
    });

    it("after signoff: responder bids game → terminal", () => {
      // 1H(N) P(E) 3D(S) P(W) 3H(N) P(E) 4H(S)
      const auction = buildAuction(Seat.North, ["1H", "P", "3D", "P", "3H", "P", "4H"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("terminal");
    });

    it("after game try: opponent pass activates responder-after-game-try-hearts surface", () => {
      // 1H(N) P(E) 3C(S) P(W) 3D(N) P(E) — before S acts
      const auction = buildAuction(Seat.North, ["1H", "P", "3C", "P", "3D", "P"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("responder-after-game-try-hearts");
      expect(result.activeSurfaceGroupIds).toContain("responder-after-game-try-hearts");
    });

    it("after game try: responder bids → opener-r4-accept", () => {
      // 1H(N) P(E) 3C(S) P(W) 3D(N) P(E) 4H(S)
      const auction = buildAuction(Seat.North, ["1H", "P", "3C", "P", "3D", "P", "4H"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("opener-r4-accept");
      expect(result.activeSurfaceGroupIds).toContain("opener-r4-accept");
      expect(result.context.registers.captain).toBe("opener");
    });

    it("after game (4S spades): opponent pass keeps state", () => {
      // 1S(N) P(E) 3C(S) P(W) 4S(N) P(E) — before S acts
      const auction = buildAuction(Seat.North, ["1S", "P", "3C", "P", "4S", "P"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("responder-after-game");
      expect(result.activeSurfaceGroupIds).toContain("responder-after-game");
    });

    it("after game (4S spades): all passes self-loop (convention stays active)", () => {
      // 1S(N) P(E) 3C(S) P(W) 4S(N) P(E) P(S) — both passes self-loop
      const auction = buildAuction(Seat.North, ["1S", "P", "3C", "P", "4S", "P", "P"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("responder-after-game");
    });
  });

  // ─── R4 opener accepts ─────────────────────────────────────────

  describe("R4 opener accepts after game try response", () => {
    it("all passes self-loop (convention stays active until a bid)", () => {
      // 1H(N) P(E) 3C(S) P(W) 3D(N) P(E) 4H(S) P(W) P(N) — passes self-loop
      const auction = buildAuction(Seat.North, ["1H", "P", "3C", "P", "3D", "P", "4H", "P", "P"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("opener-r4-accept");
    });

    it("opener bids after game try response → terminal", () => {
      // 1H(N) P(E) 3C(S) P(W) 3D(N) P(E) 4H(S) P(W) 5H(N) — opener bids
      const auction = buildAuction(Seat.North, ["1H", "P", "3C", "P", "3D", "P", "4H", "P", "5H"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("terminal");
    });

    it("opponent pass activates opener-r4-accept surface", () => {
      // 1H(N) P(E) 3C(S) P(W) 3D(N) P(E) 4H(S) P(W) — before N acts
      const auction = buildAuction(Seat.North, ["1H", "P", "3C", "P", "3D", "P", "4H", "P"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("opener-r4-accept");
      expect(result.activeSurfaceGroupIds).toContain("opener-r4-accept");
      expect(result.context.registers.captain).toBe("opener");
    });
  });

  // ─── Pass self-loop ────────────────────────────────────────────

  describe("pass self-loop in R3 states", () => {
    it("opponent pass in responder-after-game does not go to terminal", () => {
      // 1H(N) P(E) 3C(S) P(W) 4H(N) — enters responder-after-game
      // Next call is P(E) — opponent pass should self-loop
      const auction = buildAuction(Seat.North, ["1H", "P", "3C", "P", "4H", "P"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("responder-after-game");
      // NOT terminal — pass self-loops
    });

    it("opponent pass in responder-after-signoff does not go to terminal", () => {
      const auction = buildAuction(Seat.North, ["1H", "P", "3D", "P", "3H", "P"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("responder-after-signoff");
    });

    it("opponent pass in responder-after-game-try-hearts does not go to terminal", () => {
      const auction = buildAuction(Seat.North, ["1H", "P", "3C", "P", "3D", "P"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("responder-after-game-try-hearts");
    });

    it("opponent pass in opener-r4-accept does not go to terminal", () => {
      const auction = buildAuction(Seat.North, ["1H", "P", "3C", "P", "3D", "P", "4H", "P"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.currentStateId).toBe("opener-r4-accept");
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
    it("records complete state history: idle → major-opened → R1 → R2 → R3", () => {
      // 1H(N) P(E) 3C(S) P(W) 4H(N) P(E) — ends at responder-after-game
      const auction = buildAuction(Seat.North, ["1H", "P", "3C", "P", "4H", "P"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.stateHistory).toContain("idle");
      expect(result.context.stateHistory).toContain("major-opened-hearts");
      expect(result.context.stateHistory).toContain("responder-r1-hearts");
      expect(result.context.stateHistory).toContain("opener-after-constructive-hearts");
      expect(result.context.stateHistory).toContain("responder-after-game");
    });

    it("records full state history through R4 to terminal (game try path)", () => {
      // 1H(N) P(E) 3C(S) P(W) 3D(N) P(E) 4H(S) P(W) 5H(N) — reaches terminal via bid
      const auction = buildAuction(Seat.North, ["1H", "P", "3C", "P", "3D", "P", "4H", "P", "5H"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.stateHistory).toContain("idle");
      expect(result.context.stateHistory).toContain("major-opened-hearts");
      expect(result.context.stateHistory).toContain("responder-r1-hearts");
      expect(result.context.stateHistory).toContain("opener-after-constructive-hearts");
      expect(result.context.stateHistory).toContain("responder-after-game-try-hearts");
      expect(result.context.stateHistory).toContain("opener-r4-accept");
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
