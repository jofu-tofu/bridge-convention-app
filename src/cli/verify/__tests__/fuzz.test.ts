// ── Fuzz tests ──────────────────────────────────────────────────────
//
// Integration tests that run fuzz on real bundles to verify
// the fuzz loop works end-to-end.

import { describe, it, expect } from "vitest";

// Side-effect import: registers all bundles + conventions
import "../../../conventions";

import { getSystemBundle } from "../../../conventions/definitions/system-registry";
import { fuzzBundle } from "../fuzz";

describe("fuzzBundle", () => {
  it("runs without crashes on nt-bundle with minimal trials", () => {
    const system = getSystemBundle("nt-bundle")!;
    const modules = system.modules ?? [];
    expect(modules.length).toBeGreaterThan(0);

    const result = fuzzBundle(system, modules, {
      trials: 5,
      seed: 42,
    });

    expect(result.command).toBe("verify fuzz");
    expect(result.bundle).toBe("nt-bundle");
    expect(result.summary.trialsRun).toBe(5);
    expect(result.crashes).toEqual([]);
  });

  it("cycles vulnerability when vulnMixed is true", () => {
    const system = getSystemBundle("nt-bundle")!;
    const modules = system.modules ?? [];

    const result = fuzzBundle(system, modules, {
      trials: 8,
      seed: 0,
      vulnMixed: true,
    });

    expect(result.summary.trialsRun).toBe(8);
    expect(result.crashes).toEqual([]);
  });

  it("produces deterministic results with same seed", () => {
    const system = getSystemBundle("nt-bundle")!;
    const modules = system.modules ?? [];

    const result1 = fuzzBundle(system, modules, { trials: 3, seed: 42 });
    const result2 = fuzzBundle(system, modules, { trials: 3, seed: 42 });

    expect(result1.crashes.length).toBe(result2.crashes.length);
    expect(result1.summary.passRate).toBe(result2.summary.passRate);
  });

  it("works on bergen-bundle", () => {
    const system = getSystemBundle("bergen-bundle")!;
    const modules = system.modules ?? [];
    expect(modules.length).toBeGreaterThan(0);

    const result = fuzzBundle(system, modules, { trials: 3, seed: 42 });
    expect(result.crashes).toEqual([]);
  });
});
