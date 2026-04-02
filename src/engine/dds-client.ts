/**
 * DDS client — main thread API for the DDS Web Worker.
 * Provides initDDS(), isDDSAvailable(), solveDealFromPBN(), and solveBoardWasm().
 */

import type { DDSolution } from "./types";
import type { SolveBoardResult } from "./dds-wasm";

/** Messages received from the DDS Web Worker. */
type DDSWorkerMessage =
  | { type: "ready" }
  | { type: "result"; id: number; solution: DDSolution }
  | { type: "solveBoardResult"; id: number; result: SolveBoardResult }
  | { type: "error"; id: number; message: string };

let worker: Worker | null = null;
let ready = false;
let initPromise: Promise<void> | null = null;
let nextId = 0;
// any: union of resolve types — DDSolution for table solves, SolveBoardResult for board solves
const pending = new Map<
  number,
  { resolve: (v: never) => void; reject: (e: Error) => void }
>();

/**
 * Initialize the DDS Web Worker. Returns when the worker has loaded
 * the WASM module and is ready to solve. Safe to call multiple times.
 */
export async function initDDS(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = new Promise<void>((resolve, reject) => {
    worker = new Worker(new URL("./dds-worker.ts", import.meta.url), { type: "module" });
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
      if ("id" in msg && pending.has(msg.id)) {
        const p = pending.get(msg.id)!;
        pending.delete(msg.id);
        if (msg.type === "result") {
          p.resolve(msg.solution as never);
        } else if (msg.type === "solveBoardResult") {
          p.resolve(msg.result as never);
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

/** Solve a deal from PBN string via the DDS Web Worker. Rejects if not initialized. */
export function solveDealFromPBN(pbn: string): Promise<DDSolution> {
  if (!worker || !ready) {
    return Promise.reject(new Error("DDS not ready"));
  }
  const id = nextId++;
  return new Promise<DDSolution>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: never) => void, reject });
    worker!.postMessage({ id, pbn });
  });
}

/**
 * Solve a board position — returns per-card trick counts for all legal plays.
 * Requires DDS SolveBoardPBN to be exported in the WASM build.
 *
 * @param trump             Trump suit index (0=S, 1=H, 2=D, 3=C, 4=NT)
 * @param first             Seat on lead (0=N, 1=E, 2=S, 3=W)
 * @param currentTrickSuit  Suits of cards already played this trick
 * @param currentTrickRank  Ranks (2-14) of cards already played this trick
 * @param remainCardsPBN    PBN string of remaining cards in all hands
 */
export function solveBoardWasm(
  trump: number,
  first: number,
  currentTrickSuit: number[],
  currentTrickRank: number[],
  remainCardsPBN: string,
): Promise<SolveBoardResult> {
  if (!worker || !ready) {
    return Promise.reject(new Error("DDS not ready"));
  }
  const id = nextId++;
  return new Promise<SolveBoardResult>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: never) => void, reject });
    worker!.postMessage({
      type: "solveBoard",
      id,
      trump,
      first,
      currentTrickSuit,
      currentTrickRank,
      remainCardsPBN,
    });
  });
}
