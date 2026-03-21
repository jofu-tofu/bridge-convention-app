/**
 * Service port interfaces — the boundary between UI/CLI and game logic.
 *
 * ServicePort is the production interface. DevServicePort extends it with
 * debug/observability methods. Production stores type against ServicePort;
 * debug panels cast to DevServicePort.
 */

import type { Call, Card, Seat } from "../engine/types";
import type { BiddingViewport } from "../core/viewport";
import type { GamePhase } from "../stores/phase-machine";
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

/** Production service interface — all methods return Promise<T>. */
export interface ServicePort {
  // ── Session lifecycle ───────────────────────────────────────────
  createSession(config: SessionConfig): Promise<SessionHandle>;
  destroySession(handle: SessionHandle): Promise<void>;

  // ── Drill lifecycle ─────────────────────────────────────────────
  startDrill(handle: SessionHandle): Promise<DrillStartResult>;

  // ── Bidding ─────────────────────────────────────────────────────
  /** Grade + apply + run AI + return next viewport — single round-trip. */
  submitBid(handle: SessionHandle, call: Call): Promise<BidSubmitResult>;

  // ── Phase transitions ───────────────────────────────────────────
  acceptPrompt(handle: SessionHandle, mode?: "play" | "skip"): Promise<PromptAcceptResult>;

  // ── Play ────────────────────────────────────────────────────────
  playCard(handle: SessionHandle, card: Card, seat: Seat): Promise<PlayCardResult>;

  // ── Query ───────────────────────────────────────────────────────
  getViewport(handle: SessionHandle): Promise<SessionViewport>;
  getPhase(handle: SessionHandle): Promise<GamePhase>;

  // ── DDS analysis ────────────────────────────────────────────────
  getDDSSolution(handle: SessionHandle): Promise<DDSolutionResult>;

  // ── Stateless CLI evaluation ────────────────────────────────────
  evaluateAtom(bundleId: string, atomId: string, seed: number): Promise<BiddingViewport>;
  gradeAtom(bundleId: string, atomId: string, seed: number, bid: string): Promise<AtomGradeResult>;

  // ── Convention catalog ──────────────────────────────────────────
  listConventions(): Promise<ConventionInfo[]>;
}

/** Extends ServicePort with dev/debug methods.
 *  Production builds use ServicePort only.
 *  local-service.ts implements both. */
export interface DevServicePort extends ServicePort {
  getExpectedBid(handle: SessionHandle): Promise<{ call: Call } | null>;
  getDebugSnapshot(handle: SessionHandle): Promise<ServiceDebugSnapshot>;
  getDebugLog(handle: SessionHandle): Promise<readonly ServiceDebugLogEntry[]>;
  getInferenceTimeline(handle: SessionHandle): Promise<readonly ServiceInferenceSnapshot[]>;
}
