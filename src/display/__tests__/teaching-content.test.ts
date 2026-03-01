import { describe, it, expect } from "vitest";
import { Seat, Suit, Rank } from "../../engine/types";
import type { BiddingContext } from "../../conventions/core/types";
import { staymanConfig } from "../../conventions/definitions/stayman";
import { staymanExplanations } from "../../conventions/definitions/stayman";
import { bergenConfig } from "../../conventions/definitions/bergen-raises";
import { weakTwosConfig } from "../../conventions/definitions/weak-twos";
import { saycConfig } from "../../conventions/definitions/sayc";
import { ConventionCategory } from "../../conventions/core/types";
import type { ConventionConfig } from "../../conventions/core/types";
import {
  extractTeachingContent,
  evaluateTeachingRound,
} from "../teaching-content";

describe("extractTeachingContent", () => {
  it("returns non-null for staymanConfig with explanations", () => {
    const result = extractTeachingContent(staymanConfig, staymanExplanations);
    expect(result).not.toBeNull();
    expect(result!.conventionId).toBe("stayman");
    expect(result!.conventionName).toBe("Stayman");
  });

  it("returns reasonable round count for Stayman (>=3)", () => {
    const result = extractTeachingContent(staymanConfig, staymanExplanations);
    expect(result).not.toBeNull();
    // Round 1 (1NT-P): responder ask
    // Round 2 (1NT-P-2C-P): opener response
    // Round 3 (1NT-P-2C-P-2H-P / 2S-P / 2D-P): responder rebids
    // Plus 2NT Stayman rounds
    expect(result!.rounds.length).toBeGreaterThanOrEqual(3);
  });

  it("has totalBidOptions matching expected bid count for Stayman", () => {
    const result = extractTeachingContent(staymanConfig, staymanExplanations);
    expect(result).not.toBeNull();
    // Count all bid options across all rounds
    const countedBids = result!.rounds.reduce(
      (sum, r) => sum + r.bidOptions.length,
      0,
    );
    expect(result!.totalBidOptions).toBe(countedBids);
    // Stayman has many bids: ask, 3 responses, rebids per response path
    expect(result!.totalBidOptions).toBeGreaterThanOrEqual(5);
  });

  it("includes teaching metadata from staymanExplanations", () => {
    const result = extractTeachingContent(staymanConfig, staymanExplanations);
    expect(result).not.toBeNull();
    expect(result!.teaching).not.toBeNull();
    expect(result!.teaching!.purpose).toContain("4-4 major");
  });

  it("has at least one bid with isArtificial in bidMetadata", () => {
    const result = extractTeachingContent(staymanConfig, staymanExplanations);
    expect(result).not.toBeNull();
    const allBids = result!.rounds.flatMap((r) => r.bidOptions);
    const artificialBids = allBids.filter(
      (b) => b.bidMetadata?.isArtificial === true,
    );
    expect(artificialBids.length).toBeGreaterThanOrEqual(1);
  });

  it("returns non-null for Weak Twos with bid options from all triggers", () => {
    const result = extractTeachingContent(weakTwosConfig);
    expect(result).not.toBeNull();
    expect(result!.rounds.length).toBeGreaterThanOrEqual(1);
    expect(result!.totalBidOptions).toBeGreaterThan(0);
  });

  it("returns null when config has no ruleTree", () => {
    const noTreeConfig: ConventionConfig = {
      id: "test-no-tree",
      name: "Test No Tree",
      description: "A config without a rule tree",
      category: ConventionCategory.Asking,
      dealConstraints: { seats: [] },
    };
    const result = extractTeachingContent(noTreeConfig);
    expect(result).toBeNull();
  });

  it("returns non-null for all conventions", () => {
    const configs = [
      staymanConfig,
      bergenConfig,
      weakTwosConfig,
      saycConfig,
    ];
    for (const config of configs) {
      const result = extractTeachingContent(config);
      expect(result).not.toBeNull();
    }
  });
});

describe("evaluateTeachingRound", () => {
  // Helper: create a minimal BiddingContext
  function makeContext(
    hcp: number,
    shape: readonly [number, number, number, number],
  ): BiddingContext {
    // Build a hand with the right shape and approximate HCP
    // Shape: [spades, hearts, diamonds, clubs]
    const cards: Array<{ suit: Suit; rank: Rank }> = [];
    const suits = [Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs];
    const ranks = [
      Rank.Two,
      Rank.Three,
      Rank.Four,
      Rank.Five,
      Rank.Six,
      Rank.Seven,
      Rank.Eight,
      Rank.Nine,
      Rank.Ten,
      Rank.Jack,
      Rank.Queen,
      Rank.King,
      Rank.Ace,
    ];

    for (let s = 0; s < 4; s++) {
      for (let i = 0; i < shape[s]!; i++) {
        cards.push({ suit: suits[s]!, rank: ranks[i]! });
      }
    }

    return {
      hand: { cards },
      auction: { entries: [], isComplete: false },
      seat: Seat.South,
      evaluation: {
        hcp,
        shape,
        distribution: { shortness: 0, length: 0, total: 0 },
        totalPoints: hcp,
        strategy: "hcp",
      },
      opponentConventionIds: [],
    };
  }

  it("shows failureDetail when hand has 7 HCP against hcpMin(8)", () => {
    const result = extractTeachingContent(staymanConfig, staymanExplanations);
    expect(result).not.toBeNull();

    // Find a round with an hcp-min condition in bid options
    const round = result!.rounds.find((r) =>
      r.bidOptions.some((b) =>
        b.handConditions.some((c) => c.condition.inference?.type === "hcp-min"),
      ),
    );
    expect(round).toBeDefined();

    // 7 HCP, 4-4-3-2 shape (has a 4-card major)
    const ctx = makeContext(7, [4, 4, 3, 2]);
    const evaluated = evaluateTeachingRound(round!, ctx);

    // Find the bid option with hcp-min condition
    const bidWithHcp = evaluated.evaluatedBidOptions.find((b) =>
      b.evaluatedConditions.some(
        (c) => c.condition.inference?.type === "hcp-min" && !c.passed,
      ),
    );
    expect(bidWithHcp).toBeDefined();

    const failedHcp = bidWithHcp!.evaluatedConditions.find(
      (c) => c.condition.inference?.type === "hcp-min" && !c.passed,
    );
    expect(failedHcp).toBeDefined();
    expect(failedHcp!.failureDetail).toContain("short");
  });

  it("marks handWouldMatch true and resolvedCall non-null for matching hand", () => {
    const result = extractTeachingContent(staymanConfig, staymanExplanations);
    expect(result).not.toBeNull();

    // Find a round with hand conditions
    const round = result!.rounds.find((r) =>
      r.bidOptions.some((b) => b.handConditions.length > 0),
    );
    expect(round).toBeDefined();

    // 12 HCP, 4-4-3-2 shape — should match Stayman ask (8+ HCP, 4+ major)
    const ctx = makeContext(12, [4, 4, 3, 2]);
    const evaluated = evaluateTeachingRound(round!, ctx);

    const matchingBid = evaluated.evaluatedBidOptions.find(
      (b) => b.handWouldMatch,
    );
    expect(matchingBid).toBeDefined();
    expect(matchingBid!.resolvedCall).not.toBeNull();
  });

  it("marks handWouldMatch false for non-matching hand", () => {
    const result = extractTeachingContent(staymanConfig, staymanExplanations);
    expect(result).not.toBeNull();

    // Find a round with hand conditions
    const round = result!.rounds.find((r) =>
      r.bidOptions.some((b) => b.handConditions.length > 0),
    );
    expect(round).toBeDefined();

    // 5 HCP, 3-3-4-3 shape — no 4-card major, too weak
    const ctx = makeContext(5, [3, 3, 4, 3]);
    const evaluated = evaluateTeachingRound(round!, ctx);

    // All bids should fail (too weak, no major)
    const allFail = evaluated.evaluatedBidOptions.every((b) => !b.handWouldMatch);
    expect(allFail).toBe(true);
  });
});
