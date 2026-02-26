import { describe, it, expect, beforeEach } from "vitest";
import {
  clearRegistry,
  registerConvention,
  listConventions,
} from "../../../conventions/core/registry";
import { staymanConfig } from "../../../conventions/definitions/stayman";
import { gerberConfig } from "../../../conventions/definitions/gerber";
import { bergenConfig } from "../../../conventions/definitions/bergen-raises";
import { dontConfig } from "../../../conventions/definitions/dont";

// ConventionSelectScreen uses getContext so we test via registry + filter logic
describe("ConventionSelectScreen", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(staymanConfig);
    registerConvention(gerberConfig);
    registerConvention(bergenConfig);
    registerConvention(dontConfig);
  });

  it("lists all registered conventions from registry", () => {
    const conventions = listConventions();
    expect(conventions).toHaveLength(4);
    expect(conventions.map((c) => c.id)).toContain("stayman");
    expect(conventions.map((c) => c.id)).toContain("gerber");
    expect(conventions.map((c) => c.id)).toContain("bergen-raises");
    expect(conventions.map((c) => c.id)).toContain("dont");
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
      await import("../../../display/filter-conventions");
    const conventions = listConventions();
    const result = filterConventions(conventions, "stayman", null);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("stayman");
  });

  it("filterConventions filters by category", async () => {
    const { filterConventions } =
      await import("../../../display/filter-conventions");
    const { ConventionCategory } = await import("../../../conventions/core/types");
    const conventions = listConventions();
    const result = filterConventions(
      conventions,
      "",
      ConventionCategory.Defensive,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("dont");
  });

  it("shows empty state when no conventions match", async () => {
    const { filterConventions } =
      await import("../../../display/filter-conventions");
    const conventions = listConventions();
    const result = filterConventions(conventions, "nonexistent", null);
    expect(result).toHaveLength(0);
  });
});
