import { describe, it, expect } from "vitest";
import {
  getSystem,
  listSystems,
  aggregateModuleContent,
  bundleFromSystem,
  ntSystem,
  bergenSystem,
  dontSystem,
  weakTwosSystem,
} from "../system-registry";
import { getModules } from "../module-registry";

const ALL_IDS = ["nt-bundle", "bergen-bundle", "dont-bundle", "weak-twos-bundle"] as const;

describe("getSystem", () => {
  it.each(ALL_IDS)("returns a system for %s", (id) => {
    const sys = getSystem(id);
    expect(sys).toBeDefined();
    expect(sys!.id).toBe(id);
  });

  it("returns undefined for unknown ID", () => {
    expect(getSystem("nonexistent")).toBeUndefined();
  });
});

describe("listSystems", () => {
  const systems = listSystems();

  it("returns exactly 4 systems", () => {
    expect(systems).toHaveLength(4);
  });

  it("contains all expected IDs", () => {
    const ids = systems.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining([...ALL_IDS]));
  });

  it("has stable order", () => {
    const ids = systems.map((s) => s.id);
    expect(ids).toEqual(["nt-bundle", "bergen-bundle", "dont-bundle", "weak-twos-bundle"]);
  });
});

describe("aggregateModuleContent", () => {
  it.each([
    ["ntSystem", ntSystem],
    ["bergenSystem", bergenSystem],
    ["dontSystem", dontSystem],
    ["weakTwosSystem", weakTwosSystem],
  ] as const)("%s produces non-empty explanationCatalog", (_label, system) => {
    const content = aggregateModuleContent(system);
    expect(content.explanationCatalog.entries.length).toBeGreaterThan(0);
  });

  it.each([
    ["ntSystem", ntSystem],
    ["bergenSystem", bergenSystem],
    ["dontSystem", dontSystem],
    ["weakTwosSystem", weakTwosSystem],
  ] as const)("%s returns arrays for all fields", (_label, system) => {
    const content = aggregateModuleContent(system);
    expect(Array.isArray(content.pedagogicalRelations)).toBe(true);
    expect(Array.isArray(content.acceptableAlternatives)).toBe(true);
    expect(Array.isArray(content.intentFamilies)).toBe(true);
    expect(content.explanationCatalog).toBeDefined();
  });

  it("ntSystem includes cross-module pedagogical relations", () => {
    const content = aggregateModuleContent(ntSystem);
    const moduleRelations = getModules(ntSystem.moduleIds).flatMap((m) => m.pedagogicalRelations);
    expect(content.pedagogicalRelations.length).toBeGreaterThan(moduleRelations.length);
  });

  it("bergenSystem alternatives match module alternatives", () => {
    const content = aggregateModuleContent(bergenSystem);
    const moduleAlts = getModules(bergenSystem.moduleIds).flatMap((m) => m.alternatives);
    expect(content.acceptableAlternatives).toEqual(moduleAlts);
  });
});

describe("bundleFromSystem", () => {
  it("maps system.id to bundle.id", () => {
    const bundle = bundleFromSystem(ntSystem);
    expect(bundle.id).toBe(ntSystem.id);
  });

  it("maps system.moduleIds to bundle.memberIds", () => {
    const bundle = bundleFromSystem(bergenSystem);
    expect(bundle.memberIds).toEqual(bergenSystem.moduleIds);
  });

  it("maps system.profile to bundle.systemProfile", () => {
    const bundle = bundleFromSystem(dontSystem);
    expect(bundle.systemProfile).toBe(dontSystem.profile);
  });

  it("ntSystem bundle declares opening.1nt capability", () => {
    const bundle = bundleFromSystem(ntSystem);
    expect(bundle.declaredCapabilities).toHaveProperty("opening.1nt");
  });

  it("bundle includes aggregated content fields", () => {
    const bundle = bundleFromSystem(weakTwosSystem);
    expect(bundle.explanationCatalog).toBeDefined();
    expect(Array.isArray(bundle.pedagogicalRelations)).toBe(true);
    expect(Array.isArray(bundle.acceptableAlternatives)).toBe(true);
    expect(Array.isArray(bundle.intentFamilies)).toBe(true);
  });
});
