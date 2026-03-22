import { describe, it, expect } from "vitest";
import { extractKernelState, computeKernelDelta } from "../negotiation-extractor";
import { INITIAL_NEGOTIATION } from "../../../core/contracts/committed-step";
import type { NegotiationState } from "../../../core/contracts/committed-step";
import type { MachineRegisters } from "../../../core/contracts/module-surface";
import { ForcingState } from "../../../core/contracts/bidding";

function makeRegisters(
  overrides: Partial<MachineRegisters> = {},
): MachineRegisters {
  return {
    forcingState: ForcingState.Nonforcing,
    obligation: { kind: "none", obligatedSide: "opener" },
    agreedStrain: { type: "none" },
    competitionMode: "Uncontested",
    captain: "undecided",
    systemCapabilities: {},
    ...overrides,
  };
}

describe("extractKernelState", () => {
  it("maps default registers to INITIAL_NEGOTIATION", () => {
    const result = extractKernelState(makeRegisters());
    expect(result).toEqual(INITIAL_NEGOTIATION);
  });

  describe("forcing state mapping", () => {
    it("maps Nonforcing → 'none'", () => {
      const result = extractKernelState(
        makeRegisters({ forcingState: ForcingState.Nonforcing }),
      );
      expect(result.forcing).toBe("none");
    });

    it("maps ForcingOneRound → 'one-round'", () => {
      const result = extractKernelState(
        makeRegisters({ forcingState: ForcingState.ForcingOneRound }),
      );
      expect(result.forcing).toBe("one-round");
    });

    it("maps GameForcing → 'game'", () => {
      const result = extractKernelState(
        makeRegisters({ forcingState: ForcingState.GameForcing }),
      );
      expect(result.forcing).toBe("game");
    });

    it("maps PassForcing → 'one-round' (pass-forcing is a one-round constraint)", () => {
      const result = extractKernelState(
        makeRegisters({ forcingState: ForcingState.PassForcing }),
      );
      expect(result.forcing).toBe("one-round");
    });
  });

  describe("fitAgreed mapping", () => {
    it("maps agreedStrain type:'none' → null", () => {
      const result = extractKernelState(
        makeRegisters({ agreedStrain: { type: "none" } }),
      );
      expect(result.fitAgreed).toBeNull();
    });

    it("maps agreedStrain type:'suit' with suit and confidence", () => {
      const result = extractKernelState(
        makeRegisters({
          agreedStrain: {
            type: "suit",
            suit: "hearts",
            confidence: "tentative",
          },
        }),
      );
      expect(result.fitAgreed).toEqual({
        strain: "hearts",
        confidence: "tentative",
      });
    });

    it("maps agreedStrain type:'notrump'", () => {
      const result = extractKernelState(
        makeRegisters({
          agreedStrain: { type: "notrump", confidence: "final" },
        }),
      );
      expect(result.fitAgreed).toEqual({
        strain: "notrump",
        confidence: "final",
      });
    });

    it("defaults confidence to 'tentative' when not specified", () => {
      const result = extractKernelState(
        makeRegisters({
          agreedStrain: { type: "suit", suit: "spades" },
        }),
      );
      expect(result.fitAgreed).toEqual({
        strain: "spades",
        confidence: "tentative",
      });
    });
  });

  describe("captain mapping", () => {
    it("maps 'opener' → 'opener'", () => {
      const result = extractKernelState(
        makeRegisters({ captain: "opener" }),
      );
      expect(result.captain).toBe("opener");
    });

    it("maps 'responder' → 'responder'", () => {
      const result = extractKernelState(
        makeRegisters({ captain: "responder" }),
      );
      expect(result.captain).toBe("responder");
    });

    it("maps unknown captain to 'undecided'", () => {
      const result = extractKernelState(
        makeRegisters({ captain: "something-else" }),
      );
      expect(result.captain).toBe("undecided");
    });
  });

  describe("competition mapping", () => {
    it("maps 'Uncontested' → 'uncontested'", () => {
      const result = extractKernelState(
        makeRegisters({ competitionMode: "Uncontested" }),
      );
      expect(result.competition).toBe("uncontested");
    });

    it("maps 'Doubled' → 'doubled'", () => {
      const result = extractKernelState(
        makeRegisters({ competitionMode: "Doubled" }),
      );
      expect(result.competition).toBe("doubled");
    });

    it("maps 'Redoubled' → 'redoubled'", () => {
      const result = extractKernelState(
        makeRegisters({ competitionMode: "Redoubled" }),
      );
      expect(result.competition).toBe("redoubled");
    });

    it("maps 'Contested' → overcalled fallback (lossy)", () => {
      const result = extractKernelState(
        makeRegisters({ competitionMode: "Contested" }),
      );
      // TODO(Phase 4): replace with actual overcall strain/level from CommittedStep
      expect(result.competition).toEqual({
        kind: "overcalled",
        strain: "notrump",
        level: 0,
      });
    });

    it("maps unknown competition mode to 'uncontested'", () => {
      const result = extractKernelState(
        makeRegisters({ competitionMode: "SomethingNew" }),
      );
      expect(result.competition).toBe("uncontested");
    });
  });
});

describe("computeKernelDelta", () => {
  it("returns empty object for identical kernels", () => {
    const delta = computeKernelDelta(INITIAL_NEGOTIATION, INITIAL_NEGOTIATION);
    expect(delta).toEqual({});
  });

  it("returns only changed fields", () => {
    const before = INITIAL_NEGOTIATION;
    const after: NegotiationState = {
      ...INITIAL_NEGOTIATION,
      forcing: "game",
      captain: "responder",
    };
    const delta = computeKernelDelta(before, after);
    expect(delta).toEqual({ forcing: "game", captain: "responder" });
    expect(delta.fitAgreed).toBeUndefined();
    expect(delta.competition).toBeUndefined();
  });

  it("detects fitAgreed change from null to value", () => {
    const before = INITIAL_NEGOTIATION;
    const after: NegotiationState = {
      ...INITIAL_NEGOTIATION,
      fitAgreed: { strain: "hearts", confidence: "tentative" },
    };
    const delta = computeKernelDelta(before, after);
    expect(delta).toEqual({
      fitAgreed: { strain: "hearts", confidence: "tentative" },
    });
  });

  it("detects competition change from uncontested to overcalled", () => {
    const before = INITIAL_NEGOTIATION;
    const after: NegotiationState = {
      ...INITIAL_NEGOTIATION,
      competition: { kind: "overcalled", strain: "hearts", level: 2 },
    };
    const delta = computeKernelDelta(before, after);
    expect(delta).toEqual({
      competition: { kind: "overcalled", strain: "hearts", level: 2 },
    });
  });
});
