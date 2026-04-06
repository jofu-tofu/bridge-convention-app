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
  DrillHandle,
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
  PlayEntryResult,
  PlayCardResult,
  DDSolutionResult,
  ConventionInfo,
  BundleFlowTreeViewport,
  ModuleFlowTreeViewport,
  ServiceInferenceSnapshot,
  ServicePublicBeliefState,
} from "./response-types";
import type {
  ServiceDebugLogEntry,
} from "./debug-types";

/** Production service interface — all methods return Promise<T>. */
interface ServicePort {
  /** Bootstrap the service. Transport-specific wiring (WASM load, DDS, etc.) happens here.
   *  Must be called once before any other method. Idempotent. */
  init(): Promise<void>;

  // ── Session lifecycle ───────────────────────────────────────────
  createDrillSession(config: SessionConfig): Promise<DrillHandle>;

  // ── Drill lifecycle ─────────────────────────────────────────────
  startDrill(handle: DrillHandle): Promise<DrillStartResult>;

  // ── Bidding ─────────────────────────────────────────────────────
  /** Grade + apply + run AI + return next viewport — single round-trip. */
  submitBid(handle: DrillHandle, call: Call): Promise<BidSubmitResult>;

  // ── Phase transitions ───────────────────────────────────────────
  enterPlay(handle: DrillHandle, seatOverride?: Seat): Promise<PlayEntryResult>;
  declinePlay(handle: DrillHandle): Promise<void>;
  returnToPrompt(handle: DrillHandle): Promise<void>;
  restartPlay(handle: DrillHandle): Promise<PlayEntryResult>;

  // ── Play ────────────────────────────────────────────────────────
  playCard(handle: DrillHandle, card: Card, seat: Seat): Promise<PlayCardResult>;
  skipToReview(handle: DrillHandle): Promise<void>;
  updatePlayProfile(handle: DrillHandle, profileId: PlayProfileId): Promise<void>;

  // ── Query ───────────────────────────────────────────────────────
  getBiddingViewport(handle: DrillHandle): Promise<BiddingViewport | null>;
  getDeclarerPromptViewport(handle: DrillHandle): Promise<DeclarerPromptViewport | null>;
  getPlayingViewport(handle: DrillHandle): Promise<PlayingViewport | null>;
  getExplanationViewport(handle: DrillHandle): Promise<ExplanationViewport | null>;

  // ── Inference ─────────────────────────────────────────────────────
  /** Get the current public belief state from the session's inference coordinator.
   *  Eliminates the need for the store to maintain its own inference coordinator. */
  getPublicBeliefState(handle: DrillHandle): Promise<ServicePublicBeliefState>;

  // ── DDS analysis ────────────────────────────────────────────────
  getDDSSolution(handle: DrillHandle): Promise<DDSolutionResult>;

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
  getExpectedBid(handle: DrillHandle): Promise<{ call: Call } | null>;
  getDebugLog(handle: DrillHandle): Promise<readonly ServiceDebugLogEntry[]>;
  getInferenceTimeline(handle: DrillHandle): Promise<readonly ServiceInferenceSnapshot[]>;

  /** Return the resolved convention name for a session. */
  getConventionName(handle: DrillHandle): Promise<string>;

  /** Create a session from a pre-built DrillBundle (for tests using stub engines).
   *  @deprecated Only available in LocalService (TS backend). Not supported in WasmService. */
  createDrillSessionFromBundle(bundle: unknown): Promise<DrillHandle>;
}
