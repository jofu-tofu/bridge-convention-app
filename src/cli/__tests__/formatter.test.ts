import { describe, it, expect } from "vitest";
import { formatResult, formatDeal, formatHandEvaluation } from "../formatter";
import { formatError } from "../errors";
import type { CliError } from "../errors";
import { Seat, Vulnerability } from "../../engine/types";
import type { HandEvaluation } from "../../engine/types";
import type { CommandResult } from "../types";
import { hand } from "../../engine/__tests__/fixtures";

// Re-import Deal from engine types for test construction
type TestDeal = import("../../engine/types").Deal;

describe("formatResult", () => {
  it("outputs JSON by default", () => {
    const result: CommandResult = {
      type: "test",
      data: { foo: "bar" },
    };
    const output = formatResult(result, "json");
    expect(JSON.parse(output)).toEqual({ foo: "bar" });
  });

  it("falls back to JSON for unknown types in text mode", () => {
    const result: CommandResult = {
      type: "unknown",
      data: { foo: "bar" },
    };
    const output = formatResult(result, "text");
    expect(JSON.parse(output)).toEqual({ foo: "bar" });
  });
});

describe("formatDeal", () => {
  const testDeal: TestDeal = {
    hands: {
      [Seat.North]: hand(
        "SA",
        "SK",
        "SQ",
        "HK",
        "HQ",
        "HJ",
        "DA",
        "DK",
        "DQ",
        "DJ",
        "CA",
        "CK",
        "CQ",
      ),
      [Seat.East]: hand(
        "SJ",
        "ST",
        "S9",
        "HT",
        "H9",
        "H8",
        "DT",
        "D9",
        "D8",
        "CJ",
        "CT",
        "C9",
        "C8",
      ),
      [Seat.South]: hand(
        "S8",
        "S7",
        "S6",
        "H7",
        "H6",
        "H5",
        "D7",
        "D6",
        "D5",
        "C7",
        "C6",
        "C5",
        "C4",
      ),
      [Seat.West]: hand(
        "S5",
        "S4",
        "S3",
        "S2",
        "H4",
        "H3",
        "H2",
        "D4",
        "D3",
        "D2",
        "C3",
        "C2",
        "HA",
      ),
    },
    dealer: Seat.North,
    vulnerability: Vulnerability.None,
  };

  it("shows all seats with HCP", () => {
    const output = formatDeal(testDeal);
    expect(output).toContain("N:");
    expect(output).toContain("E:");
    expect(output).toContain("S:");
    expect(output).toContain("W:");
    expect(output).toContain("HCP");
    expect(output).toContain("Dealer: N");
  });

  it("uses ASCII when unicode disabled", () => {
    const output = formatDeal(testDeal, { unicode: false });
    expect(output).not.toContain("♠");
    expect(output).toContain("S ");
  });

  it("uses suit symbols by default", () => {
    const output = formatDeal(testDeal);
    expect(output).toContain("♠");
    expect(output).toContain("♥");
    expect(output).toContain("♦");
    expect(output).toContain("♣");
  });
});

describe("formatHandEvaluation", () => {
  const testEval: HandEvaluation = {
    hcp: 17,
    distribution: { shortness: 1, length: 0, total: 1 },
    shape: [4, 3, 4, 2] as const,
    totalPoints: 18,
    strategy: "HCP",
  };

  it("shows all evaluation fields", () => {
    const output = formatHandEvaluation(testEval);
    expect(output).toContain("HCP: 17");
    expect(output).toContain("Total Points: 18");
    expect(output).toContain("Shape: 4-3-4-2");
    expect(output).toContain("Strategy: HCP");
  });
});

describe("formatError", () => {
  it("formats JSON error with code and message", () => {
    const error: CliError = { code: "INVALID_ARGS", message: "Bad input" };
    const output = formatError(error, "json");
    const parsed = JSON.parse(output);
    expect(parsed.error.code).toBe("INVALID_ARGS");
    expect(parsed.error.message).toBe("Bad input");
  });

  it("formats text error with code and message", () => {
    const error: CliError = { code: "ENGINE_ERROR", message: "Something broke" };
    const output = formatError(error, "text");
    expect(output).toBe("Error [ENGINE_ERROR]: Something broke");
  });

  it("includes phase in text format when present", () => {
    const error: CliError = {
      code: "NOT_IMPLEMENTED",
      message: "Not available",
      phase: 3,
    };
    const output = formatError(error, "text");
    expect(output).toContain("Error [NOT_IMPLEMENTED]: Not available");
    expect(output).toContain("Phase: 3");
  });

  it("includes suggestion in text format when present", () => {
    const error: CliError = {
      code: "INVALID_ARGS",
      message: "Unknown command",
      suggestion: "Run --help for usage.",
    };
    const output = formatError(error, "text");
    expect(output).toContain("Suggestion: Run --help for usage.");
  });

  it("includes both phase and suggestion in text format", () => {
    const error: CliError = {
      code: "NOT_IMPLEMENTED",
      message: "Not yet",
      phase: 2,
      suggestion: "Wait for Phase 2.",
    };
    const output = formatError(error, "text");
    expect(output).toContain("Phase: 2");
    expect(output).toContain("Suggestion: Wait for Phase 2.");
  });
});
