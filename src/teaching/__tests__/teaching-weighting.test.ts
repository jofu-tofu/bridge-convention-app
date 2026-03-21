import { describe, it, expect } from "vitest";
import {
  computeScenarioDistribution,
} from "../teaching-weighting";
import type { TeachingControls } from "../../core/contracts/deal-spec";

describe("computeScenarioDistribution", () => {
  it("positiveOnly returns 100% positive, 0% boundary and competitive", () => {
    const controls: TeachingControls = { weightingMode: "positiveOnly" };
    const dist = computeScenarioDistribution(controls);

    expect(dist.positive).toBe(1.0);
    expect(dist.nearBoundary).toBe(0);
    expect(dist.competitive).toBe(0);
  });

  it("teachingDefault returns ~60% positive, ~25% near-boundary, ~15% competitive", () => {
    const controls: TeachingControls = { weightingMode: "teachingDefault" };
    const dist = computeScenarioDistribution(controls);

    expect(dist.positive).toBe(0.6);
    expect(dist.nearBoundary).toBe(0.25);
    expect(dist.competitive).toBe(0.15);
  });

  it("balanced returns equal positive and negative (50/50)", () => {
    const controls: TeachingControls = { weightingMode: "balanced" };
    const dist = computeScenarioDistribution(controls);

    expect(dist.positive).toBe(0.5);
    expect(dist.nearBoundary).toBe(0.25);
    expect(dist.competitive).toBe(0.25);
  });

  it("adaptive returns same distribution as teachingDefault (stub)", () => {
    const adaptive: TeachingControls = { weightingMode: "adaptive" };
    const teachingDefault: TeachingControls = {
      weightingMode: "teachingDefault",
    };

    const adaptiveDist = computeScenarioDistribution(adaptive);
    const defaultDist = computeScenarioDistribution(teachingDefault);

    expect(adaptiveDist).toEqual(defaultDist);
  });

  it("undefined weightingMode defaults to positiveOnly", () => {
    const controls: TeachingControls = {};
    const dist = computeScenarioDistribution(controls);

    expect(dist.positive).toBe(1.0);
    expect(dist.nearBoundary).toBe(0);
    expect(dist.competitive).toBe(0);
  });

  it("all distributions sum to 1.0", () => {
    const modes = [
      "positiveOnly",
      "teachingDefault",
      "balanced",
      "adaptive",
    ] as const;

    for (const mode of modes) {
      const dist = computeScenarioDistribution({ weightingMode: mode });
      const sum = dist.positive + dist.nearBoundary + dist.competitive;
      expect(sum).toBeCloseTo(1.0, 10);
    }
  });
});
