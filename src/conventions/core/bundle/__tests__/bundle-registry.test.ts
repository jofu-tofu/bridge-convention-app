import { describe, it, expect, beforeEach } from "vitest";
import {
  registerBundle,
  getBundle,
  listBundles,
  findBundleForConvention,
  clearBundleRegistry,
} from "../bundle-registry";
import type { ConventionBundle } from "../bundle-types";
import { ConventionCategory } from "../../../../core/contracts/convention";

function makeBundle(id: string, memberIds: string[] = []): ConventionBundle {
  return {
    id,
    name: `Bundle ${id}`,
    category: ConventionCategory.Constructive,
    description: "test",
    memberIds,
    dealConstraints: { seats: [] },
    derivedTeaching: { acceptableAlternatives: [], surfaceGroups: [], relations: [] },
  };
}

describe("bundle-registry", () => {
  beforeEach(() => {
    clearBundleRegistry();
  });

  it("registerBundle stores and retrieves bundles", () => {
    const bundle = makeBundle("test-bundle", ["conv-a", "conv-b"]);
    registerBundle(bundle);
    expect(getBundle("test-bundle")).toBe(bundle);
  });

  it("registerBundle throws on duplicate ID", () => {
    const bundle = makeBundle("dup-bundle");
    registerBundle(bundle);
    expect(() => registerBundle(bundle)).toThrow('Bundle "dup-bundle" is already registered.');
  });

  it("getBundle returns undefined for unknown ID", () => {
    expect(getBundle("nonexistent")).toBeUndefined();
  });

  it("listBundles returns all registered bundles", () => {
    const b1 = makeBundle("b1");
    const b2 = makeBundle("b2");
    registerBundle(b1);
    registerBundle(b2);
    const all = listBundles();
    expect(all).toHaveLength(2);
    expect(all).toContain(b1);
    expect(all).toContain(b2);
  });

  it("findBundleForConvention finds the right bundle", () => {
    const bundle = makeBundle("my-bundle", ["conv-x", "conv-y"]);
    registerBundle(bundle);
    expect(findBundleForConvention("conv-x")).toBe(bundle);
    expect(findBundleForConvention("conv-y")).toBe(bundle);
  });

  it("findBundleForConvention returns undefined for unregistered convention", () => {
    const bundle = makeBundle("my-bundle", ["conv-x"]);
    registerBundle(bundle);
    expect(findBundleForConvention("unknown-conv")).toBeUndefined();
  });

  it("clearBundleRegistry empties the registry", () => {
    registerBundle(makeBundle("b1"));
    registerBundle(makeBundle("b2"));
    expect(listBundles()).toHaveLength(2);
    clearBundleRegistry();
    expect(listBundles()).toHaveLength(0);
    expect(getBundle("b1")).toBeUndefined();
  });
});
