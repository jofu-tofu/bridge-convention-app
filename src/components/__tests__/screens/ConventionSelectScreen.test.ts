import { describe, it, expect, beforeEach } from "vitest";
import {
  clearRegistry,
  registerConvention,
  listConventions,
} from "../../../conventions/core/registry";
import { ntBundleConventionConfig } from "../../../conventions/definitions/nt-bundle/convention-config";
import { bergenBundleConventionConfig } from "../../../conventions/definitions/bergen-bundle/convention-config";

// ConventionSelectScreen uses getContext so we test via registry + filter logic
describe("ConventionSelectScreen", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(ntBundleConventionConfig);
    registerConvention(bergenBundleConventionConfig);
  });

  it("lists all registered conventions from registry", () => {
    const conventions = listConventions();
    expect(conventions).toHaveLength(2);
    expect(conventions.map((c) => c.id)).toContain("nt-bundle");
    expect(conventions.map((c) => c.id)).toContain("bergen-bundle");
  });

  it("each convention has name, description, and category", () => {
    const conventions = listConventions();
    for (const conv of conventions) {
      expect(conv.name).toBeTruthy();
      expect(conv.description).toBeTruthy();
      expect(conv.category).toBeTruthy();
    }
  });

  it("filterConventions filters by search query", async () => {
    const { filterConventions } =
      await import("../../../core/display/filter-conventions");
    const conventions = listConventions();
    const result = filterConventions(conventions, "1NT", null);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("nt-bundle");
  });

  it("filterConventions filters by category", async () => {
    const { filterConventions } =
      await import("../../../core/display/filter-conventions");
    const { ConventionCategory } = await import("../../../conventions/core");
    const conventions = listConventions();
    const result = filterConventions(
      conventions,
      "",
      ConventionCategory.Constructive,
    );
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.map((c) => c.id)).toContain("bergen-bundle");
  });

  it("shows empty state when no conventions match", async () => {
    const { filterConventions } =
      await import("../../../core/display/filter-conventions");
    const conventions = listConventions();
    const result = filterConventions(conventions, "nonexistent", null);
    expect(result).toHaveLength(0);
  });
});
