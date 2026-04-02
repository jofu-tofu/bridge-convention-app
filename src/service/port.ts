/**
 * Service port interfaces — the boundary between UI/CLI and game logic.
 *
 * ServicePort is the production interface. DevServicePort extends it with
 * debug/observability methods. Production stores type against ServicePort;
 * debug panels cast to DevServicePort.
 */

import type { Call, Card, Seat } from "../engine/types";
import type { PlayProfileId } from "./session-types";
import type {
  SessionHandle,
  SessionConfig,
} from "./request-types";
import type {
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
  DDSolutionResult,
  ConventionInfo,
  BundleFlowTreeViewport,
  ModuleFlowTreeViewport,
  ServiceInferenceSnapshot,
  ServicePublicBeliefState,
} from "./response-types";
import type {
  ServiceDebugSnapshot,
  ServiceDebugLogEntry,
  PlaySuggestions,
} from "./debug-types";

/** Production service interface — all methods return Promise<T>. */
interface ServicePort {
  // ── Session lifecycle ───────────────────────────────────────────
  createSession(config: SessionConfig): Promise<SessionHandle>;

  // ── Drill lifecycle ─────────────────────────────────────────────
  startDrill(handle: SessionHandle): Promise<DrillStartResult>;

  // ── Bidding ─────────────────────────────────────────────────────
  /** Grade + apply + run AI + return next viewport — single round-trip. */
  submitBid(handle: SessionHandle, call: Call): Promise<BidSubmitResult>;

  // ── Phase transitions ───────────────────────────────────────────
  acceptPrompt(handle: SessionHandle, mode?: "play" | "skip" | "replay" | "restart", seatOverride?: Seat): Promise<PromptAcceptResult>;

  // ── Play ────────────────────────────────────────────────────────
  playCard(handle: SessionHandle, card: Card, seat: Seat): Promise<PlayCardResult>;
  skipToReview(handle: SessionHandle): Promise<void>;
  updatePlayProfile(handle: SessionHandle, profileId: PlayProfileId): Promise<void>;

  // ── Query ───────────────────────────────────────────────────────
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

  /** Get the deal in PBN format for browser DDS solving. */
  getDealPBN(handle: SessionHandle): Promise<string>;

  // ── Convention catalog ──────────────────────────────────────────
  listConventions(): Promise<ConventionInfo[]>;

  // ── Learning ──────────────────────────────────────────────────
  /** List all registered modules with catalog metadata. */
  listModules(): Promise<readonly ModuleCatalogEntry[]>;
  /** Build a learning viewport for a single module by ID. */
  getModuleLearningViewport(moduleId: string): Promise<ModuleLearningViewport | null>;

  /** Build a unified conversation flow tree for a bundle. */
  getBundleFlowTree(bundleId: string): Promise<BundleFlowTreeViewport | null>;

  /** Build a conversation flow tree scoped to a single module. */
  getModuleFlowTree(moduleId: string): Promise<ModuleFlowTreeViewport | null>;
}

/** Extends ServicePort with dev/debug methods.
 *  Production builds use ServicePort only.
 *  local-service.ts implements both. */
export interface DevServicePort extends ServicePort {
  getExpectedBid(handle: SessionHandle): Promise<{ call: Call } | null>;
  getDebugSnapshot(handle: SessionHandle): Promise<ServiceDebugSnapshot>;
  getDebugLog(handle: SessionHandle): Promise<readonly ServiceDebugLogEntry[]>;
  getInferenceTimeline(handle: SessionHandle): Promise<readonly ServiceInferenceSnapshot[]>;

  /** Get play suggestions from all difficulty profiles for the current position. */
  getPlaySuggestions(handle: SessionHandle): Promise<PlaySuggestions>;

  /** Return the resolved convention name for a session. */
  getConventionName(handle: SessionHandle): Promise<string>;

  /** Create a session from a pre-built DrillBundle (for tests using stub engines).
   *  @deprecated Only available in LocalService (TS backend). Not supported in WasmService. */
  createSessionFromBundle(bundle: unknown): Promise<SessionHandle>;
}
