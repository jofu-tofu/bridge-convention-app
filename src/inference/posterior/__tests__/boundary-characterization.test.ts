/**
 * Phase 0 — Characterization tests for the PosteriorEngine public contract.
 *
 * These tests lock the CURRENT behavior of:
 *   compilePublic()         — PublicSnapshot → PublicHandSpace[]
 *   conditionOnHand()       — (space, seat, hand) → SeatPosterior
 *   deriveActingHandFacts() — (space, factIds) → PosteriorFactValue[]
 *
 * They will be UPDATED (not deleted) as the boundary changes during redesign.
 */
import { describe, it, expect } from "vitest";
import { createPosteriorEngine } from "../posterior-engine";
import type { PublicSnapshot } from "../../../core/contracts/module-surface";
import type { PublicConstraint } from "../../../core/contracts/agreement-module";
import { ForcingState } from "../../../core/contracts/bidding";
import { Suit, Rank, Seat } from "../../../engine/types";
import type { Hand, Card } from "../../../engine/types";

// ─── Fixtures ───────────────────────────────────────────────

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

// South hand: 10 HCP (A♠ K♠ = 7, Q♥ = 2, J♦ = 1 → 10)
// Shape: 4=3=3=3
const southHand: Hand = {
  cards: [
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
  ],
};

const NT_OPENING_COMMITMENTS: PublicConstraint[] = [
  { subject: "N", constraint: { factId: "hand.hcp", operator: "gte", value: 15 }, origin: "call-meaning", strength: "hard" },
  { subject: "N", constraint: { factId: "hand.hcp", operator: "lte", value: 17 }, origin: "call-meaning", strength: "hard" },
  { subject: "N", constraint: { factId: "hand.isBalanced", operator: "boolean", value: true }, origin: "call-meaning", strength: "hard" },
];

const STAYMAN_DENIAL_COMMITMENTS: PublicConstraint[] = [
  ...NT_OPENING_COMMITMENTS,
  { subject: "N", constraint: { factId: "hand.suitLength.H", operator: "gte", value: 4 }, origin: "entailed-denial", strength: "entailed" },
  { subject: "N", constraint: { factId: "hand.suitLength.S", operator: "gte", value: 4 }, origin: "entailed-denial", strength: "entailed" },
];

// ─── Tests ──────────────────────────────────────────────────

describe("PosteriorEngine contract", () => {
  // ── compilePublic behavior ──────────────────────────────

  describe("compilePublic behavior", () => {
    it("produces one PublicHandSpace per subject seat from 1NT commitments", () => {
      const engine = createPosteriorEngine({ sampleCount: 100, seed: 42 });
      const snapshot = makeSnapshot(NT_OPENING_COMMITMENTS);

      const spaces = engine.compilePublic(snapshot);

      expect(spaces).toHaveLength(1);
      expect(spaces[0]!.seatId).toBe("N");
    });

    it("hand space has constraints with correct clauses (gte 15, lte 17, boolean balanced)", () => {
      const engine = createPosteriorEngine({ sampleCount: 100, seed: 42 });
      const snapshot = makeSnapshot(NT_OPENING_COMMITMENTS);

      const spaces = engine.compilePublic(snapshot);
      const northSpace = spaces[0]!;

      // At least one constraint predicate should exist
      expect(northSpace.constraints.length).toBeGreaterThan(0);

      // Flatten all clauses across all constraint predicates
      const allClauses = northSpace.constraints.flatMap((c) => c.clauses);

      // Should contain the three expected clauses
      const hcpGte = allClauses.find(
        (cl) => cl.factId === "hand.hcp" && cl.operator === "gte",
      );
      expect(hcpGte).toBeDefined();
      expect(hcpGte!.value).toBe(15);

      const hcpLte = allClauses.find(
        (cl) => cl.factId === "hand.hcp" && cl.operator === "lte",
      );
      expect(hcpLte).toBeDefined();
      expect(hcpLte!.value).toBe(17);

      const balanced = allClauses.find(
        (cl) => cl.factId === "hand.isBalanced" && cl.operator === "boolean",
      );
      expect(balanced).toBeDefined();
      expect(balanced!.value).toBe(true);
    });

    it("returns empty array for empty commitments", () => {
      const engine = createPosteriorEngine({ sampleCount: 100, seed: 42 });
      const snapshot = makeSnapshot([]);

      const spaces = engine.compilePublic(snapshot);

      expect(spaces).toEqual([]);
    });

    it("returns one space per subject seat with multiple subjects", () => {
      const engine = createPosteriorEngine({ sampleCount: 100, seed: 42 });
      const snapshot = makeSnapshot([
        { subject: "N", constraint: { factId: "hand.hcp", operator: "gte", value: 15 }, origin: "call-meaning", strength: "hard" },
        { subject: "S", constraint: { factId: "hand.hcp", operator: "gte", value: 6 }, origin: "call-meaning", strength: "hard" },
      ]);

      const spaces = engine.compilePublic(snapshot);

      expect(spaces).toHaveLength(2);
      const seatIds = spaces.map((s) => s.seatId).sort();
      expect(seatIds).toEqual(["N", "S"]);
    });
  });

  // ── conditionOnHand behavior ────────────────────────────

  describe("conditionOnHand behavior", () => {
    it("returns SeatPosterior with correct seatId and positive sample size", () => {
      const engine = createPosteriorEngine({ sampleCount: 100, seed: 42 });
      const snapshot = makeSnapshot(NT_OPENING_COMMITMENTS);
      const spaces = engine.compilePublic(snapshot);
      const northSpace = spaces.find((s) => s.seatId === "N")!;

      const posterior = engine.conditionOnHand(northSpace, Seat.South, southHand);

      expect(posterior.seatId).toBe("N");
      expect(posterior.effectiveSampleSize).toBeGreaterThan(0);
    });

    it("probability() returns values in [0, 1] for all 5 known fact handlers", () => {
      const engine = createPosteriorEngine({ sampleCount: 100, seed: 42 });
      const snapshot = makeSnapshot(NT_OPENING_COMMITMENTS);
      const spaces = engine.compilePublic(snapshot);
      const northSpace = spaces.find((s) => s.seatId === "N")!;

      const posterior = engine.conditionOnHand(northSpace, Seat.South, southHand);

      const queries = [
        { factId: "bridge.partnerHas4CardMajorLikely", seatId: "N", conditionedOn: ["H"] },
        { factId: "bridge.nsHaveEightCardFitLikely", seatId: "N" },
        { factId: "bridge.combinedHcpInRangeLikely", seatId: "N", conditionedOn: ["25", "40"] },
        { factId: "bridge.openerStillBalancedLikely", seatId: "N" },
        { factId: "bridge.openerHasSecondMajorLikely", seatId: "N" },
      ];

      for (const query of queries) {
        const prob = posterior.probability(query);
        expect(prob).toBeGreaterThanOrEqual(0);
        expect(prob).toBeLessThanOrEqual(1);
      }
    });

    it("distribution('hcp') returns non-empty array with values summing to ~1.0", () => {
      const engine = createPosteriorEngine({ sampleCount: 100, seed: 42 });
      const snapshot = makeSnapshot(NT_OPENING_COMMITMENTS);
      const spaces = engine.compilePublic(snapshot);
      const northSpace = spaces.find((s) => s.seatId === "N")!;

      const posterior = engine.conditionOnHand(northSpace, Seat.South, southHand);
      const dist = posterior.distribution("hcp");

      expect(dist.length).toBeGreaterThan(0);

      const totalProb = dist.reduce((sum, entry) => sum + entry.probability, 0);
      expect(totalProb).toBeCloseTo(1.0, 1);

      // Each entry has value (number) and probability in [0,1]
      for (const entry of dist) {
        expect(typeof entry.value).toBe("number");
        expect(entry.probability).toBeGreaterThanOrEqual(0);
        expect(entry.probability).toBeLessThanOrEqual(1);
      }
    });

    it("after 1NT (15-17 balanced), conditioning on 10 HCP South → P(combined 25+ HCP) ≥ 0.9", () => {
      const engine = createPosteriorEngine({ sampleCount: 100, seed: 42 });
      const snapshot = makeSnapshot(NT_OPENING_COMMITMENTS);
      const spaces = engine.compilePublic(snapshot);
      const northSpace = spaces.find((s) => s.seatId === "N")!;

      const posterior = engine.conditionOnHand(northSpace, Seat.South, southHand);
      const prob25Plus = posterior.probability({
        factId: "bridge.combinedHcpInRangeLikely",
        seatId: "N",
        conditionedOn: ["25", "40"],
      });

      // South=10, North=15-17 ⇒ combined=25-27, always ≥25
      expect(prob25Plus).toBeGreaterThanOrEqual(0.9);
    });

    it("after Stayman denial (entailed-denial of 4+ H and 4+ S), P(partner 4+ hearts) = 0", () => {
      const engine = createPosteriorEngine({ sampleCount: 100, seed: 42 });
      const snapshot = makeSnapshot(STAYMAN_DENIAL_COMMITMENTS);
      const spaces = engine.compilePublic(snapshot);
      const northSpace = spaces.find((s) => s.seatId === "N")!;

      const posterior = engine.conditionOnHand(northSpace, Seat.South, southHand);
      const probHearts = posterior.probability({
        factId: "bridge.partnerHas4CardMajorLikely",
        seatId: "N",
        conditionedOn: ["H"],
      });

      expect(probHearts).toBe(0);
    });

    it("after 1NT (balanced constraint), P(opener balanced) = 1.0", () => {
      const engine = createPosteriorEngine({ sampleCount: 100, seed: 42 });
      const snapshot = makeSnapshot(NT_OPENING_COMMITMENTS);
      const spaces = engine.compilePublic(snapshot);
      const northSpace = spaces.find((s) => s.seatId === "N")!;

      const posterior = engine.conditionOnHand(northSpace, Seat.South, southHand);
      const probBalanced = posterior.probability({
        factId: "bridge.openerStillBalancedLikely",
        seatId: "N",
      });

      expect(probBalanced).toBe(1);
    });
  });

  // ── deriveActingHandFacts behavior ──────────────────────

  describe("deriveActingHandFacts behavior", () => {
    it("returns one PosteriorFactValue per requested factId", () => {
      const engine = createPosteriorEngine({ sampleCount: 100, seed: 42 });
      const snapshot = makeSnapshot(NT_OPENING_COMMITMENTS);
      const spaces = engine.compilePublic(snapshot);
      const northSpace = spaces.find((s) => s.seatId === "N")!;

      const requestedIds = [
        "bridge.partnerHas4CardMajorLikely",
        "bridge.combinedHcpInRangeLikely",
      ];
      const facts = engine.deriveActingHandFacts(northSpace, requestedIds);

      expect(facts).toHaveLength(2);
      expect(facts[0]!.factId).toBe(requestedIds[0]);
      expect(facts[1]!.factId).toBe(requestedIds[1]);
    });

    it("each result has expectedValue in [0,1] and confidence > 0", () => {
      const engine = createPosteriorEngine({ sampleCount: 100, seed: 42 });
      const snapshot = makeSnapshot(NT_OPENING_COMMITMENTS);
      const spaces = engine.compilePublic(snapshot);
      const northSpace = spaces.find((s) => s.seatId === "N")!;

      const facts = engine.deriveActingHandFacts(northSpace, [
        "bridge.openerStillBalancedLikely",
        "bridge.partnerHas4CardMajorLikely",
      ]);

      for (const fact of facts) {
        expect(fact.expectedValue).toBeGreaterThanOrEqual(0);
        expect(fact.expectedValue).toBeLessThanOrEqual(1);
        expect(fact.confidence).toBeGreaterThan(0);
      }
    });

    it("unknown factIds get expectedValue: 0 and confidence: 0", () => {
      const engine = createPosteriorEngine({ sampleCount: 100, seed: 42 });
      const snapshot = makeSnapshot(NT_OPENING_COMMITMENTS);
      const spaces = engine.compilePublic(snapshot);
      const northSpace = spaces.find((s) => s.seatId === "N")!;

      const facts = engine.deriveActingHandFacts(northSpace, ["nonexistent.factId"]);

      expect(facts).toHaveLength(1);
      expect(facts[0]!.factId).toBe("nonexistent.factId");
      expect(facts[0]!.expectedValue).toBe(0);
      expect(facts[0]!.confidence).toBe(0);
    });
  });
});
