import { describe, it, expect } from "vitest";
import { getModule, getAllModules, getModules } from "../module-registry";

const KNOWN_IDS = [
  "stayman",
  "jacoby-transfers",
  "natural-bids",
  "smolen",
  "bergen",
  "dont",
  "weak-twos",
  "blackwood",
] as const;

describe("getModule", () => {
  it.each(KNOWN_IDS)("returns a module for '%s'", (id) => {
    const mod = getModule(id);
    expect(mod).toBeDefined();
    expect(mod!.moduleId).toBe(id);
  });

  it("returns undefined for an unknown ID", () => {
    expect(getModule("nonexistent")).toBeUndefined();
  });
});

describe("getAllModules", () => {
  it("returns exactly 8 modules", () => {
    expect(getAllModules()).toHaveLength(8);
  });

  it("contains all expected module IDs", () => {
    const ids = getAllModules().map((m) => m.moduleId);
    expect(ids).toEqual(expect.arrayContaining([...KNOWN_IDS]));
  });

  it("has no duplicate moduleIds", () => {
    const ids = getAllModules().map((m) => m.moduleId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getModules", () => {
  it("returns modules in the requested order", () => {
    const requested = ["dont", "stayman", "bergen"] as const;
    const result = getModules(requested);
    expect(result.map((m) => m.moduleId)).toEqual([...requested]);
  });

  it("returns an empty array for empty input", () => {
    expect(getModules([])).toEqual([]);
  });

  it("throws with a descriptive message for an unknown ID", () => {
    expect(() => getModules(["stayman", "fake-module"])).toThrowError(
      "Unknown module: fake-module",
    );
  });

  it("works with a subset of IDs", () => {
    const subset = ["natural-bids", "weak-twos"];
    const result = getModules(subset);
    expect(result).toHaveLength(2);
    expect(result[0]!.moduleId).toBe("natural-bids");
    expect(result[1]!.moduleId).toBe("weak-twos");
  });
});
