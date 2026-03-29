import { describe, it, expect } from "vitest";
import { matchKernel } from "../observation/negotiation-matcher";
import { INITIAL_NEGOTIATION, ConfidenceLevel } from "../../core/committed-step";
import type { NegotiationState } from "../../core/committed-step";
import type { NegotiationExpr } from "../../core/rule-module";
import { ObsSuit } from "../bid-action";
import { HandStrength } from "../bid-action";

function kernel(overrides: Partial<NegotiationState> = {}): NegotiationState {
  return { ...INITIAL_NEGOTIATION, ...overrides };
}

describe("matchKernel", () => {
  describe("fit / no-fit", () => {
    it("fit() matches any fitAgreed", () => {
      const k = kernel({
        fitAgreed: { strain: ObsSuit.Hearts, confidence: ConfidenceLevel.Tentative },
      });
      expect(matchKernel({ kind: "fit" }, k)).toBe(true);
    });

    it("fit(hearts) matches specific strain", () => {
      const k = kernel({
        fitAgreed: { strain: ObsSuit.Hearts, confidence: ConfidenceLevel.Tentative },
      });
      expect(matchKernel({ kind: "fit", strain: ObsSuit.Hearts }, k)).toBe(true);
      expect(matchKernel({ kind: "fit", strain: ObsSuit.Spades }, k)).toBe(false);
    });

    it("fit() does not match null fitAgreed", () => {
      expect(matchKernel({ kind: "fit" }, INITIAL_NEGOTIATION)).toBe(false);
    });

    it("no-fit matches null fitAgreed", () => {
      expect(matchKernel({ kind: "no-fit" }, INITIAL_NEGOTIATION)).toBe(true);
    });

    it("no-fit does not match when fit is agreed", () => {
      const k = kernel({
        fitAgreed: { strain: ObsSuit.Spades, confidence: ConfidenceLevel.Final },
      });
      expect(matchKernel({ kind: "no-fit" }, k)).toBe(false);
    });
  });

  describe("forcing", () => {
    it("matches forcing level", () => {
      const k = kernel({ forcing: "game" });
      expect(matchKernel({ kind: "forcing", level: HandStrength.Game }, k)).toBe(true);
      expect(matchKernel({ kind: "forcing", level: "none" }, k)).toBe(false);
    });

    it("matches none forcing on initial kernel", () => {
      expect(matchKernel({ kind: "forcing", level: "none" }, INITIAL_NEGOTIATION)).toBe(true);
    });
  });

  describe("captain", () => {
    it("matches captain", () => {
      const k = kernel({ captain: "responder" });
      expect(matchKernel({ kind: "captain", who: "responder" }, k)).toBe(true);
      expect(matchKernel({ kind: "captain", who: "opener" }, k)).toBe(false);
    });

    it("matches undecided on initial kernel", () => {
      expect(matchKernel({ kind: "captain", who: "undecided" }, INITIAL_NEGOTIATION)).toBe(true);
    });
  });

  describe("competition", () => {
    it("uncontested matches initial kernel", () => {
      expect(matchKernel({ kind: "uncontested" }, INITIAL_NEGOTIATION)).toBe(true);
    });

    it("uncontested does not match overcalled", () => {
      const k = kernel({
        competition: { kind: "overcalled", strain: ObsSuit.Hearts, level: 2 },
      });
      expect(matchKernel({ kind: "uncontested" }, k)).toBe(false);
    });

    it("overcalled matches any overcall", () => {
      const k = kernel({
        competition: { kind: "overcalled", strain: ObsSuit.Hearts, level: 2 },
      });
      expect(matchKernel({ kind: "overcalled" }, k)).toBe(true);
    });

    it("overcalled does not match uncontested", () => {
      expect(matchKernel({ kind: "overcalled" }, INITIAL_NEGOTIATION)).toBe(false);
    });

    it("overcalled(below) matches overcalls below threshold", () => {
      const k = kernel({
        competition: { kind: "overcalled", strain: ObsSuit.Clubs, level: 2 },
      });
      // 2C is below 3C
      expect(matchKernel(
        { kind: "overcalled", below: { level: 3, strain: ObsSuit.Clubs } },
        k,
      )).toBe(true);
      // 2C is below 2H (same level, clubs < hearts)
      expect(matchKernel(
        { kind: "overcalled", below: { level: 2, strain: ObsSuit.Hearts } },
        k,
      )).toBe(true);
      // 2C is NOT below 2C (equal)
      expect(matchKernel(
        { kind: "overcalled", below: { level: 2, strain: ObsSuit.Clubs } },
        k,
      )).toBe(false);
    });

    it("doubled matches doubled competition", () => {
      const k = kernel({ competition: "doubled" });
      expect(matchKernel({ kind: "doubled" }, k)).toBe(true);
      expect(matchKernel({ kind: "doubled" }, INITIAL_NEGOTIATION)).toBe(false);
    });

    it("redoubled matches redoubled competition", () => {
      const k = kernel({ competition: "redoubled" });
      expect(matchKernel({ kind: "redoubled" }, k)).toBe(true);
    });
  });

  describe("combinators", () => {
    it("and requires all to match", () => {
      const expr: NegotiationExpr = {
        kind: "and",
        exprs: [
          { kind: "uncontested" },
          { kind: "forcing", level: "none" },
        ],
      };
      expect(matchKernel(expr, INITIAL_NEGOTIATION)).toBe(true);

      const k = kernel({ forcing: "game" });
      expect(matchKernel(expr, k)).toBe(false);
    });

    it("or requires any to match", () => {
      const expr: NegotiationExpr = {
        kind: "or",
        exprs: [
          { kind: "forcing", level: HandStrength.Game },
          { kind: "uncontested" },
        ],
      };
      expect(matchKernel(expr, INITIAL_NEGOTIATION)).toBe(true);
    });

    it("not inverts", () => {
      expect(matchKernel(
        { kind: "not", expr: { kind: "forcing", level: HandStrength.Game } },
        INITIAL_NEGOTIATION,
      )).toBe(true);
      expect(matchKernel(
        { kind: "not", expr: { kind: "uncontested" } },
        INITIAL_NEGOTIATION,
      )).toBe(false);
    });
  });
});
