import { describe, it, expect } from "vitest";
import { filterConventions } from "../filter-conventions";
import { ConventionCategory } from "../../../service";
import type { ConventionInfo } from "../../../service";

function makeConvention(
  overrides: Partial<ConventionInfo>,
): ConventionInfo {
  return {
    id: "test",
    name: "Test Convention",
    description: "A test convention for testing",
    category: ConventionCategory.Asking,
    ...overrides,
  };
}

const conventions: ConventionInfo[] = [
  makeConvention({
    id: "stayman",
    name: "Stayman",
    description: "Asking for 4-card major",
    category: ConventionCategory.Asking,
  }),
  makeConvention({
    id: "weak-twos",
    name: "Weak Twos",
    description: "Preemptive opening bids",
    category: ConventionCategory.Competitive,
  }),
  makeConvention({
    id: "bergen",
    name: "Bergen Raises",
    description: "Major suit raises",
    category: ConventionCategory.Constructive,
  }),
];

describe("filterConventions", () => {
  it("returns all conventions when query is empty and category is null", () => {
    const result = filterConventions(conventions, "", null);
    expect(result).toHaveLength(3);
  });

  it("filters by name substring, case-insensitive", () => {
    const result = filterConventions(conventions, "stay", null);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("stayman");
  });

  it("filters by description substring", () => {
    const result = filterConventions(conventions, "preemptive", null);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("weak-twos");
  });

  it("filters by category", () => {
    const result = filterConventions(
      conventions,
      "",
      ConventionCategory.Asking,
    );
    expect(result).toHaveLength(1);
    expect(result.map((c) => c.id)).toContain("stayman");
  });

  it("combines search query and category filter (AND logic)", () => {
    const result = filterConventions(
      conventions,
      "bergen",
      ConventionCategory.Constructive,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("bergen");
  });

  it("returns empty array when nothing matches", () => {
    const result = filterConventions(conventions, "xyz", null);
    expect(result).toHaveLength(0);
  });
});
