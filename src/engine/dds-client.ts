/**
 * DDS client — main thread API for the DDS Web Worker.
 * Provides initDDS(), isDDSAvailable(), and solveDealWasm().
 */

import type { Deal, DDSolution } from "./types";

/** Messages received from the DDS Web Worker. */
type DDSWorkerMessage =
  | { type: "ready" }
  | { type: "result"; id: number; solution: DDSolution }
  | { type: "error"; id: number; message: string };

let worker: Worker | null = null;
let ready = false;
let initPromise: Promise<void> | null = null;
let nextId = 0;
const pending = new Map<
  number,
  { resolve: (v: DDSolution) => void; reject: (e: Error) => void }
>();

/**
 * Initialize the DDS Web Worker. Returns when the worker has loaded
 * the WASM module and is ready to solve. Safe to call multiple times.
 */
export async function initDDS(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = new Promise<void>((resolve, reject) => {
    worker = new Worker(new URL("./dds-worker.ts", import.meta.url));
    const timeout = setTimeout(
      () => reject(new Error("DDS init timeout")),
      15000,
    );

    worker.onmessage = (e: MessageEvent<DDSWorkerMessage>) => {
      const msg = e.data;

      if (msg.type === "ready") {
        ready = true;
        clearTimeout(timeout);
        resolve();
        return;
      }

      // Route solve responses by request ID
      if (pending.has(msg.id)) {
        const p = pending.get(msg.id)!;
        pending.delete(msg.id);
        if (msg.type === "result") {
          p.resolve(msg.solution);
        } else {
          p.reject(new Error(msg.message));
        }
        return;
      }

      // Unrouted error after timeout — silently discard.
      // isDDSAvailable() stays false; UI degrades gracefully.
    };

    worker.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("DDS worker error"));
    };
  });
  return initPromise;
}

/** Whether the DDS worker is initialized and ready to solve. */
export function isDDSAvailable(): boolean {
  return ready;
}

/** Solve a deal via the DDS Web Worker. Rejects if not initialized. */
export function solveDealWasm(deal: Deal): Promise<DDSolution> {
  if (!worker || !ready) {
    return Promise.reject(new Error("DDS not ready"));
  }
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker!.postMessage({ id, deal });
  });
}
