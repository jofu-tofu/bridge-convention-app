import { describe, it, expect } from "vitest";
import {
  compareByCanons,
  CANON_DIMENSIONAL_COUNT,
  CANON_DIMENSION_PRIORITY,
} from "../specificity-canons";
import type { ConstraintDimension } from "../meaning";

// ─── Helpers ────────────────────────────────────────────────

function dims(...dimensions: ConstraintDimension[]): ReadonlySet<ConstraintDimension> {
  return new Set(dimensions);
}

// ─── Tests ──────────────────────────────────────────────────

describe("compareByCanons", () => {
  it("Canon 1: more dimensions wins (3 dims beats 2 dims)", () => {
    // {pointRange, suitIdentity, suitLength} vs {suitIdentity, suitLength}
    const setA = dims("pointRange", "suitIdentity", "suitLength");
    const setB = dims("suitIdentity", "suitLength");

    const result = compareByCanons(setA, setB);
    expect(result.result).toBeLessThan(0); // A wins (more specific)
    expect(result.canonUsed).toBe(CANON_DIMENSIONAL_COUNT);
  });

  it("Canon 2: suitRelation beats shapeClass at equal count", () => {
    // {suitRelation, suitLength} vs {shapeClass, suitLength}
    const setA = dims("suitRelation", "suitLength");
    const setB = dims("shapeClass", "suitLength");

    const result = compareByCanons(setA, setB);
    expect(result.result).toBeLessThan(0); // A wins (suitRelation > shapeClass)
    expect(result.canonUsed).toBe(CANON_DIMENSION_PRIORITY);
  });

  it("Canon 2: pointRange beats suitLength at equal count", () => {
    // {pointRange, suitIdentity} vs {suitLength, suitIdentity}
    const setA = dims("pointRange", "suitIdentity");
    const setB = dims("suitLength", "suitIdentity");

    const result = compareByCanons(setA, setB);
    expect(result.result).toBeLessThan(0); // A wins (pointRange > suitLength)
    expect(result.canonUsed).toBe(CANON_DIMENSION_PRIORITY);
  });

  it("returns 0 with null canon for identical dimension sets", () => {
    // {pointRange, suitIdentity} vs {pointRange, suitIdentity}
    const setA = dims("pointRange", "suitIdentity");
    const setB = dims("pointRange", "suitIdentity");

    const result = compareByCanons(setA, setB);
    expect(result.result).toBe(0);
    expect(result.canonUsed).toBeNull();
  });

  it("returns 0 with null canon for same-count same-priority dimensions", () => {
    // {pointRange, shapeClass} vs {pointRange, shapeClass}
    const setA = dims("pointRange", "shapeClass");
    const setB = dims("pointRange", "shapeClass");

    const result = compareByCanons(setA, setB);
    expect(result.result).toBe(0);
    expect(result.canonUsed).toBeNull();
  });
});
