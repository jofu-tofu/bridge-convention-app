import { describe, it, expect } from "vitest";
import { resolveLatentBranches } from "../latent-branch-resolver";
import type { LatentBranchSet } from "../../../core/contracts/posterior";
import type { WeightedDealSample } from "../posterior-sampler";
import { Suit, Rank } from "../../../engine/types";
import type { Hand, Card } from "../../../engine/types";

function makeHand(cards: Card[]): Hand {
  return { cards };
}

// South hand: 4 spades, 3 hearts, 3 diamonds, 3 clubs
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

// Helper to create sample deals where partner (North) has known hands
function makeSample(northHand: Hand): WeightedDealSample {
  const hands = new Map<string, Hand>();
  hands.set("S", southHand);
  hands.set("N", northHand);
  return { hands, weight: 1 };
}

// North hand with 5+ hearts (transfer-hearts branch)
const northWithHearts: Hand = makeHand([
  { suit: Suit.Hearts, rank: Rank.Ace },
  { suit: Suit.Hearts, rank: Rank.King },
  { suit: Suit.Hearts, rank: Rank.Jack },
  { suit: Suit.Hearts, rank: Rank.Ten },
  { suit: Suit.Hearts, rank: Rank.Nine },
  { suit: Suit.Spades, rank: Rank.Queen },
  { suit: Suit.Spades, rank: Rank.Seven },
  { suit: Suit.Spades, rank: Rank.Two },
  { suit: Suit.Diamonds, rank: Rank.King },
  { suit: Suit.Diamonds, rank: Rank.Two },
  { suit: Suit.Clubs, rank: Rank.King },
  { suit: Suit.Clubs, rank: Rank.Seven },
  { suit: Suit.Clubs, rank: Rank.Two },
]);

// North hand with 5+ spades (transfer-spades branch)
const northWithSpades: Hand = makeHand([
  { suit: Suit.Spades, rank: Rank.Jack },
  { suit: Suit.Spades, rank: Rank.Ten },
  { suit: Suit.Spades, rank: Rank.Nine },
  { suit: Suit.Spades, rank: Rank.Eight },
  { suit: Suit.Spades, rank: Rank.Six },
  { suit: Suit.Hearts, rank: Rank.King },
  { suit: Suit.Hearts, rank: Rank.Three },
  { suit: Suit.Hearts, rank: Rank.Four },
  { suit: Suit.Diamonds, rank: Rank.Queen },
  { suit: Suit.Diamonds, rank: Rank.Two },
  { suit: Suit.Clubs, rank: Rank.Ace },
  { suit: Suit.Clubs, rank: Rank.Nine },
  { suit: Suit.Clubs, rank: Rank.Four },
]);

// North hand with neither 5+ hearts nor 5+ spades
const northWithNeither: Hand = makeHand([
  { suit: Suit.Hearts, rank: Rank.King },
  { suit: Suit.Hearts, rank: Rank.Three },
  { suit: Suit.Spades, rank: Rank.Jack },
  { suit: Suit.Spades, rank: Rank.Ten },
  { suit: Suit.Diamonds, rank: Rank.Queen },
  { suit: Suit.Diamonds, rank: Rank.Nine },
  { suit: Suit.Diamonds, rank: Rank.Eight },
  { suit: Suit.Diamonds, rank: Rank.Six },
  { suit: Suit.Clubs, rank: Rank.Ace },
  { suit: Suit.Clubs, rank: Rank.Nine },
  { suit: Suit.Clubs, rank: Rank.Six },
  { suit: Suit.Clubs, rank: Rank.Four },
  { suit: Suit.Clubs, rank: Rank.Two },
]);

describe("resolveLatentBranches", () => {
  const transferBranchSet: LatentBranchSet = {
    setId: "transfer-ambiguity",
    alternatives: [
      {
        branchId: "transfer-hearts",
        meaningId: "jacoby:transfer-hearts",
        description: "5+ hearts, transfer to hearts",
      },
      {
        branchId: "transfer-spades",
        meaningId: "jacoby:transfer-spades",
        description: "5+ spades, transfer to spades",
      },
    ],
  };

  it("computes marginal probabilities from samples matching branch predicates", () => {
    // 6 samples: 4 with hearts, 2 with spades
    const samples: WeightedDealSample[] = [
      makeSample(northWithHearts),
      makeSample(northWithHearts),
      makeSample(northWithHearts),
      makeSample(northWithHearts),
      makeSample(northWithSpades),
      makeSample(northWithSpades),
    ];

    const branchPredicates = new Map<string, (hand: Hand) => boolean>();
    branchPredicates.set("transfer-hearts", (hand) =>
      hand.cards.filter((c) => c.suit === Suit.Hearts).length >= 5,
    );
    branchPredicates.set("transfer-spades", (hand) =>
      hand.cards.filter((c) => c.suit === Suit.Spades).length >= 5,
    );

    const resolutions = resolveLatentBranches(
      [transferBranchSet],
      samples,
      "N",
      branchPredicates,
    );

    expect(resolutions).toHaveLength(1);
    const resolution = resolutions[0]!;
    expect(resolution.setId).toBe("transfer-ambiguity");
    expect(resolution.marginals).toHaveLength(2);

    const heartsMarginal = resolution.marginals.find((m) => m.branchId === "transfer-hearts")!;
    const spadesMarginal = resolution.marginals.find((m) => m.branchId === "transfer-spades")!;

    // 4/6 samples have 5+ hearts
    expect(heartsMarginal.probability).toBeCloseTo(4 / 6, 5);
    // 2/6 samples have 5+ spades
    expect(spadesMarginal.probability).toBeCloseTo(2 / 6, 5);
  });

  it("returns zero probability for branches with no matching samples", () => {
    // All samples have hearts, none have spades
    const samples: WeightedDealSample[] = [
      makeSample(northWithHearts),
      makeSample(northWithHearts),
    ];

    const branchPredicates = new Map<string, (hand: Hand) => boolean>();
    branchPredicates.set("transfer-hearts", (hand) =>
      hand.cards.filter((c) => c.suit === Suit.Hearts).length >= 5,
    );
    branchPredicates.set("transfer-spades", (hand) =>
      hand.cards.filter((c) => c.suit === Suit.Spades).length >= 5,
    );

    const resolutions = resolveLatentBranches(
      [transferBranchSet],
      samples,
      "N",
      branchPredicates,
    );

    const spadesMarginal = resolutions[0]!.marginals.find((m) => m.branchId === "transfer-spades")!;
    expect(spadesMarginal.probability).toBe(0);
  });

  it("handles empty sample set gracefully", () => {
    const branchPredicates = new Map<string, (hand: Hand) => boolean>();
    branchPredicates.set("transfer-hearts", () => true);
    branchPredicates.set("transfer-spades", () => true);

    const resolutions = resolveLatentBranches(
      [transferBranchSet],
      [],
      "N",
      branchPredicates,
    );

    expect(resolutions).toHaveLength(1);
    expect(resolutions[0]!.marginals.every((m) => m.probability === 0)).toBe(true);
    expect(resolutions[0]!.effectiveSampleSize).toBe(0);
  });

  it("identifies the selected branch when one alternative dominates", () => {
    // All samples match hearts branch
    const samples: WeightedDealSample[] = [
      makeSample(northWithHearts),
      makeSample(northWithHearts),
      makeSample(northWithHearts),
    ];

    const branchPredicates = new Map<string, (hand: Hand) => boolean>();
    branchPredicates.set("transfer-hearts", (hand) =>
      hand.cards.filter((c) => c.suit === Suit.Hearts).length >= 5,
    );
    branchPredicates.set("transfer-spades", (hand) =>
      hand.cards.filter((c) => c.suit === Suit.Spades).length >= 5,
    );

    const resolutions = resolveLatentBranches(
      [transferBranchSet],
      samples,
      "N",
      branchPredicates,
    );

    expect(resolutions[0]!.selectedBranchId).toBe("transfer-hearts");
  });

  it("does not select a branch when probabilities are close", () => {
    // 3 hearts, 2 spades — not dominant enough
    const samples: WeightedDealSample[] = [
      makeSample(northWithHearts),
      makeSample(northWithHearts),
      makeSample(northWithHearts),
      makeSample(northWithSpades),
      makeSample(northWithSpades),
    ];

    const branchPredicates = new Map<string, (hand: Hand) => boolean>();
    branchPredicates.set("transfer-hearts", (hand) =>
      hand.cards.filter((c) => c.suit === Suit.Hearts).length >= 5,
    );
    branchPredicates.set("transfer-spades", (hand) =>
      hand.cards.filter((c) => c.suit === Suit.Spades).length >= 5,
    );

    const resolutions = resolveLatentBranches(
      [transferBranchSet],
      samples,
      "N",
      branchPredicates,
    );

    // 60% vs 40% — not dominant enough (threshold is 80%)
    expect(resolutions[0]!.selectedBranchId).toBeUndefined();
  });

  it("handles samples where no branch predicate matches", () => {
    // All samples have neither 5+ hearts nor 5+ spades
    const samples: WeightedDealSample[] = [
      makeSample(northWithNeither),
      makeSample(northWithNeither),
    ];

    const branchPredicates = new Map<string, (hand: Hand) => boolean>();
    branchPredicates.set("transfer-hearts", (hand) =>
      hand.cards.filter((c) => c.suit === Suit.Hearts).length >= 5,
    );
    branchPredicates.set("transfer-spades", (hand) =>
      hand.cards.filter((c) => c.suit === Suit.Spades).length >= 5,
    );

    const resolutions = resolveLatentBranches(
      [transferBranchSet],
      samples,
      "N",
      branchPredicates,
    );

    expect(resolutions[0]!.marginals.every((m) => m.probability === 0)).toBe(true);
    expect(resolutions[0]!.selectedBranchId).toBeUndefined();
  });

  it("resolves multiple branch sets independently", () => {
    const secondBranchSet: LatentBranchSet = {
      setId: "minor-ambiguity",
      alternatives: [
        {
          branchId: "clubs",
          meaningId: "natural:clubs",
          description: "4+ clubs",
        },
        {
          branchId: "diamonds",
          meaningId: "natural:diamonds",
          description: "4+ diamonds",
        },
      ],
    };

    const samples: WeightedDealSample[] = [
      makeSample(northWithHearts),
      makeSample(northWithSpades),
    ];

    const branchPredicates = new Map<string, (hand: Hand) => boolean>();
    branchPredicates.set("transfer-hearts", (hand) =>
      hand.cards.filter((c) => c.suit === Suit.Hearts).length >= 5,
    );
    branchPredicates.set("transfer-spades", (hand) =>
      hand.cards.filter((c) => c.suit === Suit.Spades).length >= 5,
    );
    branchPredicates.set("clubs", (hand) =>
      hand.cards.filter((c) => c.suit === Suit.Clubs).length >= 4,
    );
    branchPredicates.set("diamonds", (hand) =>
      hand.cards.filter((c) => c.suit === Suit.Diamonds).length >= 4,
    );

    const resolutions = resolveLatentBranches(
      [transferBranchSet, secondBranchSet],
      samples,
      "N",
      branchPredicates,
    );

    expect(resolutions).toHaveLength(2);
    expect(resolutions[0]!.setId).toBe("transfer-ambiguity");
    expect(resolutions[1]!.setId).toBe("minor-ambiguity");
  });
});
