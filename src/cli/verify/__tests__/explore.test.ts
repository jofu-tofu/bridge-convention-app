// ── Explore tests ───────────────────────────────────────────────────
//
// Integration tests that run explore on real bundles to verify
// the exploration loop works end-to-end.

import { describe, it, expect } from "vitest";

// Side-effect import: registers all bundles + conventions
import "../../../conventions";

import { resolveBundle, getBundleInput, specFromBundle } from "../../../conventions";
import { SAYC_SYSTEM_CONFIG } from "../../../conventions/definitions/system-config";
import { exploreBundle } from "../explore";

describe("exploreBundle", () => {
  it("runs without crashes on nt-bundle with minimal trials", () => {
    const system = resolveBundle(getBundleInput("nt-bundle")!, SAYC_SYSTEM_CONFIG);
    const modules = specFromBundle(getBundleInput("nt-bundle")!, SAYC_SYSTEM_CONFIG)!.modules;
    expect(modules.length).toBeGreaterThan(0);

    const result = exploreBundle(system, modules, {
      depth: 4,
      seed: 42,
      trials: 3,
    });

    expect(result.command).toBe("verify explore");
    expect(result.bundle).toBe("nt-bundle");
    expect(result.summary.trialsRun).toBe(3);
    expect(result.summary.totalSteps).toBeGreaterThan(0);
    // Should have activated some modules
    expect(result.coverage.modulesActivated.length).toBeGreaterThan(0);
  });

  it("tracks atom coverage across trials", () => {
    const system = resolveBundle(getBundleInput("nt-bundle")!, SAYC_SYSTEM_CONFIG);
    const modules = specFromBundle(getBundleInput("nt-bundle")!, SAYC_SYSTEM_CONFIG)!.modules;

    const result = exploreBundle(system, modules, {
      depth: 6,
      seed: 100,
      trials: 5,
    });

    // Should exercise some atoms
    expect(result.coverage.atomsExercised.length).toBeGreaterThan(0);
    // All exercised atoms should be in moduleId/meaningId format
    for (const atom of result.coverage.atomsExercised) {
      expect(atom).toContain("/");
    }
  });

  it("produces deterministic results with same seed", () => {
    const system = resolveBundle(getBundleInput("nt-bundle")!, SAYC_SYSTEM_CONFIG);
    const modules = specFromBundle(getBundleInput("nt-bundle")!, SAYC_SYSTEM_CONFIG)!.modules;

    const result1 = exploreBundle(system, modules, { depth: 4, seed: 42, trials: 3 });
    const result2 = exploreBundle(system, modules, { depth: 4, seed: 42, trials: 3 });

    expect(result1.coverage.atomsExercised).toEqual(result2.coverage.atomsExercised);
    expect(result1.summary.totalSteps).toBe(result2.summary.totalSteps);
  });

  it("filters invariants when specified", () => {
    const system = resolveBundle(getBundleInput("nt-bundle")!, SAYC_SYSTEM_CONFIG);
    const modules = specFromBundle(getBundleInput("nt-bundle")!, SAYC_SYSTEM_CONFIG)!.modules;

    const result = exploreBundle(system, modules, {
      depth: 4,
      seed: 42,
      trials: 3,
      invariants: ["kernel-consistency"],
    });

    // Should still run without error
    expect(result.command).toBe("verify explore");
  });
});
