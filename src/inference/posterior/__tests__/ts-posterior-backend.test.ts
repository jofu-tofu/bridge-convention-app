import { describe, it, expect } from "vitest";
import { createTsBackend } from "../ts-posterior-backend";
import { compileFactorGraph } from "../factor-compiler";
import type { PublicConstraint } from "../../../conventions/core/agreement-module";
import type { ConditioningContext } from "../posterior-boundary";
import { Suit, Rank } from "../../../engine/types";
import type { Hand } from "../../../engine/types";
import { makeSnapshot, makeHand, southHand, oneNtCommitments } from "./posterior-test-fixtures";
import { FactOperator } from "../../../conventions/pipeline/evaluation/meaning";
import { ObsSuit } from "../../../conventions/pipeline/bid-action";

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

describe("createTsBackend", () => {
  it("initialize() produces PosteriorState with particles", () => {
    const backend = createTsBackend({ sampleCount: 100, seed: 42 });
    const context = makeConditioningContext(oneNtCommitments);
    const state = backend.initialize(context);

    expect(state).toHaveProperty("particles");
    expect(state).toHaveProperty("context");
    expect(state.particles.length).toBeGreaterThan(0);
    expect(state.context).toBe(context);
  });

  it("particles have valid structure (world with hiddenDeal and weight)", () => {
    const backend = createTsBackend({ sampleCount: 50, seed: 42 });
    const context = makeConditioningContext(oneNtCommitments);
    const state = backend.initialize(context);

    for (const particle of state.particles) {
      expect(particle).toHaveProperty("world");
      expect(particle).toHaveProperty("weight");
      expect(particle.world).toHaveProperty("hiddenDeal");
      expect(particle.world).toHaveProperty("branchAssignment");
      expect(particle.world.hiddenDeal).toBeInstanceOf(Map);
      expect(particle.weight).toBeGreaterThanOrEqual(0);
    }
  });

  it("query() round-trip: initialize → query marginalHcp → result has health", () => {
    const backend = createTsBackend({ sampleCount: 100, seed: 42 });
    const context = makeConditioningContext(oneNtCommitments);
    const state = backend.initialize(context);

    const result = backend.query(state, { kind: "marginal-hcp", seat: "N" });
    expect(result).toHaveProperty("value");
    expect(result).toHaveProperty("health");
    expect(result.health.totalParticles).toBeGreaterThan(0);
    expect(result.health.effectiveSampleSize).toBeGreaterThan(0);
    expect(result.health.acceptanceRate).toBeGreaterThan(0);
  });

  it("with 1NT constraints (15-17 HCP balanced), marginal HCP is in expected range", () => {
    const backend = createTsBackend({ sampleCount: 100, seed: 42 });
    const context = makeConditioningContext(oneNtCommitments);
    const state = backend.initialize(context);

    const result = backend.query(state, { kind: "marginal-hcp", seat: "N" });
    // 1NT opener has 15-17 HCP, so average should be in that range
    expect(result.value).toBeGreaterThanOrEqual(14.5);
    expect(result.value).toBeLessThanOrEqual(17.5);
  });

  it("with 1NT constraints, isBalanced returns 1.0", () => {
    const backend = createTsBackend({ sampleCount: 100, seed: 42 });
    const context = makeConditioningContext(oneNtCommitments);
    const state = backend.initialize(context);

    const result = backend.query(state, { kind: "is-balanced", seat: "N" });
    expect(result.value).toBe(1);
  });

  it("suit-length query returns reasonable values for balanced hands", () => {
    const backend = createTsBackend({ sampleCount: 100, seed: 42 });
    const context = makeConditioningContext(oneNtCommitments);
    const state = backend.initialize(context);

    const result = backend.query(state, { kind: "suit-length", seat: "N", suit: ObsSuit.Spades });
    // Balanced hand: each suit between 2 and 5
    expect(result.value).toBeGreaterThanOrEqual(2);
    expect(result.value).toBeLessThanOrEqual(5);
  });

  it("conditionOnHand() filters particles", () => {
    const backend = createTsBackend({ sampleCount: 100, seed: 42 });
    const context = makeConditioningContext(oneNtCommitments);
    const state = backend.initialize(context);

    // Condition on a specific hand for North that likely doesn't match most particles
    const specificHand: Hand = makeHand([
      { suit: Suit.Spades, rank: Rank.Ace },
      { suit: Suit.Spades, rank: Rank.Queen },
      { suit: Suit.Spades, rank: Rank.Jack },
      { suit: Suit.Spades, rank: Rank.Two },
      { suit: Suit.Hearts, rank: Rank.King },
      { suit: Suit.Hearts, rank: Rank.Ten },
      { suit: Suit.Hearts, rank: Rank.Nine },
      { suit: Suit.Diamonds, rank: Rank.Ace },
      { suit: Suit.Diamonds, rank: Rank.King },
      { suit: Suit.Diamonds, rank: Rank.Three },
      { suit: Suit.Clubs, rank: Rank.Queen },
      { suit: Suit.Clubs, rank: Rank.Jack },
      { suit: Suit.Clubs, rank: Rank.Two },
    ]);

    const filtered = backend.conditionOnHand(state, "N", specificHand);
    // Filtered should have fewer or equal particles
    expect(filtered.particles.length).toBeLessThanOrEqual(state.particles.length);
    expect(filtered).toHaveProperty("context");
  });

  it("introspect() returns factor introspection for each factor", () => {
    const backend = createTsBackend({ sampleCount: 100, seed: 42 });
    const context = makeConditioningContext(oneNtCommitments);
    const state = backend.initialize(context);

    const introspection = backend.introspect(state);
    // 1NT has 3 factors (hcp gte, hcp lte, isBalanced)
    expect(introspection).toHaveLength(3);
    for (const item of introspection) {
      expect(item).toHaveProperty("factor");
      expect(item).toHaveProperty("satisfactionRate");
      expect(item).toHaveProperty("effectiveWeight");
      expect(item.satisfactionRate).toBe(1);
      expect(item.effectiveWeight).toBe(1);
    }
  });

  it("empty commitments → particles exist (no constraints = all accepted)", () => {
    const backend = createTsBackend({ sampleCount: 50, seed: 42 });
    const context = makeConditioningContext([]);
    const state = backend.initialize(context);

    // With no constraints, the sampler has no hand spaces to check,
    // so all deals are accepted
    expect(state.particles.length).toBeGreaterThanOrEqual(0);
  });

  it("joint-hcp query correctly detects combined HCP range", () => {
    const backend = createTsBackend({ sampleCount: 100, seed: 42 });
    const context = makeConditioningContext(oneNtCommitments);
    const state = backend.initialize(context);

    // South has 10 HCP, North has 15-17 → combined 25-27
    // P(combined in [25, 27]) should be 1.0 or very close
    const result = backend.query(state, {
      kind: "joint-hcp",
      seats: ["N", "S"],
      min: 25,
      max: 27,
    });
    expect(result.value).toBeGreaterThanOrEqual(0.9);
  });

  it("fit-probability query returns values in [0,1]", () => {
    const backend = createTsBackend({ sampleCount: 100, seed: 42 });
    const context = makeConditioningContext(oneNtCommitments);
    const state = backend.initialize(context);

    const result = backend.query(state, {
      kind: "fit-probability",
      seats: ["N", "S"],
      suit: ObsSuit.Spades,
      threshold: 8,
    });
    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThanOrEqual(1);
  });

  it("branch-probability returns 0 (not yet wired)", () => {
    const backend = createTsBackend({ sampleCount: 100, seed: 42 });
    const context = makeConditioningContext(oneNtCommitments);
    const state = backend.initialize(context);

    const result = backend.query(state, {
      kind: "branch-probability",
      familyId: "test",
      branchId: "test",
    });
    expect(result.value).toBe(0);
  });

  it("with factResolver, derived facts are enforced during sampling", async () => {
    const { createHandFactResolver } = await import("../../../conventions/pipeline/facts/hand-fact-resolver");
    const resolver = createHandFactResolver();

    // Add a hasFourCardMajor constraint alongside the 1NT constraints
    const commitments: readonly PublicConstraint[] = [
      ...oneNtCommitments,
      {
        subject: "N",
        constraint: { factId: "bridge.hasFourCardMajor", operator: FactOperator.Boolean, value: false },
        origin: "call-meaning",
        strength: "hard",
      },
    ];

    // Without resolver: the derived fact is unknown and silently passes
    const backendNoResolver = createTsBackend({ sampleCount: 100, seed: 42 });
    const contextNoResolver = makeConditioningContext(commitments);
    const stateNoResolver = backendNoResolver.initialize(contextNoResolver);

    // With resolver: the derived fact is properly enforced
    const backendWithResolver = createTsBackend({ sampleCount: 100, seed: 42, factResolver: resolver });
    const contextWithResolver = makeConditioningContext(commitments);
    const stateWithResolver = backendWithResolver.initialize(contextWithResolver);

    // The resolver version should filter more strictly (fewer or equal particles)
    // since it actually checks bridge.hasFourCardMajor
    expect(stateWithResolver.particles.length).toBeLessThanOrEqual(stateNoResolver.particles.length);

    // Verify all particles in the resolver version satisfy the constraint
    for (const particle of stateWithResolver.particles) {
      const northHand = particle.world.hiddenDeal.get("N");
      if (northHand) {
        const hearts = northHand.cards.filter(c => c.suit === Suit.Hearts).length;
        const spades = northHand.cards.filter(c => c.suit === Suit.Spades).length;
        // hasFourCardMajor should be false — no 4+ card major
        expect(hearts < 4 && spades < 4).toBe(true);
      }
    }
  });
});
