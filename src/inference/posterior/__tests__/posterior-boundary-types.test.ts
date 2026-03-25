import { describe, it, expect } from "vitest";
import type {
  InferenceHealth,
  PosteriorQueryResult,
  ConditioningContext,
} from "../posterior-boundary";
import type { PosteriorQuery } from "../posterior-boundary";
import type { FactorGraph, FactorOrigin } from "../posterior-boundary";
import type { PublicSnapshot } from "../../../conventions/core/module-surface";
import { ForcingState } from "../../../conventions";
import { Suit, Rank } from "../../../engine/types";
import type { Hand } from "../../../engine/types";

// ─── Helpers ────────────────────────────────────────────────
const origin: FactorOrigin = {
  originKind: "call-meaning",
  sourceMeaning: "stayman:ask-major",
  sourceModule: "stayman",
};

const hand: Hand = {
  cards: [
    { suit: Suit.Spades, rank: Rank.Ace },
    { suit: Suit.Hearts, rank: Rank.King },
  ],
};

const emptyFactorGraph: FactorGraph = {
  factors: [],
  ambiguitySchema: [],
  evidencePins: [],
};

const snapshot: PublicSnapshot = {
  activeModuleIds: ["stayman"],
  forcingState: ForcingState.ForcingOneRound,
  obligation: { kind: "bid", obligatedSide: "responder" },
  agreedStrain: { type: "notrump", confidence: "agreed" },
  competitionMode: "uncontested",
  captain: "responder",
  systemCapabilities: {},
  publicRegisters: {},
};

// ─── InferenceHealth ────────────────────────────────────────
describe("InferenceHealth", () => {
  it("can be constructed with all required fields", () => {
    const health: InferenceHealth = {
      effectiveSampleSize: 500,
      totalParticles: 1000,
      acceptanceRate: 0.5,
    };

    expect(health.effectiveSampleSize).toBe(500);
    expect(health.totalParticles).toBe(1000);
    expect(health.acceptanceRate).toBe(0.5);
  });

  it("can include optional posteriorEntropy", () => {
    const health: InferenceHealth = {
      effectiveSampleSize: 800,
      totalParticles: 1000,
      acceptanceRate: 0.8,
      posteriorEntropy: 3.2,
    };

    expect(health.posteriorEntropy).toBe(3.2);
  });
});

// ─── PosteriorQueryResult ───────────────────────────────────
describe("PosteriorQueryResult", () => {
  it("wraps a numeric value with health metrics", () => {
    const result: PosteriorQueryResult = {
      value: 13.5,
      health: {
        effectiveSampleSize: 900,
        totalParticles: 1000,
        acceptanceRate: 0.9,
      },
    };

    expect(result.value).toBe(13.5);
    expect(result.health.effectiveSampleSize).toBe(900);
  });

  it("supports generic type parameter", () => {
    const result: PosteriorQueryResult<boolean> = {
      value: true,
      health: {
        effectiveSampleSize: 500,
        totalParticles: 1000,
        acceptanceRate: 0.5,
      },
    };

    expect(result.value).toBe(true);
  });
});

// ─── ConditioningContext ─────────────────────────────────────
describe("ConditioningContext", () => {
  it("can be constructed with all required fields", () => {
    const ctx: ConditioningContext = {
      snapshot,
      factorGraph: emptyFactorGraph,
      observerSeat: "S",
    };

    expect(ctx.snapshot.activeModuleIds).toEqual(["stayman"]);
    expect(ctx.factorGraph.factors).toHaveLength(0);
    expect(ctx.observerSeat).toBe("S");
    expect(ctx.ownHand).toBeUndefined();
  });

  it("can include optional ownHand", () => {
    const ctx: ConditioningContext = {
      snapshot,
      factorGraph: {
        factors: [
          { kind: "hcp-range", seat: "N", min: 15, max: 17, strength: "hard", origin },
        ],
        ambiguitySchema: [],
        evidencePins: [],
      },
      observerSeat: "S",
      ownHand: hand,
    };

    expect(ctx.ownHand).toBeDefined();
    expect(ctx.ownHand!.cards).toHaveLength(2);
    expect(ctx.factorGraph.factors).toHaveLength(1);
  });
});

// ─── PosteriorQuery ───────────────────────────────────────
describe("PosteriorQuery discriminated union", () => {
  it("can construct marginal-hcp query", () => {
    const q: PosteriorQuery = { kind: "marginal-hcp", seat: "N" };
    expect(q.kind).toBe("marginal-hcp");
  });

  it("can construct suit-length query", () => {
    const q: PosteriorQuery = { kind: "suit-length", seat: "E", suit: "hearts" };
    expect(q.kind).toBe("suit-length");
  });

  it("can construct fit-probability query", () => {
    const q: PosteriorQuery = {
      kind: "fit-probability",
      seats: ["N", "S"],
      suit: "spades",
      threshold: 8,
    };
    expect(q.kind).toBe("fit-probability");
  });

  it("can construct is-balanced query", () => {
    const q: PosteriorQuery = { kind: "is-balanced", seat: "W" };
    expect(q.kind).toBe("is-balanced");
  });

  it("can construct joint-hcp query", () => {
    const q: PosteriorQuery = {
      kind: "joint-hcp",
      seats: ["N", "S"],
      min: 25,
      max: 40,
    };
    expect(q.kind).toBe("joint-hcp");
  });

  it("can construct branch-probability query", () => {
    const q: PosteriorQuery = {
      kind: "branch-probability",
      familyId: "1NT-response",
      branchId: "stayman",
    };
    expect(q.kind).toBe("branch-probability");
  });

  it("supports exhaustive switch on kind discriminant", () => {
    const queries: PosteriorQuery[] = [
      { kind: "marginal-hcp", seat: "N" },
      { kind: "suit-length", seat: "N", suit: "spades" },
      { kind: "fit-probability", seats: ["N", "S"], suit: "hearts", threshold: 8 },
      { kind: "is-balanced", seat: "E" },
      { kind: "joint-hcp", seats: ["N", "S"], min: 25, max: 40 },
      { kind: "branch-probability", familyId: "fam1", branchId: "br1" },
    ];

    const kinds = queries.map((q) => {
      switch (q.kind) {
        case "marginal-hcp":
          return q.seat;
        case "suit-length":
          return q.suit;
        case "fit-probability":
          return q.threshold;
        case "is-balanced":
          return q.seat;
        case "joint-hcp":
          return q.min;
        case "branch-probability":
          return q.branchId;
      }
    });

    expect(kinds).toEqual(["N", "spades", 8, "E", 25, "br1"]);
  });
});
