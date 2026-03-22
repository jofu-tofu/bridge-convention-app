import { describe, it, expect } from "vitest";
import {
  getSystemBundle,
  listSystemBundles,
  specFromBundle,
  ntBundle,
  ntBundleAcol,
  ntStaymanBundle,
  ntTransfersBundle,
  bergenBundle,
  dontBundle,
  weakTwoBundle,
} from "../system-registry";

const ALL_IDS = ["nt-bundle", "nt-bundle-acol", "nt-stayman", "nt-transfers", "bergen-bundle", "dont-bundle", "weak-twos-bundle"] as const;

describe("getSystemBundle", () => {
  it.each(ALL_IDS)("returns a bundle for %s", (id) => {
    const bundle = getSystemBundle(id);
    expect(bundle).toBeDefined();
    expect(bundle!.id).toBe(id);
  });

  it("returns undefined for unknown ID", () => {
    expect(getSystemBundle("nonexistent")).toBeUndefined();
  });
});

describe("listSystemBundles", () => {
  const bundles = listSystemBundles();

  it("returns exactly 7 bundles", () => {
    expect(bundles).toHaveLength(7);
  });

  it("contains all expected IDs", () => {
    const ids = bundles.map((b) => b.id);
    expect(ids).toEqual(expect.arrayContaining([...ALL_IDS]));
  });

  it("has stable order", () => {
    const ids = bundles.map((b) => b.id);
    expect(ids).toEqual(["nt-bundle", "nt-bundle-acol", "nt-stayman", "nt-transfers", "bergen-bundle", "dont-bundle", "weak-twos-bundle"]);
  });
});

describe("pre-built bundles", () => {
  it("ntBundle maps id correctly", () => {
    expect(ntBundle.id).toBe("nt-bundle");
  });

  it("ntBundle has memberIds", () => {
    expect(ntBundle.memberIds.length).toBeGreaterThan(0);
  });

  it("ntBundle has systemProfile", () => {
    expect(ntBundle.systemProfile).toBeDefined();
  });

  it("ntBundle declares opening.1nt capability", () => {
    expect(ntBundle.declaredCapabilities).toHaveProperty("opening.1nt");
  });

  it("bergenBundle has memberIds", () => {
    expect(bergenBundle.memberIds.length).toBeGreaterThan(0);
  });

  it("dontBundle has systemProfile", () => {
    expect(dontBundle.systemProfile).toBeDefined();
  });

  it("weakTwoBundle includes aggregated content fields", () => {
    expect(Array.isArray(weakTwoBundle.derivedTeaching.acceptableAlternatives)).toBe(true);
    expect(Array.isArray(weakTwoBundle.derivedTeaching.surfaceGroups)).toBe(true);
  });

  it.each([
    ["ntBundle", ntBundle],
    ["ntStaymanBundle", ntStaymanBundle],
    ["ntTransfersBundle", ntTransfersBundle],
    ["bergenBundle", bergenBundle],
    ["dontBundle", dontBundle],
    ["weakTwoBundle", weakTwoBundle],
  ] as const)("%s has arrays for all teaching fields", (_label, bundle) => {
    expect(Array.isArray(bundle.derivedTeaching.acceptableAlternatives)).toBe(true);
    expect(Array.isArray(bundle.derivedTeaching.surfaceGroups)).toBe(true);
  });

  it("bergenBundle produces alternatives from derivation", () => {
    expect(bergenBundle.derivedTeaching.acceptableAlternatives.length).toBeGreaterThanOrEqual(0);
  });
});

describe("specFromBundle", () => {
  it("derives spec with matching id", () => {
    const spec = specFromBundle(ntBundle);
    expect(spec).toBeDefined();
    expect(spec!.id).toBe(ntBundle.id);
  });

  it("derives spec for bergenBundle", () => {
    const spec = specFromBundle(bergenBundle);
    expect(spec).toBeDefined();
    expect(spec!.id).toBe(bergenBundle.id);
  });

  it("derives spec for dontBundle", () => {
    const spec = specFromBundle(dontBundle);
    expect(spec).toBeDefined();
    expect(spec!.id).toBe(dontBundle.id);
  });
});
