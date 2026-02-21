import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/svelte";
import { clearRegistry, registerConvention, listConventions } from "../../conventions/registry";
import { staymanConfig } from "../../conventions/stayman";
import { gerberConfig } from "../../conventions/gerber";
import { bergenConfig } from "../../conventions/bergen-raises";
import { dontConfig } from "../../conventions/dont";

// ConventionSelect uses getContext so we need a wrapper
// For now, test the rendering logic via the registry directly
describe("ConventionSelect", () => {
  beforeEach(() => {
    clearRegistry();
  });

  it("lists all registered conventions from registry", () => {
    registerConvention(staymanConfig);
    registerConvention(gerberConfig);
    registerConvention(bergenConfig);
    registerConvention(dontConfig);

    // Verify the registry has all 4 conventions
    const conventions = listConventions();
    expect(conventions).toHaveLength(4);
    expect(conventions.map((c) => c.id)).toContain("stayman");
    expect(conventions.map((c) => c.id)).toContain("gerber");
    expect(conventions.map((c) => c.id)).toContain("bergen-raises");
    expect(conventions.map((c) => c.id)).toContain("dont");
  });

  it("each convention has name, description, and category", () => {
    registerConvention(staymanConfig);
    const conventions = listConventions();
    for (const conv of conventions) {
      expect(conv.name).toBeTruthy();
      expect(conv.description).toBeTruthy();
      expect(conv.category).toBeTruthy();
    }
  });
});
