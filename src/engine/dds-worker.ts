/**
 * DDS Web Worker — Classic Worker (NOT module worker).
 * Loads DDS WASM via importScripts, solves deals on request.
 *
 * Protocol:
 *   Worker → Main: { type: "ready" } after init
 *   Main → Worker: { id: number, deal: Deal }
 *   Worker → Main: { type: "result", id: number, solution: DDSolution }
 *   Worker → Main: { type: "error", id?: number, message: string }
 */

import type { Deal } from "./types";
import type { DDSModule } from "./dds-wasm";
import { solveWithModule } from "./dds-wasm";

// Web Worker globals not in default TS lib
declare function importScripts(...urls: string[]): void;

// any: Emscripten factory function injected by importScripts
declare const createDDS: (opts: {
  locateFile: (path: string) => string;
}) => Promise<DDSModule>;

let ddsModule: DDSModule | null = null;

async function init(): Promise<void> {
  // Classic worker: importScripts is available
  importScripts("/dds/dds.js");

  ddsModule = await createDDS({
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

self.onmessage = (e: MessageEvent) => {
  const { id, deal } = e.data as { id: number; deal: Deal };
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
