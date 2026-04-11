/**
 * Pure data factories for service response/viewport types.
 *
 * No vitest dependency — these produce complete, structurally valid objects.
 * Each takes Partial<T> overrides so tests only specify fields they care about.
 *
 * Used by store orchestration tests (game-lifecycle-red.test.ts) and
 * any future tests needing mock service responses.
 */
import { Seat, Suit, Rank, Vulnerability, BidSuit } from "../engine/types";
import type { Card } from "../engine/types";
import type {
  BiddingViewport,
  HandEvaluationView,
  DrillStartResult,
  BidSubmitResult,
  PlayEntryResult,
  PlayCardResult,
  PlayingViewport,
  DeclarerPromptViewport,
  ExplanationViewport,
} from "../service/response-types";
import { ViewportBidGrade } from "../service/response-types";
import type { GamePhase } from "../service/session-types";
import { PlayPreference, PracticeMode, PromptMode } from "../service/session-types";

// ── Internal helpers ─────────────────────────────────────────────────

const RANKS = [
  Rank.Two, Rank.Three, Rank.Four, Rank.Five, Rank.Six,
  Rank.Seven, Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack,
  Rank.Queen, Rank.King, Rank.Ace,
] as const;

/** Generate a 13-card hand: 4♠ 3♥ 3♦ 3♣ (low cards). */
function make13Cards(): Card[] {
  return [
    ...RANKS.slice(0, 4).map((r) => ({ suit: Suit.Spades, rank: r })),
    ...RANKS.slice(0, 3).map((r) => ({ suit: Suit.Hearts, rank: r })),
    ...RANKS.slice(0, 3).map((r) => ({ suit: Suit.Diamonds, rank: r })),
    ...RANKS.slice(0, 3).map((r) => ({ suit: Suit.Clubs, rank: r })),
  ];
}

function makeHandEvaluation(overrides?: Partial<HandEvaluationView>): HandEvaluationView {
  return {
    hcp: 10,
    shape: [4, 3, 3, 3],
    isBalanced: true,
    distributionPoints: { shortness: 0, length: 0, total: 0 },
    ...overrides,
  };
}

// ── Public factories ─────────────────────────────────────────────────

export function makeBiddingViewport(overrides?: Partial<BiddingViewport>): BiddingViewport {
  return {
    dealer: Seat.North,
    vulnerability: Vulnerability.None,
    seat: Seat.South,
    conventionName: "NT Bundle",
    hand: { cards: make13Cards() },
    handEvaluation: makeHandEvaluation(),
    handSummary: "4♠ 3♥ 3♦ 3♣, 10 HCP",
    visibleHands: {},
    auctionEntries: [],
    legalCalls: [{ type: "pass" as const }],
    biddingOptions: [],
    isUserTurn: true,
    currentBidder: Seat.South,
    ...overrides,
  };
}

export function makeDrillStartResult(overrides?: Partial<DrillStartResult>): DrillStartResult {
  return {
    viewport: makeBiddingViewport(),
    isOffConvention: false,
    aiBids: [],
    auctionComplete: false,
    phase: "BIDDING" as GamePhase,
    practiceMode: PracticeMode.DecisionDrill,
    playPreference: PlayPreference.Prompt,
    ...overrides,
  };
}

export function makeBidSubmitResult(overrides?: Partial<BidSubmitResult>): BidSubmitResult {
  return {
    accepted: true,
    grade: ViewportBidGrade.Correct,
    feedback: null,
    teaching: null,
    aiBids: [],
    nextViewport: makeBiddingViewport(),
    phaseTransition: null,
    userHistoryEntry: null,
    ...overrides,
  };
}

export function makePlayEntryResult(overrides?: Partial<PlayEntryResult>): PlayEntryResult {
  return {
    phase: "PLAYING" as GamePhase,
    aiPlays: undefined,
    ...overrides,
  };
}

export function makePlayCardResult(overrides?: Partial<PlayCardResult>): PlayCardResult {
  return {
    accepted: true,
    trickComplete: false,
    playComplete: false,
    score: null,
    aiPlays: [],
    legalPlays: [],
    currentPlayer: Seat.South,
    ...overrides,
  };
}

export function makePlayingViewport(overrides?: Partial<PlayingViewport>): PlayingViewport {
  return {
    dealer: Seat.North,
    vulnerability: Vulnerability.None,
    userSeat: Seat.South,
    rotated: false,
    visibleHands: {},
    contract: {
      level: 3,
      strain: BidSuit.NoTrump,
      declarer: Seat.North,
      doubled: false,
      redoubled: false,
    },
    currentPlayer: Seat.West,
    currentTrick: [],
    trumpSuit: undefined,
    legalPlays: [],
    userControlledSeats: [Seat.South],
    remainingCards: {},
    tricks: [],
    declarerTricksWon: 0,
    defenderTricksWon: 0,
    ...overrides,
  };
}

export function makeDeclarerPromptViewport(
  overrides?: Partial<DeclarerPromptViewport>,
): DeclarerPromptViewport {
  return {
    dealer: Seat.North,
    vulnerability: Vulnerability.None,
    userSeat: Seat.South,
    visibleHands: {},
    auctionEntries: [],
    contract: {
      level: 3,
      strain: BidSuit.NoTrump,
      declarer: Seat.North,
      doubled: false,
      redoubled: false,
    },
    promptMode: PromptMode.DeclarerSwap,
    ...overrides,
  };
}

export function makeExplanationViewport(
  overrides?: Partial<ExplanationViewport>,
): ExplanationViewport {
  return {
    dealer: Seat.North,
    vulnerability: Vulnerability.None,
    userSeat: Seat.South,
    allHands: {
      [Seat.North]: { cards: make13Cards() },
      [Seat.East]: { cards: make13Cards() },
      [Seat.South]: { cards: make13Cards() },
      [Seat.West]: { cards: make13Cards() },
    },
    auctionEntries: [],
    contract: null,
    score: null,
    declarerTricksWon: 0,
    defenderTricksWon: 0,
    bidHistory: [],
    tricks: [],
    playRecommendations: [],
    ...overrides,
  };
}
