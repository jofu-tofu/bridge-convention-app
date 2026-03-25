import { describe, it, expect } from "vitest";
import {
  BEGINNER_PROFILE,
  CLUB_PLAYER_PROFILE,
  EXPERT_PROFILE,
  WORLD_CLASS_PROFILE,
  PLAY_PROFILES,
} from "../play-profiles";
import { createProfileStrategyProvider } from "../profile-play-strategy";
import type { PlayContext } from "../../../conventions/core/strategy-types";
import { Suit, Rank, Seat, BidSuit } from "../../../engine/types";
import type { Card, Contract, PlayedCard } from "../../../engine/types";
import type { PublicBeliefs, DerivedRanges } from "../../../inference/inference-types";

// ── Test helpers ────────────────────────────────────────────────────

function card(suit: Suit, rank: Rank): Card {
  return { suit, rank };
}

function playedCard(seat: Seat, suit: Suit, rank: Rank): PlayedCard {
  return { card: card(suit, rank), seat };
}

function makeContract(declarer: Seat, strain: BidSuit): Contract {
  return { level: 3, strain, doubled: false, redoubled: false, declarer };
}

function makeContext(overrides: Partial<PlayContext>): PlayContext {
  return {
    hand: { cards: [] },
    currentTrick: [],
    previousTricks: [],
    contract: makeContract(Seat.South, BidSuit.NoTrump),
    seat: Seat.West,
    trumpSuit: undefined,
    legalPlays: [],
    ...overrides,
  };
}

function makeRanges(overrides: Partial<DerivedRanges>): DerivedRanges {
  return {
    hcp: { min: 0, max: 40 },
    suitLengths: {
      [Suit.Spades]: { min: 0, max: 13 },
      [Suit.Hearts]: { min: 0, max: 13 },
      [Suit.Diamonds]: { min: 0, max: 13 },
      [Suit.Clubs]: { min: 0, max: 13 },
    },
    isBalanced: undefined,
    ...overrides,
  };
}

function makeBeliefs(seat: Seat, ranges: DerivedRanges): PublicBeliefs {
  return { seat, constraints: [], ranges, qualitative: [] };
}

/** Seeded LCG for deterministic tests. */
function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ── Profile constant tests ──────────────────────────────────────────

describe("PlayProfile constants", () => {
  it("beginner has skip rate and skippable heuristics", () => {
    expect(BEGINNER_PROFILE.heuristicSkipRate).toBe(0.15);
    expect(BEGINNER_PROFILE.skippableHeuristics).toContain("cover-honor-with-honor");
    expect(BEGINNER_PROFILE.skippableHeuristics).toContain("trump-management");
    expect(BEGINNER_PROFILE.useInferences).toBe(false);
    expect(BEGINNER_PROFILE.usePosterior).toBe(false);
  });

  it("club player uses inferences with noise", () => {
    expect(CLUB_PLAYER_PROFILE.heuristicSkipRate).toBe(0);
    expect(CLUB_PLAYER_PROFILE.useInferences).toBe(true);
    expect(CLUB_PLAYER_PROFILE.inferenceNoise).toBe(0.25);
    expect(CLUB_PLAYER_PROFILE.usePosterior).toBe(false);
  });

  it("expert uses everything with zero noise", () => {
    expect(EXPERT_PROFILE.heuristicSkipRate).toBe(0);
    expect(EXPERT_PROFILE.useInferences).toBe(true);
    expect(EXPERT_PROFILE.inferenceNoise).toBe(0);
    expect(EXPERT_PROFILE.usePosterior).toBe(true);
    expect(EXPERT_PROFILE.useCardCounting).toBe(true);
  });

  it("PLAY_PROFILES maps all four IDs", () => {
    expect(Object.keys(PLAY_PROFILES)).toHaveLength(4);
    expect(PLAY_PROFILES["beginner"]).toBe(BEGINNER_PROFILE);
    expect(PLAY_PROFILES["club-player"]).toBe(CLUB_PLAYER_PROFILE);
    expect(PLAY_PROFILES["expert"]).toBe(EXPERT_PROFILE);
    expect(PLAY_PROFILES["world-class"]).toBe(WORLD_CLASS_PROFILE);
  });
});

// ── Beginner provider tests ─────────────────────────────────────────

describe("Beginner provider", () => {
  it("returns a valid PlayStrategy", () => {
    const provider = createProfileStrategyProvider(BEGINNER_PROFILE, { rng: seededRng(42) });
    const strategy = provider.getStrategy();
    expect(strategy.id).toBe("beginner");
    expect(strategy.name).toBe("Beginner Play");
  });

  it("skips cover-honor heuristic at expected rate with seeded RNG", async () => {
    // Run many trials: when an honor is led and we have a covering honor,
    // beginner should sometimes fail to cover (~15% of the time).
    const rng = seededRng(123);
    const provider = createProfileStrategyProvider(BEGINNER_PROFILE, { rng });
    const strategy = provider.getStrategy();

    let covered = 0;
    let notCovered = 0;
    const trials = 200;

    for (let i = 0; i < trials; i++) {
      const ctx = makeContext({
        // Queen led, we have the King — cover-honor should apply
        currentTrick: [playedCard(Seat.North, Suit.Hearts, Rank.Queen)],
        seat: Seat.East,
        contract: makeContract(Seat.South, BidSuit.Spades),
        trumpSuit: Suit.Spades,
        legalPlays: [
          card(Suit.Hearts, Rank.King),
          card(Suit.Hearts, Rank.Three),
        ],
      });

      const result = await strategy.suggest(ctx);
      if (result.card.rank === Rank.King) {
        covered++;
      } else {
        notCovered++;
      }
    }

    // With 15% skip rate, we expect ~85% coverage.
    // Allow some variance: 70-95% should cover.
    const coverRate = covered / trials;
    expect(coverRate).toBeGreaterThan(0.70);
    expect(coverRate).toBeLessThan(0.95);
    // Some should be skipped
    expect(notCovered).toBeGreaterThan(0);
  });

  it("does not skip non-skippable heuristics", async () => {
    // second-hand-low is not in skippableHeuristics — should always work
    const rng = seededRng(42);
    const provider = createProfileStrategyProvider(BEGINNER_PROFILE, { rng });
    const strategy = provider.getStrategy();

    for (let i = 0; i < 50; i++) {
      const ctx = makeContext({
        currentTrick: [playedCard(Seat.North, Suit.Hearts, Rank.Five)],
        seat: Seat.East,
        contract: makeContract(Seat.South, BidSuit.Spades),
        trumpSuit: Suit.Spades,
        legalPlays: [
          card(Suit.Hearts, Rank.Nine),
          card(Suit.Hearts, Rank.Three),
        ],
      });

      const result = await strategy.suggest(ctx);
      // second-hand-low should always pick the Three
      expect(result.card.rank).toBe(Rank.Three);
    }
  });
});

// ── Club Player provider tests ──────────────────────────────────────

describe("Club Player provider", () => {
  it("returns a valid PlayStrategy", () => {
    const provider = createProfileStrategyProvider(CLUB_PLAYER_PROFILE);
    const strategy = provider.getStrategy();
    expect(strategy.id).toBe("club-player");
  });

  it("prefers partner's shown suit on opening lead when inferences available", async () => {
    const provider = createProfileStrategyProvider(CLUB_PLAYER_PROFILE);
    const strategy = provider.getStrategy();

    // Partner (East) showed long hearts, declarer (South) showed long spades
    const partnerRanges = makeRanges({
      suitLengths: {
        [Suit.Spades]: { min: 1, max: 3 },
        [Suit.Hearts]: { min: 5, max: 7 },
        [Suit.Diamonds]: { min: 2, max: 4 },
        [Suit.Clubs]: { min: 2, max: 4 },
      },
    });
    const declarerRanges = makeRanges({
      hcp: { min: 15, max: 17 },
      suitLengths: {
        [Suit.Spades]: { min: 5, max: 6 },
        [Suit.Hearts]: { min: 2, max: 3 },
        [Suit.Diamonds]: { min: 2, max: 4 },
        [Suit.Clubs]: { min: 2, max: 4 },
      },
    });

    const inferences: Record<Seat, PublicBeliefs> = {
      [Seat.North]: makeBeliefs(Seat.North, makeRanges({})),
      [Seat.East]: makeBeliefs(Seat.East, partnerRanges),
      [Seat.South]: makeBeliefs(Seat.South, declarerRanges),
      [Seat.West]: makeBeliefs(Seat.West, makeRanges({})),
    };

    const ctx = makeContext({
      currentTrick: [],
      previousTricks: [],
      seat: Seat.West,
      contract: makeContract(Seat.South, BidSuit.NoTrump),
      trumpSuit: undefined,
      hand: {
        cards: [
          card(Suit.Spades, Rank.Jack),
          card(Suit.Spades, Rank.Eight),
          card(Suit.Hearts, Rank.Six),
          card(Suit.Hearts, Rank.Four),
          card(Suit.Hearts, Rank.Two),
          card(Suit.Diamonds, Rank.King),
          card(Suit.Diamonds, Rank.Nine),
          card(Suit.Diamonds, Rank.Five),
          card(Suit.Clubs, Rank.Queen),
          card(Suit.Clubs, Rank.Ten),
          card(Suit.Clubs, Rank.Seven),
          card(Suit.Clubs, Rank.Three),
          card(Suit.Clubs, Rank.Two),
        ],
      },
      legalPlays: [
        card(Suit.Spades, Rank.Jack),
        card(Suit.Spades, Rank.Eight),
        card(Suit.Hearts, Rank.Six),
        card(Suit.Hearts, Rank.Four),
        card(Suit.Hearts, Rank.Two),
        card(Suit.Diamonds, Rank.King),
        card(Suit.Diamonds, Rank.Nine),
        card(Suit.Diamonds, Rank.Five),
        card(Suit.Clubs, Rank.Queen),
        card(Suit.Clubs, Rank.Ten),
        card(Suit.Clubs, Rank.Seven),
        card(Suit.Clubs, Rank.Three),
        card(Suit.Clubs, Rank.Two),
      ],
      inferences,
    });

    const result = await strategy.suggest(ctx);
    // Should lead hearts (partner's suit), not spades (declarer's suit)
    expect(result.card.suit).toBe(Suit.Hearts);
    expect(result.reason).toBe("auction-aware-lead");
  });

  it("falls back to base heuristics when inferences are absent", async () => {
    const provider = createProfileStrategyProvider(CLUB_PLAYER_PROFILE);
    const strategy = provider.getStrategy();

    const ctx = makeContext({
      currentTrick: [playedCard(Seat.North, Suit.Hearts, Rank.Five)],
      seat: Seat.East,
      contract: makeContract(Seat.South, BidSuit.Spades),
      trumpSuit: Suit.Spades,
      legalPlays: [
        card(Suit.Hearts, Rank.Nine),
        card(Suit.Hearts, Rank.Three),
      ],
      // No inferences
    });

    const result = await strategy.suggest(ctx);
    // Falls through to second-hand-low
    expect(result.card.rank).toBe(Rank.Three);
    expect(result.reason).toBe("second-hand-low");
  });
});

// ── Expert provider tests ───────────────────────────────────────────

describe("Expert provider", () => {
  it("returns a valid PlayStrategy", () => {
    const provider = createProfileStrategyProvider(EXPERT_PROFILE);
    const strategy = provider.getStrategy();
    expect(strategy.id).toBe("expert");
  });

  it("has onAuctionComplete method", () => {
    const provider = createProfileStrategyProvider(EXPERT_PROFILE);
    expect(provider.onAuctionComplete).toBeDefined();
  });

  it("includes inference heuristics in chain", async () => {
    const provider = createProfileStrategyProvider(EXPERT_PROFILE);
    const strategy = provider.getStrategy();

    // Same test as Club Player — expert should also use auction-aware lead
    const partnerRanges = makeRanges({
      suitLengths: {
        [Suit.Spades]: { min: 1, max: 3 },
        [Suit.Hearts]: { min: 5, max: 7 },
        [Suit.Diamonds]: { min: 2, max: 4 },
        [Suit.Clubs]: { min: 2, max: 4 },
      },
    });
    const declarerRanges = makeRanges({
      hcp: { min: 15, max: 17 },
      suitLengths: {
        [Suit.Spades]: { min: 5, max: 6 },
        [Suit.Hearts]: { min: 2, max: 3 },
        [Suit.Diamonds]: { min: 2, max: 4 },
        [Suit.Clubs]: { min: 2, max: 4 },
      },
    });

    const inferences: Record<Seat, PublicBeliefs> = {
      [Seat.North]: makeBeliefs(Seat.North, makeRanges({})),
      [Seat.East]: makeBeliefs(Seat.East, partnerRanges),
      [Seat.South]: makeBeliefs(Seat.South, declarerRanges),
      [Seat.West]: makeBeliefs(Seat.West, makeRanges({})),
    };

    const ctx = makeContext({
      currentTrick: [],
      previousTricks: [],
      seat: Seat.West,
      contract: makeContract(Seat.South, BidSuit.NoTrump),
      hand: {
        cards: [
          card(Suit.Spades, Rank.Jack),
          card(Suit.Hearts, Rank.Six),
          card(Suit.Hearts, Rank.Four),
          card(Suit.Hearts, Rank.Two),
          card(Suit.Diamonds, Rank.King),
          card(Suit.Diamonds, Rank.Nine),
          card(Suit.Diamonds, Rank.Five),
          card(Suit.Clubs, Rank.Queen),
          card(Suit.Clubs, Rank.Ten),
          card(Suit.Clubs, Rank.Seven),
          card(Suit.Clubs, Rank.Three),
          card(Suit.Clubs, Rank.Two),
          card(Suit.Spades, Rank.Eight),
        ],
      },
      legalPlays: [
        card(Suit.Spades, Rank.Jack),
        card(Suit.Hearts, Rank.Six),
        card(Suit.Hearts, Rank.Four),
        card(Suit.Hearts, Rank.Two),
        card(Suit.Diamonds, Rank.King),
        card(Suit.Diamonds, Rank.Nine),
        card(Suit.Diamonds, Rank.Five),
        card(Suit.Clubs, Rank.Queen),
        card(Suit.Clubs, Rank.Ten),
        card(Suit.Clubs, Rank.Seven),
        card(Suit.Clubs, Rank.Three),
        card(Suit.Clubs, Rank.Two),
        card(Suit.Spades, Rank.Eight),
      ],
      inferences,
    });

    const result = await strategy.suggest(ctx);
    expect(result.card.suit).toBe(Suit.Hearts);
    expect(result.reason).toBe("auction-aware-lead");
  });
});

// ── Provider lifecycle tests ────────────────────────────────────────

describe("PlayStrategyProvider lifecycle", () => {
  it("beginner provider has no onAuctionComplete", () => {
    const provider = createProfileStrategyProvider(BEGINNER_PROFILE);
    expect(provider.onAuctionComplete).toBeUndefined();
  });

  it("club player provider has no onAuctionComplete", () => {
    const provider = createProfileStrategyProvider(CLUB_PLAYER_PROFILE);
    expect(provider.onAuctionComplete).toBeUndefined();
  });

  it("expert onAuctionComplete does not throw", () => {
    const provider = createProfileStrategyProvider(EXPERT_PROFILE);
    const inferences: Record<Seat, PublicBeliefs> = {
      [Seat.North]: makeBeliefs(Seat.North, makeRanges({})),
      [Seat.East]: makeBeliefs(Seat.East, makeRanges({})),
      [Seat.South]: makeBeliefs(Seat.South, makeRanges({})),
      [Seat.West]: makeBeliefs(Seat.West, makeRanges({})),
    };
    expect(() => provider.onAuctionComplete!(inferences)).not.toThrow();
  });
});
