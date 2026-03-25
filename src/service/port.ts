/**
 * Service port interfaces — the boundary between UI/CLI and game logic.
 *
 * ServicePort is the production interface. DevServicePort extends it with
 * debug/observability methods. Production stores type against ServicePort;
 * debug panels cast to DevServicePort.
 */

import type { Call, Card, Seat } from "../engine/types";
import type { DrillBundle } from "../session/drill-types";
import type {
  SessionHandle,
  SessionConfig,
} from "./request-types";
import type {
  ServiceGamePhase,
  BiddingViewport,
  DeclarerPromptViewport,
  PlayingViewport,
  ExplanationViewport,
  ModuleCatalogEntry,
  ModuleLearningViewport,
  DrillStartResult,
  BidSubmitResult,
  PromptAcceptResult,
  PlayCardResult,
  SessionViewport,
  DDSolutionResult,
  ConventionInfo,
  ServiceInferenceSnapshot,
  ServicePublicBeliefState,
} from "./response-types";
import type {
  ServiceDebugSnapshot,
  ServiceDebugLogEntry,
} from "./debug-types";
import type { AtomGradeResult } from "./evaluation/types";

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
  getPhase(handle: SessionHandle): Promise<ServiceGamePhase>;
  getBiddingViewport(handle: SessionHandle): Promise<BiddingViewport | null>;
  getDeclarerPromptViewport(handle: SessionHandle): Promise<DeclarerPromptViewport | null>;
  getPlayingViewport(handle: SessionHandle): Promise<PlayingViewport | null>;
  getExplanationViewport(handle: SessionHandle): Promise<ExplanationViewport | null>;

  // ── Inference ─────────────────────────────────────────────────────
  /** Get the current public belief state from the session's inference coordinator.
   *  Eliminates the need for the store to maintain its own inference coordinator. */
  getPublicBeliefState(handle: SessionHandle): Promise<ServicePublicBeliefState>;

  // ── DDS analysis ────────────────────────────────────────────────
  getDDSSolution(handle: SessionHandle): Promise<DDSolutionResult>;

  // ── Stateless CLI evaluation ────────────────────────────────────
  evaluateAtom(bundleId: string, atomId: string, seed: number): Promise<BiddingViewport>;
  gradeAtom(bundleId: string, atomId: string, seed: number, bid: string): Promise<AtomGradeResult>;

  // ── Convention catalog ──────────────────────────────────────────
  listConventions(): Promise<ConventionInfo[]>;

  // ── Learning ──────────────────────────────────────────────────
  /** List all registered modules with catalog metadata. */
  listModules(): Promise<readonly ModuleCatalogEntry[]>;
  /** Build a learning viewport for a single module by ID. */
  getModuleLearningViewport(moduleId: string): Promise<ModuleLearningViewport | null>;
}

/** Extends ServicePort with dev/debug methods.
 *  Production builds use ServicePort only.
 *  local-service.ts implements both. */
export interface DevServicePort extends ServicePort {
  getExpectedBid(handle: SessionHandle): Promise<{ call: Call } | null>;
  getDebugSnapshot(handle: SessionHandle): Promise<ServiceDebugSnapshot>;
  getDebugLog(handle: SessionHandle): Promise<readonly ServiceDebugLogEntry[]>;
  getInferenceTimeline(handle: SessionHandle): Promise<readonly ServiceInferenceSnapshot[]>;

  /** Transitional: return the DrillBundle so stores can initialize from raw state.
   *  Will be removed once stores fully delegate to the service (Phases 2-4). */
  getSessionBundle(handle: SessionHandle): Promise<DrillBundle>;

  /** Transitional: return the resolved convention name for a session. */
  getConventionName(handle: SessionHandle): Promise<string>;

  /** Create a session from a pre-built DrillBundle (for tests using stub engines). */
  createSessionFromBundle(bundle: DrillBundle): Promise<SessionHandle>;
}
