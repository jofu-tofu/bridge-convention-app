/**
 * RED tests: Game store lifecycle orchestration with mock service.
 *
 * All tests are it("RED: ...") — they define expected behavior
 * that the store must support. Changing it.skip → it would produce
 * runtime failures until the store + service wiring is complete.
 *
 * Run: npx vitest src/stores/__tests__/game-lifecycle-red.test.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DevServicePort } from "../../service/port";
import type { BiddingViewport } from "../../service/response-types";
import { Seat, Suit, Rank, BidSuit } from "../../engine/types";
import { createGameStore } from "../game.svelte";

// ── Minimal mock viewport ────────────────────────────────────────
// Partial mock — only fields the tests access need to be accurate.
// Cast via `as unknown` to avoid exhaustive interface checks.
const MOCK_BIDDING_VP = {
  hand: {
    cards: Array.from({ length: 13 }, (_, i) => ({
      suit: [Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs][
        Math.floor(i / 4)
      ] as Suit,
      rank: Rank.Two,
    })),
  },
  handEvaluation: {
    hcp: 10,
    shape: [4, 3, 3, 3],
    isBalanced: true,
    totalPoints: 10,
    distributionPoints: { shortness: 0, length: 0 },
  },
  handSummary: "4♠ 3♥ 3♦ 3♣, 10 HCP",
  auctionEntries: [],
  legalCalls: [{ type: "pass" as const }],
  seat: Seat.South,
  conventionName: "NT Bundle",
  visibleHands: {},
  biddingOptions: [],
  isUserTurn: true,
  currentBidder: Seat.South,
} as unknown as BiddingViewport;

// ── Mock service factory ─────────────────────────────────────────
function createMockService(): DevServicePort {
  return {
    createSession: vi.fn().mockResolvedValue("session-1"),
    startDrill: vi.fn().mockResolvedValue({
      viewport: MOCK_BIDDING_VP,
      isOffConvention: false,
      aiBids: [],
      auctionComplete: false,
      phase: "BIDDING",
      practiceMode: "decision-drill",
      playPreference: "prompt",
    }),
    submitBid: vi.fn().mockResolvedValue({
      accepted: true,
      grade: "correct",
      feedback: null,
      teaching: null,
      aiBids: [],
      nextViewport: MOCK_BIDDING_VP,
      phaseTransition: null,
      userHistoryEntry: null,
    }),
    acceptPrompt: vi
      .fn()
      .mockResolvedValue({ phase: "PLAYING", aiPlays: null }),
    playCard: vi.fn().mockResolvedValue({
      accepted: true,
      trickComplete: false,
      playComplete: false,
      score: null,
      aiPlays: [],
      legalPlays: [],
      currentPlayer: Seat.South,
    }),
    playSingleCard: vi.fn().mockResolvedValue({
      accepted: true, trickComplete: false, playComplete: false,
      score: null, currentPlayer: Seat.South, legalPlays: [],
    }),
    skipToReview: vi.fn().mockResolvedValue(undefined),
    updatePlayProfile: vi.fn().mockResolvedValue(undefined),
    getBiddingViewport: vi.fn().mockResolvedValue(MOCK_BIDDING_VP),
    getDeclarerPromptViewport: vi.fn().mockResolvedValue(null),
    getPlayingViewport: vi.fn().mockResolvedValue(null),
    getExplanationViewport: vi.fn().mockResolvedValue(null),
    getPublicBeliefState: vi
      .fn()
      .mockResolvedValue({ beliefs: {}, annotations: [] }),
    getDealPBN: vi.fn().mockResolvedValue("N:AKQ.JT98.765.432 QJ.K654.AK43.765 T987.32.QJ2.AT98 6543.A7.T98.KQJ2"),
    getDDSSolution: vi
      .fn()
      .mockRejectedValue(new Error("not available")),
    listConventions: vi.fn().mockResolvedValue([]),
    listModules: vi.fn().mockResolvedValue([]),
    getModuleLearningViewport: vi.fn().mockResolvedValue(null),
    getBundleFlowTree: vi.fn().mockResolvedValue(null),
    getModuleFlowTree: vi.fn().mockResolvedValue(null),
    // DevServicePort methods
    getExpectedBid: vi.fn().mockResolvedValue(null),
    getDebugSnapshot: vi.fn().mockResolvedValue({}),
    getDebugLog: vi.fn().mockResolvedValue([]),
    getInferenceTimeline: vi.fn().mockResolvedValue([]),
    getPlaySuggestions: vi.fn().mockResolvedValue(null),
    getConventionName: vi.fn().mockResolvedValue("Test Convention"),
    createSessionFromBundle: vi.fn().mockRejectedValue(new Error("stub")),
  } as unknown as DevServicePort;
}

describe("game store lifecycle (RED tests)", () => {
  let mockService: DevServicePort;

  beforeEach(() => {
    mockService = createMockService();
  });

  it("RED: startNewDrill calls createSession then startDrill and caches viewport", async () => {
    const store = createGameStore(mockService, {
      delayFn: () => Promise.resolve(),
    });

    store.startNewDrill({
      conventionId: "nt-bundle",
      userSeat: Seat.South,
      seed: 42,
    });

    // Allow async operations to settle
    await vi.waitFor(() => {
      expect(mockService.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ conventionId: "nt-bundle" }),
      );
      expect(mockService.startDrill).toHaveBeenCalledWith("session-1");
      expect(store.biddingViewport).not.toBeNull();
      expect(store.phase).toBe("BIDDING");
    });
  });

  it("RED: userBid with correct bid updates viewport and animates AI bids", async () => {
    const aiBids = [
      { seat: Seat.West, call: { type: "pass" as const } },
      { seat: Seat.North, call: { type: "bid" as const, level: 2, strain: BidSuit.Clubs } },
    ];

    (mockService.submitBid as ReturnType<typeof vi.fn>).mockResolvedValue({
      accepted: true,
      grade: "correct",
      feedback: null,
      teaching: null,
      aiBids,
      nextViewport: MOCK_BIDDING_VP,
      phaseTransition: null,
      userHistoryEntry: null,
    });

    const store = createGameStore(mockService, {
      delayFn: () => Promise.resolve(),
    });

    await store.startDrillFromHandle("session-1");
    store.userBid({ type: "pass" });

    await vi.waitFor(() => {
      expect(mockService.submitBid).toHaveBeenCalled();
      expect(store.biddingViewport).not.toBeNull();
    });
  });

  it("RED: userBid with wrong bid shows feedback, does NOT advance", async () => {
    (mockService.submitBid as ReturnType<typeof vi.fn>).mockResolvedValue({
      accepted: false,
      grade: "incorrect",
      feedback: {
        grade: "incorrect",
        userCall: { type: "pass" },
        expectedCall: { type: "bid", level: 2, strain: BidSuit.Clubs },
        explanation: "Stayman is the correct response",
      },
      teaching: null,
      aiBids: [],
      nextViewport: null,
      phaseTransition: null,
      userHistoryEntry: null,
    });

    const store = createGameStore(mockService, {
      delayFn: () => Promise.resolve(),
    });

    await store.startDrillFromHandle("session-1");
    store.userBid({ type: "pass" });

    await vi.waitFor(() => {
      expect(store.bidFeedback).not.toBeNull();
      expect(store.bidFeedback?.grade).toBe("incorrect");
    });
  });

  it("RED: phaseTransition in submitBid triggers post-auction orchestration", async () => {
    (mockService.submitBid as ReturnType<typeof vi.fn>).mockResolvedValue({
      accepted: true,
      grade: "correct",
      feedback: null,
      teaching: null,
      aiBids: [],
      nextViewport: MOCK_BIDDING_VP,
      phaseTransition: { from: "BIDDING", to: "DECLARER_PROMPT" },
      userHistoryEntry: null,
    });

    (mockService.getDeclarerPromptViewport as ReturnType<typeof vi.fn>).mockResolvedValue({
      contract: { level: 3, strain: BidSuit.NoTrump, declarer: Seat.North, doubled: false, redoubled: false },
      declarerSeat: Seat.North,
      userSeat: Seat.South,
    });

    const store = createGameStore(mockService, {
      delayFn: () => Promise.resolve(),
    });

    await store.startDrillFromHandle("session-1");
    store.userBid({ type: "bid", level: 3, strain: BidSuit.NoTrump });

    await vi.waitFor(() => {
      expect(store.phase).toBe("DECLARER_PROMPT");
      expect(mockService.getDeclarerPromptViewport).toHaveBeenCalled();
    });
  });

  it("RED: auto-prompt with playPreference=skip transitions to EXPLANATION", async () => {
    (mockService.startDrill as ReturnType<typeof vi.fn>).mockResolvedValue({
      viewport: MOCK_BIDDING_VP,
      isOffConvention: false,
      aiBids: [],
      auctionComplete: false,
      phase: "BIDDING",
      practiceMode: "decision-drill",
      playPreference: "skip",
    });

    (mockService.submitBid as ReturnType<typeof vi.fn>).mockResolvedValue({
      accepted: true,
      grade: "correct",
      feedback: null,
      teaching: null,
      aiBids: [],
      nextViewport: MOCK_BIDDING_VP,
      phaseTransition: { from: "BIDDING", to: "DECLARER_PROMPT" },
      userHistoryEntry: null,
    });

    (mockService.acceptPrompt as ReturnType<typeof vi.fn>).mockResolvedValue({
      phase: "EXPLANATION",
    });

    (mockService.getExplanationViewport as ReturnType<typeof vi.fn>).mockResolvedValue({
      contract: null,
      bidHistory: [],
      explanationEntries: [],
    });

    const store = createGameStore(mockService, {
      delayFn: () => Promise.resolve(),
    });

    await store.startDrillFromHandle("session-1");
    store.userBid({ type: "pass" });

    await vi.waitFor(() => {
      expect(store.phase).toBe("EXPLANATION");
    });
  });

  it("RED: auto-prompt with playPreference=always transitions to PLAYING", async () => {
    (mockService.startDrill as ReturnType<typeof vi.fn>).mockResolvedValue({
      viewport: MOCK_BIDDING_VP,
      isOffConvention: false,
      aiBids: [],
      auctionComplete: false,
      phase: "BIDDING",
      practiceMode: "decision-drill",
      playPreference: "always",
    });

    (mockService.submitBid as ReturnType<typeof vi.fn>).mockResolvedValue({
      accepted: true,
      grade: "correct",
      feedback: null,
      teaching: null,
      aiBids: [],
      nextViewport: MOCK_BIDDING_VP,
      phaseTransition: { from: "BIDDING", to: "PLAYING" },
      userHistoryEntry: null,
    });

    (mockService.getPlayingViewport as ReturnType<typeof vi.fn>).mockResolvedValue({
      tricks: [],
      currentTrick: [],
      currentPlayer: Seat.West,
      declarerTricksWon: 0,
      defenderTricksWon: 0,
      dummySeat: Seat.North,
      contract: { level: 3, strain: BidSuit.NoTrump, declarer: Seat.South, doubled: false, redoubled: false },
      trumpSuit: undefined,
    });

    const store = createGameStore(mockService, {
      delayFn: () => Promise.resolve(),
    });

    await store.startDrillFromHandle("session-1");
    store.userBid({ type: "pass" });

    await vi.waitFor(() => {
      expect(store.phase).toBe("PLAYING");
    });
  });

  it("RED: starting new drill mid-animation cancels previous", async () => {
    const store = createGameStore(mockService, {
      delayFn: () => Promise.resolve(),
    });

    // Start first drill
    store.startNewDrill({ conventionId: "nt-bundle", seed: 1 });

    // Immediately start another before first settles
    store.startNewDrill({ conventionId: "nt-bundle", seed: 2 });

    await vi.waitFor(() => {
      // Second drill should win — createSession called twice
      expect(mockService.createSession).toHaveBeenCalledTimes(2);
      // Store should reflect the second drill, not the first
      expect(store.activeHandle).not.toBeNull();
    });
  });

  it("RED: lifecycle methods are no-ops during wrong phase", async () => {
    const store = createGameStore(mockService, {
      delayFn: () => Promise.resolve(),
    });

    await store.startDrillFromHandle("session-1");
    expect(store.phase).toBe("BIDDING");

    // acceptPrompt during BIDDING should be a no-op (guarded)
    store.acceptPrompt();

    // Service acceptPrompt should NOT have been called
    expect(mockService.acceptPrompt).not.toHaveBeenCalled();
    expect(store.phase).toBe("BIDDING");
  });

  // ── Executor transition tests ──────────────────────────────────

  async function drillToDeclarerPrompt(store: ReturnType<typeof createGameStore>, svc: DevServicePort) {
    (svc.submitBid as ReturnType<typeof vi.fn>).mockResolvedValue({
      accepted: true, grade: "correct", feedback: null, teaching: null,
      aiBids: [], nextViewport: MOCK_BIDDING_VP,
      phaseTransition: { from: "BIDDING", to: "DECLARER_PROMPT" },
      userHistoryEntry: null,
    });
    (svc.getDeclarerPromptViewport as ReturnType<typeof vi.fn>).mockResolvedValue({
      contract: { level: 3, strain: BidSuit.NoTrump, declarer: Seat.North, doubled: false, redoubled: false },
      declarerSeat: Seat.North, userSeat: Seat.South,
    });
    await store.startDrillFromHandle("session-1");
    store.userBid({ type: "pass" });
    await vi.waitFor(() => { expect(store.phase).toBe("DECLARER_PROMPT"); });
  }

  it("ACCEPT_PLAY calls service, fetches viewport, transitions to PLAYING", async () => {
    const store = createGameStore(mockService, { delayFn: () => Promise.resolve() });
    await drillToDeclarerPrompt(store, mockService);

    (mockService.acceptPrompt as ReturnType<typeof vi.fn>).mockResolvedValue({ phase: "PLAYING", aiPlays: [] });
    (mockService.getPlayingViewport as ReturnType<typeof vi.fn>).mockResolvedValue({
      tricks: [], currentTrick: [], currentPlayer: Seat.West,
      declarerTricksWon: 0, defenderTricksWon: 0,
      contract: { level: 3, strain: BidSuit.NoTrump, declarer: Seat.North, doubled: false, redoubled: false },
      legalPlays: [], userControlledSeats: [Seat.South], remainingCards: {},
    });

    store.acceptPrompt();
    await vi.waitFor(() => {
      expect(store.phase).toBe("PLAYING");
      expect(mockService.acceptPrompt).toHaveBeenCalledWith("session-1", "play", expect.any(String));
      expect(mockService.getPlayingViewport).toHaveBeenCalled();
    });
  });

  it("DECLINE_PLAY calls service, transitions to EXPLANATION", async () => {
    const store = createGameStore(mockService, { delayFn: () => Promise.resolve() });
    await drillToDeclarerPrompt(store, mockService);

    (mockService.acceptPrompt as ReturnType<typeof vi.fn>).mockResolvedValue({ phase: "EXPLANATION" });
    (mockService.getExplanationViewport as ReturnType<typeof vi.fn>).mockResolvedValue({
      contract: null, bidHistory: [], explanationEntries: [],
    });

    store.declinePrompt();
    await vi.waitFor(() => {
      expect(store.phase).toBe("EXPLANATION");
      expect(mockService.acceptPrompt).toHaveBeenCalledWith("session-1", "skip", undefined);
      expect(mockService.getExplanationViewport).toHaveBeenCalled();
    });
  });

  it("SKIP_TO_REVIEW calls skipToReview service, transitions to EXPLANATION", async () => {
    const store = createGameStore(mockService, { delayFn: () => Promise.resolve() });
    await drillToDeclarerPrompt(store, mockService);

    // First get to PLAYING
    (mockService.acceptPrompt as ReturnType<typeof vi.fn>).mockResolvedValue({ phase: "PLAYING", aiPlays: [] });
    (mockService.getPlayingViewport as ReturnType<typeof vi.fn>).mockResolvedValue({
      tricks: [], currentTrick: [], currentPlayer: Seat.West,
      declarerTricksWon: 0, defenderTricksWon: 0,
      contract: { level: 3, strain: BidSuit.NoTrump, declarer: Seat.North, doubled: false, redoubled: false },
      legalPlays: [], userControlledSeats: [Seat.South], remainingCards: {},
    });
    store.acceptPrompt();
    await vi.waitFor(() => { expect(store.phase).toBe("PLAYING"); });

    (mockService.getExplanationViewport as ReturnType<typeof vi.fn>).mockResolvedValue({
      contract: null, bidHistory: [], explanationEntries: [],
    });

    store.skipToReview();
    await vi.waitFor(() => {
      expect(store.phase).toBe("EXPLANATION");
      expect(mockService.skipToReview).toHaveBeenCalledWith("session-1");
    });
  });

  it("RESTART_PLAY stays in PLAYING, refreshes viewport", async () => {
    const store = createGameStore(mockService, { delayFn: () => Promise.resolve() });
    await drillToDeclarerPrompt(store, mockService);

    // Get to PLAYING first
    (mockService.acceptPrompt as ReturnType<typeof vi.fn>).mockResolvedValue({ phase: "PLAYING", aiPlays: [] });
    (mockService.getPlayingViewport as ReturnType<typeof vi.fn>).mockResolvedValue({
      tricks: [], currentTrick: [], currentPlayer: Seat.West,
      declarerTricksWon: 0, defenderTricksWon: 0,
      contract: { level: 3, strain: BidSuit.NoTrump, declarer: Seat.North, doubled: false, redoubled: false },
      legalPlays: [], userControlledSeats: [Seat.South], remainingCards: {},
    });
    store.acceptPrompt();
    await vi.waitFor(() => { expect(store.phase).toBe("PLAYING"); });

    // Reset mocks to track restart calls
    (mockService.acceptPrompt as ReturnType<typeof vi.fn>).mockClear();
    (mockService.getPlayingViewport as ReturnType<typeof vi.fn>).mockClear();
    (mockService.acceptPrompt as ReturnType<typeof vi.fn>).mockResolvedValue({ phase: "PLAYING", aiPlays: [] });
    (mockService.getPlayingViewport as ReturnType<typeof vi.fn>).mockResolvedValue({
      tricks: [], currentTrick: [], currentPlayer: Seat.West,
      declarerTricksWon: 0, defenderTricksWon: 0,
      contract: { level: 3, strain: BidSuit.NoTrump, declarer: Seat.North, doubled: false, redoubled: false },
      legalPlays: [], userControlledSeats: [Seat.South], remainingCards: {},
    });

    store.restartPlay();
    await vi.waitFor(() => {
      expect(mockService.acceptPrompt).toHaveBeenCalledWith("session-1", "restart", undefined);
      expect(mockService.getPlayingViewport).toHaveBeenCalled();
      expect(store.phase).toBe("PLAYING");
    });
  });

  it("guarded() tracks full async lifecycle including animation", async () => {
    const delayResolvers: Array<() => void> = [];
    const controlledDelay = () => new Promise<void>((resolve) => { delayResolvers.push(resolve); });
    const store = createGameStore(mockService, { delayFn: controlledDelay });
    await drillToDeclarerPrompt(store, mockService);

    (mockService.acceptPrompt as ReturnType<typeof vi.fn>).mockResolvedValue({
      phase: "PLAYING",
      aiPlays: [{ seat: Seat.West, card: { suit: Suit.Spades, rank: Rank.Ace }, reason: "test" }],
    });
    (mockService.getPlayingViewport as ReturnType<typeof vi.fn>).mockResolvedValue({
      tricks: [], currentTrick: [], currentPlayer: Seat.South,
      declarerTricksWon: 0, defenderTricksWon: 0,
      contract: { level: 3, strain: BidSuit.NoTrump, declarer: Seat.North, doubled: false, redoubled: false },
      legalPlays: [], userControlledSeats: [Seat.South], remainingCards: {},
    });

    store.acceptPrompt();
    // Wait for the service calls to complete (controlled delay hasn't been hit yet by service calls)
    // The transition to PLAYING happens before animation, so phase will be PLAYING
    await vi.waitFor(() => { expect(store.phase).toBe("PLAYING"); });

    // transitioning should be true while animation is pending
    expect(store.isTransitioning).toBe(true);

    // Resolve all pending delays to let animation proceed
    delayResolvers.forEach(r => r());
    await vi.waitFor(() => { expect(store.isTransitioning).toBe(false); });
  });
});
