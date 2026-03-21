/**
 * SessionState — per-session state mutation and phase transitions.
 *
 * Tests the public API of SessionState: construction, play initialization,
 * user-controlled seat detection, and remaining-card tracking.
 */
import { describe, it, expect } from "vitest";
import { Seat, BidSuit, Suit, Rank, Vulnerability } from "../../engine/types";
import type { Contract, PlayedCard, Trick } from "../../engine/types";
import { makeSimpleTestDeal, makeDrillSession, makeContract, makeCard } from "../../test-support/fixtures";
import { createInferenceCoordinator } from "../../inference/inference-coordinator";
import { SessionState } from "../session-state";
import type { DrillBundle } from "../../bootstrap/types";
import type { DebugLogEntry } from "../../stores/game.svelte";

// ── Helpers ────────────────────────────────────────────────────

/** Create a minimal DrillBundle for testing. */
function makeBundle(overrides: Partial<DrillBundle> = {}): DrillBundle {
  const deal = makeSimpleTestDeal(Seat.North);
  const session = makeDrillSession(Seat.South);
  return {
    deal,
    session,
    nsInferenceEngine: null,
    ewInferenceEngine: null,
    ...overrides,
  };
}

/** Create a fresh SessionState for testing. */
function makeState(bundleOverrides: Partial<DrillBundle> = {}): SessionState {
  const bundle = makeBundle(bundleOverrides);
  const coordinator = createInferenceCoordinator();
  return new SessionState(bundle, coordinator);
}

// ── Initial state creation ─────────────────────────────────────

describe("SessionState construction", () => {
  it("starts in BIDDING phase", () => {
    const state = makeState();
    expect(state.phase).toBe("BIDDING");
  });

  it("has an empty auction", () => {
    const state = makeState();
    expect(state.auction.entries).toEqual([]);
    expect(state.auction.isComplete).toBe(false);
  });

  it("stores the deal from the bundle", () => {
    const deal = makeSimpleTestDeal(Seat.East);
    const state = makeState({ deal });
    expect(state.deal).toBe(deal);
  });

  it("has no contract initially", () => {
    const state = makeState();
    expect(state.contract).toBeNull();
  });

  it("has no effective user seat initially", () => {
    const state = makeState();
    expect(state.effectiveUserSeat).toBeNull();
  });

  it("has empty bid history", () => {
    const state = makeState();
    expect(state.bidHistory).toEqual([]);
  });

  it("has no current feedback", () => {
    const state = makeState();
    expect(state.currentFeedback).toBeNull();
  });

  it("stores the convention ID from the session config", () => {
    const state = makeState();
    expect(state.conventionId).toBe("test");
  });

  it("defaults isOffConvention to false", () => {
    const state = makeState();
    expect(state.isOffConvention).toBe(false);
  });

  it("respects isOffConvention=true from bundle", () => {
    const state = makeState({ isOffConvention: true });
    expect(state.isOffConvention).toBe(true);
  });

  it("has empty play state defaults", () => {
    const state = makeState();
    expect(state.tricks).toEqual([]);
    expect(state.currentTrick).toEqual([]);
    expect(state.currentPlayer).toBeNull();
    expect(state.declarerTricksWon).toBe(0);
    expect(state.defenderTricksWon).toBe(0);
    expect(state.dummySeat).toBeNull();
    expect(state.trumpSuit).toBeUndefined();
    expect(state.playScore).toBeNull();
  });

  it("has empty debug state", () => {
    const state = makeState();
    expect(state.debugLog).toEqual([]);
    expect(state.debugTurnCounter).toBe(0);
  });
});

// ── Seat helpers ───────────────────────────────────────────────

describe("SessionState seat helpers", () => {
  it("userSeat returns the configured user seat", () => {
    const state = makeState();
    expect(state.userSeat).toBe(Seat.South);
  });

  it("isUserSeat returns true for the user seat", () => {
    const state = makeState();
    expect(state.isUserSeat(Seat.South)).toBe(true);
  });

  it("isUserSeat returns false for non-user seats", () => {
    const state = makeState();
    expect(state.isUserSeat(Seat.North)).toBe(false);
    expect(state.isUserSeat(Seat.East)).toBe(false);
    expect(state.isUserSeat(Seat.West)).toBe(false);
  });
});

// ── Play initialization ────────────────────────────────────────

describe("SessionState.initializePlay", () => {
  it("sets dummy to partner of declarer", () => {
    const state = makeState();
    const contract = makeContract(Seat.South);
    state.initializePlay(contract);
    expect(state.dummySeat).toBe(Seat.North);
  });

  it("sets opening leader to left of declarer", () => {
    const state = makeState();
    const contract = makeContract(Seat.South);
    state.initializePlay(contract);
    // Left of South is West
    expect(state.currentPlayer).toBe(Seat.West);
  });

  it("sets trump suit for suit contracts", () => {
    const state = makeState();
    const heartsContract: Contract = {
      level: 4,
      strain: BidSuit.Hearts,
      doubled: false,
      redoubled: false,
      declarer: Seat.South,
    };
    state.initializePlay(heartsContract);
    expect(state.trumpSuit).toBe(Suit.Hearts);
  });

  it("sets trump to undefined for NoTrump", () => {
    const state = makeState();
    const contract = makeContract(Seat.South);
    state.initializePlay(contract);
    expect(state.trumpSuit).toBeUndefined();
  });

  it("resets trick counters to zero", () => {
    const state = makeState();
    // Simulate some existing play state
    state.declarerTricksWon = 5;
    state.defenderTricksWon = 3;
    state.tricks = [{} as Trick];

    const contract = makeContract(Seat.South);
    state.initializePlay(contract);

    expect(state.declarerTricksWon).toBe(0);
    expect(state.defenderTricksWon).toBe(0);
    expect(state.tricks).toEqual([]);
    expect(state.currentTrick).toEqual([]);
    expect(state.playScore).toBeNull();
  });

  it("maps all bid suit strains to correct play suit", () => {
    const state = makeState();

    const cases: Array<[BidSuit, Suit | undefined]> = [
      [BidSuit.Clubs, Suit.Clubs],
      [BidSuit.Diamonds, Suit.Diamonds],
      [BidSuit.Hearts, Suit.Hearts],
      [BidSuit.Spades, Suit.Spades],
      [BidSuit.NoTrump, undefined],
    ];

    for (const [strain, expectedSuit] of cases) {
      const contract: Contract = {
        level: 1,
        strain,
        doubled: false,
        redoubled: false,
        declarer: Seat.North,
      };
      state.initializePlay(contract);
      expect(state.trumpSuit).toBe(expectedSuit);
    }
  });

  it("sets correct leader for each declarer position", () => {
    const state = makeState();

    // Left of North is East
    state.initializePlay(makeContract(Seat.North));
    expect(state.currentPlayer).toBe(Seat.East);

    // Left of East is South
    state.initializePlay(makeContract(Seat.East));
    expect(state.currentPlayer).toBe(Seat.South);

    // Left of West is North
    state.initializePlay(makeContract(Seat.West));
    expect(state.currentPlayer).toBe(Seat.North);
  });
});

// ── User-controlled play ───────────────────────────────────────

describe("SessionState.isUserControlledPlay", () => {
  it("returns false when no contract is set", () => {
    const state = makeState();
    expect(state.isUserControlledPlay(Seat.South)).toBe(false);
  });

  it("returns false when no effective user seat", () => {
    const state = makeState();
    state.contract = makeContract(Seat.South);
    // effectiveUserSeat is still null
    expect(state.isUserControlledPlay(Seat.South)).toBe(false);
  });

  it("returns true for the effective user seat", () => {
    const state = makeState();
    state.contract = makeContract(Seat.South);
    state.effectiveUserSeat = Seat.South;
    expect(state.isUserControlledPlay(Seat.South)).toBe(true);
  });

  it("returns true for dummy when user is declarer", () => {
    const state = makeState();
    state.contract = makeContract(Seat.South);
    state.effectiveUserSeat = Seat.South;
    // Dummy is partner of declarer = North
    expect(state.isUserControlledPlay(Seat.North)).toBe(true);
  });

  it("returns false for opponents when user is declarer", () => {
    const state = makeState();
    state.contract = makeContract(Seat.South);
    state.effectiveUserSeat = Seat.South;
    expect(state.isUserControlledPlay(Seat.East)).toBe(false);
    expect(state.isUserControlledPlay(Seat.West)).toBe(false);
  });

  it("returns false for dummy when user is NOT declarer", () => {
    const state = makeState();
    // North is declarer, so dummy is South
    state.contract = makeContract(Seat.North);
    state.effectiveUserSeat = Seat.East;
    // East is NOT declarer, so controlling dummy (South) should be false
    expect(state.isUserControlledPlay(Seat.South)).toBe(false);
  });
});

// ── Remaining cards ────────────────────────────────────────────

describe("SessionState.getRemainingCards", () => {
  it("returns all 13 cards when no cards have been played", () => {
    const state = makeState();
    const remaining = state.getRemainingCards(Seat.South);
    expect(remaining).toHaveLength(13);
  });

  it("excludes cards played in completed tricks", () => {
    const state = makeState();
    const southHand = state.deal.hands[Seat.South].cards;
    const playedCard = southHand[0]!;

    state.tricks = [{
      plays: [
        { seat: Seat.South, card: playedCard },
        { seat: Seat.West, card: makeCard(Suit.Spades, Rank.Ace) },
        { seat: Seat.North, card: makeCard(Suit.Clubs, Rank.Ace) },
        { seat: Seat.East, card: makeCard(Suit.Diamonds, Rank.Ace) },
      ],
      winner: Seat.South,
    }];

    const remaining = state.getRemainingCards(Seat.South);
    expect(remaining).toHaveLength(12);
    expect(remaining).not.toContainEqual(playedCard);
  });

  it("excludes cards in the current trick", () => {
    const state = makeState();
    const southHand = state.deal.hands[Seat.South].cards;
    const playedCard = southHand[0]!;

    state.currentTrick = [
      { seat: Seat.South, card: playedCard },
    ];

    const remaining = state.getRemainingCards(Seat.South);
    expect(remaining).toHaveLength(12);
    expect(remaining).not.toContainEqual(playedCard);
  });

  it("excludes cards from both tricks and current trick", () => {
    const state = makeState();
    const southHand = state.deal.hands[Seat.South].cards;
    const card1 = southHand[0]!;
    const card2 = southHand[1]!;

    state.tricks = [{
      plays: [
        { seat: Seat.South, card: card1 },
        { seat: Seat.West, card: makeCard(Suit.Spades, Rank.Ace) },
        { seat: Seat.North, card: makeCard(Suit.Clubs, Rank.Ace) },
        { seat: Seat.East, card: makeCard(Suit.Diamonds, Rank.Ace) },
      ],
      winner: Seat.South,
    }];
    state.currentTrick = [
      { seat: Seat.South, card: card2 },
    ];

    const remaining = state.getRemainingCards(Seat.South);
    expect(remaining).toHaveLength(11);
  });

  it("only removes cards for the queried seat", () => {
    const state = makeState();
    const westCard = state.deal.hands[Seat.West].cards[0]!;

    state.tricks = [{
      plays: [
        { seat: Seat.West, card: westCard },
        { seat: Seat.North, card: makeCard(Suit.Clubs, Rank.Ace) },
        { seat: Seat.East, card: makeCard(Suit.Diamonds, Rank.Ace) },
        { seat: Seat.South, card: makeCard(Suit.Hearts, Rank.Ace) },
      ],
      winner: Seat.West,
    }];

    // South should still have all 13 cards (the played Hearts Ace is from the
    // simple test deal's South hand, so we need to be careful here)
    // West should have 12 cards
    const westRemaining = state.getRemainingCards(Seat.West);
    expect(westRemaining).toHaveLength(12);
  });
});

// ── Lead suit ──────────────────────────────────────────────────

describe("SessionState.getLeadSuit", () => {
  it("returns undefined when no cards in current trick", () => {
    const state = makeState();
    expect(state.getLeadSuit()).toBeUndefined();
  });

  it("returns the suit of the first card played", () => {
    const state = makeState();
    state.currentTrick = [
      { seat: Seat.West, card: makeCard(Suit.Spades, Rank.King) },
    ];
    expect(state.getLeadSuit()).toBe(Suit.Spades);
  });

  it("returns lead suit even with multiple cards in trick", () => {
    const state = makeState();
    state.currentTrick = [
      { seat: Seat.West, card: makeCard(Suit.Spades, Rank.King) },
      { seat: Seat.North, card: makeCard(Suit.Clubs, Rank.Two) },
    ];
    expect(state.getLeadSuit()).toBe(Suit.Spades);
  });
});

// ── Debug log ──────────────────────────────────────────────────

describe("SessionState.pushDebugLog", () => {
  it("appends entries immutably", () => {
    const state = makeState();
    const original = state.debugLog;

    const entry: DebugLogEntry = {
      kind: "ai-bid",
      turnIndex: 1,
      seat: Seat.North,
      call: { type: "pass" },
      snapshot: state.captureSnapshot(),
      feedback: null,
    };
    state.pushDebugLog(entry);

    expect(state.debugLog).toHaveLength(1);
    // Original reference should not be the same (immutable append)
    expect(state.debugLog).not.toBe(original);
  });

  it("preserves previous entries", () => {
    const state = makeState();

    state.pushDebugLog({
      kind: "ai-bid",
      turnIndex: 1,
      seat: Seat.North,
      call: { type: "pass" },
      snapshot: state.captureSnapshot(),
      feedback: null,
    });
    state.pushDebugLog({
      kind: "ai-bid",
      turnIndex: 2,
      seat: Seat.East,
      call: { type: "pass" },
      snapshot: state.captureSnapshot(),
      feedback: null,
    });

    expect(state.debugLog).toHaveLength(2);
    expect(state.debugLog[0]!.turnIndex).toBe(1);
    expect(state.debugLog[1]!.turnIndex).toBe(2);
  });
});

// ── Strategy / snapshot ────────────────────────────────────────

describe("SessionState.captureSnapshot", () => {
  it("returns empty evaluation when no strategy is set", () => {
    const state = makeState();
    const snapshot = state.captureSnapshot();

    expect(snapshot.expectedBid).toBeNull();
    expect(snapshot.practicalRecommendation).toBeNull();
    expect(snapshot.provenance).toBeNull();
    expect(snapshot.arbitration).toBeNull();
  });
});
