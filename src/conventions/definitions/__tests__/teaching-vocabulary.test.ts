import { describe, it, expect } from "vitest";
import { ALL_PEDAGOGICAL_TAGS } from "../teaching-vocabulary";

describe("pedagogical vocabulary", () => {
  it("has no duplicate tag IDs", () => {
    const ids = ALL_PEDAGOGICAL_TAGS.map((t) => t.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it("every tag has a valid derivation type", () => {
    for (const tag of ALL_PEDAGOGICAL_TAGS) {
      expect(["relation", "alternative-group", "surface-group"]).toContain(
        tag.derives.type,
      );
    }
  });

  it("contains 6 tags", () => {
    expect(ALL_PEDAGOGICAL_TAGS).toHaveLength(6);
  });
});
