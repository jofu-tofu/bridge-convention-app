import { describe, it, expect } from "vitest";
import { Seat, Suit, Vulnerability } from "../../../../engine/types";
import { SeatRole } from "../../deal-spec-types";
import { compileDealSpec } from "../deal-spec-compiler";
import { makeSpec } from "./witness-test-helpers";
import { FactOperator } from "../../../pipeline/evaluation/meaning";

// ─── Basic constraint compilation ─────────────────────────────
describe("compileDealSpec", () => {
  it("returns empty seat constraints for a spec with no layers", () => {
    const result = compileDealSpec(makeSpec(), Seat.South);
    expect(result.seats).toEqual([]);
  });

  it("compiles HCP range clause to minHcp/maxHcp on the correct seat", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: SeatRole.Self,
          predicate: {
            conjunction: "all",
            clauses: [
              { factId: "hand.hcp", operator: FactOperator.Gte, value: 15 },
              { factId: "hand.hcp", operator: FactOperator.Lte, value: 17 },
            ],
          },
        },
      ],
    });

    const result = compileDealSpec(spec, Seat.South);
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
          role: SeatRole.Self,
          predicate: {
            conjunction: "all",
            clauses: [
              {
                factId: "hand.hcp",
                operator: FactOperator.Range,
                value: { min: 12, max: 14 },
              },
            ],
          },
        },
      ],
    });

    const result = compileDealSpec(spec, Seat.South);
    expect(result.seats[0]!.minHcp).toBe(12);
    expect(result.seats[0]!.maxHcp).toBe(14);
  });

  it("compiles suit length gte clause to minLength", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: SeatRole.Self,
          predicate: {
            conjunction: "all",
            clauses: [
              { factId: "hand.suitLength.spades", operator: FactOperator.Gte, value: 5 },
            ],
          },
        },
      ],
    });

    const result = compileDealSpec(spec, Seat.South);
    expect(result.seats[0]!.minLength).toEqual({ [Suit.Spades]: 5 });
  });

  it("compiles suit length lte clause to maxLength", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: SeatRole.Self,
          predicate: {
            conjunction: "all",
            clauses: [
              { factId: "hand.suitLength.hearts", operator: FactOperator.Lte, value: 3 },
            ],
          },
        },
      ],
    });

    const result = compileDealSpec(spec, Seat.South);
    expect(result.seats[0]!.maxLength).toEqual({ [Suit.Hearts]: 3 });
  });

  it("compiles balanced boolean clause", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: SeatRole.Self,
          predicate: {
            conjunction: "all",
            clauses: [
              { factId: "hand.isBalanced", operator: FactOperator.Boolean, value: true },
            ],
          },
        },
      ],
    });

    const result = compileDealSpec(spec, Seat.South);
    expect(result.seats[0]!.balanced).toBe(true);
  });

  it("compiles unbalanced boolean clause", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: SeatRole.Self,
          predicate: {
            conjunction: "all",
            clauses: [
              { factId: "hand.isBalanced", operator: FactOperator.Boolean, value: false },
            ],
          },
        },
      ],
    });

    const result = compileDealSpec(spec, Seat.South);
    expect(result.seats[0]!.balanced).toBe(false);
  });

  it("compiles suit length range clause to both minLength and maxLength", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: SeatRole.Self,
          predicate: {
            conjunction: "all",
            clauses: [
              {
                factId: "hand.suitLength.diamonds",
                operator: FactOperator.Range,
                value: { min: 4, max: 6 },
              },
            ],
          },
        },
      ],
    });

    const result = compileDealSpec(spec, Seat.South);
    expect(result.seats[0]!.minLength).toEqual({ [Suit.Diamonds]: 4 });
    expect(result.seats[0]!.maxLength).toEqual({ [Suit.Diamonds]: 6 });
  });

  it("merges multiple clauses for the same seat into one SeatConstraint", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: SeatRole.Self,
          predicate: {
            conjunction: "all",
            clauses: [
              { factId: "hand.hcp", operator: FactOperator.Gte, value: 15 },
              { factId: "hand.suitLength.spades", operator: FactOperator.Gte, value: 5 },
              { factId: "hand.isBalanced", operator: FactOperator.Boolean, value: false },
            ],
          },
        },
      ],
    });

    const result = compileDealSpec(spec, Seat.South);
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
          role: SeatRole.Self,
          predicate: {
            conjunction: "all",
            clauses: [
              { factId: "hand.hcp", operator: FactOperator.Gte, value: 15 },
            ],
          },
        },
        {
          kind: "seat",
          role: SeatRole.Partner,
          predicate: {
            conjunction: "all",
            clauses: [
              { factId: "hand.hcp", operator: FactOperator.Gte, value: 8 },
            ],
          },
        },
      ],
    });

    const result = compileDealSpec(spec, Seat.South);
    expect(result.seats).toHaveLength(2);

    const selfSeat = result.seats.find((s) => s.seat === Seat.South);
    const partnerSeat = result.seats.find((s) => s.seat === Seat.North);
    expect(selfSeat!.minHcp).toBe(15);
    expect(partnerSeat!.minHcp).toBe(8);
  });

  it("passes through maxAttempts from spec", () => {
    const spec = makeSpec({ maxAttempts: 5000 });
    const result = compileDealSpec(spec, Seat.South);
    expect(result.maxAttempts).toBe(5000);
  });

  it("compiles any-conjunction to minLengthAny", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: SeatRole.Self,
          predicate: {
            conjunction: "any",
            clauses: [
              { factId: "hand.suitLength.hearts", operator: FactOperator.Gte, value: 5 },
              { factId: "hand.suitLength.spades", operator: FactOperator.Gte, value: 5 },
            ],
          },
        },
      ],
    });

    const result = compileDealSpec(spec, Seat.South);
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
    const result = compileDealSpec(spec, Seat.South);
    expect(result.vulnerability).toBe(Vulnerability.NorthSouth);
  });

  it("maps setup.dealerRole to DealConstraints.dealer using role resolution", () => {
    const spec = makeSpec({
      setup: { dealerRole: SeatRole.Partner },
    });
    const result = compileDealSpec(spec, Seat.South);
    expect(result.dealer).toBe(Seat.North);
  });

  // ─── Ignores non-seat layers gracefully ────────────────────
  it("skips public-guard layers (not compilable to DealConstraints)", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "public-guard",
          guard: { field: "force", operator: FactOperator.Eq, value: "forcing" },
        },
      ],
    });
    const result = compileDealSpec(spec, Seat.South);
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
    const result = compileDealSpec(spec, Seat.South);
    expect(result.seats).toEqual([]);
  });

  it("skips joint layers (not directly compilable without customCheck)", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "joint",
          roles: [SeatRole.Self, SeatRole.Partner],
          predicate: {
            kind: "combined-hcp",
            params: { min: 25, max: 30 },
          },
        },
      ],
    });
    const result = compileDealSpec(spec, Seat.South);
    // Joint constraints are not represented in DealConstraints directly
    expect(result.seats).toEqual([]);
  });
});

// ─── Role rotation ────────────────────────────────────────────
describe("compileDealSpec role rotation", () => {
  it("maps self to South when userSeat is South", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: SeatRole.Self,
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: FactOperator.Gte, value: 10 }],
          },
        },
      ],
    });
    const result = compileDealSpec(spec, Seat.South);
    expect(result.seats[0]!.seat).toBe(Seat.South);
  });

  it("maps partner to North when userSeat is South", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: SeatRole.Partner,
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: FactOperator.Gte, value: 10 }],
          },
        },
      ],
    });
    const result = compileDealSpec(spec, Seat.South);
    expect(result.seats[0]!.seat).toBe(Seat.North);
  });

  it("maps lho to West when userSeat is South", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: SeatRole.Lho,
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: FactOperator.Lte, value: 10 }],
          },
        },
      ],
    });
    const result = compileDealSpec(spec, Seat.South);
    expect(result.seats[0]!.seat).toBe(Seat.West);
  });

  it("maps rho to East when userSeat is South", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: SeatRole.Rho,
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: FactOperator.Lte, value: 10 }],
          },
        },
      ],
    });
    const result = compileDealSpec(spec, Seat.South);
    expect(result.seats[0]!.seat).toBe(Seat.East);
  });

  it("rotates correctly when userSeat is North", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: SeatRole.Self,
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: FactOperator.Gte, value: 10 }],
          },
        },
        {
          kind: "seat",
          role: SeatRole.Partner,
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: FactOperator.Gte, value: 8 }],
          },
        },
        {
          kind: "seat",
          role: SeatRole.Lho,
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: FactOperator.Lte, value: 12 }],
          },
        },
        {
          kind: "seat",
          role: SeatRole.Rho,
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: FactOperator.Lte, value: 14 }],
          },
        },
      ],
    });

    const result = compileDealSpec(spec, Seat.North);
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
          role: SeatRole.Self,
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: FactOperator.Gte, value: 10 }],
          },
        },
        {
          kind: "seat",
          role: SeatRole.Partner,
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: FactOperator.Gte, value: 8 }],
          },
        },
      ],
    });

    const result = compileDealSpec(spec, Seat.East);
    const bySeat = (s: Seat) => result.seats.find((c) => c.seat === s);

    expect(bySeat(Seat.East)!.minHcp).toBe(10); // self -> East
    expect(bySeat(Seat.West)!.minHcp).toBe(8); // partner -> West
  });

  it("maps openingSide to self (user side) for deal generation", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: SeatRole.OpeningSide,
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: FactOperator.Gte, value: 12 }],
          },
        },
      ],
    });

    const result = compileDealSpec(spec, Seat.South);
    // openingSide maps to the user seat for constraint purposes
    expect(result.seats[0]!.seat).toBe(Seat.South);
  });
});

// ─── Pedagogical controls passthrough ─────────────────────────
describe("compileDealSpec pedagogical controls", () => {
  it("returns teachingControls as metadata on the result", () => {
    const spec = makeSpec({
      teachingControls: {
        maxLiveAlternatives: 3,
        ambiguityPreference: "prefer-low",
      },
    });

    const result = compileDealSpec(spec, Seat.South);
    // teachingControls are passed through as metadata, not enforced in DealConstraints
    expect(result.teachingControls).toEqual({
      maxLiveAlternatives: 3,
      ambiguityPreference: "prefer-low",
    });
  });
});

// ─── HCP eq operator ──────────────────────────────────────────
describe("compileDealSpec eq operator", () => {
  it("compiles HCP eq to both minHcp and maxHcp", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: SeatRole.Self,
          predicate: {
            conjunction: "all",
            clauses: [{ factId: "hand.hcp", operator: FactOperator.Eq, value: 15 }],
          },
        },
      ],
    });

    const result = compileDealSpec(spec, Seat.South);
    expect(result.seats[0]!.minHcp).toBe(15);
    expect(result.seats[0]!.maxHcp).toBe(15);
  });

  it("compiles suit length eq to both minLength and maxLength", () => {
    const spec = makeSpec({
      layers: [
        {
          kind: "seat",
          role: SeatRole.Self,
          predicate: {
            conjunction: "all",
            clauses: [
              { factId: "hand.suitLength.clubs", operator: FactOperator.Eq, value: 4 },
            ],
          },
        },
      ],
    });

    const result = compileDealSpec(spec, Seat.South);
    expect(result.seats[0]!.minLength).toEqual({ [Suit.Clubs]: 4 });
    expect(result.seats[0]!.maxLength).toEqual({ [Suit.Clubs]: 4 });
  });
});
