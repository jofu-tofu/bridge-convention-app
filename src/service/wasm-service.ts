/**
 * WasmService — thin proxy delegating ServicePort methods to Rust via WASM.
 *
 * Replaces LocalService. Each method: call WasmServicePort.method(), return result.
 * All methods are async (wrap sync WASM calls in Promise.resolve()).
 */

/* eslint-disable @typescript-eslint/require-await -- async wraps sync WASM calls to match ServicePort interface */

import type { Call, Card, Seat } from "../engine/types";
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
  SingleCardResult,
  DDSolutionResult,
  ConventionInfo,
  ModuleCatalogEntry,
  ModuleLearningViewport,
  BundleFlowTreeViewport,
  ModuleFlowTreeViewport,
  ServicePublicBeliefState,
  ServiceInferenceSnapshot,
} from "./response-types";
import type { ServiceDebugLogEntry } from "./debug-types";
import type { PlayProfileId } from "./session-types";
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
  play_single_card(handle: string, card: Card, seat: Seat): SingleCardResult;
  skip_to_review(handle: string): void;
  update_play_profile(handle: string, profileId: string): void;
  get_bidding_viewport(handle: string): BiddingViewport | null;
  get_declarer_prompt_viewport(handle: string): DeclarerPromptViewport | null;
  get_playing_viewport(handle: string): PlayingViewport | null;
  get_explanation_viewport(handle: string): ExplanationViewport | null;
  get_public_belief_state(handle: string): ServicePublicBeliefState;
  get_dds_solution(handle: string): DDSolutionResult;
  get_deal_pbn(handle: string): string;
  list_conventions(): ConventionInfo[];
  list_modules(): ModuleCatalogEntry[];
  get_module_learning_viewport(moduleId: string): ModuleLearningViewport | null;
  get_bundle_flow_tree(bundleId: string): BundleFlowTreeViewport | null;
  get_module_flow_tree(moduleId: string): ModuleFlowTreeViewport | null;
  // Dev methods (available in debug builds only)
  get_expected_bid?(handle: string): Call | { call: Call } | null;
  get_debug_log?(handle: string): readonly ServiceDebugLogEntry[];
  get_inference_timeline?(handle: string): readonly ServiceInferenceSnapshot[];
  get_convention_name?(handle: string): string;
}

let wasmPort: WasmServicePortBindings | null = null;

/** Initialize the WASM service. Must be called once at startup. */
export async function initWasmService(): Promise<void> {
  // Node.js: fetch() doesn't support file:// URLs, so use initSync with fs.readFileSync.
  // Dynamic import("bridge-wasm") resolves to index.js (wrapper) in Node, which lacks
  // initSync and WasmServicePort. Import bridge_wasm.js directly for the raw wasm-pack output.
  const isNode = typeof globalThis.process !== "undefined" && globalThis.process.versions?.node;

  if (isNode) {
    // Dynamic import("bridge-wasm") resolves to index.js in Node (tsx), which lacks
    // initSync/WasmServicePort. Import the raw wasm-pack output via relative path.
    const wasmModule = await import("../../src-tauri/crates/bridge-wasm/pkg/bridge_wasm.js");
    const raw = wasmModule as unknown as Record<string, unknown>;
    const nodeFs = await import("node:fs");
    const nodePath = await import("node:path");
    const nodeUrl = await import("node:url");
    const projectRoot = nodePath.resolve(nodePath.dirname(nodeUrl.fileURLToPath(import.meta.url)), "../..");
    const wasmPath = nodePath.resolve(projectRoot, "src-tauri/crates/bridge-wasm/pkg/bridge_wasm_bg.wasm");
    const wasmBytes = nodeFs.readFileSync(wasmPath);
    const initSync = raw.initSync as (input: { module: WebAssembly.Module }) => void;
    initSync({ module: new WebAssembly.Module(wasmBytes) });
    setWasmModule(raw);
    const WasmServicePort = raw.WasmServicePort as new () => WasmServicePortBindings;
    wasmPort = new WasmServicePort();
  } else {
    const wasmModule = await import("bridge-wasm");
    await wasmModule.default();
    const raw = wasmModule as unknown as Record<string, unknown>;
    setWasmModule(raw);
    const WasmServicePort = raw.WasmServicePort as new () => WasmServicePortBindings;
    wasmPort = new WasmServicePort();
  }
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

  async playSingleCard(handle: SessionHandle, card: Card, seat: Seat): Promise<SingleCardResult> {
    return getPort().play_single_card(handle, card, seat);
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
    return getDDSSolutionFromWorker(handle, (h) => this.getDealPBN(h));
  }

  async getDealPBN(handle: SessionHandle): Promise<string> {
    return getPort().get_deal_pbn(handle);
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
    const raw = getPort().get_expected_bid?.(handle);
    if (!raw) return null;
    return "call" in raw ? raw : { call: raw };
  }

  async getDebugLog(handle: SessionHandle): Promise<readonly ServiceDebugLogEntry[]> {
    return getPort().get_debug_log?.(handle) ?? [];
  }

  async getInferenceTimeline(handle: SessionHandle): Promise<readonly ServiceInferenceSnapshot[]> {
    return getPort().get_inference_timeline?.(handle) ?? [];
  }

  async getConventionName(handle: SessionHandle): Promise<string> {
    return getPort().get_convention_name?.(handle) ?? "";
  }

  async createSessionFromBundle(_bundle: unknown): Promise<SessionHandle> {
    throw new Error("createSessionFromBundle not available in WASM service — use createSession with config");
  }
}
