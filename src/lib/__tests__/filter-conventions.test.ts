import { describe, it, expect } from "vitest";
import { filterConventions } from "../filter-conventions";
import { ConventionCategory } from "../../conventions/types";
import type { ConventionConfig } from "../../conventions/types";

function makeConvention(overrides: Partial<ConventionConfig>): ConventionConfig {
  return {
    id: "test",
    name: "Test Convention",
    description: "A test convention for testing",
    category: ConventionCategory.Asking,
    dealConstraints: { seats: [] },
    biddingRules: [],
    examples: [],
    ...overrides,
  };
}

const conventions: ConventionConfig[] = [
  makeConvention({ id: "stayman", name: "Stayman", description: "Asking for 4-card major", category: ConventionCategory.Asking }),
  makeConvention({ id: "gerber", name: "Gerber", description: "Ace asking convention", category: ConventionCategory.Asking }),
  makeConvention({ id: "dont", name: "DONT", description: "Disturb opponents notrump", category: ConventionCategory.Defensive }),
  makeConvention({ id: "bergen", name: "Bergen Raises", description: "Major suit raises", category: ConventionCategory.Constructive }),
];

describe("filterConventions", () => {
  it("returns all conventions when query is empty and category is null", () => {
    const result = filterConventions(conventions, "", null);
    expect(result).toHaveLength(4);
  });

  it("filters by name substring, case-insensitive", () => {
    const result = filterConventions(conventions, "stay", null);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("stayman");
  });

  it("filters by description substring", () => {
    const result = filterConventions(conventions, "notrump", null);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("dont");
  });

  it("filters by category", () => {
    const result = filterConventions(conventions, "", ConventionCategory.Asking);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toContain("stayman");
    expect(result.map((c) => c.id)).toContain("gerber");
  });

  it("combines search query and category filter (AND logic)", () => {
    const result = filterConventions(conventions, "gerber", ConventionCategory.Asking);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("gerber");
  });

  it("returns empty array when nothing matches", () => {
    const result = filterConventions(conventions, "xyz", null);
    expect(result).toHaveLength(0);
  });
});
