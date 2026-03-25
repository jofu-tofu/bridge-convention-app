import { describe, it, expect } from "vitest";
import { evaluateGates } from "../evaluation/gate-order";
import type { GateId } from "../evaluation/gate-order";

describe("evaluateGates", () => {
  it("returns passedAll: true with 4 results when all gates pass", () => {
    const checks = [
      { gateId: "semantic-applicability" as GateId, passed: true },
      { gateId: "obligation-satisfaction" as GateId, passed: true },
      { gateId: "encoder-availability" as GateId, passed: true },
      { gateId: "concrete-legality" as GateId, passed: true },
    ];
    const result = evaluateGates(checks);
    expect(result.passedAll).toBe(true);
    expect(result.results).toHaveLength(4);
    expect(result.results.every((r) => r.passed)).toBe(true);
  });

  it("stops early when the first gate fails, returning only 1 result", () => {
    const checks = [
      { gateId: "semantic-applicability" as GateId, passed: false },
      { gateId: "obligation-satisfaction" as GateId, passed: true },
      { gateId: "encoder-availability" as GateId, passed: true },
      { gateId: "concrete-legality" as GateId, passed: true },
    ];
    const result = evaluateGates(checks);
    expect(result.passedAll).toBe(false);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.gateId).toBe("semantic-applicability");
    expect(result.results[0]!.passed).toBe(false);
  });

  it("returns results up to and including a middle gate that fails", () => {
    const checks = [
      { gateId: "semantic-applicability" as GateId, passed: true },
      { gateId: "obligation-satisfaction" as GateId, passed: true },
      { gateId: "encoder-availability" as GateId, passed: false },
      { gateId: "concrete-legality" as GateId, passed: true },
    ];
    const result = evaluateGates(checks);
    expect(result.passedAll).toBe(false);
    expect(result.results).toHaveLength(3);
    expect(result.results[0]!.passed).toBe(true);
    expect(result.results[1]!.passed).toBe(true);
    expect(result.results[2]!.gateId).toBe("encoder-availability");
    expect(result.results[2]!.passed).toBe(false);
  });

  it("treats a missing gate as passed", () => {
    const checks = [
      { gateId: "semantic-applicability" as GateId, passed: true },
      { gateId: "concrete-legality" as GateId, passed: true },
    ];
    const result = evaluateGates(checks);
    expect(result.passedAll).toBe(true);
    expect(result.results).toHaveLength(4);
    const obligationResult = result.results.find(
      (r) => r.gateId === "obligation-satisfaction",
    );
    expect(obligationResult!.passed).toBe(true);
    const encoderResult = result.results.find(
      (r) => r.gateId === "encoder-availability",
    );
    expect(encoderResult!.passed).toBe(true);
  });

  it("returns all gates passed when checks array is empty", () => {
    const result = evaluateGates([]);
    expect(result.passedAll).toBe(true);
    expect(result.results).toHaveLength(4);
    expect(result.results.every((r) => r.passed)).toBe(true);
  });

  it("preserves the reason string on a gate result", () => {
    const checks = [
      {
        gateId: "semantic-applicability" as GateId,
        passed: false,
        reason: "Bid not applicable in this context",
      },
    ];
    const result = evaluateGates(checks);
    expect(result.results[0]!.reason).toBe(
      "Bid not applicable in this context",
    );
  });

  it("evaluates gates in canonical order regardless of input order", () => {
    const checks = [
      { gateId: "concrete-legality" as GateId, passed: true },
      { gateId: "encoder-availability" as GateId, passed: true },
      { gateId: "obligation-satisfaction" as GateId, passed: true },
      { gateId: "semantic-applicability" as GateId, passed: true },
    ];
    const result = evaluateGates(checks);
    expect(result.results.map((r) => r.gateId)).toEqual([
      "semantic-applicability",
      "obligation-satisfaction",
      "encoder-availability",
      "concrete-legality",
    ]);
  });
});
