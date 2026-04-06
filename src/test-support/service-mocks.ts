/**
 * Type-safe mock DevServicePort factory for store tests.
 *
 * The `satisfies` constraint ensures every DevServicePort method is present.
 * Adding/removing a method on DevServicePort produces a compile error here.
 */
import { vi } from "vitest";
import type { DevServicePort } from "../service/port";
import {
  makeBiddingViewport,
  makeDrillStartResult,
  makeBidSubmitResult,
  makePlayEntryResult,
  makePlayCardResult,
} from "./response-factories";

export function createMockService(
  overrides?: Partial<Record<keyof DevServicePort, ReturnType<typeof vi.fn>>>,
): DevServicePort {
  const base = {
    // Init
    init: vi.fn().mockResolvedValue(undefined),
    // Session lifecycle
    createDrillSession: vi.fn().mockResolvedValue("session-1"),
    startDrill: vi.fn().mockResolvedValue(makeDrillStartResult()),
    // Bidding
    submitBid: vi.fn().mockResolvedValue(makeBidSubmitResult()),
    // Phase transitions
    enterPlay: vi.fn().mockResolvedValue(makePlayEntryResult()),
    declinePlay: vi.fn().mockResolvedValue(undefined),
    returnToPrompt: vi.fn().mockResolvedValue(undefined),
    restartPlay: vi.fn().mockResolvedValue(makePlayEntryResult()),
    // Play
    playCard: vi.fn().mockResolvedValue(makePlayCardResult()),
    skipToReview: vi.fn().mockResolvedValue(undefined),
    updatePlayProfile: vi.fn().mockResolvedValue(undefined),
    // Query
    getBiddingViewport: vi.fn().mockResolvedValue(makeBiddingViewport()),
    getDeclarerPromptViewport: vi.fn().mockResolvedValue(null),
    getPlayingViewport: vi.fn().mockResolvedValue(null),
    getExplanationViewport: vi.fn().mockResolvedValue(null),
    // Inference
    getPublicBeliefState: vi.fn().mockResolvedValue({ beliefs: {}, annotations: [] }),
    // DDS
    getDDSSolution: vi.fn().mockRejectedValue(new Error("not available")),
    // Catalog
    listConventions: vi.fn().mockResolvedValue([]),
    // Learning
    listModules: vi.fn().mockResolvedValue([]),
    getModuleLearningViewport: vi.fn().mockResolvedValue(null),
    getBundleFlowTree: vi.fn().mockResolvedValue(null),
    getModuleFlowTree: vi.fn().mockResolvedValue(null),
    // DevServicePort
    getExpectedBid: vi.fn().mockResolvedValue(null),
    getDebugLog: vi.fn().mockResolvedValue([]),
    getInferenceTimeline: vi.fn().mockResolvedValue([]),
    getConventionName: vi.fn().mockResolvedValue("Test Convention"),
    createDrillSessionFromBundle: vi.fn().mockRejectedValue(new Error("stub")),
  } satisfies Record<keyof DevServicePort, ReturnType<typeof vi.fn>>;

  return { ...base, ...overrides };
}
