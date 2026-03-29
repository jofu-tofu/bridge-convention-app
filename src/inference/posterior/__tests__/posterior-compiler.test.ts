import { describe, it, expect } from "vitest";
import { compilePublicHandSpace } from "../posterior-compiler";
import type { PublicSnapshot } from "../../../conventions/core/module-surface";
import { makeSnapshot } from "./posterior-test-fixtures";
import { FactOperator } from "../../../conventions/pipeline/evaluation/meaning";

describe("compilePublicHandSpace", () => {
  it("extracts HCP range constraints from 1NT opening commitment (15-17 HCP)", () => {
    const snapshot = makeSnapshot([
      {
        subject: "S", // South opened 1NT
        constraint: { factId: "hand.hcp", operator: FactOperator.Gte, value: 15 },
        origin: "call-meaning",
        strength: "hard",
        sourceCall: "1NT",
      },
      {
        subject: "S",
        constraint: { factId: "hand.hcp", operator: FactOperator.Lte, value: 17 },
        origin: "call-meaning",
        strength: "hard",
        sourceCall: "1NT",
      },
    ]);

    const spaces = compilePublicHandSpace(snapshot);
    expect(spaces).toHaveLength(1);
    expect(spaces[0]!.seatId).toBe("S");
    expect(spaces[0]!.constraints).toHaveLength(1);

    const predicate = spaces[0]!.constraints[0]!;
    expect(predicate.conjunction).toBe("all");
    // Should have two clauses: hcp >= 15 and hcp <= 17
    expect(predicate.clauses).toHaveLength(2);
    expect(predicate.clauses[0]).toEqual({
      factId: "hand.hcp",
      operator: FactOperator.Gte,
      value: 15,
    });
    expect(predicate.clauses[1]).toEqual({
      factId: "hand.hcp",
      operator: FactOperator.Lte,
      value: 17,
    });
  });

  it("detects contradictory constraints (estimatedSize: 0)", () => {
    const snapshot = makeSnapshot([
      {
        subject: "S",
        constraint: { factId: "hand.hcp", operator: FactOperator.Gte, value: 20 },
        origin: "call-meaning",
        strength: "hard",
      },
      {
        subject: "S",
        constraint: { factId: "hand.hcp", operator: FactOperator.Lte, value: 10 },
        origin: "call-meaning",
        strength: "hard",
      },
    ]);

    const spaces = compilePublicHandSpace(snapshot);
    expect(spaces).toHaveLength(1);
    expect(spaces[0]!.estimatedSize).toBe(0);
  });

  it("returns empty hand spaces for empty commitments", () => {
    const snapshot = makeSnapshot([]);
    const spaces = compilePublicHandSpace(snapshot);
    expect(spaces).toHaveLength(0);
  });

  it("groups constraints by subject seat", () => {
    const snapshot = makeSnapshot([
      {
        subject: "N",
        constraint: { factId: "hand.hcp", operator: FactOperator.Gte, value: 6 },
        origin: "call-meaning",
        strength: "hard",
      },
      {
        subject: "S",
        constraint: { factId: "hand.hcp", operator: FactOperator.Gte, value: 15 },
        origin: "call-meaning",
        strength: "hard",
      },
    ]);

    const spaces = compilePublicHandSpace(snapshot);
    expect(spaces).toHaveLength(2);
    const seatIds = spaces.map((s) => s.seatId).sort();
    expect(seatIds).toEqual(["N", "S"]);
  });

  it("attaches latent branches from snapshot to hand spaces", () => {
    const snapshot: PublicSnapshot = {
      ...makeSnapshot([
        {
          subject: "N",
          constraint: { factId: "hand.hcp", operator: FactOperator.Gte, value: 15 },
          origin: "call-meaning",
          strength: "hard",
        },
      ]),
      latentBranches: [
        {
          setId: "transfer-ambiguity",
          alternatives: [
            { branchId: "hearts", meaningId: "jacoby:hearts", description: "5+ hearts" },
            { branchId: "spades", meaningId: "jacoby:spades", description: "5+ spades" },
          ],
        },
      ],
    };

    const spaces = compilePublicHandSpace(snapshot);
    expect(spaces).toHaveLength(1);
    expect(spaces[0]!.latentBranches).toHaveLength(1);
    expect(spaces[0]!.latentBranches![0]!.setId).toBe("transfer-ambiguity");
  });

  it("omits latentBranches field when snapshot has none", () => {
    const snapshot = makeSnapshot([
      {
        subject: "N",
        constraint: { factId: "hand.hcp", operator: FactOperator.Gte, value: 15 },
        origin: "call-meaning",
        strength: "hard",
      },
    ]);

    const spaces = compilePublicHandSpace(snapshot);
    expect(spaces[0]!.latentBranches).toBeUndefined();
  });
});
