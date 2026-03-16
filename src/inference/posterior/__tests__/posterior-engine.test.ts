import { describe, it, expect } from "vitest";
import { createPosteriorEngine } from "../posterior-engine";
import type { PublicSnapshot } from "../../../core/contracts/module-surface";
import type { PublicConstraint } from "../../../core/contracts/agreement-module";
import { ForcingState } from "../../../core/contracts/bidding";
import { Suit, Rank, Seat } from "../../../engine/types";
import type { Hand, Card } from "../../../engine/types";

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

function makeHand(cards: Card[]): Hand {
  return { cards };
}

// South hand: 10 HCP, 4 spades, 3 hearts, 3 diamonds, 3 clubs
const southHand: Hand = makeHand([
  { suit: Suit.Spades, rank: Rank.Ace },
  { suit: Suit.Spades, rank: Rank.King },
  { suit: Suit.Spades, rank: Rank.Five },
  { suit: Suit.Spades, rank: Rank.Three },
  { suit: Suit.Hearts, rank: Rank.Queen },
  { suit: Suit.Hearts, rank: Rank.Six },
  { suit: Suit.Hearts, rank: Rank.Two },
  { suit: Suit.Diamonds, rank: Rank.Jack },
  { suit: Suit.Diamonds, rank: Rank.Seven },
  { suit: Suit.Diamonds, rank: Rank.Four },
  { suit: Suit.Clubs, rank: Rank.Eight },
  { suit: Suit.Clubs, rank: Rank.Five },
  { suit: Suit.Clubs, rank: Rank.Three },
]);

describe("createPosteriorEngine", () => {
  it("compilePublic delegates to compiler and returns hand spaces", () => {
    const engine = createPosteriorEngine({ sampleCount: 50, seed: 42 });
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

    const spaces = engine.compilePublic(snapshot);
    expect(spaces).toHaveLength(1);
    expect(spaces[0]!.seatId).toBe("N");
  });

  it("after 1NT opening (15-17 HCP, balanced), combined HCP probability is reasonable", () => {
    const engine = createPosteriorEngine({ sampleCount: 100, seed: 42 });

    // North opened 1NT: 15-17 HCP, balanced
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

    const spaces = engine.compilePublic(snapshot);
    const northSpace = spaces.find((s) => s.seatId === "N")!;
    const posterior = engine.conditionOnHand(northSpace, Seat.South, southHand);

    // South has 10 HCP, North has 15-17. Combined = 25-27, always >= 25.
    const prob25Plus = posterior.probability({
      factId: "bridge.combinedHcpInRangeLikely",
      seatId: "N",
      conditionedOn: ["25", "40"],
    });
    // Should be 1.0 or very close — since N has 15-17 and S has 10 = 25-27 total
    expect(prob25Plus).toBeGreaterThanOrEqual(0.9);
  });

  it("after Stayman 2D response (deny 4-card major), partner major probability is low", () => {
    const engine = createPosteriorEngine({ sampleCount: 100, seed: 42 });

    // North opened 1NT and responded 2D to Stayman (denying 4-card major)
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
        constraint: { factId: "hand.suitLength.H", operator: "gte", value: 4 },
        origin: "entailed-denial",
        strength: "entailed",
      },
      {
        subject: "N",
        constraint: { factId: "hand.suitLength.S", operator: "gte", value: 4 },
        origin: "entailed-denial",
        strength: "entailed",
      },
    ]);

    const spaces = engine.compilePublic(snapshot);
    const northSpace = spaces.find((s) => s.seatId === "N")!;
    const posterior = engine.conditionOnHand(northSpace, Seat.South, southHand);

    // Partner denied 4-card majors, so probability of 4+ hearts should be 0
    const probHearts = posterior.probability({
      factId: "bridge.partnerHas4HeartsLikely",
      seatId: "N",
      conditionedOn: ["H"],
    });
    expect(probHearts).toBe(0);
  });

  it("after 1NT opening, opener balanced probability is high", () => {
    const engine = createPosteriorEngine({ sampleCount: 100, seed: 42 });

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

    const spaces = engine.compilePublic(snapshot);
    const northSpace = spaces.find((s) => s.seatId === "N")!;
    const posterior = engine.conditionOnHand(northSpace, Seat.South, southHand);

    // All sampled hands must be balanced since it's a hard constraint
    const probBalanced = posterior.probability({
      factId: "bridge.openerStillBalancedLikely",
      seatId: "N",
    });
    expect(probBalanced).toBe(1);
  });

  it("probability values are always in [0,1] range", () => {
    const engine = createPosteriorEngine({ sampleCount: 50, seed: 42 });

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

    const spaces = engine.compilePublic(snapshot);
    const northSpace = spaces.find((s) => s.seatId === "N")!;
    const posterior = engine.conditionOnHand(northSpace, Seat.South, southHand);

    const factIds = [
      "bridge.partnerHas4HeartsLikely",
      "bridge.nsHaveEightCardFitLikely",
      "bridge.openerStillBalancedLikely",
      "bridge.openerHasSecondMajorLikely",
    ];

    for (const factId of factIds) {
      const prob = posterior.probability({
        factId,
        seatId: "N",
        conditionedOn: factId === "bridge.partnerHas4HeartsLikely" ? ["H"] : undefined,
      });
      expect(prob).toBeGreaterThanOrEqual(0);
      expect(prob).toBeLessThanOrEqual(1);
    }
  });

  it("deriveActingHandFacts returns values with confidence", () => {
    const engine = createPosteriorEngine({ sampleCount: 50, seed: 42 });

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

    const spaces = engine.compilePublic(snapshot);
    const northSpace = spaces.find((s) => s.seatId === "N")!;

    const facts = engine.deriveActingHandFacts(northSpace, [
      "bridge.openerStillBalancedLikely",
    ]);

    expect(facts).toHaveLength(1);
    expect(facts[0]!.factId).toBe("bridge.openerStillBalancedLikely");
    expect(facts[0]!.expectedValue).toBeGreaterThanOrEqual(0);
    expect(facts[0]!.expectedValue).toBeLessThanOrEqual(1);
    expect(facts[0]!.confidence).toBeGreaterThan(0);
    expect(facts[0]!.confidence).toBeLessThanOrEqual(1);
  });
});
