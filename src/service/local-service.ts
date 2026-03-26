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

import { type Call, type Card, Seat } from "../engine/types";
import type { EnginePort } from "../engine/port";
import type { BiddingViewport, DeclarerPromptViewport, PlayingViewport, ExplanationViewport, ServicePublicBeliefState, ServicePublicBeliefs } from "./response-types";
import { buildBiddingViewport, buildDeclarerPromptViewport, buildPlayingViewport, buildExplanationViewport } from "../session/build-viewport";
import type { ModuleCatalogEntry, ModuleLearningViewport } from "./response-types";
import { buildModuleCatalog, buildModuleLearningViewport } from "../session/learning-viewport";
import type { GamePhase } from "../session/phase-machine";
import { isValidTransition } from "../session/phase-machine";
import { createInferenceCoordinator } from "../inference/inference-coordinator";
import { evaluateHand } from "../engine/hand-evaluator";
import { createBiddingContext } from "../conventions";
import { startDrill as assembleNewDrill } from "../session/start-drill";
import { getConvention, listConventions as listConventionConfigs } from "../conventions";
import { getBundle, resolveConventionForSystem, getSystemConfig, BASE_SYSTEM_SAYC } from "../conventions";
import type { ConventionConfig, BaseSystemId } from "../conventions";
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
  ServiceInferenceSnapshot,
} from "./response-types";
import type {
  ServiceDebugSnapshot,
  ServiceDebugLogEntry,
} from "./debug-types";
import type { AtomGradeResult } from "./evaluation/types";
import { SessionManager, createHandle } from "../session/session-manager";
import { SessionState, getCurrentTurn as getCurrentTurnFromState } from "../session/session-state";
import { DDSController } from "../session/dds-controller";
import {
  processBid,
  runInitialAiBids,
  initializeAuction,
} from "../session/bidding-controller";
import {
  processPlayCard,
} from "../session/play-controller";
import { partnerSeat, areSamePartnership } from "../engine/constants";

import type { DrillBundle } from "../session/drill-types";

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
      console.log("[DEBUG] createSession called", config.conventionId);
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
      console.log("[DEBUG] about to assembleNewDrill");
      const bundle = await assembleNewDrill(
        engine,
        convention,
        userSeat,
        undefined,
        config.seed,
        config.drill,
        baseSystemId,
      );
      console.log("[DEBUG] assembleNewDrill done");

      const activeSystemConfig = getSystemConfig(baseSystemId);
      const coordinator = createInferenceCoordinator(undefined, activeSystemConfig);
      const state = new SessionState(bundle, coordinator, convention.name);
      manager.set(handle, state);
      ddsControllers.set(handle, new DDSController());

      // Initialize with initial auction if provided by bundle
      if (bundle.initialAuction) {
        initializeAuction(state, bundle.initialAuction);
      }

      console.log("[DEBUG] createSession returning handle");
      return handle;
    },

    async destroySession(handle: SessionHandle): Promise<void> {      manager.delete(handle);
      ddsControllers.delete(handle);
    },

    // ── Drill lifecycle ───────────────────────────────────────────

    async startDrill(handle: SessionHandle): Promise<DrillStartResult> {
      console.log("[DEBUG] startDrill called");
      const state = manager.get(handle);

      // Run initial AI bids (no delays — service is transport-neutral)
      console.log("[DEBUG] about to runInitialAiBids");
      const { aiBids, auctionComplete } = await runInitialAiBids(state, engine);
      console.log("[DEBUG] runInitialAiBids done", { aiBids: aiBids.length, auctionComplete });

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

      // Build next viewport if bid was accepted (including auction-completing bids,
      // so the store can animate AI bids before transitioning phases)
      let nextViewport: BiddingViewport | null = null;
      if (result.accepted) {
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

    async acceptPrompt(handle: SessionHandle, mode?: "play" | "skip" | "replay", seatOverride?: Seat): Promise<PromptAcceptResult> {
      const state = manager.get(handle);
      if (mode === "skip" || !mode) {
        if (isValidTransition(state.phase, "EXPLANATION")) {
          state.phase = "EXPLANATION";
          // DDS solve is triggered by the store via getDDSSolution()
        }
      } else if (mode === "play") {
        if (isValidTransition(state.phase, "PLAYING") && state.contract) {
          state.effectiveUserSeat = seatOverride ?? state.userSeat;
          state.initializePlay(state.contract);
          state.phase = "PLAYING";
        }
      } else if (mode === "replay") {
        // Transition back to DECLARER_PROMPT from EXPLANATION (for "Play this Hand")
        if (isValidTransition(state.phase, "DECLARER_PROMPT")) {
          state.phase = "DECLARER_PROMPT";
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

    async getBiddingViewport(handle: SessionHandle): Promise<BiddingViewport | null> {
      const state = manager.get(handle);
      return buildBiddingViewportFromState(state);
    },

    async getDeclarerPromptViewport(handle: SessionHandle): Promise<DeclarerPromptViewport | null> {
      const state = manager.get(handle);
      return buildDeclarerPromptViewportFromState(state);
    },

    async getPlayingViewport(handle: SessionHandle): Promise<PlayingViewport | null> {
      const state = manager.get(handle);
      return buildPlayingViewportFromState(state, engine);
    },

    async getExplanationViewport(handle: SessionHandle): Promise<ExplanationViewport | null> {
      const state = manager.get(handle);
      return buildExplanationViewportFromState(state);
    },

    // ── Inference ────────────────────────────────────────────────

    async getPublicBeliefState(handle: SessionHandle): Promise<ServicePublicBeliefState> {
      const state = manager.get(handle);
      return state.publicBeliefState as ServicePublicBeliefState;
    },

    async capturePlayInferences(handle: SessionHandle) {
      const state = manager.get(handle);
      state.capturePlayInferences();
      // PublicBeliefs and ServicePublicBeliefs are structurally compatible
      return state.playInferences as Record<Seat, ServicePublicBeliefs> | null;
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

    async listModules(): Promise<readonly ModuleCatalogEntry[]> {
      return buildModuleCatalog();
    },

    async getModuleLearningViewport(moduleId: string): Promise<ModuleLearningViewport | null> {
      return buildModuleLearningViewport(moduleId);
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

/** Determine the prompt mode from session state. */
function getPromptMode(state: SessionState): "defender" | "south-declarer" | "declarer-swap" | null {
  if (state.phase !== "DECLARER_PROMPT" || !state.contract) return null;
  const userSeat = state.userSeat;
  if (state.contract.declarer !== userSeat && partnerSeat(state.contract.declarer) !== userSeat) return "defender";
  if (state.contract.declarer === userSeat) return "south-declarer";
  return "declarer-swap";
}

/** Compute face-up seats for the declarer prompt phase. */
function getDeclarerPromptFaceUpSeats(state: SessionState): Set<Seat> {
  const seat = state.effectiveUserSeat ?? state.userSeat;
  const seats = new Set<Seat>([seat]);

  if (state.contract) {
    const mode = getPromptMode(state);
    if (mode === "south-declarer") {
      seats.add(partnerSeat(state.contract.declarer));
    } else if (mode === "declarer-swap") {
      seats.add(state.contract.declarer);
    }
  }

  return seats;
}

/** Build a DeclarerPromptViewport from session state. */
function buildDeclarerPromptViewportFromState(state: SessionState): DeclarerPromptViewport | null {
  if (!state.contract || state.phase !== "DECLARER_PROMPT") return null;

  const mode = getPromptMode(state);
  if (!mode) return null;

  return buildDeclarerPromptViewport({
    deal: state.deal,
    userSeat: state.userSeat,
    faceUpSeats: getDeclarerPromptFaceUpSeats(state),
    auction: state.auction,
    bidHistory: state.bidHistory,
    contract: state.contract,
    promptMode: mode,
  });
}

/** Build a PlayingViewport from session state. Requires engine for legal plays. */
async function buildPlayingViewportFromState(state: SessionState, engine: EnginePort): Promise<PlayingViewport | null> {
  if (state.phase !== "PLAYING") return null;

  const effectiveSeat = state.effectiveUserSeat ?? state.userSeat;
  const contract = state.contract;

  // Compute face-up seats: user + dummy if on same partnership
  const faceUpSeats = new Set<Seat>([effectiveSeat]);
  if (contract) {
    const dummy = partnerSeat(contract.declarer);
    if (areSamePartnership(dummy, effectiveSeat)) {
      faceUpSeats.add(dummy);
    }
  }

  // Compute user-controlled seats
  const userControlledSeats: Seat[] = [effectiveSeat];
  if (contract && state.effectiveUserSeat) {
    const dummy = partnerSeat(contract.declarer);
    if (dummy !== state.effectiveUserSeat && contract.declarer === state.effectiveUserSeat) {
      userControlledSeats.push(dummy);
    }
  }

  // Compute remaining cards per seat
  const remainingCards: Partial<Record<Seat, readonly Card[]>> = {};
  for (const s of [Seat.North, Seat.East, Seat.South, Seat.West] as Seat[]) {
    remainingCards[s] = state.getRemainingCards(s);
  }

  // Compute legal plays for the current player
  let legalPlays: readonly Card[] = [];
  if (state.currentPlayer) {
    const remaining = state.getRemainingCards(state.currentPlayer);
    legalPlays = await engine.getLegalPlays({ cards: remaining }, state.getLeadSuit());
  }

  return buildPlayingViewport({
    deal: state.deal,
    userSeat: effectiveSeat,
    faceUpSeats,
    auction: state.auction,
    bidHistory: state.bidHistory,
    rotated: state.effectiveUserSeat === Seat.North,
    contract,
    currentPlayer: state.currentPlayer,
    currentTrick: state.currentTrick,
    trumpSuit: state.trumpSuit,
    legalPlays,
    userControlledSeats,
    remainingCards,
    tricks: state.tricks,
    declarerTricksWon: state.declarerTricksWon,
    defenderTricksWon: state.defenderTricksWon,
  });
}

/** Build an ExplanationViewport from session state. */
function buildExplanationViewportFromState(state: SessionState): ExplanationViewport | null {
  if (state.phase !== "EXPLANATION") return null;

  return buildExplanationViewport({
    deal: state.deal,
    userSeat: state.userSeat,
    auction: state.auction,
    bidHistory: state.bidHistory,
    contract: state.contract,
    score: state.playScore,
    declarerTricksWon: state.declarerTricksWon,
  });
}
