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

  it("setVulnerabilityDistribution replaces distribution", () => {
    const store = createAppStore();
    const dist = { none: 0, ours: 1, theirs: 0, both: 1 };
    store.setVulnerabilityDistribution(dist);
    expect(store.drillTuning.vulnerabilityDistribution).toEqual(dist);
  });
});
