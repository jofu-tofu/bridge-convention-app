import { describe, it, expect } from "vitest";
import { Seat, Suit, Rank, BidSuit, Vulnerability } from "../../engine/types";
import type { Hand, Deal, Call } from "../../engine/types";
import type { BiddingRule, ConventionConfig } from "../../conventions/core/types";
import { ConventionCategory } from "../../conventions/core/types";
import type { BidHistoryEntry } from "../../shared/types";
import { prepareRulesForDisplay, groupBidsByRound } from "../rules-display";
import { conditionedRule, hcpMin, suitMin, auctionMatches } from "../../conventions/core/conditions";

// --- Fixtures ---

function makeHand(cards: Array<{ suit: Suit; rank: Rank }>): Hand {
  return { cards };
}

/** A 15 HCP balanced hand for North */
const northHand: Hand = makeHand([
  { suit: Suit.Spades, rank: Rank.Ace },
  { suit: Suit.Spades, rank: Rank.King },
  { suit: Suit.Spades, rank: Rank.Five },
  { suit: Suit.Hearts, rank: Rank.Queen },
  { suit: Suit.Hearts, rank: Rank.Jack },
  { suit: Suit.Hearts, rank: Rank.Four },
  { suit: Suit.Hearts, rank: Rank.Two },
  { suit: Suit.Diamonds, rank: Rank.King },
  { suit: Suit.Diamonds, rank: Rank.Nine },
  { suit: Suit.Diamonds, rank: Rank.Seven },
  { suit: Suit.Clubs, rank: Rank.Queen },
  { suit: Suit.Clubs, rank: Rank.Eight },
  { suit: Suit.Clubs, rank: Rank.Three },
]);

/** A 10 HCP hand for South with 4+ spades */
const southHand: Hand = makeHand([
  { suit: Suit.Spades, rank: Rank.Queen },
  { suit: Suit.Spades, rank: Rank.Jack },
  { suit: Suit.Spades, rank: Rank.Ten },
  { suit: Suit.Spades, rank: Rank.Nine },
  { suit: Suit.Hearts, rank: Rank.King },
  { suit: Suit.Hearts, rank: Rank.Eight },
  { suit: Suit.Hearts, rank: Rank.Three },
  { suit: Suit.Diamonds, rank: Rank.Jack },
  { suit: Suit.Diamonds, rank: Rank.Six },
  { suit: Suit.Diamonds, rank: Rank.Two },
  { suit: Suit.Clubs, rank: Rank.Seven },
  { suit: Suit.Clubs, rank: Rank.Five },
  { suit: Suit.Clubs, rank: Rank.Two },
]);

const testDeal: Deal = {
  hands: {
    [Seat.North]: northHand,
    [Seat.East]: makeHand(Array.from({ length: 13 }, () => ({ suit: Suit.Clubs, rank: Rank.Two }))),
    [Seat.South]: southHand,
    [Seat.West]: makeHand(Array.from({ length: 13 }, () => ({ suit: Suit.Clubs, rank: Rank.Two }))),
  },
  dealer: Seat.North,
  vulnerability: Vulnerability.None,
};

// Build a minimal convention with conditioned + plain rules
// suitMin(suitIndex, suitName, min) — index 0=Spades, 1=Hearts
const ruleAsk = conditionedRule({
  name: "test-ask",
  auctionConditions: [auctionMatches(["1NT", "P"])],
  handConditions: [hcpMin(8), suitMin(0, "spades", 4)],
  call: (): Call => ({ type: "bid", level: 2, strain: BidSuit.Clubs }),
});

const ruleResponse = conditionedRule({
  name: "test-response",
  auctionConditions: [auctionMatches(["1NT", "P", "2C", "P"])],
  handConditions: [suitMin(1, "hearts", 4)],
  call: (): Call => ({ type: "bid", level: 2, strain: BidSuit.Hearts }),
});

const rulePlain: BiddingRule = {
  name: "test-signoff",
  explanation: "Sign off in 3NT",
  matches: () => false,
  call: () => ({ type: "bid", level: 3, strain: BidSuit.NoTrump }),
};

const testRules: readonly BiddingRule[] = [ruleAsk, ruleResponse, rulePlain];

const testConfig: ConventionConfig = {
  id: "test-convention",
  name: "Test Convention",
  description: "Test convention for rules display",
  category: ConventionCategory.Asking,
  dealConstraints: { seats: [] },
  biddingRules: testRules,
  examples: [],
};

// --- Tests ---

describe("prepareRulesForDisplay", () => {
  it("separates fired and reference rules based on bidHistory", () => {
    const bidHistory: BidHistoryEntry[] = [
      {
        seat: Seat.North,
        call: { type: "bid", level: 1, strain: BidSuit.NoTrump },
        ruleName: null,
        explanation: "Opening 1NT",
        isUser: false,
      },
      {
        seat: Seat.East,
        call: { type: "pass" },
        ruleName: null,
        explanation: "Pass",
        isUser: false,
      },
      {
        seat: Seat.South,
        call: { type: "bid", level: 2, strain: BidSuit.Clubs },
        ruleName: "test-ask",
        explanation: "Stayman ask",
        isUser: true,
      },
    ];

    const result = prepareRulesForDisplay(testConfig, testDeal, bidHistory);

    expect(result.firedRules).toHaveLength(1);
    expect(result.firedRules[0]!.ruleName).toBe("test-ask");
    expect(result.firedRules[0]!.fired).toBe(true);
    expect(result.firedRules[0]!.firedBySeat).toBe(Seat.South);

    expect(result.referenceRules).toHaveLength(2);
    expect(result.referenceRules[0]!.ruleName).toBe("test-response");
    expect(result.referenceRules[1]!.ruleName).toBe("test-signoff");
  });

  it("fired rules have evaluated condition descriptions with actual values", () => {
    const bidHistory: BidHistoryEntry[] = [
      {
        seat: Seat.North,
        call: { type: "bid", level: 1, strain: BidSuit.NoTrump },
        ruleName: null,
        explanation: "Opening 1NT",
        isUser: false,
      },
      {
        seat: Seat.East,
        call: { type: "pass" },
        ruleName: null,
        explanation: "Pass",
        isUser: false,
      },
      {
        seat: Seat.South,
        call: { type: "bid", level: 2, strain: BidSuit.Clubs },
        ruleName: "test-ask",
        explanation: "Stayman ask",
        isUser: true,
      },
    ];

    const result = prepareRulesForDisplay(testConfig, testDeal, bidHistory);
    const firedRule = result.firedRules[0]!;

    // Conditions should have been evaluated with real hand data
    expect(firedRule.conditions.length).toBeGreaterThan(0);
    // At least one condition description should contain actual HCP value
    const hcpCondition = firedRule.conditions.find((c) =>
      c.name.toLowerCase().includes("hcp"),
    );
    expect(hcpCondition).toBeDefined();
    // Description should contain the actual value (7 HCP for south hand: QJ spades + K hearts + J diamonds)
    expect(hcpCondition!.description).toContain("7");
  });

  it("reference rules have static condition names", () => {
    const bidHistory: BidHistoryEntry[] = [];

    const result = prepareRulesForDisplay(testConfig, testDeal, bidHistory);

    // All rules should be reference (none fired)
    expect(result.firedRules).toHaveLength(0);
    expect(result.referenceRules).toHaveLength(3);

    // Conditioned rules should have condition names
    const responseRule = result.referenceRules.find(
      (r) => r.ruleName === "test-response",
    )!;
    expect(responseRule.conditions.length).toBeGreaterThan(0);
    // Static names, not evaluated descriptions
    expect(responseRule.conditions[0]!.name).toBeTruthy();

    // Plain rule should use explanation
    const signoffRule = result.referenceRules.find(
      (r) => r.ruleName === "test-signoff",
    )!;
    expect(signoffRule.conditions).toHaveLength(1);
    expect(signoffRule.conditions[0]!.name).toBe("Sign off in 3NT");
  });

  it("reference rules compute their call for badge display", () => {
    const bidHistory: BidHistoryEntry[] = [];

    const result = prepareRulesForDisplay(testConfig, testDeal, bidHistory);

    // test-ask should compute 2C
    const askRule = result.referenceRules.find(
      (r) => r.ruleName === "test-ask",
    )!;
    expect(askRule.call).toEqual({
      type: "bid",
      level: 2,
      strain: BidSuit.Clubs,
    });

    // test-response should compute 2H
    const responseRule = result.referenceRules.find(
      (r) => r.ruleName === "test-response",
    )!;
    expect(responseRule.call).toEqual({
      type: "bid",
      level: 2,
      strain: BidSuit.Hearts,
    });
  });

  it("ignores bidHistory entries with null ruleName", () => {
    const bidHistory: BidHistoryEntry[] = [
      {
        seat: Seat.North,
        call: { type: "bid", level: 1, strain: BidSuit.NoTrump },
        ruleName: null,
        explanation: "Natural bid",
        isUser: false,
      },
    ];

    const result = prepareRulesForDisplay(testConfig, testDeal, bidHistory);

    expect(result.firedRules).toHaveLength(0);
    expect(result.referenceRules).toHaveLength(3);
  });

  it("returns empty arrays for empty rules", () => {
    const emptyConfig: ConventionConfig = {
      ...testConfig,
      biddingRules: [],
    };
    const result = prepareRulesForDisplay(emptyConfig, testDeal, []);

    expect(result.firedRules).toHaveLength(0);
    expect(result.referenceRules).toHaveLength(0);
  });

  it("fired rules ordered by auction appearance", () => {
    const bidHistory: BidHistoryEntry[] = [
      {
        seat: Seat.North,
        call: { type: "bid", level: 1, strain: BidSuit.NoTrump },
        ruleName: null,
        explanation: "Opening",
        isUser: false,
      },
      {
        seat: Seat.East,
        call: { type: "pass" },
        ruleName: null,
        explanation: "Pass",
        isUser: false,
      },
      {
        seat: Seat.South,
        call: { type: "bid", level: 2, strain: BidSuit.Clubs },
        ruleName: "test-ask",
        explanation: "Ask",
        isUser: true,
      },
      {
        seat: Seat.West,
        call: { type: "pass" },
        ruleName: null,
        explanation: "Pass",
        isUser: false,
      },
      {
        seat: Seat.North,
        call: { type: "bid", level: 2, strain: BidSuit.Hearts },
        ruleName: "test-response",
        explanation: "Response",
        isUser: false,
      },
    ];

    const result = prepareRulesForDisplay(testConfig, testDeal, bidHistory);

    expect(result.firedRules).toHaveLength(2);
    // test-ask fired first (index 2), test-response second (index 4)
    expect(result.firedRules[0]!.ruleName).toBe("test-ask");
    expect(result.firedRules[1]!.ruleName).toBe("test-response");
  });

  it("fired rules include the call that was made", () => {
    const bidHistory: BidHistoryEntry[] = [
      {
        seat: Seat.North,
        call: { type: "bid", level: 1, strain: BidSuit.NoTrump },
        ruleName: null,
        explanation: "Opening",
        isUser: false,
      },
      {
        seat: Seat.East,
        call: { type: "pass" },
        ruleName: null,
        explanation: "Pass",
        isUser: false,
      },
      {
        seat: Seat.South,
        call: { type: "bid", level: 2, strain: BidSuit.Clubs },
        ruleName: "test-ask",
        explanation: "Ask",
        isUser: true,
      },
    ];

    const result = prepareRulesForDisplay(testConfig, testDeal, bidHistory);
    const firedRule = result.firedRules[0]!;

    expect(firedRule.call).toEqual({
      type: "bid",
      level: 2,
      strain: BidSuit.Clubs,
    });
  });
});

// ─── groupBidsByRound ─────────────────────────────────────────

describe("groupBidsByRound", () => {
  function entry(seat: Seat, callStr: string, opts: Partial<BidHistoryEntry> = {}): BidHistoryEntry {
    const call: Call = callStr === "P"
      ? { type: "pass" }
      : { type: "bid", level: Number(callStr[0]) as 1 | 2 | 3 | 4 | 5 | 6 | 7, strain: callStr.slice(1) as never };
    return {
      seat,
      call,
      ruleName: opts.ruleName ?? null,
      explanation: opts.explanation ?? "",
      isUser: opts.isUser ?? false,
      isCorrect: opts.isCorrect,
      treePath: opts.treePath,
      conditions: opts.conditions,
    };
  }

  it("groups 8 entries into 2 rounds of 4", () => {
    const history: BidHistoryEntry[] = [
      entry(Seat.North, "1NT"),
      entry(Seat.East, "P"),
      entry(Seat.South, "2C", { isUser: true, ruleName: "stayman-ask" }),
      entry(Seat.West, "P"),
      entry(Seat.North, "2H", { ruleName: "stayman-response-hearts" }),
      entry(Seat.East, "P"),
      entry(Seat.South, "4H", { isUser: true, ruleName: "stayman-rebid-major-fit" }),
      entry(Seat.West, "P"),
    ];

    const rounds = groupBidsByRound(history);
    expect(rounds).toHaveLength(2);
    expect(rounds[0]!.roundNumber).toBe(1);
    expect(rounds[0]!.entries).toHaveLength(4);
    expect(rounds[1]!.roundNumber).toBe(2);
    expect(rounds[1]!.entries).toHaveLength(4);
  });

  it("handles partial last round (5 entries → 2 groups: 4 + 1)", () => {
    const history: BidHistoryEntry[] = [
      entry(Seat.North, "1NT"),
      entry(Seat.East, "P"),
      entry(Seat.South, "2C"),
      entry(Seat.West, "P"),
      entry(Seat.North, "2H"),
    ];

    const rounds = groupBidsByRound(history);
    expect(rounds).toHaveLength(2);
    expect(rounds[0]!.entries).toHaveLength(4);
    expect(rounds[1]!.entries).toHaveLength(1);
  });

  it("returns empty array for empty bidHistory", () => {
    expect(groupBidsByRound([])).toEqual([]);
  });

  it("passes through treePath and conditions from BidHistoryEntry", () => {
    const treePath = {
      matchedNodeName: "stayman-ask",
      path: [],
      visited: [],
    };
    const conditions = [{ name: "hcp-min", passed: true, description: "8+ HCP (has 12)" }];
    const history: BidHistoryEntry[] = [
      entry(Seat.North, "1NT", { treePath, conditions }),
    ];

    const rounds = groupBidsByRound(history);
    expect(rounds[0]!.entries[0]!.treePath).toBe(treePath);
    expect(rounds[0]!.entries[0]!.conditions).toBe(conditions);
  });

  it("maps isUser and isCorrect correctly", () => {
    const history: BidHistoryEntry[] = [
      entry(Seat.South, "2C", { isUser: true, isCorrect: true }),
    ];

    const rounds = groupBidsByRound(history);
    const e = rounds[0]!.entries[0]!;
    expect(e.isUser).toBe(true);
    expect(e.isCorrect).toBe(true);
  });
});
