/**
 * DDS Web Worker — Module Worker.
 * Loads DDS WASM via fetch+eval (importScripts unavailable in module workers),
 * solves deals on request.
 *
 * Protocol:
 *   Worker → Main: { type: "ready" } after init
 *   Main → Worker: { id: number, deal: Deal }
 *   Worker → Main: { type: "result", id: number, solution: DDSolution }
 *   Worker → Main: { type: "error", id?: number, message: string }
 */

import type { Deal } from "./types";
import type { DDSModule } from "./dds-wasm";
import { solveWithModule, solveFromPBN, solveBoardWithModule } from "./dds-wasm";

let ddsModule: DDSModule | null = null;

async function init(): Promise<void> {
  // Module workers can't use importScripts — fetch and eval the DDS JS instead.
  // The Emscripten-generated dds.js defines a `createDDS` factory on globalThis.
  const resp = await fetch("/dds/dds.js");
  const script = await resp.text();
  // Emscripten module must be eval'd to define createDDS on globalThis
  (0, eval)(script);

  // any: Emscripten factory function defined by eval'd script
  const factory = (globalThis as Record<string, unknown>).createDDS as (opts: {
    locateFile: (path: string) => string;
  }) => Promise<DDSModule>;

  ddsModule = await factory({
    locateFile: (path: string) => `/dds/${path}`,
  });

  // Configure DDS: 50MB memory, 1 thread (WASM is single-threaded)
  ddsModule._SetResources(50, 1);

  self.postMessage({ type: "ready" });
}

// Init eagerly on worker start
init().catch((err) =>
  self.postMessage({ type: "error", message: String(err) }),
);

/** SolveBoard request message from main thread. */
interface SolveBoardMessage {
  type: "solveBoard";
  id: number;
  trump: number;
  first: number;
  currentTrickSuit: number[];
  currentTrickRank: number[];
  remainCardsPBN: string;
}

/** CalcAllTablesPBN request with Deal object (legacy). */
interface SolveTableMessage {
  id: number;
  deal: Deal;
}

/** CalcAllTablesPBN request with PBN string (preferred — skips Deal→PBN conversion). */
interface SolveTablePBNMessage {
  id: number;
  pbn: string;
}

self.onmessage = (e: MessageEvent<SolveBoardMessage | SolveTableMessage | SolveTablePBNMessage>) => {
  const msg = e.data;

  if ("type" in msg && msg.type === "solveBoard") {
    // SolveBoard request — per-card optimal play from a mid-deal position
    const { id, trump, first, currentTrickSuit, currentTrickRank, remainCardsPBN } = msg;
    try {
      if (!ddsModule) throw new Error("DDS not initialized");
      const result = solveBoardWithModule(
        ddsModule, trump, first, currentTrickSuit, currentTrickRank, remainCardsPBN,
      );
      self.postMessage({ type: "solveBoardResult", id, result });
    } catch (err) {
      self.postMessage({
        type: "error",
        id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  // PBN-based request (from service handle path)
  if ("pbn" in msg && !("deal" in msg)) {
    const { id, pbn } = msg;
    try {
      if (!ddsModule) throw new Error("DDS not initialized");
      const solution = solveFromPBN(ddsModule, pbn);
      self.postMessage({ type: "result", id, solution });
    } catch (err) {
      self.postMessage({
        type: "error",
        id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  // Default: CalcAllTablesPBN request with Deal object (legacy flow)
  const { id, deal } = msg as SolveTableMessage;
  try {
    if (!ddsModule) throw new Error("DDS not initialized");
    const solution = solveWithModule(ddsModule, deal);
    self.postMessage({ type: "result", id, solution });
  } catch (err) {
    self.postMessage({
      type: "error",
      id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
