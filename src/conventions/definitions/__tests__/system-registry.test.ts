import { describe, it, expect } from "vitest";
import {
  getBundleInput,
  listBundleInputs,
  resolveBundle,
  specFromBundle,
  getBaseModuleIds,
} from "../system-registry";
import { SAYC_SYSTEM_CONFIG, ACOL_SYSTEM_CONFIG, BASE_SYSTEM_SAYC, BASE_SYSTEM_TWO_OVER_ONE, BASE_SYSTEM_ACOL } from "../system-config";
import { getModule } from "../module-registry";
import { moduleSurfaces } from "../../core/convention-module";
import { FactOperator } from "../../pipeline/evaluation/meaning";

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

  it("Acol spec has 1NT opening with 12-14 HCP (via base module natural-bids)", () => {
    const input = getBundleInput("nt-bundle")!;
    const spec = specFromBundle(input, ACOL_SYSTEM_CONFIG)!;
    const allSurfaces = spec.modules.flatMap((m) => moduleSurfaces(m));
    const opening = allSurfaces.find((s) => s.meaningId === "bridge:1nt-opening");
    expect(opening).toBeDefined();
    const gteClause = opening!.clauses.find((c) => c.factId === "hand.hcp" && c.operator === FactOperator.Gte);
    expect(gteClause!.value).toBe(12);
    expect(opening!.teachingLabel.name).toBe("12 to 14");
  });

  it("SAYC spec has 1NT opening with 15-17 HCP (via base module natural-bids)", () => {
    const input = getBundleInput("nt-bundle")!;
    const spec = specFromBundle(input, SAYC_SYSTEM_CONFIG)!;
    const allSurfaces = spec.modules.flatMap((m) => moduleSurfaces(m));
    const opening = allSurfaces.find((s) => s.meaningId === "bridge:1nt-opening");
    expect(opening).toBeDefined();
    const gteClause = opening!.clauses.find((c) => c.factId === "hand.hcp" && c.operator === FactOperator.Gte);
    expect(gteClause!.value).toBe(15);
    expect(opening!.teachingLabel.name).toBe("15 to 17");
  });

  it("produces derivedTeaching with surfaceGroups array", () => {
    const input = getBundleInput("bergen-bundle")!;
    const bundle = resolveBundle(input, SAYC_SYSTEM_CONFIG);
    expect(Array.isArray(bundle.derivedTeaching.surfaceGroups)).toBe(true);
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

  it("merges base modules into bergen spec (deduped)", () => {
    const input = getBundleInput("bergen-bundle")!;
    const spec = specFromBundle(input, SAYC_SYSTEM_CONFIG);
    expect(spec).toBeDefined();
    const moduleIds = spec!.modules.map((m) => m.moduleId);
    // Bergen's memberIds + base modules
    expect(moduleIds).toContain("bergen");
    expect(moduleIds).toContain("natural-bids");
    expect(moduleIds).toContain("stayman");
    expect(moduleIds).toContain("jacoby-transfers");
    expect(moduleIds).toContain("blackwood");
  });

  it("base-only modules appear exactly once in spec (via base modules)", () => {
    const input = getBundleInput("nt-bundle")!;
    const spec = specFromBundle(input, SAYC_SYSTEM_CONFIG);
    expect(spec).toBeDefined();
    const moduleIds = spec!.modules.map((m) => m.moduleId);
    // natural-bids is base-only — comes from base modules, not bundle memberIds
    const naturalCount = moduleIds.filter((id) => id === "natural-bids").length;
    expect(naturalCount).toBe(1);
  });
});

// ── Base module profiles ──────────────────────────────────────

describe("base module profiles", () => {
  const ALL_SYSTEM_IDS = [BASE_SYSTEM_SAYC, BASE_SYSTEM_TWO_OVER_ONE, BASE_SYSTEM_ACOL] as const;

  it.each(ALL_SYSTEM_IDS)("all base module IDs for %s resolve to registered modules", (systemId) => {
    const ids = getBaseModuleIds(systemId);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(getModule(id)).toBeDefined();
    }
  });

  it("SAYC base modules include natural-bids, stayman, jacoby-transfers, blackwood", () => {
    const ids = getBaseModuleIds(BASE_SYSTEM_SAYC);
    expect(ids).toEqual(["natural-bids", "stayman", "jacoby-transfers", "blackwood"]);
  });
});
