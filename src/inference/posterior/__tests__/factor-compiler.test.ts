import { describe, it, expect } from "vitest";
import { compileFactorGraph, validateFactorGraph } from "../factor-compiler";
import type { PublicConstraint } from "../../../core/contracts/agreement-module";
import type {
  HcpRangeFactor,
  SuitLengthFactor,
  ShapeFactor,
  ExclusionFactor,
} from "../../../core/contracts/factor-graph";
import { makeSnapshot } from "./posterior-test-fixtures";

describe("compileFactorGraph", () => {
  it("compiles HCP range from call-meaning (1NT: 15-17 HCP)", () => {
    const snapshot = makeSnapshot([
      {
        subject: "N",
        constraint: { factId: "hand.hcp", operator: "gte", value: 15 },
        origin: "call-meaning",
        strength: "hard",
        sourceCall: "1NT",
      },
      {
        subject: "N",
        constraint: { factId: "hand.hcp", operator: "lte", value: 17 },
        origin: "call-meaning",
        strength: "hard",
        sourceCall: "1NT",
      },
    ]);

    const graph = compileFactorGraph(snapshot);
    expect(graph.factors).toHaveLength(2);

    const f0 = graph.factors[0] as HcpRangeFactor;
    expect(f0.kind).toBe("hcp-range");
    expect(f0.seat).toBe("N");
    expect(f0.min).toBe(15);
    expect(f0.max).toBe(40);
    expect(f0.strength).toBe("hard");

    const f1 = graph.factors[1] as HcpRangeFactor;
    expect(f1.kind).toBe("hcp-range");
    expect(f1.seat).toBe("N");
    expect(f1.min).toBe(0);
    expect(f1.max).toBe(17);
    expect(f1.strength).toBe("hard");
  });

  it("negates entailed-denial of gte 5 hearts to SuitLengthFactor with max=4", () => {
    const snapshot = makeSnapshot([
      {
        subject: "S",
        constraint: { factId: "hand.suitLength.H", operator: "gte", value: 5 },
        origin: "entailed-denial",
        strength: "entailed",
        sourceCall: "2D",
        sourceMeaning: "stayman-deny-major",
      },
    ]);

    const graph = compileFactorGraph(snapshot);
    expect(graph.factors).toHaveLength(1);

    const f = graph.factors[0] as SuitLengthFactor;
    expect(f.kind).toBe("suit-length");
    expect(f.seat).toBe("S");
    expect(f.suit).toBe("H");
    expect(f.min).toBe(0);
    expect(f.max).toBe(4); // negated: gte 5 → lte 4
    expect(f.strength).toBe("hard");
    expect(f.origin.originKind).toBe("entailed-denial");
  });

  it("maps denial of isBalanced boolean true to ExclusionFactor with not-balanced", () => {
    const snapshot = makeSnapshot([
      {
        subject: "N",
        constraint: { factId: "hand.isBalanced", operator: "boolean", value: true },
        origin: "entailed-denial",
        strength: "entailed",
        sourceCall: "1S",
      },
    ]);

    const graph = compileFactorGraph(snapshot);
    expect(graph.factors).toHaveLength(1);

    const f = graph.factors[0] as ExclusionFactor;
    expect(f.kind).toBe("exclusion");
    expect(f.seat).toBe("N");
    expect(f.constraint).toBe("not-balanced");
    expect(f.strength).toBe("hard");
  });

  it("references seats via seat field, not grouped per-seat", () => {
    const snapshot = makeSnapshot([
      {
        subject: "N",
        constraint: { factId: "hand.hcp", operator: "gte", value: 15 },
        origin: "call-meaning",
        strength: "hard",
      },
      {
        subject: "N",
        constraint: { factId: "hand.hcp", operator: "lte", value: 17 },
        origin: "call-meaning",
        strength: "hard",
      },
    ]);

    const graph = compileFactorGraph(snapshot);
    // Factors are a flat array, not grouped per seat
    expect(Array.isArray(graph.factors)).toBe(true);
    expect(graph.factors).toHaveLength(2);
    // Each factor individually carries its seat
    for (const f of graph.factors) {
      expect(f).toHaveProperty("seat");
    }
  });

  it("produces factors with different seat values for multiple subjects", () => {
    const snapshot = makeSnapshot([
      {
        subject: "N",
        constraint: { factId: "hand.hcp", operator: "gte", value: 15 },
        origin: "call-meaning",
        strength: "hard",
      },
      {
        subject: "S",
        constraint: { factId: "hand.hcp", operator: "gte", value: 6 },
        origin: "call-meaning",
        strength: "hard",
      },
    ]);

    const graph = compileFactorGraph(snapshot);
    expect(graph.factors).toHaveLength(2);

    const seats = graph.factors.map((f) => {
      if (f.kind === "fit") return f.seats[0];
      return f.seat;
    });
    expect(seats).toContain("N");
    expect(seats).toContain("S");
  });

  it("returns empty factor graph for empty commitments", () => {
    const snapshot = makeSnapshot([]);
    const graph = compileFactorGraph(snapshot);
    expect(graph.factors).toHaveLength(0);
    expect(graph.ambiguitySchema).toHaveLength(0);
    expect(graph.evidencePins).toHaveLength(0);
  });

  it("maps latentBranches to AmbiguityFamilyIR", () => {
    const snapshot = makeSnapshot(
      [
        {
          subject: "N",
          constraint: { factId: "hand.hcp", operator: "gte", value: 15 },
          origin: "call-meaning",
          strength: "hard",
        },
      ],
      [
        {
          setId: "transfer-ambiguity",
          alternatives: [
            { branchId: "hearts", meaningId: "jacoby:hearts", description: "5+ hearts" },
            { branchId: "spades", meaningId: "jacoby:spades", description: "5+ spades" },
          ],
        },
      ],
    );

    const graph = compileFactorGraph(snapshot);
    expect(graph.ambiguitySchema).toHaveLength(1);
    expect(graph.ambiguitySchema[0]!.familyId).toBe("transfer-ambiguity");
    expect(graph.ambiguitySchema[0]!.exclusivity).toBe("xor");
    expect(graph.ambiguitySchema[0]!.alternatives).toHaveLength(2);
    expect(graph.ambiguitySchema[0]!.alternatives[0]!.branchId).toBe("hearts");
    expect(graph.ambiguitySchema[0]!.alternatives[0]!.meaningId).toBe("jacoby:hearts");
    expect(graph.ambiguitySchema[0]!.alternatives[0]!.description).toBe("5+ hearts");
    expect(graph.ambiguitySchema[0]!.alternatives[1]!.branchId).toBe("spades");
  });

  it("each factor has an origin with originKind", () => {
    const snapshot = makeSnapshot([
      {
        subject: "N",
        constraint: { factId: "hand.hcp", operator: "gte", value: 15 },
        origin: "call-meaning",
        strength: "hard",
        sourceCall: "1NT",
      },
      {
        subject: "N",
        constraint: { factId: "hand.hcp", operator: "lte", value: 17 },
        origin: "call-meaning",
        strength: "hard",
        sourceCall: "1NT",
      },
      {
        subject: "S",
        constraint: { factId: "hand.suitLength.H", operator: "gte", value: 5 },
        origin: "entailed-denial",
        strength: "entailed",
      },
    ]);

    const graph = compileFactorGraph(snapshot);
    expect(graph.factors).toHaveLength(3);
    // Each factor has an origin with originKind
    for (const factor of graph.factors) {
      expect(factor.origin).toHaveProperty("originKind");
    }
  });

  it("populates FactorOrigin with correct originKind and sourceConstraint", () => {
    const commitment: PublicConstraint = {
      subject: "N",
      constraint: { factId: "hand.hcp", operator: "gte", value: 15 },
      origin: "call-meaning",
      strength: "hard",
      sourceCall: "1NT",
      sourceMeaning: "1nt-opening",
    };
    const snapshot = makeSnapshot([commitment]);

    const graph = compileFactorGraph(snapshot);
    const factor = graph.factors[0] as HcpRangeFactor;

    expect(factor.origin.originKind).toBe("call-meaning");
    expect(factor.origin.sourceConstraint).toEqual(commitment);
    expect(factor.origin.sourceMeaning).toBe("1nt-opening");
  });

  it("compiles isBalanced boolean true from call-meaning to ShapeFactor", () => {
    const snapshot = makeSnapshot([
      {
        subject: "N",
        constraint: { factId: "hand.isBalanced", operator: "boolean", value: true },
        origin: "call-meaning",
        strength: "hard",
        sourceCall: "1NT",
      },
    ]);

    const graph = compileFactorGraph(snapshot);
    expect(graph.factors).toHaveLength(1);

    const f = graph.factors[0] as ShapeFactor;
    expect(f.kind).toBe("shape");
    expect(f.seat).toBe("N");
    expect(f.pattern).toBe("balanced");
    expect(f.strength).toBe("hard");
    expect(f.origin.originKind).toBe("call-meaning");
  });
});

describe("validateFactorGraph", () => {
  it("detects contradictory HCP constraints on the same seat", () => {
    const snapshot = makeSnapshot([
      {
        subject: "S",
        constraint: { factId: "hand.hcp", operator: "gte", value: 20 },
        origin: "call-meaning",
        strength: "hard",
      },
      {
        subject: "S",
        constraint: { factId: "hand.hcp", operator: "lte", value: 10 },
        origin: "call-meaning",
        strength: "hard",
      },
    ]);

    const graph = compileFactorGraph(snapshot);
    const validation = validateFactorGraph(graph);

    expect(validation.valid).toBe(false);
    expect(validation.contradictions).toHaveLength(1);
    expect(validation.contradictions[0]!.seat).toBe("S");
    expect(validation.contradictions[0]!.factId).toBe("hand.hcp");
    expect(validation.contradictions[0]!.lowerBound).toBe(20);
    expect(validation.contradictions[0]!.upperBound).toBe(10);
  });

  it("returns valid for non-contradictory constraints", () => {
    const snapshot = makeSnapshot([
      {
        subject: "N",
        constraint: { factId: "hand.hcp", operator: "gte", value: 15 },
        origin: "call-meaning",
        strength: "hard",
      },
      {
        subject: "N",
        constraint: { factId: "hand.hcp", operator: "lte", value: 17 },
        origin: "call-meaning",
        strength: "hard",
      },
    ]);

    const graph = compileFactorGraph(snapshot);
    const validation = validateFactorGraph(graph);

    expect(validation.valid).toBe(true);
    expect(validation.contradictions).toHaveLength(0);
  });

  it("detects contradictory suit-length constraints on the same seat and suit", () => {
    const snapshot = makeSnapshot([
      {
        subject: "N",
        constraint: { factId: "hand.suitLength.S", operator: "gte", value: 8 },
        origin: "call-meaning",
        strength: "hard",
      },
      {
        subject: "N",
        constraint: { factId: "hand.suitLength.S", operator: "lte", value: 3 },
        origin: "call-meaning",
        strength: "hard",
      },
    ]);

    const graph = compileFactorGraph(snapshot);
    const validation = validateFactorGraph(graph);

    expect(validation.valid).toBe(false);
    expect(validation.contradictions).toHaveLength(1);
    expect(validation.contradictions[0]!.seat).toBe("N");
    expect(validation.contradictions[0]!.factId).toBe("hand.suitLength.S");
    expect(validation.contradictions[0]!.lowerBound).toBe(8);
    expect(validation.contradictions[0]!.upperBound).toBe(3);
  });
});
