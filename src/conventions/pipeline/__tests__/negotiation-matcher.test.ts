import { describe, it, expect } from "vitest";
import { matchKernel } from "../negotiation-matcher";
import { INITIAL_NEGOTIATION } from "../../../core/contracts/committed-step";
import type { NegotiationState } from "../../../core/contracts/committed-step";
import type { NegotiationExpr } from "../../core/rule-module";

function kernel(overrides: Partial<NegotiationState> = {}): NegotiationState {
  return { ...INITIAL_NEGOTIATION, ...overrides };
}

describe("matchKernel", () => {
  describe("fit / no-fit", () => {
    it("fit() matches any fitAgreed", () => {
      const k = kernel({
        fitAgreed: { strain: "hearts", confidence: "tentative" },
      });
      expect(matchKernel({ kind: "fit" }, k)).toBe(true);
    });

    it("fit(hearts) matches specific strain", () => {
      const k = kernel({
        fitAgreed: { strain: "hearts", confidence: "tentative" },
      });
      expect(matchKernel({ kind: "fit", strain: "hearts" }, k)).toBe(true);
      expect(matchKernel({ kind: "fit", strain: "spades" }, k)).toBe(false);
    });

    it("fit() does not match null fitAgreed", () => {
      expect(matchKernel({ kind: "fit" }, INITIAL_NEGOTIATION)).toBe(false);
    });

    it("no-fit matches null fitAgreed", () => {
      expect(matchKernel({ kind: "no-fit" }, INITIAL_NEGOTIATION)).toBe(true);
    });

    it("no-fit does not match when fit is agreed", () => {
      const k = kernel({
        fitAgreed: { strain: "spades", confidence: "final" },
      });
      expect(matchKernel({ kind: "no-fit" }, k)).toBe(false);
    });
  });

  describe("forcing", () => {
    it("matches forcing level", () => {
      const k = kernel({ forcing: "game" });
      expect(matchKernel({ kind: "forcing", level: "game" }, k)).toBe(true);
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
        competition: { kind: "overcalled", strain: "hearts", level: 2 },
      });
      expect(matchKernel({ kind: "uncontested" }, k)).toBe(false);
    });

    it("overcalled matches any overcall", () => {
      const k = kernel({
        competition: { kind: "overcalled", strain: "hearts", level: 2 },
      });
      expect(matchKernel({ kind: "overcalled" }, k)).toBe(true);
    });

    it("overcalled does not match uncontested", () => {
      expect(matchKernel({ kind: "overcalled" }, INITIAL_NEGOTIATION)).toBe(false);
    });

    it("overcalled(below) matches overcalls below threshold", () => {
      const k = kernel({
        competition: { kind: "overcalled", strain: "clubs", level: 2 },
      });
      // 2C is below 3C
      expect(matchKernel(
        { kind: "overcalled", below: { level: 3, strain: "clubs" } },
        k,
      )).toBe(true);
      // 2C is below 2H (same level, clubs < hearts)
      expect(matchKernel(
        { kind: "overcalled", below: { level: 2, strain: "hearts" } },
        k,
      )).toBe(true);
      // 2C is NOT below 2C (equal)
      expect(matchKernel(
        { kind: "overcalled", below: { level: 2, strain: "clubs" } },
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
          { kind: "forcing", level: "game" },
          { kind: "uncontested" },
        ],
      };
      expect(matchKernel(expr, INITIAL_NEGOTIATION)).toBe(true);
    });

    it("not inverts", () => {
      expect(matchKernel(
        { kind: "not", expr: { kind: "forcing", level: "game" } },
        INITIAL_NEGOTIATION,
      )).toBe(true);
      expect(matchKernel(
        { kind: "not", expr: { kind: "uncontested" } },
        INITIAL_NEGOTIATION,
      )).toBe(false);
    });
  });
});
