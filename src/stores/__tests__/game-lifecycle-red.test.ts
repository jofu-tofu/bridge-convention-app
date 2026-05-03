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
import { Seat, Suit, Rank, BidSuit } from "../../engine/types";
import type { AiBidEntry } from "../../service/response-types";
import { ViewportBidGrade } from "../../service/response-types";
import { PlayPreference, SAYC_SYSTEM_CONFIG, DEFAULT_BASE_MODULE_IDS } from "../../service/session-types";
import { createGameStore } from "../game.svelte";
import { createMockService } from "../../test-support/service-mocks";
import {
  makeDrillStartResult,
  makeBidSubmitResult,
  makePlayEntryResult,
  makePlayingViewport,
  makeDeclarerPromptViewport,
  makeExplanationViewport,
} from "../../test-support/response-factories";

describe("game store lifecycle (RED tests)", () => {
  let mockService: DevServicePort;

  beforeEach(() => {
    mockService = createMockService();
  });

  it("RED: startNewDrill calls createDrillSession then startDrill and caches viewport", async () => {
    const store = createGameStore(mockService, {
      delayFn: () => Promise.resolve(),
    });

    store.startNewDrill({
      conventionId: "nt-bundle",
      userSeat: Seat.South,
      seed: 42,
      systemConfig: SAYC_SYSTEM_CONFIG,
      baseModuleIds: [...DEFAULT_BASE_MODULE_IDS],
    });

    // Allow async operations to settle
    await vi.waitFor(() => {
      expect(mockService.createDrillSession).toHaveBeenCalledWith(
        expect.objectContaining({ conventionId: "nt-bundle" }),
      );
      expect(mockService.startDrill).toHaveBeenCalledWith("session-1");
      expect(store.biddingViewport).not.toBeNull();
      expect(store.phase).toBe("BIDDING");
    });
  });

  it("RED: multi-module drills round-robin the active launch target module per deal", async () => {
    const observedModuleIds: string[] = [];
    const activeLaunch = { moduleIds: ["stayman-bundle", "jacoby-transfers-bundle"] };

    vi.mocked(mockService.createDrillSession).mockImplementation(async (config) => {
      const targetModuleId = config.target?.kind === "module" || config.target?.kind === "surface"
        ? config.target.moduleId
        : undefined;
      observedModuleIds.push(targetModuleId ?? config.conventionId);
      return `session-${observedModuleIds.length}`;
    });

    const store = createGameStore(mockService, {
      delayFn: () => Promise.resolve(),
      getActiveLaunch: () => activeLaunch,
    });

    const config = {
      conventionId: "ignored",
      userSeat: Seat.South,
      systemConfig: SAYC_SYSTEM_CONFIG,
      baseModuleIds: [...DEFAULT_BASE_MODULE_IDS],
    };

    store.startNewDrill(config);
    await vi.waitFor(() => {
      expect(observedModuleIds).toHaveLength(1);
      expect(store.activeHandle).toBe("session-1");
    });

    store.startNewDrill(config);
    await vi.waitFor(() => {
      expect(observedModuleIds).toHaveLength(2);
      expect(store.activeHandle).toBe("session-2");
    });

    store.startNewDrill(config);
    await vi.waitFor(() => {
      expect(observedModuleIds).toHaveLength(3);
      expect(store.activeHandle).toBe("session-3");
    });

    store.startNewDrill(config);
    await vi.waitFor(() => {
      expect(observedModuleIds).toHaveLength(4);
      expect(store.activeHandle).toBe("session-4");
    });

    expect(observedModuleIds).toEqual([
      "stayman-bundle",
      "jacoby-transfers-bundle",
      "stayman-bundle",
      "jacoby-transfers-bundle",
    ]);
  });

  it("RED: userBid with correct bid updates viewport and animates AI bids", async () => {
    const aiBids: AiBidEntry[] = [
      { seat: Seat.West, call: { type: "pass" as const }, historyEntry: { seat: Seat.West, call: { type: "pass" as const }, isUser: false } },
      { seat: Seat.North, call: { type: "bid" as const, level: 2, strain: BidSuit.Clubs }, historyEntry: { seat: Seat.North, call: { type: "bid" as const, level: 2, strain: BidSuit.Clubs }, isUser: false } },
    ];

    vi.mocked(mockService.submitBid).mockResolvedValue(
      makeBidSubmitResult({ aiBids }),
    );

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
    vi.mocked(mockService.submitBid).mockResolvedValue(
      makeBidSubmitResult({
        accepted: false,
        grade: ViewportBidGrade.Incorrect,
        feedback: {
          grade: ViewportBidGrade.Incorrect,
          userCall: { type: "pass" },
          userCallDisplay: "Pass",
          correctCall: { type: "bid", level: 2, strain: BidSuit.Clubs },
          correctCallDisplay: "2♣",
          requiresRetry: true,
        },
        teaching: null,
        aiBids: [],
        nextViewport: null,
        phaseTransition: null,
        userHistoryEntry: null,
      }),
    );

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
    vi.mocked(mockService.submitBid).mockResolvedValue(
      makeBidSubmitResult({
        phaseTransition: { from: "BIDDING", to: "DECLARER_PROMPT" },
      }),
    );

    vi.mocked(mockService.getDeclarerPromptViewport).mockResolvedValue(
      makeDeclarerPromptViewport(),
    );

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
    vi.mocked(mockService.startDrill).mockResolvedValue(
      makeDrillStartResult({ playPreference: PlayPreference.Skip }),
    );

    vi.mocked(mockService.submitBid).mockResolvedValue(
      makeBidSubmitResult({
        phaseTransition: { from: "BIDDING", to: "DECLARER_PROMPT" },
      }),
    );

    vi.mocked(mockService.getExplanationViewport).mockResolvedValue(
      makeExplanationViewport(),
    );

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
    vi.mocked(mockService.startDrill).mockResolvedValue(
      makeDrillStartResult({ playPreference: PlayPreference.Always }),
    );

    vi.mocked(mockService.submitBid).mockResolvedValue(
      makeBidSubmitResult({
        phaseTransition: { from: "BIDDING", to: "PLAYING" },
      }),
    );

    vi.mocked(mockService.getPlayingViewport).mockResolvedValue(
      makePlayingViewport(),
    );

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
    store.startNewDrill({ conventionId: "nt-bundle", seed: 1, systemConfig: SAYC_SYSTEM_CONFIG, baseModuleIds: [...DEFAULT_BASE_MODULE_IDS] });

    // Immediately start another before first settles
    store.startNewDrill({ conventionId: "nt-bundle", seed: 2, systemConfig: SAYC_SYSTEM_CONFIG, baseModuleIds: [...DEFAULT_BASE_MODULE_IDS] });

    await vi.waitFor(() => {
      // Second drill should win — createDrillSession called twice
      expect(mockService.createDrillSession).toHaveBeenCalledTimes(2);
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

    // Service enterPlay should NOT have been called
    expect(mockService.enterPlay).not.toHaveBeenCalled();
    expect(store.phase).toBe("BIDDING");
  });

  // ── Executor transition tests ──────────────────────────────────

  async function drillToDeclarerPrompt(store: ReturnType<typeof createGameStore>, svc: DevServicePort) {
    vi.mocked(svc.submitBid).mockResolvedValue(
      makeBidSubmitResult({
        phaseTransition: { from: "BIDDING", to: "DECLARER_PROMPT" },
      }),
    );
    vi.mocked(svc.getDeclarerPromptViewport).mockResolvedValue(
      makeDeclarerPromptViewport(),
    );
    await store.startDrillFromHandle("session-1");
    store.userBid({ type: "pass" });
    await vi.waitFor(() => { expect(store.phase).toBe("DECLARER_PROMPT"); });
  }

  it("ACCEPT_PLAY calls service, fetches viewport, transitions to PLAYING", async () => {
    const store = createGameStore(mockService, { delayFn: () => Promise.resolve() });
    await drillToDeclarerPrompt(store, mockService);

    vi.mocked(mockService.enterPlay).mockResolvedValue(makePlayEntryResult({ aiPlays: [] }));
    vi.mocked(mockService.getPlayingViewport).mockResolvedValue(makePlayingViewport());

    store.acceptPrompt();
    await vi.waitFor(() => {
      expect(store.phase).toBe("PLAYING");
      expect(mockService.enterPlay).toHaveBeenCalledWith("session-1", expect.any(String));
      expect(mockService.getPlayingViewport).toHaveBeenCalled();
    });
  });

  it("DECLINE_PLAY calls service, transitions to EXPLANATION", async () => {
    const store = createGameStore(mockService, { delayFn: () => Promise.resolve() });
    await drillToDeclarerPrompt(store, mockService);

    vi.mocked(mockService.getExplanationViewport).mockResolvedValue(
      makeExplanationViewport(),
    );

    store.declinePrompt();
    await vi.waitFor(() => {
      expect(store.phase).toBe("EXPLANATION");
      expect(mockService.declinePlay).toHaveBeenCalledWith("session-1");
      expect(mockService.getExplanationViewport).toHaveBeenCalled();
    });
  });

  it("SKIP_TO_REVIEW calls skipToReview service, transitions to EXPLANATION", async () => {
    const store = createGameStore(mockService, { delayFn: () => Promise.resolve() });
    await drillToDeclarerPrompt(store, mockService);

    // First get to PLAYING
    vi.mocked(mockService.enterPlay).mockResolvedValue(makePlayEntryResult({ aiPlays: [] }));
    vi.mocked(mockService.getPlayingViewport).mockResolvedValue(makePlayingViewport());
    store.acceptPrompt();
    await vi.waitFor(() => { expect(store.phase).toBe("PLAYING"); });

    vi.mocked(mockService.getExplanationViewport).mockResolvedValue(
      makeExplanationViewport(),
    );

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
    vi.mocked(mockService.enterPlay).mockResolvedValue(makePlayEntryResult({ aiPlays: [] }));
    vi.mocked(mockService.getPlayingViewport).mockResolvedValue(makePlayingViewport());
    store.acceptPrompt();
    await vi.waitFor(() => { expect(store.phase).toBe("PLAYING"); });

    // Reset mocks to track restart calls
    vi.mocked(mockService.restartPlay).mockClear();
    vi.mocked(mockService.getPlayingViewport).mockClear();
    vi.mocked(mockService.restartPlay).mockResolvedValue(makePlayEntryResult({ aiPlays: [] }));
    vi.mocked(mockService.getPlayingViewport).mockResolvedValue(makePlayingViewport());

    store.restartPlay();
    await vi.waitFor(() => {
      expect(mockService.restartPlay).toHaveBeenCalledWith("session-1");
      expect(mockService.getPlayingViewport).toHaveBeenCalled();
      expect(store.phase).toBe("PLAYING");
    });
  });

  it("guarded() tracks full async lifecycle including animation", async () => {
    const delayResolvers: Array<() => void> = [];
    const controlledDelay = () => new Promise<void>((resolve) => { delayResolvers.push(resolve); });
    const store = createGameStore(mockService, { delayFn: controlledDelay });
    await drillToDeclarerPrompt(store, mockService);

    vi.mocked(mockService.enterPlay).mockResolvedValue(
      makePlayEntryResult({
        aiPlays: [{ seat: Seat.West, card: { suit: Suit.Spades, rank: Rank.Ace }, reason: "test" }],
      }),
    );
    vi.mocked(mockService.getPlayingViewport).mockResolvedValue(
      makePlayingViewport({ currentPlayer: Seat.South }),
    );

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
