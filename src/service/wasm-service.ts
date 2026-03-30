/**
 * WasmService — thin proxy delegating ServicePort methods to Rust via WASM.
 *
 * Replaces LocalService. Each method: call WasmServicePort.method(), return result.
 * All methods are async (wrap sync WASM calls in Promise.resolve()).
 */

/* eslint-disable @typescript-eslint/require-await -- async wraps sync WASM calls to match ServicePort interface */

import type { Call, Card, Seat, Vulnerability } from "../engine/types";
import type { DevServicePort } from "./port";
import type { SessionHandle, SessionConfig } from "./request-types";
import type {
  BiddingViewport,
  DeclarerPromptViewport,
  PlayingViewport,
  ExplanationViewport,
  DrillStartResult,
  BidSubmitResult,
  PromptAcceptResult,
  PlayCardResult,
  DDSolutionResult,
  ConventionInfo,
  ModuleCatalogEntry,
  ModuleLearningViewport,
  BundleFlowTreeViewport,
  ModuleFlowTreeViewport,
  ServicePublicBeliefState,
  ServiceInferenceSnapshot,
} from "./response-types";
import type { AtomGradeResult, PlaythroughHandle, PlaythroughGradeResult } from "./session-types";
import type { ServiceDebugSnapshot, ServiceDebugLogEntry, PlaySuggestions } from "./debug-types";
import type { OpponentMode, PlayProfileId } from "./session-types";
import { getDDSSolutionFromWorker } from "./dds-bridge";
import { setWasmModule } from "./service-helpers";

// The WASM module exposes WasmServicePort as a class.
// Type declarations for the WASM bindings:
interface WasmServicePortBindings {
  // eslint-disable-next-line @typescript-eslint/no-misused-new -- models wasm-bindgen class constructor
  new(): WasmServicePortBindings;
  create_session(config: SessionConfig): string;
  start_drill(handle: string): DrillStartResult;
  submit_bid(handle: string, call: Call): BidSubmitResult;
  accept_prompt(handle: string, mode: string | undefined, seatOverride: Seat | undefined): PromptAcceptResult;
  play_card(handle: string, card: Card, seat: Seat): PlayCardResult;
  skip_to_review(handle: string): void;
  update_play_profile(handle: string, profileId: string): void;
  get_bidding_viewport(handle: string): BiddingViewport | null;
  get_declarer_prompt_viewport(handle: string): DeclarerPromptViewport | null;
  get_playing_viewport(handle: string): PlayingViewport | null;
  get_explanation_viewport(handle: string): ExplanationViewport | null;
  get_public_belief_state(handle: string): ServicePublicBeliefState;
  get_dds_solution(handle: string): DDSolutionResult;
  evaluate_atom(bundleId: string, atomId: string, seed: number, vuln?: Vulnerability, baseSystem?: string): BiddingViewport;
  grade_atom(bundleId: string, atomId: string, seed: number, bid: string, vuln?: Vulnerability, baseSystem?: string): AtomGradeResult;
  start_playthrough(bundleId: string, seed: number, vuln?: Vulnerability, opponents?: string, baseSystem?: string): { handle: PlaythroughHandle; firstStep: BiddingViewport | null };
  get_playthrough_step(bundleId: string, seed: number, stepIdx: number, vuln?: Vulnerability, opponents?: string, baseSystem?: string): BiddingViewport;
  grade_playthrough_bid(bundleId: string, seed: number, stepIdx: number, bid: string, vuln?: Vulnerability, opponents?: string, baseSystem?: string): PlaythroughGradeResult;
  list_conventions(): ConventionInfo[];
  list_modules(): ModuleCatalogEntry[];
  get_module_learning_viewport(moduleId: string): ModuleLearningViewport | null;
  get_bundle_flow_tree(bundleId: string): BundleFlowTreeViewport | null;
  get_module_flow_tree(moduleId: string): ModuleFlowTreeViewport | null;
  // Dev methods (available in debug builds only)
  get_expected_bid?(handle: string): { call: Call } | null;
  get_debug_snapshot?(handle: string): ServiceDebugSnapshot;
  get_debug_log?(handle: string): readonly ServiceDebugLogEntry[];
  get_inference_timeline?(handle: string): readonly ServiceInferenceSnapshot[];
  get_play_suggestions?(handle: string): PlaySuggestions;
  get_convention_name?(handle: string): string;
}

let wasmPort: WasmServicePortBindings | null = null;

/** Initialize the WASM service. Must be called once at startup. */
export async function initWasmService(): Promise<void> {
  // Dynamic import to avoid bundling WASM in SSR
  const wasmModule = await import("bridge-wasm");
  await wasmModule.default();
  // Share the module reference for sync helpers
  setWasmModule(wasmModule as unknown as Record<string, unknown>);
  // any: WasmServicePort constructor from wasm-bindgen
  const WasmServicePort = (wasmModule as Record<string, unknown>).WasmServicePort as new () => WasmServicePortBindings;
  wasmPort = new WasmServicePort();
}

function getPort(): WasmServicePortBindings {
  if (!wasmPort) throw new Error("WASM service not initialized — call initWasmService() first");
  return wasmPort;
}

/** WasmService implements DevServicePort by delegating to Rust WASM. */
export class WasmService implements DevServicePort {
  // ── Session lifecycle ───────────────────────────────────────────
  async createSession(config: SessionConfig): Promise<SessionHandle> {
    return getPort().create_session(config);
  }

  async startDrill(handle: SessionHandle): Promise<DrillStartResult> {
    return getPort().start_drill(handle);
  }

  // ── Bidding ─────────────────────────────────────────────────────
  async submitBid(handle: SessionHandle, call: Call): Promise<BidSubmitResult> {
    return getPort().submit_bid(handle, call);
  }

  // ── Phase transitions ───────────────────────────────────────────
  async acceptPrompt(handle: SessionHandle, mode?: "play" | "skip" | "replay" | "restart", seatOverride?: Seat): Promise<PromptAcceptResult> {
    return getPort().accept_prompt(handle, mode, seatOverride);
  }

  // ── Play ────────────────────────────────────────────────────────
  async playCard(handle: SessionHandle, card: Card, seat: Seat): Promise<PlayCardResult> {
    return getPort().play_card(handle, card, seat);
  }

  async skipToReview(handle: SessionHandle): Promise<void> {
    getPort().skip_to_review(handle);
  }

  async updatePlayProfile(handle: SessionHandle, profileId: PlayProfileId): Promise<void> {
    getPort().update_play_profile(handle, profileId);
  }

  // ── Query ───────────────────────────────────────────────────────
  async getBiddingViewport(handle: SessionHandle): Promise<BiddingViewport | null> {
    return getPort().get_bidding_viewport(handle);
  }

  async getDeclarerPromptViewport(handle: SessionHandle): Promise<DeclarerPromptViewport | null> {
    return getPort().get_declarer_prompt_viewport(handle);
  }

  async getPlayingViewport(handle: SessionHandle): Promise<PlayingViewport | null> {
    return getPort().get_playing_viewport(handle);
  }

  async getExplanationViewport(handle: SessionHandle): Promise<ExplanationViewport | null> {
    return getPort().get_explanation_viewport(handle);
  }

  // ── Inference ───────────────────────────────────────────────────
  async getPublicBeliefState(handle: SessionHandle): Promise<ServicePublicBeliefState> {
    return getPort().get_public_belief_state(handle);
  }

  // ── DDS ─────────────────────────────────────────────────────────
  async getDDSSolution(handle: SessionHandle): Promise<DDSolutionResult> {
    // Rust WASM returns error stub → fall back to JS DDS Web Worker
    return getDDSSolutionFromWorker(handle);
  }

  // ── Evaluation ──────────────────────────────────────────────────
  async evaluateAtom(bundleId: string, atomId: string, seed: number, vuln?: Vulnerability, baseSystem?: string): Promise<BiddingViewport> {
    return getPort().evaluate_atom(bundleId, atomId, seed, vuln, baseSystem);
  }

  async gradeAtom(bundleId: string, atomId: string, seed: number, bid: string, vuln?: Vulnerability, baseSystem?: string): Promise<AtomGradeResult> {
    return getPort().grade_atom(bundleId, atomId, seed, bid, vuln, baseSystem);
  }

  async startPlaythrough(bundleId: string, seed: number, vuln?: Vulnerability, opponents?: OpponentMode, baseSystem?: string): Promise<{ handle: PlaythroughHandle; firstStep: BiddingViewport | null }> {
    return getPort().start_playthrough(bundleId, seed, vuln, opponents, baseSystem);
  }

  async getPlaythroughStep(bundleId: string, seed: number, stepIdx: number, vuln?: Vulnerability, opponents?: OpponentMode, baseSystem?: string): Promise<BiddingViewport> {
    return getPort().get_playthrough_step(bundleId, seed, stepIdx, vuln, opponents, baseSystem);
  }

  async gradePlaythroughBid(bundleId: string, seed: number, stepIdx: number, bid: string, vuln?: Vulnerability, opponents?: OpponentMode, baseSystem?: string): Promise<PlaythroughGradeResult> {
    return getPort().grade_playthrough_bid(bundleId, seed, stepIdx, bid, vuln, opponents, baseSystem);
  }

  // ── Catalog ─────────────────────────────────────────────────────
  async listConventions(): Promise<ConventionInfo[]> {
    return getPort().list_conventions();
  }

  async listModules(): Promise<readonly ModuleCatalogEntry[]> {
    return getPort().list_modules();
  }

  // ── Learning ────────────────────────────────────────────────────
  async getModuleLearningViewport(moduleId: string): Promise<ModuleLearningViewport | null> {
    return getPort().get_module_learning_viewport(moduleId);
  }

  async getBundleFlowTree(bundleId: string): Promise<BundleFlowTreeViewport | null> {
    return getPort().get_bundle_flow_tree(bundleId);
  }

  async getModuleFlowTree(moduleId: string): Promise<ModuleFlowTreeViewport | null> {
    return getPort().get_module_flow_tree(moduleId);
  }

  // ── DevServicePort ──────────────────────────────────────────────
  async getExpectedBid(handle: SessionHandle): Promise<{ call: Call } | null> {
    return getPort().get_expected_bid?.(handle) ?? null;
  }

  async getDebugSnapshot(handle: SessionHandle): Promise<ServiceDebugSnapshot> {
    return getPort().get_debug_snapshot?.(handle) ?? ({} as ServiceDebugSnapshot);
  }

  async getDebugLog(handle: SessionHandle): Promise<readonly ServiceDebugLogEntry[]> {
    return getPort().get_debug_log?.(handle) ?? [];
  }

  async getInferenceTimeline(handle: SessionHandle): Promise<readonly ServiceInferenceSnapshot[]> {
    return getPort().get_inference_timeline?.(handle) ?? [];
  }

  async getPlaySuggestions(handle: SessionHandle): Promise<PlaySuggestions> {
    return getPort().get_play_suggestions?.(handle) ?? ({} as PlaySuggestions);
  }

  async getConventionName(handle: SessionHandle): Promise<string> {
    return getPort().get_convention_name?.(handle) ?? "";
  }

  async createSessionFromBundle(_bundle: unknown): Promise<SessionHandle> {
    throw new Error("createSessionFromBundle not available in WASM service — use createSession with config");
  }
}
