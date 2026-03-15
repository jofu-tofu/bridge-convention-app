import { describe, it, expect } from "vitest";
import {
  compileWitnessSpec,
  compileWitnessSpecFull,
  generateWitnessSpec,
  resolveRole,
} from "../witness-generator";
import type { WitnessGeneratorResult } from "../witness-generator";
import { Seat, Suit, Vulnerability } from "../../../../engine/types";
import type { WitnessSpecIR, WitnessUnsatResult } from "../../../../core/contracts/witness-spec";
import type { HandPredicateIR } from "../../../../core/contracts/predicate-surfaces";
import { CAP_OPENING_1NT } from "../../../../core/contracts/capability-vocabulary";

// ─── Helpers ───────────────────────────────────────────────────────

function makeMinimalSpec(overrides: Partial<WitnessSpecIR> = {}): WitnessSpecIR {
  return {
    specId: "test-spec",
    moduleId: "test-module",
    layers: [],
    targets: [],
    ...overrides,
  };
}

function hcpPredicate(op: "gte" | "lte" | "range", value: number | { min: number; max: number }): HandPredicateIR {
  return {
    clauses: [{ factId: "hcp", operator: op, value }],
    conjunction: "all",
  };
}

function suitLengthPredicate(suit: string, op: "gte" | "lte" | "eq", value: number): HandPredicateIR {
  return {
    clauses: [{ factId: suit, operator: op, value }],
    conjunction: "all",
  };
}

function balancedPredicate(balanced: boolean): HandPredicateIR {
  return {
    clauses: [{ factId: "balanced", operator: "boolean", value: balanced }],
    conjunction: "all",
  };
}

// ─── resolveRole ───────────────────────────────────────────────────

describe("resolveRole", () => {
  it("maps 'self' to the user seat", () => {
    expect(resolveRole("self", Seat.South)).toBe(Seat.South);
    expect(resolveRole("self", Seat.North)).toBe(Seat.North);
  });

  it("maps 'partner' to the opposite seat", () => {
    expect(resolveRole("partner", Seat.South)).toBe(Seat.North);
    expect(resolveRole("partner", Seat.North)).toBe(Seat.South);
    expect(resolveRole("partner", Seat.East)).toBe(Seat.West);
    expect(resolveRole("partner", Seat.West)).toBe(Seat.East);
  });

  it("maps 'lho' to the left-hand opponent (clockwise)", () => {
    // Clockwise: N→E→S→W
    expect(resolveRole("lho", Seat.South)).toBe(Seat.West);
    expect(resolveRole("lho", Seat.North)).toBe(Seat.East);
    expect(resolveRole("lho", Seat.East)).toBe(Seat.South);
    expect(resolveRole("lho", Seat.West)).toBe(Seat.North);
  });

  it("maps 'rho' to the right-hand opponent (counter-clockwise)", () => {
    expect(resolveRole("rho", Seat.South)).toBe(Seat.East);
    expect(resolveRole("rho", Seat.North)).toBe(Seat.West);
    expect(resolveRole("rho", Seat.East)).toBe(Seat.North);
    expect(resolveRole("rho", Seat.West)).toBe(Seat.South);
  });

  it("maps 'openingSide' to user seat", () => {
    expect(resolveRole("openingSide", Seat.South)).toBe(Seat.South);
  });
});

// ─── compileWitnessSpec: seat mapping ──────────────────────────────

describe("compileWitnessSpec", () => {
  describe("role-relative seat mapping", () => {
    it("maps self=South to a South seat constraint", () => {
      const spec = makeMinimalSpec({
        layers: [
          {
            kind: "seat",
            role: "self",
            predicate: hcpPredicate("gte", 12),
          },
        ],
      });

      const { dealConstraints } = compileWitnessSpec(spec, Seat.South);
      expect(dealConstraints.seats).toHaveLength(1);
      expect(dealConstraints.seats[0]!.seat).toBe(Seat.South);
    });

    it("maps partner to the opposite seat", () => {
      const spec = makeMinimalSpec({
        layers: [
          {
            kind: "seat",
            role: "partner",
            predicate: hcpPredicate("gte", 6),
          },
        ],
      });

      const { dealConstraints } = compileWitnessSpec(spec, Seat.South);
      expect(dealConstraints.seats[0]!.seat).toBe(Seat.North);
    });

    it("maps lho and rho correctly from East perspective", () => {
      const spec = makeMinimalSpec({
        layers: [
          {
            kind: "seat",
            role: "lho",
            predicate: hcpPredicate("lte", 10),
          },
          {
            kind: "seat",
            role: "rho",
            predicate: hcpPredicate("lte", 10),
          },
        ],
      });

      const { dealConstraints } = compileWitnessSpec(spec, Seat.East);
      expect(dealConstraints.seats[0]!.seat).toBe(Seat.South); // LHO of East
      expect(dealConstraints.seats[1]!.seat).toBe(Seat.North); // RHO of East
    });
  });

  // ─── HCP constraints ──────────────────────────────────────────

  describe("HCP constraints", () => {
    it("translates hcp gte to minHcp", () => {
      const spec = makeMinimalSpec({
        layers: [
          { kind: "seat", role: "self", predicate: hcpPredicate("gte", 15) },
        ],
      });

      const { dealConstraints } = compileWitnessSpec(spec, Seat.North);
      expect(dealConstraints.seats[0]!.minHcp).toBe(15);
      expect(dealConstraints.seats[0]!.maxHcp).toBeUndefined();
    });

    it("translates hcp lte to maxHcp", () => {
      const spec = makeMinimalSpec({
        layers: [
          { kind: "seat", role: "self", predicate: hcpPredicate("lte", 17) },
        ],
      });

      const { dealConstraints } = compileWitnessSpec(spec, Seat.North);
      expect(dealConstraints.seats[0]!.maxHcp).toBe(17);
    });

    it("translates hcp range to minHcp + maxHcp", () => {
      const spec = makeMinimalSpec({
        layers: [
          {
            kind: "seat",
            role: "self",
            predicate: hcpPredicate("range", { min: 15, max: 17 }),
          },
        ],
      });

      const { dealConstraints } = compileWitnessSpec(spec, Seat.North);
      expect(dealConstraints.seats[0]!.minHcp).toBe(15);
      expect(dealConstraints.seats[0]!.maxHcp).toBe(17);
    });

    it("translates hcp eq to minHcp === maxHcp", () => {
      const spec = makeMinimalSpec({
        layers: [
          {
            kind: "seat",
            role: "self",
            predicate: {
              clauses: [{ factId: "hcp", operator: "eq", value: 16 }],
              conjunction: "all" as const,
            },
          },
        ],
      });

      const { dealConstraints } = compileWitnessSpec(spec, Seat.North);
      expect(dealConstraints.seats[0]!.minHcp).toBe(16);
      expect(dealConstraints.seats[0]!.maxHcp).toBe(16);
    });
  });

  // ─── Suit length constraints ──────────────────────────────────

  describe("suit length constraints", () => {
    it("translates spades gte to minLength", () => {
      const spec = makeMinimalSpec({
        layers: [
          { kind: "seat", role: "self", predicate: suitLengthPredicate("spades", "gte", 5) },
        ],
      });

      const { dealConstraints } = compileWitnessSpec(spec, Seat.South);
      expect(dealConstraints.seats[0]!.minLength).toEqual({ [Suit.Spades]: 5 });
    });

    it("translates hearts lte to maxLength", () => {
      const spec = makeMinimalSpec({
        layers: [
          { kind: "seat", role: "self", predicate: suitLengthPredicate("hearts", "lte", 3) },
        ],
      });

      const { dealConstraints } = compileWitnessSpec(spec, Seat.South);
      expect(dealConstraints.seats[0]!.maxLength).toEqual({ [Suit.Hearts]: 3 });
    });

    it("translates suit eq to both min and max length", () => {
      const spec = makeMinimalSpec({
        layers: [
          { kind: "seat", role: "self", predicate: suitLengthPredicate("diamonds", "eq", 4) },
        ],
      });

      const { dealConstraints } = compileWitnessSpec(spec, Seat.South);
      expect(dealConstraints.seats[0]!.minLength).toEqual({ [Suit.Diamonds]: 4 });
      expect(dealConstraints.seats[0]!.maxLength).toEqual({ [Suit.Diamonds]: 4 });
    });

    it("translates suit range to min and max length", () => {
      const spec = makeMinimalSpec({
        layers: [
          {
            kind: "seat",
            role: "self",
            predicate: {
              clauses: [{ factId: "clubs", operator: "range", value: { min: 3, max: 5 } }],
              conjunction: "all" as const,
            },
          },
        ],
      });

      const { dealConstraints } = compileWitnessSpec(spec, Seat.South);
      expect(dealConstraints.seats[0]!.minLength).toEqual({ [Suit.Clubs]: 3 });
      expect(dealConstraints.seats[0]!.maxLength).toEqual({ [Suit.Clubs]: 5 });
    });

    it("handles multiple suit constraints in one predicate", () => {
      const spec = makeMinimalSpec({
        layers: [
          {
            kind: "seat",
            role: "self",
            predicate: {
              clauses: [
                { factId: "spades", operator: "gte", value: 5 },
                { factId: "hearts", operator: "gte", value: 4 },
                { factId: "hcp", operator: "gte", value: 12 },
              ],
              conjunction: "all" as const,
            },
          },
        ],
      });

      const { dealConstraints } = compileWitnessSpec(spec, Seat.South);
      const sc = dealConstraints.seats[0]!;
      expect(sc.minHcp).toBe(12);
      expect(sc.minLength).toEqual({ [Suit.Spades]: 5, [Suit.Hearts]: 4 });
    });
  });

  // ─── Balanced constraint ──────────────────────────────────────

  describe("balanced constraint", () => {
    it("translates balanced: true", () => {
      const spec = makeMinimalSpec({
        layers: [
          { kind: "seat", role: "self", predicate: balancedPredicate(true) },
        ],
      });

      const { dealConstraints } = compileWitnessSpec(spec, Seat.North);
      expect(dealConstraints.seats[0]!.balanced).toBe(true);
    });

    it("translates balanced: false", () => {
      const spec = makeMinimalSpec({
        layers: [
          { kind: "seat", role: "self", predicate: balancedPredicate(false) },
        ],
      });

      const { dealConstraints } = compileWitnessSpec(spec, Seat.North);
      expect(dealConstraints.seats[0]!.balanced).toBe(false);
    });
  });

  // ─── Joint constraints ────────────────────────────────────────

  describe("joint constraints", () => {
    it("produces a diagnostic for joint constraints", () => {
      const spec = makeMinimalSpec({
        layers: [
          {
            kind: "joint",
            roles: ["self", "partner"],
            predicate: {
              kind: "fit-check",
              params: { suit: "S", minLength: 8 },
            },
          },
        ],
      });

      const { diagnostics } = compileWitnessSpec(spec, Seat.South);
      expect(diagnostics).toContainEqual(
        expect.stringContaining("Joint constraint"),
      );
    });

    it("compileWitnessSpecFull provides a jointCheck function", () => {
      const spec = makeMinimalSpec({
        layers: [
          {
            kind: "joint",
            roles: ["self", "partner"],
            predicate: {
              kind: "combined-hcp",
              params: { min: 20, max: 30 },
            },
          },
        ],
      });

      const result = compileWitnessSpecFull(spec, Seat.South);
      expect(result.jointCheck).toBeDefined();
      expect(typeof result.jointCheck).toBe("function");
    });
  });

  // ─── Exclusion constraints ────────────────────────────────────

  describe("exclusion constraints", () => {
    it("produces a diagnostic for exclusion constraints", () => {
      const spec = makeMinimalSpec({
        layers: [
          {
            kind: "exclusion",
            meaningIds: ["stayman-ask", "jacoby-transfer"],
          },
        ],
      });

      const { diagnostics } = compileWitnessSpec(spec, Seat.South);
      expect(diagnostics).toContainEqual(
        expect.stringContaining("Exclusion"),
      );
      expect(diagnostics).toContainEqual(
        expect.stringContaining("stayman-ask"),
      );
    });
  });

  // ─── Public guard constraints ─────────────────────────────────

  describe("public guard constraints", () => {
    it("produces a diagnostic for public guard constraints", () => {
      const spec = makeMinimalSpec({
        layers: [
          {
            kind: "public-guard",
            guard: { field: CAP_OPENING_1NT, operator: "eq", value: "active" },
          },
        ],
      });

      const { diagnostics } = compileWitnessSpec(spec, Seat.South);
      expect(diagnostics).toContainEqual(
        expect.stringContaining("Public guard"),
      );
    });
  });

  // ─── Setup: dealer ────────────────────────────────────────────

  describe("setup.dealerRole", () => {
    it("resolves dealerRole to a compass seat", () => {
      const spec = makeMinimalSpec({
        setup: { dealerRole: "self" },
      });

      const { dealConstraints } = compileWitnessSpec(spec, Seat.North);
      expect(dealConstraints.dealer).toBe(Seat.North);
    });

    it("resolves partner as dealer", () => {
      const spec = makeMinimalSpec({
        setup: { dealerRole: "partner" },
      });

      const { dealConstraints } = compileWitnessSpec(spec, Seat.South);
      expect(dealConstraints.dealer).toBe(Seat.North);
    });

    it("omits dealer when setup is absent", () => {
      const spec = makeMinimalSpec();
      const { dealConstraints } = compileWitnessSpec(spec, Seat.South);
      expect(dealConstraints.dealer).toBeUndefined();
    });
  });

  // ─── Setup: vulnerability ─────────────────────────────────────

  describe("setup.vulnerability", () => {
    it("maps 'ns' to NorthSouth", () => {
      const spec = makeMinimalSpec({
        setup: { vulnerability: "ns" },
      });

      const { dealConstraints } = compileWitnessSpec(spec, Seat.South);
      expect(dealConstraints.vulnerability).toBe(Vulnerability.NorthSouth);
    });

    it("maps 'both' to Both", () => {
      const spec = makeMinimalSpec({
        setup: { vulnerability: "both" },
      });

      const { dealConstraints } = compileWitnessSpec(spec, Seat.South);
      expect(dealConstraints.vulnerability).toBe(Vulnerability.Both);
    });
  });

  // ─── maxAttempts ──────────────────────────────────────────────

  describe("maxAttempts", () => {
    it("passes through maxAttempts from spec", () => {
      const spec = makeMinimalSpec({ maxAttempts: 5000 });

      const { dealConstraints } = compileWitnessSpec(spec, Seat.South);
      expect(dealConstraints.maxAttempts).toBe(5000);
    });

    it("omits maxAttempts when not specified", () => {
      const spec = makeMinimalSpec();
      const { dealConstraints } = compileWitnessSpec(spec, Seat.South);
      expect(dealConstraints.maxAttempts).toBeUndefined();
    });
  });

  // ─── Unknown factId diagnostics ───────────────────────────────

  describe("diagnostics for unknown clauses", () => {
    it("reports unknown factId", () => {
      const spec = makeMinimalSpec({
        layers: [
          {
            kind: "seat",
            role: "self",
            predicate: {
              clauses: [{ factId: "losers", operator: "lte", value: 7 }],
              conjunction: "all" as const,
            },
          },
        ],
      });

      const { diagnostics } = compileWitnessSpec(spec, Seat.South);
      expect(diagnostics).toContainEqual(
        expect.stringContaining("losers"),
      );
    });
  });

  // ─── Full 1NT-style spec ──────────────────────────────────────

  describe("full NT-style spec", () => {
    it("compiles a realistic 1NT opener + responder spec", () => {
      const spec = makeMinimalSpec({
        layers: [
          {
            kind: "seat",
            role: "self",
            predicate: {
              clauses: [
                { factId: "hcp", operator: "range", value: { min: 15, max: 17 } },
                { factId: "balanced", operator: "boolean", value: true },
              ],
              conjunction: "all" as const,
            },
          },
          {
            kind: "seat",
            role: "partner",
            predicate: {
              clauses: [
                { factId: "hcp", operator: "gte", value: 6 },
                { factId: "spades", operator: "gte", value: 4 },
              ],
              conjunction: "all" as const,
            },
          },
        ],
        setup: { dealerRole: "self" },
      });

      const { dealConstraints, diagnostics } = compileWitnessSpec(spec, Seat.North);

      // Opener = self = North
      expect(dealConstraints.seats).toHaveLength(2);
      const opener = dealConstraints.seats[0]!;
      expect(opener.seat).toBe(Seat.North);
      expect(opener.minHcp).toBe(15);
      expect(opener.maxHcp).toBe(17);
      expect(opener.balanced).toBe(true);

      // Responder = partner = South
      const responder = dealConstraints.seats[1]!;
      expect(responder.seat).toBe(Seat.South);
      expect(responder.minHcp).toBe(6);
      expect(responder.minLength).toEqual({ [Suit.Spades]: 4 });

      // Dealer = North
      expect(dealConstraints.dealer).toBe(Seat.North);

      // No diagnostics for standard clauses
      expect(diagnostics).toHaveLength(0);
    });
  });
});

// ─── generateWitnessSpec ───────────────────────────────────────────

describe("generateWitnessSpec", () => {
  it("generates a deal satisfying basic seat constraints", () => {
    const spec = makeMinimalSpec({
      layers: [
        {
          kind: "seat",
          role: "self",
          predicate: hcpPredicate("gte", 10),
        },
      ],
      maxAttempts: 50_000,
    });

    const result = generateWitnessSpec(spec, Seat.South);
    // Should be a successful result, not unsat
    expect("deal" in result).toBe(true);
    const gen = result as WitnessGeneratorResult;
    expect(gen.deal).toBeDefined();
    expect(gen.deal.hands[Seat.South]).toBeDefined();
    expect(gen.iterations).toBeGreaterThan(0);
  });

  describe("diagnostic mode", () => {
    it("returns unsat for impossible HCP (all seats want 15+)", () => {
      const spec = makeMinimalSpec({
        diagnosticMode: true,
        layers: [
          { kind: "seat", role: "self", predicate: hcpPredicate("gte", 15) },
          { kind: "seat", role: "partner", predicate: hcpPredicate("gte", 15) },
          { kind: "seat", role: "lho", predicate: hcpPredicate("gte", 15) },
          { kind: "seat", role: "rho", predicate: hcpPredicate("gte", 15) },
        ],
      });

      const result = generateWitnessSpec(spec, Seat.South);
      expect("unsatCore" in result).toBe(true);
      const unsat = result as WitnessUnsatResult;
      expect(unsat.specId).toBe("test-spec");
      expect(unsat.unsatCore.length).toBeGreaterThan(0);
      expect(unsat.unsatCore[0]).toContain("exceeds deck total");
    });

    it("returns unsat for impossible suit lengths (all seats want 8+ spades)", () => {
      const spec = makeMinimalSpec({
        diagnosticMode: true,
        layers: [
          { kind: "seat", role: "self", predicate: suitLengthPredicate("spades", "gte", 8) },
          { kind: "seat", role: "partner", predicate: suitLengthPredicate("spades", "gte", 8) },
        ],
      });

      const result = generateWitnessSpec(spec, Seat.South);
      expect("unsatCore" in result).toBe(true);
      const unsat = result as WitnessUnsatResult;
      expect(unsat.unsatCore.length).toBeGreaterThan(0);
      expect(unsat.unsatCore[0]).toContain("exceeds suit total");
    });
  });
});
