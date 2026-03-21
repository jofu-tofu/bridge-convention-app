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
import type { BiddingViewport } from "../core/viewport";
import { buildBiddingViewport } from "../core/viewport";
import type { GamePhase } from "../stores/phase-machine";
import { isValidTransition } from "../stores/phase-machine";
import { createInferenceCoordinator } from "../inference/inference-coordinator";
import { evaluateHand } from "../engine/hand-evaluator";
import { createBiddingContext } from "../conventions/core";
import { startDrill as bootstrapStartDrill } from "../bootstrap/start-drill";
import { getConvention, listConventions as listConventionConfigs } from "../conventions/core";
import type { ConventionConfig } from "../conventions/core";
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
  AtomGradeResult,
  ServiceDebugSnapshot,
  ServiceDebugLogEntry,
  ServiceInferenceSnapshot,
} from "./response-types";
import { SessionManager, createHandle } from "./session-manager";
import { SessionState } from "./session-state";
import { DDSController } from "./dds-controller";
import {
  processBid,
  runInitialAiBids,
  initializeAuction,
} from "./bidding-controller";
import { partnerSeat } from "../engine/constants";

/** Per-session ancillary state not on SessionState. */
interface SessionAncillary {
  dds: DDSController;
  conventionConfig: ConventionConfig;
}

/**
 * Create a local (in-process) service.
 *
 * The service owns all game logic. Stores become thin reactive wrappers.
 */
export function createLocalService(engine: EnginePort): DevServicePort {
  const manager = new SessionManager();
  const ancillary = new Map<SessionHandle, SessionAncillary>();

  function getAncillary(handle: SessionHandle): SessionAncillary {
    const a = ancillary.get(handle);
    if (!a) throw new Error(`Unknown session handle: ${handle}`);
    return a;
  }

  return {
    // ── Session lifecycle ─────────────────────────────────────────

    async createSession(config: SessionConfig): Promise<SessionHandle> {
      const handle = createHandle();
      const conventionId = config.conventionId;
      const convention = getConvention(conventionId);
      const userSeat = config.userSeat ?? ("S" as Seat);

      const bundle = await bootstrapStartDrill(
        engine,
        convention,
        userSeat,
        undefined,
        config.seed,
        config.drill,
      );

      const coordinator = createInferenceCoordinator();
      const state = new SessionState(bundle, coordinator);
      manager.set(handle, state);
      ancillary.set(handle, {
        dds: new DDSController(),
        conventionConfig: convention,
      });

      // Initialize with initial auction if provided by bundle
      if (bundle.initialAuction) {
        initializeAuction(state, bundle.initialAuction);
      }

      return handle;
    },

    async destroySession(handle: SessionHandle): Promise<void> {      manager.delete(handle);
      ancillary.delete(handle);
    },

    // ── Drill lifecycle ───────────────────────────────────────────

    async startDrill(handle: SessionHandle): Promise<DrillStartResult> {
      const state = manager.get(handle);

      // Run initial AI bids (no delays — service is transport-neutral)
      const { aiBids } = await runInitialAiBids(state, engine);

      // Build viewport
      const viewport = buildBiddingViewportFromState(state);

      return {
        viewport: viewport!,
        isOffConvention: state.isOffConvention,
        aiBids,
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
      };
    },

    // ── Phase transitions ─────────────────────────────────────────

    async acceptPrompt(handle: SessionHandle, mode?: "play" | "skip"): Promise<PromptAcceptResult> {      const state = manager.get(handle);
      const anc = getAncillary(handle);

      if (mode === "skip" || !mode) {
        if (isValidTransition(state.phase, "EXPLANATION")) {
          state.phase = "EXPLANATION";
          // Trigger DDS solve
          if (state.deal && state.contract) {
            void anc.dds.solve(state.deal, state.contract, engine);
          }
        }
      } else if (mode === "play") {
        if (isValidTransition(state.phase, "PLAYING")) {
          state.phase = "PLAYING";
        }
      }

      return { phase: state.phase };
    },

    // ── Play ──────────────────────────────────────────────────────

    async playCard(_handle: SessionHandle, _card: Card, _seat: Seat): Promise<PlayCardResult> {      // Play controller extraction deferred — placeholder for now
      return { accepted: false, trickComplete: false, playComplete: false, score: null };
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
      const anc = getAncillary(handle);

      if (!state.deal || !state.contract) {
        return { solution: null, error: "No deal or contract available" };
      }

      return anc.dds.solve(state.deal, state.contract, engine);
    },

    // ── Stateless CLI evaluation ──────────────────────────────────

    async evaluateAtom(bundleId: string, atomId: string, seed: number): Promise<BiddingViewport> {
      // Delegate to evaluation module
      const { buildAtomViewport } = await import("../evaluation");
      return buildAtomViewport(bundleId, atomId, seed);
    },

    async gradeAtom(bundleId: string, atomId: string, seed: number, bid: string): Promise<AtomGradeResult> {
      const { buildAtomViewport, gradeAtomBid } = await import("../evaluation");
      const viewport = buildAtomViewport(bundleId, atomId, seed);
      const gradeResult = gradeAtomBid(bundleId, atomId, seed, bid);
      return {
        viewport,
        feedback: gradeResult.feedback ?? null,
        teaching: gradeResult.teaching ?? null,
        grade: gradeResult.grade ?? null,
      };
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

import { nextSeat } from "../engine/constants";

/** Get current turn seat from session state. */
function getCurrentTurnFromState(state: SessionState): Seat | null {
  if (state.auction.entries.length === 0) {
    return state.deal.dealer;
  }
  const lastEntry = state.auction.entries[state.auction.entries.length - 1]!;
  return nextSeat(lastEntry.seat);
}
