import { describe, it, expect } from "vitest";
import { createAppStore } from "../app.svelte";
import { DEFAULT_DRILL_TUNING } from "../../service/session-types";

describe("app store drill tuning", () => {
  it("starts with default drill tuning", () => {
    const store = createAppStore();
    expect(store.drillTuning).toEqual(DEFAULT_DRILL_TUNING);
  });

  it("setVulnerabilityDistribution updates distribution", () => {
    const store = createAppStore();
    const dist = { none: 0, ours: 0, theirs: 0, both: 1 };
    store.setVulnerabilityDistribution(dist);
    expect(store.drillTuning.vulnerabilityDistribution).toEqual(dist);
  });

  it("setVulnerabilityDistribution preserves other tuning fields", () => {
    const store = createAppStore();
    store.setIncludeOffConvention(true);
    const dist = { none: 0, ours: 1, theirs: 0, both: 1 };
    store.setVulnerabilityDistribution(dist);
    expect(store.drillTuning.includeOffConvention).toBe(true);
    expect(store.drillTuning.vulnerabilityDistribution).toEqual(dist);
  });

  it("setIncludeOffConvention updates flag", () => {
    const store = createAppStore();
    store.setIncludeOffConvention(true);
    expect(store.drillTuning.includeOffConvention).toBe(true);
    store.setIncludeOffConvention(false);
    expect(store.drillTuning.includeOffConvention).toBe(false);
  });

  it("setOffConventionRate stores rate", () => {
    const store = createAppStore();
    store.setOffConventionRate(0.5);
    expect(store.drillTuning.offConventionRate).toBe(0.5);
  });

  it("setOffConventionRate clamps below 0", () => {
    const store = createAppStore();
    store.setOffConventionRate(-1);
    expect(store.drillTuning.offConventionRate).toBe(0);
  });

  it("setOffConventionRate clamps above 1", () => {
    const store = createAppStore();
    store.setOffConventionRate(2);
    expect(store.drillTuning.offConventionRate).toBe(1);
  });

  it("preserves existing tuning fields when updating one field", () => {
    const store = createAppStore();
    const dist = { none: 0, ours: 0, theirs: 0, both: 1 };
    store.setVulnerabilityDistribution(dist);
    store.setIncludeOffConvention(true);
    store.setOffConventionRate(0.3);
    expect(store.drillTuning.vulnerabilityDistribution).toEqual(dist);
    expect(store.drillTuning.includeOffConvention).toBe(true);
    expect(store.drillTuning.offConventionRate).toBe(0.3);
  });
});
