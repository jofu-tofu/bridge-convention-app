import { describe, it, expect } from "vitest";
import { evaluateMachine } from "../../../core/runtime/machine-evaluator";
import { buildAuction } from "../../../../engine/auction-helpers";
import { Seat } from "../../../../engine/types";
import { createDontConversationMachine } from "../machine";

describe("createDontConversationMachine", () => {
  const machine = createDontConversationMachine();

  // ─── Basic setup ──────────────────────────────────────────────

  it("starts in idle state", () => {
    const auction = buildAuction(Seat.East, []);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("idle");
    expect(result.activeSurfaceGroupIds).toEqual([]);
  });

  it("has 21 states", () => {
    // idle, dont-active, overcaller-r1,
    // wait-advancer-2h, wait-advancer-2d, wait-advancer-2c, wait-advancer-2s, wait-advancer-double,
    // advancer-after-2h, advancer-after-2d, advancer-after-2c, advancer-after-2s, advancer-after-double,
    // wait-reveal, overcaller-reveal,
    // wait-2d-relay, overcaller-2d-relay,
    // wait-2c-relay, overcaller-2c-relay,
    // terminal, dont-contested
    expect(machine.states.size).toBe(21);
  });

  // ─── R1: Activation and overcaller bids ───────────────────────

  it("1NT activates convention", () => {
    const auction = buildAuction(Seat.East, ["1NT"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("overcaller-r1");
    expect(result.activeSurfaceGroupIds).toContain("overcaller-r1");
  });

  it("overcaller bids 2H (both majors)", () => {
    const auction = buildAuction(Seat.East, ["1NT", "2H"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("wait-advancer-2h");
  });

  it("overcaller bids 2D (diamonds+major)", () => {
    const auction = buildAuction(Seat.East, ["1NT", "2D"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("wait-advancer-2d");
  });

  it("overcaller bids 2C (clubs+higher)", () => {
    const auction = buildAuction(Seat.East, ["1NT", "2C"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("wait-advancer-2c");
  });

  it("overcaller bids 2S (natural spades)", () => {
    const auction = buildAuction(Seat.East, ["1NT", "2S"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("wait-advancer-2s");
  });

  it("overcaller doubles (single suited) — predicate transition", () => {
    const auction = buildAuction(Seat.East, ["1NT", "X"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("wait-advancer-double");
  });

  it("overcaller passes", () => {
    const auction = buildAuction(Seat.East, ["1NT", "P"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("terminal");
  });

  // ─── Opponent pass → advancer ─────────────────────────────────

  it("West passes after 2H → advancer-after-2h", () => {
    const auction = buildAuction(Seat.East, ["1NT", "2H", "P"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("advancer-after-2h");
    expect(result.activeSurfaceGroupIds).toContain("advancer-after-2h");
    expect(result.context.registers.captain).toBe("responder");
  });

  it("West passes after double → advancer-after-double", () => {
    const auction = buildAuction(Seat.East, ["1NT", "X", "P"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("advancer-after-double");
  });

  // ─── Hierarchical inheritance — opponent interference ─────────

  it("West doubles after 2H → dont-contested (inherited from parent)", () => {
    const auction = buildAuction(Seat.East, ["1NT", "2H", "X"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("dont-contested");
    expect(result.context.registers.competitionMode).toContain("Doubled");
  });

  it("West overcalls after 2D → dont-contested (inherited)", () => {
    const auction = buildAuction(Seat.East, ["1NT", "2D", "2S"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("dont-contested");
  });

  it("East bids after relay wait → dont-contested (inherited)", () => {
    // 1NT(E) X(S) P(W) 2C(N) 2H(E) — East interferes during wait-reveal
    const auction = buildAuction(Seat.East, ["1NT", "X", "P", "2C", "2H"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("dont-contested");
  });

  // ─── Advancer responses ───────────────────────────────────────

  it("advancer passes after 2H (accept hearts) → terminal", () => {
    const auction = buildAuction(Seat.East, ["1NT", "2H", "P", "P"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("terminal");
  });

  it("advancer bids 2S after 2H (prefer spades) → terminal", () => {
    const auction = buildAuction(Seat.East, ["1NT", "2H", "P", "2S"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("terminal");
  });

  it("advancer bids 2C after double (forced relay) → wait-reveal", () => {
    const auction = buildAuction(Seat.East, ["1NT", "X", "P", "2C"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("wait-reveal");
  });

  it("advancer bids 2H after 2D (relay for major) → wait-2d-relay", () => {
    const auction = buildAuction(Seat.East, ["1NT", "2D", "P", "2H"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("wait-2d-relay");
  });

  it("advancer bids 2D after 2C (relay for higher suit) → wait-2c-relay", () => {
    const auction = buildAuction(Seat.East, ["1NT", "2C", "P", "2D"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("wait-2c-relay");
  });

  // ─── Multi-stage relay sequences ──────────────────────────────

  it("double → 2C relay → pass → overcaller reveal", () => {
    // 1NT(E) X(S) P(W) 2C(N) P(E)
    const auction = buildAuction(Seat.East, ["1NT", "X", "P", "2C", "P"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("overcaller-reveal");
    expect(result.activeSurfaceGroupIds).toContain("overcaller-reveal");
    expect(result.context.registers.captain).toBe("opener");
  });

  it("2D → 2H relay → pass → overcaller relay response", () => {
    // 1NT(E) 2D(S) P(W) 2H(N) P(E)
    const auction = buildAuction(Seat.East, ["1NT", "2D", "P", "2H", "P"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("overcaller-2d-relay");
    expect(result.activeSurfaceGroupIds).toContain("overcaller-2d-relay");
  });

  it("2C → 2D relay → pass → overcaller relay response", () => {
    // 1NT(E) 2C(S) P(W) 2D(N) P(E)
    const auction = buildAuction(Seat.East, ["1NT", "2C", "P", "2D", "P"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("overcaller-2c-relay");
    expect(result.activeSurfaceGroupIds).toContain("overcaller-2c-relay");
  });

  // ─── Terminal sequences ───────────────────────────────────────

  it("full double sequence: X → P → 2C → P → reveal (pass=clubs)", () => {
    // 1NT(E) X(S) P(W) 2C(N) P(E) P(S) — overcaller passes to show clubs
    const auction = buildAuction(Seat.East, ["1NT", "X", "P", "2C", "P", "P"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("terminal");
  });

  it("full double sequence: X → P → 2C → P → reveal (2H=hearts)", () => {
    // 1NT(E) X(S) P(W) 2C(N) P(E) 2H(S) — overcaller bids 2H to show hearts
    const auction = buildAuction(Seat.East, ["1NT", "X", "P", "2C", "P", "2H"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("terminal");
  });

  it("2D relay: pass shows hearts", () => {
    // 1NT(E) 2D(S) P(W) 2H(N) P(E) P(S) — overcaller passes to confirm hearts
    const auction = buildAuction(Seat.East, ["1NT", "2D", "P", "2H", "P", "P"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("terminal");
  });

  it("2D relay: 2S shows spades", () => {
    // 1NT(E) 2D(S) P(W) 2H(N) P(E) 2S(S) — overcaller bids 2S to show spades
    const auction = buildAuction(Seat.East, ["1NT", "2D", "P", "2H", "P", "2S"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("terminal");
  });

  // ─── State history tracking ───────────────────────────────────

  describe("state history tracking", () => {
    it("tracks full state history for double relay sequence", () => {
      // 1NT(E) X(S) P(W) 2C(N) P(E) 2H(S)
      const auction = buildAuction(Seat.East, ["1NT", "X", "P", "2C", "P", "2H"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.stateHistory).toContain("idle");
      expect(result.context.stateHistory).toContain("overcaller-r1");
      expect(result.context.stateHistory).toContain("wait-advancer-double");
      expect(result.context.stateHistory).toContain("advancer-after-double");
      expect(result.context.stateHistory).toContain("wait-reveal");
      expect(result.context.stateHistory).toContain("overcaller-reveal");
      expect(result.context.stateHistory).toContain("terminal");
    });

    it("tracks transition history", () => {
      const auction = buildAuction(Seat.East, ["1NT", "X", "P", "2C"]);
      const result = evaluateMachine(machine, auction, Seat.South);
      expect(result.context.transitionHistory.length).toBeGreaterThan(0);
    });
  });

  // ─── Additional coverage ──────────────────────────────────────

  it("West passes after 2D → advancer-after-2d", () => {
    const auction = buildAuction(Seat.East, ["1NT", "2D", "P"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("advancer-after-2d");
  });

  it("West passes after 2C → advancer-after-2c", () => {
    const auction = buildAuction(Seat.East, ["1NT", "2C", "P"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("advancer-after-2c");
  });

  it("West passes after 2S → advancer-after-2s", () => {
    const auction = buildAuction(Seat.East, ["1NT", "2S", "P"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("advancer-after-2s");
  });

  it("2C relay: overcaller reveals higher suit → terminal", () => {
    // 1NT(E) 2C(S) P(W) 2D(N) P(E) 2H(S) — overcaller bids 2H to show hearts
    const auction = buildAuction(Seat.East, ["1NT", "2C", "P", "2D", "P", "2H"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("terminal");
  });

  it("2C relay: overcaller passes to confirm diamonds → terminal", () => {
    // 1NT(E) 2C(S) P(W) 2D(N) P(E) P(S) — overcaller passes to confirm diamonds
    const auction = buildAuction(Seat.East, ["1NT", "2C", "P", "2D", "P", "P"]);
    const result = evaluateMachine(machine, auction, Seat.South);
    expect(result.context.currentStateId).toBe("terminal");
  });
});
