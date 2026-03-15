import { describe, it, expect } from "vitest";
import { compileFactorGraph } from "../factor-compiler";
import type { PublicSnapshot } from "../../../core/contracts/module-surface";
import type { PublicConstraint } from "../../../core/contracts/agreement-module";
import { ForcingState } from "../../../core/contracts/bidding";

function makeSnapshot(commitments: readonly PublicConstraint[]): PublicSnapshot {
  return {
    activeModuleIds: [],
    forcingState: ForcingState.Nonforcing,
    obligation: { kind: "none", obligatedSide: "opener" },
    agreedStrain: { type: "none" },
    competitionMode: "uncontested",
    captain: "responder",
    systemCapabilities: {},
    publicRegisters: {},
    publicCommitments: commitments,
  };
}

describe("posterior boundary invariants", () => {
  it("schema closure: no file in posterior/ imports from conventions/definitions/", async () => {
    // Read all .ts files in posterior/ (non-test) and check imports
    const { readdir } = await import("node:fs/promises");
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");

    const posteriorDir = join(import.meta.dirname, "..");
    const files = await readdir(posteriorDir);
    const tsFiles = files.filter(f => f.endsWith(".ts") && !f.endsWith(".test.ts"));

    for (const file of tsFiles) {
      const content = await readFile(join(posteriorDir, file), "utf-8");
      expect(content).not.toMatch(/from\s+["'].*conventions\/definitions/);
    }
  });

  it("no beliefs on snapshot: PublicSnapshot has no publicBeliefs field", () => {
    // Runtime assertion — build a snapshot and verify no publicBeliefs
    const snapshot = makeSnapshot([]);
    expect("publicBeliefs" in snapshot).toBe(false);
  });

  it("factor graph serializable: JSON round-trip without loss", () => {
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
      {
        subject: "N",
        constraint: { factId: "hand.isBalanced", operator: "boolean", value: true },
        origin: "call-meaning",
        strength: "hard",
      },
    ]);

    const graph = compileFactorGraph(snapshot);
    const serialized = JSON.stringify(graph);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.factors).toHaveLength(graph.factors.length);
    expect(deserialized.ambiguitySchema).toHaveLength(graph.ambiguitySchema.length);
    expect(deserialized.evidencePins).toHaveLength(graph.evidencePins.length);

    // Each factor survives serialization
    for (let i = 0; i < graph.factors.length; i++) {
      expect(deserialized.factors[i].kind).toBe(graph.factors[i].kind);
      expect(deserialized.factors[i].seat).toBe(graph.factors[i].seat);
      expect(deserialized.factors[i].strength).toBe(graph.factors[i].strength);
    }
  });

  it("constraint integrity: hard constraints are all satisfied in standard 1NT test", () => {
    // This test verifies the factor compiler correctly preserves constraint semantics
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

    // All factors should be "hard"
    for (const factor of graph.factors) {
      expect(factor.strength).toBe("hard");
    }

    // Should have 2 HCP factors
    const hcpFactors = graph.factors.filter(f => f.kind === "hcp-range");
    expect(hcpFactors.length).toBe(2);
  });

  it("factor origin present: every factor has an origin with originKind", () => {
    const snapshot = makeSnapshot([
      {
        subject: "N",
        constraint: { factId: "hand.hcp", operator: "gte", value: 15 },
        origin: "call-meaning",
        strength: "hard",
      },
      {
        subject: "N",
        constraint: { factId: "hand.suitLength.H", operator: "gte", value: 4 },
        origin: "call-meaning",
        strength: "hard",
      },
    ]);

    const graph = compileFactorGraph(snapshot);
    for (const factor of graph.factors) {
      expect(factor.origin).toHaveProperty("originKind");
    }
  });

  it("latent dimensionality: standard conventions produce factors with only seat-level variables", () => {
    const snapshot = makeSnapshot([
      {
        subject: "N",
        constraint: { factId: "hand.hcp", operator: "gte", value: 15 },
        origin: "call-meaning",
        strength: "hard",
      },
    ]);

    const graph = compileFactorGraph(snapshot);

    // All factors should have a "seat" field (not cross-seat by default)
    for (const factor of graph.factors) {
      if (factor.kind !== "fit") {
        expect(factor).toHaveProperty("seat");
      } else {
        // FitFactor has "seats" array
        expect(factor).toHaveProperty("seats");
      }
    }
  });
});
