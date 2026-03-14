import { describe, it, expect } from "vitest";
import {
  computeScenarioDistribution,
} from "../pedagogical-weighting";
import type { PedagogicalControls } from "../../core/contracts/witness-spec";

describe("computeScenarioDistribution", () => {
  it("positiveOnly returns 100% positive, 0% boundary and competitive", () => {
    const controls: PedagogicalControls = { weightingMode: "positiveOnly" };
    const dist = computeScenarioDistribution(controls);

    expect(dist.positive).toBe(1.0);
    expect(dist.nearBoundary).toBe(0);
    expect(dist.competitive).toBe(0);
  });

  it("teachingDefault returns ~60% positive, ~25% near-boundary, ~15% competitive", () => {
    const controls: PedagogicalControls = { weightingMode: "teachingDefault" };
    const dist = computeScenarioDistribution(controls);

    expect(dist.positive).toBe(0.6);
    expect(dist.nearBoundary).toBe(0.25);
    expect(dist.competitive).toBe(0.15);
  });

  it("balanced returns equal positive and negative (50/50)", () => {
    const controls: PedagogicalControls = { weightingMode: "balanced" };
    const dist = computeScenarioDistribution(controls);

    expect(dist.positive).toBe(0.5);
    expect(dist.nearBoundary).toBe(0.25);
    expect(dist.competitive).toBe(0.25);
  });

  it("adaptive returns same distribution as teachingDefault (stub)", () => {
    const adaptive: PedagogicalControls = { weightingMode: "adaptive" };
    const teachingDefault: PedagogicalControls = {
      weightingMode: "teachingDefault",
    };

    const adaptiveDist = computeScenarioDistribution(adaptive);
    const defaultDist = computeScenarioDistribution(teachingDefault);

    expect(adaptiveDist).toEqual(defaultDist);
  });

  it("undefined weightingMode defaults to positiveOnly", () => {
    const controls: PedagogicalControls = {};
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
