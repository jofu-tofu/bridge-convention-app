/**
 * WasmService — thin proxy delegating ServicePort methods to Rust via WASM.
 *
 * Replaces LocalService. Each method: call WasmServicePort.method(), return result.
 * All methods are async (wrap sync WASM calls in Promise.resolve()).
 *
 * DDS solver is injected at init time via set_dds_solver(). The WASM layer
 * internally routes Expert/WorldClass profiles through the async DDS play path
 * and Beginner/ClubPlayer through the sync heuristic path. The store never
 * sees DDS — it just calls playCard().
 */

/* eslint-disable @typescript-eslint/require-await -- async wraps sync WASM calls to match ServicePort interface */

import type { Call, Card, Seat } from "../engine/types";
import type { DevServicePort } from "./port";
import type { DrillHandle, SessionConfig } from "./request-types";
import type {
  BiddingViewport,
  DeclarerPromptViewport,
  PlayingViewport,
  ExplanationViewport,
  DrillStartResult,
  BidSubmitResult,
  PlayEntryResult,
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
import type { ServiceDebugLogEntry } from "./debug-types";
import type { PlayProfileId } from "./session-types";
import { setWasmModule } from "./service-helpers";
import { initDDS, isDDSAvailable, solveBoardWasm, solveDealFromPBN } from "../engine/dds-client";

// The WASM module exposes WasmServicePort as a class.
// Type declarations for the WASM bindings:
interface WasmServicePortBindings {
  // eslint-disable-next-line @typescript-eslint/no-misused-new -- models wasm-bindgen class constructor
  new(): WasmServicePortBindings;
  set_dds_solver(solver: (trump: number, first: number, trickSuit: number[], trickRank: number[], pbn: string) => Promise<DdsSolveResult>): void;
  set_dds_table_solver(solver: (pbn: string) => Promise<unknown>): void;
  needs_dds_play(handle: string): boolean;
  create_drill_session(config: SessionConfig): string;
  start_drill(handle: string): DrillStartResult;
  submit_bid(handle: string, call: Call): BidSubmitResult;
  enter_play(handle: string, seatOverride: Seat | undefined): PlayEntryResult;
  decline_play(handle: string): void;
  return_to_prompt(handle: string): void;
  restart_play(handle: string): PlayEntryResult;
  play_card(handle: string, card: Card, seat: Seat): PlayCardResult;
  play_card_dds(handle: string, card: Card, seat: Seat): Promise<PlayCardResult>;
  skip_to_review(handle: string): void;
  update_play_profile(handle: string, profileId: string): void;
  get_bidding_viewport(handle: string): BiddingViewport | null;
  get_declarer_prompt_viewport(handle: string): DeclarerPromptViewport | null;
  get_playing_viewport(handle: string): PlayingViewport | null;
  get_explanation_viewport(handle: string): ExplanationViewport | null;
  get_public_belief_state(handle: string): ServicePublicBeliefState;
  get_dds_solution(handle: string): Promise<DDSolutionResult>;
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

/** Shape expected by the Rust DDS solver callback. */
interface DdsSolveResult {
  cards: Array<{ suit: string; rank: number; score: number }>;
}

/** Convert TS string rank ("2"-"A") to numeric (2-14) for Rust. */
function rankToU8(rank: string): number {
  switch (rank) {
    case "A": return 14;
    case "K": return 13;
    case "Q": return 12;
    case "J": return 11;
    case "T": return 10;
    default: return parseInt(rank, 10);
  }
}

/**
 * Build the DDS solver callback passed to Rust via set_dds_solver().
 * Wraps the existing solveBoardWasm() from dds-client.ts.
 */
function buildDdsSolverCallback(): (trump: number, first: number, trickSuit: number[], trickRank: number[], pbn: string) => Promise<DdsSolveResult> {
  return async (trump, first, trickSuit, trickRank, pbn) => {
    const result = await solveBoardWasm(trump, first, trickSuit, trickRank, pbn);
    return {
      cards: result.cards.map(c => ({
        suit: c.suit,
        rank: rankToU8(c.rank),
        score: c.score,
      })),
    };
  };
}

let wasmPort: WasmServicePortBindings | null = null;

async function initWasmModule(): Promise<void> {
  const isNode = typeof globalThis.process !== "undefined" && globalThis.process.versions?.node;

  if (isNode) {
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
    const WasmServicePort = raw.WasmServicePort as new () => WasmServicePortBindings;
    wasmPort = new WasmServicePort();
    setWasmModule(raw, wasmPort);
  } else {
    const wasmModule = await import("bridge-wasm");
    await wasmModule.default();
    const raw = wasmModule as unknown as Record<string, unknown>;
    const WasmServicePort = raw.WasmServicePort as new () => WasmServicePortBindings;
    wasmPort = new WasmServicePort();
    setWasmModule(raw, wasmPort);
  }
}

/**
 * Wire both DDS solvers into the WASM service.
 * Called after both WASM init and DDS init complete.
 */
function wireDdsSolver(): void {
  if (!wasmPort) return;
  if (!isDDSAvailable()) return;
  wasmPort.set_dds_solver(buildDdsSolverCallback());
  wasmPort.set_dds_table_solver((pbn: string) => solveDealFromPBN(pbn));
}

function getPort(): WasmServicePortBindings {
  if (!wasmPort) throw new Error("WASM service not initialized — call init() first");
  return wasmPort;
}

/** WasmService implements DevServicePort by delegating to Rust WASM. */
export class WasmService implements DevServicePort {
  // ── Init ────────────────────────────────────────────────────────
  async init(): Promise<void> {
    if (wasmPort) return; // idempotent
    await initWasmModule();

    // DDS: browser-only, fire-and-forget, non-essential
    if (typeof Worker !== "undefined") {
      void initDDS().then(() => { wireDdsSolver(); }).catch(() => {});
    }
  }

  // ── Session lifecycle ───────────────────────────────────────────
  async createDrillSession(config: SessionConfig): Promise<DrillHandle> {
    return getPort().create_drill_session(config);
  }

  async startDrill(handle: DrillHandle): Promise<DrillStartResult> {
    return getPort().start_drill(handle);
  }

  // ── Bidding ─────────────────────────────────────────────────────
  async submitBid(handle: DrillHandle, call: Call): Promise<BidSubmitResult> {
    return getPort().submit_bid(handle, call);
  }

  // ── Phase transitions ───────────────────────────────────────────
  async enterPlay(handle: DrillHandle, seatOverride?: Seat): Promise<PlayEntryResult> {
    return getPort().enter_play(handle, seatOverride);
  }

  async declinePlay(handle: DrillHandle): Promise<void> {
    getPort().decline_play(handle);
  }

  async returnToPrompt(handle: DrillHandle): Promise<void> {
    getPort().return_to_prompt(handle);
  }

  async restartPlay(handle: DrillHandle): Promise<PlayEntryResult> {
    return getPort().restart_play(handle);
  }

  // ── Play ────────────────────────────────────────────────────────

  /**
   * Play a card. Routes through DDS or heuristic path automatically.
   * The store never sees DDS — it just calls playCard().
   */
  async playCard(handle: DrillHandle, card: Card, seat: Seat): Promise<PlayCardResult> {
    const port = getPort();
    // Route: if DDS solver is set and profile needs DDS, use async DDS path
    if (port.needs_dds_play(handle)) {
      return port.play_card_dds(handle, card, seat);
    }
    return port.play_card(handle, card, seat);
  }

  async skipToReview(handle: DrillHandle): Promise<void> {
    getPort().skip_to_review(handle);
  }

  async updatePlayProfile(handle: DrillHandle, profileId: PlayProfileId): Promise<void> {
    getPort().update_play_profile(handle, profileId);
  }

  // ── Query ───────────────────────────────────────────────────────
  async getBiddingViewport(handle: DrillHandle): Promise<BiddingViewport | null> {
    return getPort().get_bidding_viewport(handle);
  }

  async getDeclarerPromptViewport(handle: DrillHandle): Promise<DeclarerPromptViewport | null> {
    return getPort().get_declarer_prompt_viewport(handle);
  }

  async getPlayingViewport(handle: DrillHandle): Promise<PlayingViewport | null> {
    return getPort().get_playing_viewport(handle);
  }

  async getExplanationViewport(handle: DrillHandle): Promise<ExplanationViewport | null> {
    return getPort().get_explanation_viewport(handle);
  }

  // ── Inference ───────────────────────────────────────────────────
  async getPublicBeliefState(handle: DrillHandle): Promise<ServicePublicBeliefState> {
    return getPort().get_public_belief_state(handle);
  }

  // ── DDS ─────────────────────────────────────────────────────────
  async getDDSSolution(handle: DrillHandle): Promise<DDSolutionResult> {
    return getPort().get_dds_solution(handle);
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
  async getExpectedBid(handle: DrillHandle): Promise<{ call: Call } | null> {
    const raw = getPort().get_expected_bid?.(handle);
    if (!raw) return null;
    return "call" in raw ? raw : { call: raw };
  }

  async getDebugLog(handle: DrillHandle): Promise<readonly ServiceDebugLogEntry[]> {
    return getPort().get_debug_log?.(handle) ?? [];
  }

  async getInferenceTimeline(handle: DrillHandle): Promise<readonly ServiceInferenceSnapshot[]> {
    return getPort().get_inference_timeline?.(handle) ?? [];
  }

  async getConventionName(handle: DrillHandle): Promise<string> {
    return getPort().get_convention_name?.(handle) ?? "";
  }

  async createDrillSessionFromBundle(_bundle: unknown): Promise<DrillHandle> {
    throw new Error("createDrillSessionFromBundle not available in WASM service — use createDrillSession with config");
  }
}
