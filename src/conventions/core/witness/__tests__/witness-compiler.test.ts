import { describe, it, expect } from "vitest";
import { Seat, Suit, Vulnerability } from "../../../../engine/types";
import type { SeatRole } from "../../../../core/contracts/witness-spec";
import { compileWitnessSpec } from "../witness-compiler";
import { makeSpec } from "./witness-test-helpers";

// ─── Basic constraint compilation ─────────────────────────────
describe("compileWitnessSpec", () => {
  it("returns empty seat constraints for a spec with no layers", () => {
    const result = compileWitnessSpec(makeSpec(), Seat.South);
    expect(result.seats).toEqual([]);
  });

  it("compiles HCP range clause to minHcp/maxHcp on the correct seat", () => {
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

    const result = compileWitnessSpec(spec, Seat.South);
    expect(result.seats).toHaveLength(1);
    expect(result.seats[0]!.seat).toBe(Seat.South);
    expect(result.seats[0]!.minHcp).toBe(15);
    expect(result.seats[0]!.maxHcp).toBe(17);
  });

  it("compiles HCP range operator to minHcp and maxHcp", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: "self",
          predicate: {
            conjunction: "all",
            clauses: [
              {
                factId: "hand.hcp",
                operator: "range",
                value: { min: 12, max: 14 },
              },
            ],
          },
        },
      ],
    });

    const result = compileWitnessSpec(spec, Seat.South);
    expect(result.seats[0]!.minHcp).toBe(12);
    expect(result.seats[0]!.maxHcp).toBe(14);
  });

  it("compiles suit length gte clause to minLength", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: "self",
          predicate: {
            conjunction: "all",
            clauses: [
              { factId: "hand.suitLength.spades", operator: "gte", value: 5 },
            ],
          },
        },
      ],
    });

    const result = compileWitnessSpec(spec, Seat.South);
    expect(result.seats[0]!.minLength).toEqual({ [Suit.Spades]: 5 });
  });

  it("compiles suit length lte clause to maxLength", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: "self",
          predicate: {
            conjunction: "all",
            clauses: [
              { factId: "hand.suitLength.hearts", operator: "lte", value: 3 },
            ],
          },
        },
      ],
    });

    const result = compileWitnessSpec(spec, Seat.South);
    expect(result.seats[0]!.maxLength).toEqual({ [Suit.Hearts]: 3 });
  });

  it("compiles balanced boolean clause", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: "self",
          predicate: {
            conjunction: "all",
            clauses: [
              { factId: "hand.isBalanced", operator: "boolean", value: true },
            ],
          },
        },
      ],
    });

    const result = compileWitnessSpec(spec, Seat.South);
    expect(result.seats[0]!.balanced).toBe(true);
  });

  it("compiles unbalanced boolean clause", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: "self",
          predicate: {
            conjunction: "all",
            clauses: [
              { factId: "hand.isBalanced", operator: "boolean", value: false },
            ],
          },
        },
      ],
    });

    const result = compileWitnessSpec(spec, Seat.South);
    expect(result.seats[0]!.balanced).toBe(false);
  });

  it("compiles suit length range clause to both minLength and maxLength", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: "self",
          predicate: {
            conjunction: "all",
            clauses: [
              {
                factId: "hand.suitLength.diamonds",
                operator: "range",
                value: { min: 4, max: 6 },
              },
            ],
          },
        },
      ],
    });

    const result = compileWitnessSpec(spec, Seat.South);
    expect(result.seats[0]!.minLength).toEqual({ [Suit.Diamonds]: 4 });
    expect(result.seats[0]!.maxLength).toEqual({ [Suit.Diamonds]: 6 });
  });

  it("merges multiple clauses for the same seat into one SeatConstraint", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: "self",
          predicate: {
            conjunction: "all",
            clauses: [
              { factId: "hand.hcp", operator: "gte", value: 15 },
              { factId: "hand.suitLength.spades", operator: "gte", value: 5 },
              { factId: "hand.isBalanced", operator: "boolean", value: false },
            ],
          },
        },
      ],
    });

    const result = compileWitnessSpec(spec, Seat.South);
    expect(result.seats).toHaveLength(1);
    expect(result.seats[0]!.minHcp).toBe(15);
    expect(result.seats[0]!.minLength).toEqual({ [Suit.Spades]: 5 });
    expect(result.seats[0]!.balanced).toBe(false);
  });

  it("compiles multiple seat layers for different roles", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: "self",
          predicate: {
            conjunction: "all",
            clauses: [
              { factId: "hand.hcp", operator: "gte", value: 15 },
            ],
          },
        },
        {
          kind: "seat",
          role: "partner",
          predicate: {
            conjunction: "all",
            clauses: [
              { factId: "hand.hcp", operator: "gte", value: 8 },
            ],
          },
        },
      ],
    });

    const result = compileWitnessSpec(spec, Seat.South);
    expect(result.seats).toHaveLength(2);

    const selfSeat = result.seats.find((s) => s.seat === Seat.South);
    const partnerSeat = result.seats.find((s) => s.seat === Seat.North);
    expect(selfSeat!.minHcp).toBe(15);
    expect(partnerSeat!.minHcp).toBe(8);
  });

  it("passes through maxAttempts from spec", () => {
    const spec = makeSpec({ maxAttempts: 5000 });
    const result = compileWitnessSpec(spec, Seat.South);
    expect(result.maxAttempts).toBe(5000);
  });

  it("compiles any-conjunction to minLengthAny", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: "self",
          predicate: {
            conjunction: "any",
            clauses: [
              { factId: "hand.suitLength.hearts", operator: "gte", value: 5 },
              { factId: "hand.suitLength.spades", operator: "gte", value: 5 },
            ],
          },
        },
      ],
    });

    const result = compileWitnessSpec(spec, Seat.South);
    expect(result.seats[0]!.minLengthAny).toEqual({
      [Suit.Hearts]: 5,
      [Suit.Spades]: 5,
    });
  });

  // ─── Setup fields ──────────────────────────────────────────
  it("maps setup.vulnerability to DealConstraints.vulnerability", () => {
    const spec = makeSpec({
      setup: { vulnerability: "ns" },
    });
    const result = compileWitnessSpec(spec, Seat.South);
    expect(result.vulnerability).toBe(Vulnerability.NorthSouth);
  });

  it("maps setup.dealerRole to DealConstraints.dealer using role resolution", () => {
    const spec = makeSpec({
      setup: { dealerRole: "partner" },
    });
    const result = compileWitnessSpec(spec, Seat.South);
    expect(result.dealer).toBe(Seat.North);
  });

  // ─── Ignores non-seat layers gracefully ────────────────────
  it("skips public-guard layers (not compilable to DealConstraints)", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "public-guard",
          guard: { field: "force", operator: "eq", value: "forcing" },
        },
      ],
    });
    const result = compileWitnessSpec(spec, Seat.South);
    expect(result.seats).toEqual([]);
  });

  it("skips exclusion layers (not compilable to DealConstraints)", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "exclusion",
          meaningIds: ["stayman:ask-major"],
        },
      ],
    });
    const result = compileWitnessSpec(spec, Seat.South);
    expect(result.seats).toEqual([]);
  });

  it("skips joint layers (not directly compilable without customCheck)", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "joint",
          roles: ["self", "partner"] as [SeatRole, SeatRole],
          predicate: {
            kind: "combined-hcp",
            params: { min: 25, max: 30 },
          },
        },
      ],
    });
    const result = compileWitnessSpec(spec, Seat.South);
    // Joint constraints are not represented in DealConstraints directly
    expect(result.seats).toEqual([]);
  });
});

// ─── Role rotation ────────────────────────────────────────────
describe("compileWitnessSpec role rotation", () => {
  it("maps self to South when userSeat is South", () => {
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
      ],
    });
    const result = compileWitnessSpec(spec, Seat.South);
    expect(result.seats[0]!.seat).toBe(Seat.South);
  });

  it("maps partner to North when userSeat is South", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: "partner",
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: "gte", value: 10 }],
          },
        },
      ],
    });
    const result = compileWitnessSpec(spec, Seat.South);
    expect(result.seats[0]!.seat).toBe(Seat.North);
  });

  it("maps lho to West when userSeat is South", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: "lho",
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: "lte", value: 10 }],
          },
        },
      ],
    });
    const result = compileWitnessSpec(spec, Seat.South);
    expect(result.seats[0]!.seat).toBe(Seat.West);
  });

  it("maps rho to East when userSeat is South", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: "rho",
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: "lte", value: 10 }],
          },
        },
      ],
    });
    const result = compileWitnessSpec(spec, Seat.South);
    expect(result.seats[0]!.seat).toBe(Seat.East);
  });

  it("rotates correctly when userSeat is North", () => {
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
            clauses: [{ factId: "hand.hcp", operator: "gte", value: 8 }],
          },
        },
        {
          kind: "seat",
          role: "lho",
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: "lte", value: 12 }],
          },
        },
        {
          kind: "seat",
          role: "rho",
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: "lte", value: 14 }],
          },
        },
      ],
    });

    const result = compileWitnessSpec(spec, Seat.North);
    const bySeat = (s: Seat) => result.seats.find((c) => c.seat === s);

    expect(bySeat(Seat.North)!.minHcp).toBe(10); // self -> North
    expect(bySeat(Seat.South)!.minHcp).toBe(8); // partner -> South
    expect(bySeat(Seat.East)!.maxHcp).toBe(12); // lho -> East
    expect(bySeat(Seat.West)!.maxHcp).toBe(14); // rho -> West
  });

  it("rotates correctly when userSeat is East", () => {
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
            clauses: [{ factId: "hand.hcp", operator: "gte", value: 8 }],
          },
        },
      ],
    });

    const result = compileWitnessSpec(spec, Seat.East);
    const bySeat = (s: Seat) => result.seats.find((c) => c.seat === s);

    expect(bySeat(Seat.East)!.minHcp).toBe(10); // self -> East
    expect(bySeat(Seat.West)!.minHcp).toBe(8); // partner -> West
  });

  it("maps openingSide to self (user side) for deal generation", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: "openingSide",
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: "gte", value: 12 }],
          },
        },
      ],
    });

    const result = compileWitnessSpec(spec, Seat.South);
    // openingSide maps to the user seat for constraint purposes
    expect(result.seats[0]!.seat).toBe(Seat.South);
  });
});

// ─── Pedagogical controls passthrough ─────────────────────────
describe("compileWitnessSpec pedagogical controls", () => {
  it("returns pedagogicalControls as metadata on the result", () => {
    const spec = makeSpec({
      pedagogicalControls: {
        maxLiveAlternatives: 3,
        ambiguityPreference: "prefer-low",
      },
    });

    const result = compileWitnessSpec(spec, Seat.South);
    // pedagogicalControls are passed through as metadata, not enforced in DealConstraints
    expect(result.pedagogicalControls).toEqual({
      maxLiveAlternatives: 3,
      ambiguityPreference: "prefer-low",
    });
  });
});

// ─── HCP eq operator ──────────────────────────────────────────
describe("compileWitnessSpec eq operator", () => {
  it("compiles HCP eq to both minHcp and maxHcp", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: "self",
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: "eq", value: 15 }],
          },
        },
      ],
    });

    const result = compileWitnessSpec(spec, Seat.South);
    expect(result.seats[0]!.minHcp).toBe(15);
    expect(result.seats[0]!.maxHcp).toBe(15);
  });

  it("compiles suit length eq to both minLength and maxLength", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: "self",
          predicate: {
            conjunction: "all",
            clauses: [
              { factId: "hand.suitLength.clubs", operator: "eq", value: 4 },
            ],
          },
        },
      ],
    });

    const result = compileWitnessSpec(spec, Seat.South);
    expect(result.seats[0]!.minLength).toEqual({ [Suit.Clubs]: 4 });
    expect(result.seats[0]!.maxLength).toEqual({ [Suit.Clubs]: 4 });
  });
});
