import { describe, it, expect } from "vitest";
import { detectUnsat } from "../deal-spec-unsat";
import { makeSpec } from "./witness-test-helpers";

// ─── Satisfiable specs return null ────────────────────────────
describe("detectUnsat - satisfiable specs", () => {
  it("returns null for an empty spec", () => {
    const result = detectUnsat(makeSpec());
    expect(result).toBeNull();
  });

  it("returns null for a valid HCP range (15-17)", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: "self",
          predicate: {
            conjunction: "all",
            clauses: [
              { factId: "hand.hcp", operator: "gte", value: 15 },
              { factId: "hand.hcp", operator: "lte", value: 17 },
            ],
          },
        },
      ],
    });
    expect(detectUnsat(spec)).toBeNull();
  });

  it("returns null for valid suit length range", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: "self",
          predicate: {
            conjunction: "all",
            clauses: [
              {
                factId: "hand.suitLength.spades",
                operator: "range",
                value: { min: 4, max: 8 },
              },
            ],
          },
        },
      ],
    });
    expect(detectUnsat(spec)).toBeNull();
  });

  it("returns null for balanced + valid HCP", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: "self",
          predicate: {
            conjunction: "all",
            clauses: [
              { factId: "hand.hcp", operator: "gte", value: 15 },
              { factId: "hand.hcp", operator: "lte", value: 17 },
              { factId: "hand.isBalanced", operator: "boolean", value: true },
            ],
          },
        },
      ],
    });
    expect(detectUnsat(spec)).toBeNull();
  });

  it("returns null for suit lengths that sum to exactly 13", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: "self",
          predicate: {
            conjunction: "all",
            clauses: [
              { factId: "hand.suitLength.spades", operator: "eq", value: 5 },
              { factId: "hand.suitLength.hearts", operator: "eq", value: 4 },
              { factId: "hand.suitLength.diamonds", operator: "eq", value: 3 },
              { factId: "hand.suitLength.clubs", operator: "eq", value: 1 },
            ],
          },
        },
      ],
    });
    expect(detectUnsat(spec)).toBeNull();
  });
});

// ─── Unsatisfiable specs return diagnostics ───────────────────
describe("detectUnsat - unsatisfiable specs", () => {
  it("detects HCP > 37 as impossible (max single hand HCP is 37)", () => {
    const spec = makeSpec({
      specId: "impossible-hcp",
      layers: [
        {
          kind: "seat",
          role: "self",
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: "gte", value: 38 }],
          },
        },
      ],
    });
    const result = detectUnsat(spec);
    expect(result).not.toBeNull();
    expect(result!.specId).toBe("impossible-hcp");
    expect(result!.unsatCore.length).toBeGreaterThan(0);
  });

  it("detects negative HCP as impossible", () => {
    const spec = makeSpec({
      specId: "negative-hcp",
      layers: [
        {
          kind: "seat",
          role: "self",
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: "lte", value: -1 }],
          },
        },
      ],
    });
    const result = detectUnsat(spec);
    expect(result).not.toBeNull();
    expect(result!.unsatCore.length).toBeGreaterThan(0);
  });

  it("detects inverted HCP range (min > max)", () => {
    const spec = makeSpec({
      specId: "inverted-hcp",
      layers: [
        {
          kind: "seat",
          role: "self",
          predicate: {
            conjunction: "all",
            clauses: [
              { factId: "hand.hcp", operator: "gte", value: 20 },
              { factId: "hand.hcp", operator: "lte", value: 10 },
            ],
          },
        },
      ],
    });
    const result = detectUnsat(spec);
    expect(result).not.toBeNull();
    expect(result!.unsatCore.length).toBeGreaterThan(0);
  });

  it("detects suit length > 13 as impossible", () => {
    const spec = makeSpec({
      specId: "impossible-suit-length",
      layers: [
        {
          kind: "seat",
          role: "self",
          predicate: {
            conjunction: "all",
            clauses: [
              { factId: "hand.suitLength.spades", operator: "gte", value: 14 },
            ],
          },
        },
      ],
    });
    const result = detectUnsat(spec);
    expect(result).not.toBeNull();
  });

  it("detects suit lengths summing to more than 13 as impossible", () => {
    const spec = makeSpec({
      specId: "suit-sum-over-13",
      layers: [
        {
          kind: "seat",
          role: "self",
          predicate: {
            conjunction: "all",
            clauses: [
              { factId: "hand.suitLength.spades", operator: "gte", value: 7 },
              { factId: "hand.suitLength.hearts", operator: "gte", value: 7 },
            ],
          },
        },
      ],
    });
    const result = detectUnsat(spec);
    expect(result).not.toBeNull();
    expect(result!.unsatCore.length).toBeGreaterThan(0);
  });

  it("detects inverted suit length range (min > max)", () => {
    const spec = makeSpec({
      specId: "inverted-suit-range",
      layers: [
        {
          kind: "seat",
          role: "self",
          predicate: {
            conjunction: "all",
            clauses: [
              {
                factId: "hand.suitLength.hearts",
                operator: "range",
                value: { min: 8, max: 3 },
              },
            ],
          },
        },
      ],
    });
    const result = detectUnsat(spec);
    expect(result).not.toBeNull();
  });

  it("detects combined HCP exceeding 40 across two seats", () => {
    const spec = makeSpec({
      specId: "combined-hcp-over-40",
      layers: [
        {
          kind: "seat",
          role: "self",
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: "gte", value: 25 }],
          },
        },
        {
          kind: "seat",
          role: "partner",
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: "gte", value: 20 }],
          },
        },
      ],
    });
    const result = detectUnsat(spec);
    expect(result).not.toBeNull();
    expect(result!.unsatCore.length).toBeGreaterThan(0);
  });

  it("provides nearestSatisfiable when relaxation is straightforward", () => {
    const spec = makeSpec({
      specId: "relaxable-hcp",
      layers: [
        {
          kind: "seat",
          role: "self",
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: "gte", value: 38 }],
          },
        },
      ],
    });
    const result = detectUnsat(spec);
    expect(result).not.toBeNull();
    if (result!.nearestSatisfiable) {
      expect(result!.nearestSatisfiable.relaxedConstraintId).toBeTruthy();
      expect(result!.nearestSatisfiable.delta).toBeTruthy();
    }
  });
});

// ─── Cross-seat validation ────────────────────────────────────
describe("detectUnsat - cross-seat checks", () => {
  it("returns null when four seats each require 10 HCP (total = 40, exactly satisfiable)", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: "self",
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: "gte", value: 10 }],
          },
        },
        {
          kind: "seat",
          role: "partner",
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: "gte", value: 10 }],
          },
        },
        {
          kind: "seat",
          role: "lho",
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: "gte", value: 10 }],
          },
        },
        {
          kind: "seat",
          role: "rho",
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: "gte", value: 10 }],
          },
        },
      ],
    });
    // 4 * 10 = 40, which exactly equals total deck HCP — satisfiable
    const result = detectUnsat(spec);
    expect(result).toBeNull();
  });

  it("detects when four seats minimum HCP exceeds 40", () => {
    const spec = makeSpec({
      specId: "four-seats-over-40",
      layers: [
        {
          kind: "seat",
          role: "self",
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: "gte", value: 11 }],
          },
        },
        {
          kind: "seat",
          role: "partner",
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: "gte", value: 11 }],
          },
        },
        {
          kind: "seat",
          role: "lho",
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: "gte", value: 11 }],
          },
        },
        {
          kind: "seat",
          role: "rho",
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: "gte", value: 11 }],
          },
        },
      ],
    });
    const result = detectUnsat(spec);
    expect(result).not.toBeNull();
    expect(result!.specId).toBe("four-seats-over-40");
  });
});

// ─── Non-seat layers are ignored for unsat ────────────────────
describe("detectUnsat - ignores non-seat layers", () => {
  it("ignores public-guard layers", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "public-guard",
          guard: { field: "force", operator: "eq", value: "forcing" },
        },
      ],
    });
    expect(detectUnsat(spec)).toBeNull();
  });

  it("ignores exclusion layers", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "exclusion",
          meaningIds: ["some:meaning"],
        },
      ],
    });
    expect(detectUnsat(spec)).toBeNull();
  });
});
