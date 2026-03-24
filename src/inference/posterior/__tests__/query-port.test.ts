import { describe, it, expect } from "vitest";
import { createQueryPort } from "../query-port";
import { createTsBackend } from "../ts-posterior-backend";
import { compileFactorGraph } from "../factor-compiler";
import type { PublicConstraint } from "../../../conventions/core/agreement-module";
import type { ConditioningContext } from "../posterior-boundary";
import type { PosteriorState } from "../posterior-boundary";
import type { Hand } from "../../../engine/types";
import { makeSnapshot, southHand, oneNtCommitments } from "./posterior-test-fixtures";

function makeConditioningContext(
  commitments: readonly PublicConstraint[],
  ownHand: Hand = southHand,
  observerSeat: string = "S",
): ConditioningContext {
  const snapshot = makeSnapshot(commitments);
  return {
    snapshot,
    factorGraph: compileFactorGraph(snapshot),
    observerSeat,
    ownHand,
  };
}

describe("createQueryPort", () => {
  it("marginalHcp returns PosteriorQueryResult with InferenceHealth", () => {
    const backend = createTsBackend({ sampleCount: 100, seed: 42 });
    const context = makeConditioningContext(oneNtCommitments);
    const state = backend.initialize(context);
    const port = createQueryPort(backend, state);

    const result = port.marginalHcp("N");
    expect(result).toHaveProperty("value");
    expect(result).toHaveProperty("health");
    expect(result.health).toHaveProperty("effectiveSampleSize");
    expect(result.health).toHaveProperty("totalParticles");
    expect(result.health).toHaveProperty("acceptanceRate");
  });

  it("marginalHcp returns expected HCP average for 1NT (15-17)", () => {
    const backend = createTsBackend({ sampleCount: 100, seed: 42 });
    const context = makeConditioningContext(oneNtCommitments);
    const state = backend.initialize(context);
    const port = createQueryPort(backend, state);

    const result = port.marginalHcp("N");
    // 1NT opener has 15-17 HCP, so average should be ~16
    expect(result.value).toBeGreaterThanOrEqual(14.5);
    expect(result.value).toBeLessThanOrEqual(17.5);
  });

  it("suitLength returns PosteriorQueryResult with reasonable values", () => {
    const backend = createTsBackend({ sampleCount: 100, seed: 42 });
    const context = makeConditioningContext(oneNtCommitments);
    const state = backend.initialize(context);
    const port = createQueryPort(backend, state);

    const result = port.suitLength("N", "spades");
    expect(result).toHaveProperty("value");
    expect(result).toHaveProperty("health");
    // Balanced hand: each suit 2-5, average length ~3.25
    expect(result.value).toBeGreaterThanOrEqual(2);
    expect(result.value).toBeLessThanOrEqual(5);
  });

  it("isBalanced returns 1.0 for 1NT opener (balanced constraint)", () => {
    const backend = createTsBackend({ sampleCount: 100, seed: 42 });
    const context = makeConditioningContext(oneNtCommitments);
    const state = backend.initialize(context);
    const port = createQueryPort(backend, state);

    const result = port.isBalanced("N");
    // All sampled hands must be balanced since it's a hard constraint
    expect(result.value).toBe(1);
  });

  it("jointHcp returns correct probability for range queries", () => {
    const backend = createTsBackend({ sampleCount: 100, seed: 42 });
    const context = makeConditioningContext(oneNtCommitments);
    const state = backend.initialize(context);
    const port = createQueryPort(backend, state);

    // South has 10 HCP, North has 15-17. Combined = 25-27.
    // P(combined in [25,27]) should be 1.0
    const result = port.jointHcp(["N", "S"], 25, 27);
    expect(result.value).toBeGreaterThanOrEqual(0.9);
    expect(result.value).toBeLessThanOrEqual(1);
  });

  it("fitProbability works for suit fit queries", () => {
    const backend = createTsBackend({ sampleCount: 100, seed: 42 });
    const context = makeConditioningContext(oneNtCommitments);
    const state = backend.initialize(context);
    const port = createQueryPort(backend, state);

    // South has 4 spades. P(N+S spades >= 8) = probability North has 4+ spades
    const result = port.fitProbability(["N", "S"], "spades", 8);
    expect(result).toHaveProperty("value");
    expect(result).toHaveProperty("health");
    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThanOrEqual(1);
  });

  it("branchProbability returns 0 (not yet wired)", () => {
    const backend = createTsBackend({ sampleCount: 100, seed: 42 });
    const context = makeConditioningContext(oneNtCommitments);
    const state = backend.initialize(context);
    const port = createQueryPort(backend, state);

    const result = port.branchProbability("family1", "branch1");
    expect(result.value).toBe(0);
    expect(result).toHaveProperty("health");
  });

  it("activeFactors returns introspection data", () => {
    const backend = createTsBackend({ sampleCount: 100, seed: 42 });
    const context = makeConditioningContext(oneNtCommitments);
    const state = backend.initialize(context);
    const port = createQueryPort(backend, state);

    const factors = port.activeFactors();
    // 1NT has 3 commitments → 3 factors
    expect(factors).toHaveLength(3);
    for (const f of factors) {
      expect(f).toHaveProperty("factor");
      expect(f).toHaveProperty("satisfactionRate");
      expect(f).toHaveProperty("effectiveWeight");
    }
  });

  it("InferenceHealth reflects actual sample quality", () => {
    const backend = createTsBackend({ sampleCount: 100, seed: 42 });
    const context = makeConditioningContext(oneNtCommitments);
    const state = backend.initialize(context);
    const port = createQueryPort(backend, state);

    const result = port.marginalHcp("N");
    expect(result.health.totalParticles).toBeGreaterThan(0);
    expect(result.health.effectiveSampleSize).toBeGreaterThan(0);
    expect(result.health.acceptanceRate).toBeGreaterThan(0);
    expect(result.health.acceptanceRate).toBeLessThanOrEqual(1);
  });

  it("empty particles return value 0 with health showing 0 particles", () => {
    // Create a backend, then manually create an empty state
    const backend = createTsBackend({ sampleCount: 100, seed: 42 });
    const context = makeConditioningContext(oneNtCommitments);
    const emptyState: PosteriorState = {
      particles: [],
      context: {
        snapshot: context.snapshot,
        factorGraph: context.factorGraph,
        observerSeat: "S",
        ownHand: southHand,
      },
    };
    const port = createQueryPort(backend, emptyState);

    const result = port.marginalHcp("N");
    expect(result.value).toBe(0);
    expect(result.health.totalParticles).toBe(0);
    expect(result.health.effectiveSampleSize).toBe(0);
    expect(result.health.acceptanceRate).toBe(0);

    const suitResult = port.suitLength("N", "spades");
    expect(suitResult.value).toBe(0);

    const balancedResult = port.isBalanced("N");
    expect(balancedResult.value).toBe(0);

    const jointResult = port.jointHcp(["N", "S"], 0, 40);
    expect(jointResult.value).toBe(0);

    const fitResult = port.fitProbability(["N", "S"], "spades", 8);
    expect(fitResult.value).toBe(0);
  });
});
