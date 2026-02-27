import { describe, test, expect } from "vitest";
import { formatHandSummary } from "../hand-summary";
import type { HandEvaluation } from "../../engine/types";

function makeEval(shape: readonly [number, number, number, number], hcp: number): HandEvaluation {
  return {
    hcp,
    shape,
    distribution: { shortness: 0, length: 0, total: 0 },
    totalPoints: hcp,
    strategy: "hcp",
  };
}

describe("formatHandSummary", () => {
  test("formats standard 4-3-3-3 shape with HCP", () => {
    expect(formatHandSummary(makeEval([4, 3, 3, 3], 12))).toBe("4\u2660 3\u2665 3\u2666 3\u2663, 12 HCP");
  });

  test("formats 5-4-3-1 shape with HCP", () => {
    expect(formatHandSummary(makeEval([3, 5, 4, 1], 16))).toBe("3\u2660 5\u2665 4\u2666 1\u2663, 16 HCP");
  });

  test("formats void (0 in a suit)", () => {
    expect(formatHandSummary(makeEval([5, 5, 3, 0], 8))).toBe("5\u2660 5\u2665 3\u2666 0\u2663, 8 HCP");
  });

  test("formats 0 HCP", () => {
    expect(formatHandSummary(makeEval([7, 4, 2, 0], 0))).toBe("7\u2660 4\u2665 2\u2666 0\u2663, 0 HCP");
  });
});
