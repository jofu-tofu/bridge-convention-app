/**
 * Local (in-process) service implementation.
 *
 * Implements DevServicePort — all service methods run in the same process.
 * No network, no server. Convention definitions and strategy logic are
 * available locally.
 *
 * Future: swap this for a remote service implementation where convention
 * IP never leaves the server.
 */

/* eslint-disable @typescript-eslint/require-await -- ServicePort methods are async for future network compat; local impl is synchronous */

import type { Call, Card, Seat } from "../engine/types";
import type { EnginePort } from "../engine/port";
import type { BiddingViewport } from "./response-types";
import { buildBiddingViewport } from "./build-viewport";
import type { LearningViewport } from "./response-types";
import { buildLearningViewport } from "./learning-viewport";
import type { GamePhase } from "../core/phase-machine";
import { isValidTransition } from "../core/phase-machine";
import { createInferenceCoordinator } from "../inference/inference-coordinator";
import { evaluateHand } from "../engine/hand-evaluator";
import { createBiddingContext } from "../conventions";
import { startDrill as bootstrapStartDrill } from "../bootstrap/start-drill";
import { getConvention, listConventions as listConventionConfigs } from "../conventions";
import { getBundle, resolveConventionForSystem } from "../conventions";
import type { ConventionConfig } from "../conventions";
import { getSystemConfig } from "../conventions/definitions/system-config";
import { BASE_SYSTEM_SAYC } from "../conventions/definitions/system-config";
import type { BaseSystemId } from "../conventions/definitions/system-config";
import type { DevServicePort } from "./port";
import type {
  SessionHandle,
  SessionConfig,
} from "./request-types";
import type {
  DrillStartResult,
  BidSubmitResult,
  PromptAcceptResult,
  PlayCardResult,
  SessionViewport,
  DDSolutionResult,
  ConventionInfo,
  ServiceDebugSnapshot,
  ServiceDebugLogEntry,
  ServiceInferenceSnapshot,
} from "./response-types";
import type { AtomGradeResult } from "./evaluation/types";
import { SessionManager, createHandle } from "./session-manager";
import { SessionState, getCurrentTurn as getCurrentTurnFromState } from "./session-state";
import { DDSController } from "./dds-controller";
import {
  processBid,
  runInitialAiBids,
  initializeAuction,
} from "./bidding-controller";
import {
  processPlayCard,
} from "./play-controller";
import { partnerSeat } from "../engine/constants";

import type { DrillBundle } from "../bootstrap/types";

/**
 * Create a local (in-process) service.
 *
 * The service owns all game logic. Stores become thin reactive wrappers.
 */
export function createLocalService(engine: EnginePort): DevServicePort {
  const manager = new SessionManager();
  const ddsControllers = new Map<SessionHandle, DDSController>();

  return {
    // ── Session lifecycle ─────────────────────────────────────────

    async createSession(config: SessionConfig): Promise<SessionHandle> {
      const handle = createHandle();
      const conventionId = config.conventionId;
      const baseConvention = getConvention(conventionId);
      const userSeat = config.userSeat ?? ("S" as Seat);

      // Resolve convention constraints for the base system.
      // If the bundle has constraint factories, deal constraints are
      // regenerated for the active SystemConfig; otherwise used as-is.
      let convention: ConventionConfig = baseConvention;
      if (config.baseSystemId) {
        const systemConfig = getSystemConfig(config.baseSystemId as BaseSystemId);
        const convBundle = getBundle(conventionId);
        convention = resolveConventionForSystem(baseConvention, convBundle, systemConfig);
      }

      const baseSystemId = (config.baseSystemId as BaseSystemId) ?? BASE_SYSTEM_SAYC;
      const bundle = await bootstrapStartDrill(
        engine,
        convention,
        userSeat,
        undefined,
        config.seed,
        config.drill,
        baseSystemId,
      );

      const coordinator = createInferenceCoordinator();
      const state = new SessionState(bundle, coordinator, convention.name);
      manager.set(handle, state);
      ddsControllers.set(handle, new DDSController());

      // Initialize with initial auction if provided by bundle
      if (bundle.initialAuction) {
        initializeAuction(state, bundle.initialAuction);
      }

      return handle;
    },

    async destroySession(handle: SessionHandle): Promise<void> {      manager.delete(handle);
      ddsControllers.delete(handle);
    },

    // ── Drill lifecycle ───────────────────────────────────────────

    async startDrill(handle: SessionHandle): Promise<DrillStartResult> {
      const state = manager.get(handle);

      // Run initial AI bids (no delays — service is transport-neutral)
      const { aiBids, auctionComplete } = await runInitialAiBids(state, engine);

      // Build viewport
      const viewport = buildBiddingViewportFromState(state);
      if (!viewport) {
        throw new Error("Failed to build initial bidding viewport — no current turn in auction");
      }

      return {
        viewport,
        isOffConvention: state.isOffConvention,
        aiBids,
        auctionComplete,
      };
    },

    // ── Bidding ───────────────────────────────────────────────────

    async submitBid(handle: SessionHandle, call: Call): Promise<BidSubmitResult> {
      const state = manager.get(handle);
      const result = await processBid(state, call, engine);

      // Build next viewport if bid was accepted
      let nextViewport: BiddingViewport | null = null;
      if (result.accepted && !result.auctionComplete) {
        nextViewport = buildBiddingViewportFromState(state);
      }

      return {
        accepted: result.accepted,
        feedback: result.viewportFeedback,
        teaching: result.teaching,
        grade: result.grade,
        aiBids: result.aiBids,
        nextViewport,
        phaseTransition: result.phaseTransition,
        userHistoryEntry: result.userHistoryEntry,
      };
    },

    // ── Phase transitions ─────────────────────────────────────────

    async acceptPrompt(handle: SessionHandle, mode?: "play" | "skip"): Promise<PromptAcceptResult> {
      const state = manager.get(handle);
      if (mode === "skip" || !mode) {
        if (isValidTransition(state.phase, "EXPLANATION")) {
          state.phase = "EXPLANATION";
          // Trigger DDS solve
          if (state.deal && state.contract) {
            ddsControllers.get(handle)?.solve(state.deal, state.contract, engine).catch((err) => {
              console.error("DDS solve failed:", err);
            });
          }
        }
      } else if (mode === "play") {
        if (isValidTransition(state.phase, "PLAYING") && state.contract) {
          state.initializePlay(state.contract);
          state.phase = "PLAYING";
        }
      }

      return { phase: state.phase };
    },

    // ── Play ──────────────────────────────────────────────────────

    async playCard(handle: SessionHandle, card: Card, seat: Seat): Promise<PlayCardResult> {
      const state = manager.get(handle);
      return processPlayCard(state, card, seat, engine);
    },

    // ── Query ─────────────────────────────────────────────────────

    async getViewport(handle: SessionHandle): Promise<SessionViewport> {      const state = manager.get(handle);
      return {
        phase: state.phase,
        biddingViewport: buildBiddingViewportFromState(state),
      };
    },

    async getPhase(handle: SessionHandle): Promise<GamePhase> {      const state = manager.get(handle);
      return state.phase;
    },

    // ── DDS analysis ──────────────────────────────────────────────

    async getDDSSolution(handle: SessionHandle): Promise<DDSolutionResult> {
      const state = manager.get(handle);

      if (!state.deal || !state.contract) {
        return { solution: null, error: "No deal or contract available" };
      }

      const dds = ddsControllers.get(handle);
      if (!dds) return { solution: null, error: "No DDS controller" };
      return dds.solve(state.deal, state.contract, engine);
    },

    // ── Stateless CLI evaluation ──────────────────────────────────

    async evaluateAtom(bundleId: string, atomId: string, seed: number): Promise<BiddingViewport> {
      // Delegate to evaluation module
      const { buildAtomViewport } = await import("./evaluation");
      return buildAtomViewport(bundleId, atomId, seed);
    },

    async gradeAtom(bundleId: string, atomId: string, seed: number, bid: string): Promise<AtomGradeResult> {
      const { gradeAtomBid } = await import("./evaluation");
      return gradeAtomBid(bundleId, atomId, seed, bid);
    },

    // ── Convention catalog ────────────────────────────────────────

    async listConventions(): Promise<ConventionInfo[]> {
      const configs = listConventionConfigs();
      return configs.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        category: c.category,
      }));
    },

    // ── Learning ──────────────────────────────────────────────────

    async getLearningViewport(conventionId: string): Promise<LearningViewport | null> {
      const bundle = getBundle(conventionId);
      if (!bundle) return null;
      return buildLearningViewport(bundle);
    },

    // ── Dev methods ───────────────────────────────────────────────

    async getExpectedBid(handle: SessionHandle): Promise<{ call: Call } | null> {
      const state = manager.get(handle);
      if (!state.strategy) return null;

      const currentTurn = getCurrentTurnFromState(state);
      if (!currentTurn || !state.isUserSeat(currentTurn)) return null;

      const hand = state.deal.hands[currentTurn];
      const evaluation = evaluateHand(hand);
      const result = state.strategy.suggest(
        createBiddingContext({ hand, auction: state.auction, seat: currentTurn, evaluation }),
      );
      return result ? { call: result.call } : null;
    },

    async getDebugSnapshot(handle: SessionHandle): Promise<ServiceDebugSnapshot> {
      const state = manager.get(handle);
      const snap = state.captureSnapshot();
      return { ...snap, sessionPhase: state.phase };
    },

    async getDebugLog(handle: SessionHandle): Promise<readonly ServiceDebugLogEntry[]> {
      const state = manager.get(handle);
      return state.debugLog;
    },

    async getInferenceTimeline(handle: SessionHandle): Promise<readonly ServiceInferenceSnapshot[]> {
      const state = manager.get(handle);
      return state.getNSTimeline();
    },

    // ── Transitional methods (removed after Phases 2-4) ───────────

    async getSessionBundle(handle: SessionHandle): Promise<DrillBundle> {
      const state = manager.get(handle);
      return state.bundle;
    },

    async getConventionName(handle: SessionHandle): Promise<string> {
      const state = manager.get(handle);
      return state.conventionName;
    },

    async createSessionFromBundle(bundle: DrillBundle): Promise<SessionHandle> {
      const handle = createHandle();
      const coordinator = createInferenceCoordinator();
      const state = new SessionState(bundle, coordinator);
      manager.set(handle, state);
      ddsControllers.set(handle, new DDSController());
      if (bundle.initialAuction) {
        initializeAuction(state, bundle.initialAuction);
      }
      return handle;
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Build a BiddingViewport from session state. */
function buildBiddingViewportFromState(state: SessionState): BiddingViewport | null {
  const currentTurn = getCurrentTurnFromState(state);
  if (!currentTurn) return null;

  const seat = state.userSeat;
  const faceUpSeats = new Set<Seat>([seat]);

  // In DECLARER_PROMPT, show additional seats
  if (state.phase === "DECLARER_PROMPT" && state.contract) {
    if (state.contract.declarer === seat) {
      faceUpSeats.add(partnerSeat(state.contract.declarer));
    } else if (partnerSeat(state.contract.declarer) === seat) {
      faceUpSeats.add(state.contract.declarer);
    }
  }

  return buildBiddingViewport({
    deal: state.deal,
    userSeat: seat,
    auction: state.auction,
    bidHistory: state.bidHistory,
    legalCalls: state.legalCalls,
    faceUpSeats,
    conventionName: state.conventionId,
    isUserTurn: state.isUserSeat(currentTurn) && state.phase === "BIDDING",
    currentBidder: currentTurn,
  });
}
