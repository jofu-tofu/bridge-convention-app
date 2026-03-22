import { describe, it, expect } from "vitest";
import {
  getBundleInput,
  listBundleInputs,
  resolveBundle,
  specFromBundle,
  // Deprecated shims (kept for backwards compat)
  getSystemBundle,
  listSystemBundles,
} from "../system-registry";
import { SAYC_SYSTEM_CONFIG, ACOL_SYSTEM_CONFIG } from "../../../core/contracts/system-config";
import { moduleSurfaces } from "../../core/convention-module";
import { Seat } from "../../../engine/types";

const ALL_IDS = ["nt-bundle", "nt-stayman", "nt-transfers", "bergen-bundle", "dont-bundle", "weak-twos-bundle"] as const;

// ── New API: getBundleInput ──────────────────────────────────────

describe("getBundleInput", () => {
  it.each(ALL_IDS)("returns a BundleInput for %s", (id) => {
    const input = getBundleInput(id);
    expect(input).toBeDefined();
    expect(input!.id).toBe(id);
  });

  it("returns BundleInput without modules property", () => {
    const input = getBundleInput("nt-bundle");
    expect(input).toBeDefined();
    // BundleInput does not have modules — that's the whole point
    expect("modules" in input!).toBe(false);
  });

  it("returns undefined for unknown ID", () => {
    expect(getBundleInput("nonexistent")).toBeUndefined();
  });

  it("does not have nt-bundle-acol (removed — use resolveBundle with Acol config)", () => {
    expect(getBundleInput("nt-bundle-acol")).toBeUndefined();
  });
});

// ── New API: listBundleInputs ────────────────────────────────────

describe("listBundleInputs", () => {
  const inputs = listBundleInputs();

  it("returns exactly 6 bundle inputs (no nt-bundle-acol)", () => {
    expect(inputs).toHaveLength(6);
  });

  it("contains all expected IDs", () => {
    const ids = inputs.map((b) => b.id);
    expect(ids).toEqual(expect.arrayContaining([...ALL_IDS]));
  });

  it("has stable order", () => {
    const ids = inputs.map((b) => b.id);
    expect(ids).toEqual(["nt-bundle", "nt-stayman", "nt-transfers", "bergen-bundle", "dont-bundle", "weak-twos-bundle"]);
  });

  it("inputs have memberIds but no modules", () => {
    for (const input of inputs) {
      expect(input.memberIds.length).toBeGreaterThan(0);
      expect("modules" in input).toBe(false);
    }
  });
});

// ── New API: resolveBundle ──────────────────────────────────────

describe("resolveBundle", () => {
  it("resolves nt-bundle with SAYC modules", () => {
    const input = getBundleInput("nt-bundle")!;
    const bundle = resolveBundle(input, SAYC_SYSTEM_CONFIG);
    expect(bundle.id).toBe("nt-bundle");
    expect(bundle.modules.length).toBeGreaterThan(0);
    expect(bundle.derivedTeaching).toBeDefined();
  });

  it("resolves nt-bundle with Acol modules", () => {
    const input = getBundleInput("nt-bundle")!;
    const bundle = resolveBundle(input, ACOL_SYSTEM_CONFIG);
    expect(bundle.id).toBe("nt-bundle");
    expect(bundle.modules.length).toBeGreaterThan(0);
  });

  it("Acol-resolved bundle has 1NT opening with 12-14 HCP", () => {
    const input = getBundleInput("nt-bundle")!;
    const bundle = resolveBundle(input, ACOL_SYSTEM_CONFIG);
    const allSurfaces = bundle.modules.flatMap((m) => moduleSurfaces(m));
    const opening = allSurfaces.find((s) => s.meaningId === "bridge:1nt-opening");
    expect(opening).toBeDefined();
    const gteClause = opening!.clauses.find((c) => c.factId === "hand.hcp" && c.operator === "gte");
    expect(gteClause!.value).toBe(12);
    expect(opening!.teachingLabel).toBe("12 to 14");
  });

  it("SAYC-resolved bundle has 1NT opening with 15-17 HCP", () => {
    const input = getBundleInput("nt-bundle")!;
    const bundle = resolveBundle(input, SAYC_SYSTEM_CONFIG);
    const allSurfaces = bundle.modules.flatMap((m) => moduleSurfaces(m));
    const opening = allSurfaces.find((s) => s.meaningId === "bridge:1nt-opening");
    expect(opening).toBeDefined();
    const gteClause = opening!.clauses.find((c) => c.factId === "hand.hcp" && c.operator === "gte");
    expect(gteClause!.value).toBe(15);
    expect(opening!.teachingLabel).toBe("15 to 17");
  });

  it("produces derivedTeaching with arrays", () => {
    const input = getBundleInput("bergen-bundle")!;
    const bundle = resolveBundle(input, SAYC_SYSTEM_CONFIG);
    expect(Array.isArray(bundle.derivedTeaching.acceptableAlternatives)).toBe(true);
    expect(Array.isArray(bundle.derivedTeaching.surfaceGroups)).toBe(true);
    expect(Array.isArray(bundle.derivedTeaching.relations)).toBe(true);
  });
});

// ── New API: specFromBundle ──────────────────────────────────────

describe("specFromBundle", () => {
  it("derives spec from BundleInput + SystemConfig", () => {
    const input = getBundleInput("nt-bundle")!;
    const spec = specFromBundle(input, SAYC_SYSTEM_CONFIG);
    expect(spec).toBeDefined();
    expect(spec!.id).toBe("nt-bundle");
    expect(spec!.modules.length).toBeGreaterThan(0);
    expect(spec!.systemConfig).toBe(SAYC_SYSTEM_CONFIG);
  });

  it("derives Acol spec with Acol modules and systemConfig", () => {
    const input = getBundleInput("nt-bundle")!;
    const spec = specFromBundle(input, ACOL_SYSTEM_CONFIG);
    expect(spec).toBeDefined();
    expect(spec!.systemConfig).toBe(ACOL_SYSTEM_CONFIG);
  });

  it("derives spec for bergen bundle", () => {
    const input = getBundleInput("bergen-bundle")!;
    const spec = specFromBundle(input, SAYC_SYSTEM_CONFIG);
    expect(spec).toBeDefined();
    expect(spec!.id).toBe("bergen-bundle");
  });
});

// ── NT dealConstraintFactory ─────────────────────────────────────

describe("NT dealConstraintFactory", () => {
  it("NT bundle has dealConstraintFactory", () => {
    const input = getBundleInput("nt-bundle")!;
    expect(input.dealConstraintFactory).toBeDefined();
  });

  it("factory produces Acol constraints (12-14 HCP for North)", () => {
    const input = getBundleInput("nt-bundle")!;
    const constraints = input.dealConstraintFactory!(ACOL_SYSTEM_CONFIG);
    const north = constraints.seats?.find((s) => s.seat === Seat.North);
    expect(north).toBeDefined();
    expect(north!.minHcp).toBe(12);
    expect(north!.maxHcp).toBe(14);
  });

  it("factory produces SAYC constraints (15-17 HCP for North)", () => {
    const input = getBundleInput("nt-bundle")!;
    const constraints = input.dealConstraintFactory!(SAYC_SYSTEM_CONFIG);
    const north = constraints.seats?.find((s) => s.seat === Seat.North);
    expect(north).toBeDefined();
    expect(north!.minHcp).toBe(15);
    expect(north!.maxHcp).toBe(17);
  });

  it("NT bundle has offConventionConstraintFactory", () => {
    const input = getBundleInput("nt-bundle")!;
    expect(input.offConventionConstraintFactory).toBeDefined();
  });
});

// ── Deprecated shims (backwards compat) ──────────────────────────

describe("deprecated getSystemBundle", () => {
  it("still resolves nt-bundle (with SAYC defaults)", () => {
    const bundle = getSystemBundle("nt-bundle");
    expect(bundle).toBeDefined();
    expect(bundle!.id).toBe("nt-bundle");
    expect(bundle!.modules.length).toBeGreaterThan(0);
  });

  it("returns undefined for unknown ID", () => {
    expect(getSystemBundle("nonexistent")).toBeUndefined();
  });
});

describe("deprecated listSystemBundles", () => {
  it("returns resolved bundles with modules", () => {
    const bundles = listSystemBundles();
    expect(bundles.length).toBe(6);
    for (const b of bundles) {
      expect(b.modules.length).toBeGreaterThan(0);
    }
  });
});
