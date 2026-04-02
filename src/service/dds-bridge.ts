/**
 * DDS Bridge — platform-conditional DDS dispatch.
 *
 * On desktop (Tauri): DDS runs natively via Rust bridge-engine.
 * On browser (WASM): Extracts deal PBN from Rust service, sends to
 * JS DDS Web Worker (Emscripten-compiled C++ DDS).
 *
 * IMPORTANT: This module must not import wasm-service.ts directly —
 * that would create a circular import. Use callback injection instead.
 */

import type { DDSolutionResult } from "./response-types";
import { isDDSAvailable, solveDealFromPBN } from "../engine/dds-client";

/**
 * Get DDS solution using the JS Web Worker.
 * The Rust WASM service can't run DDS (C++ FFI won't compile to wasm32),
 * so we extract the deal as PBN from Rust and solve via the Emscripten worker.
 *
 * @param handle — session handle passed to getDealPBN to extract the deal.
 * @param getDealPBN — callback to extract deal PBN from the service (avoids circular import).
 */
export async function getDDSSolutionFromWorker(
  handle: string,
  getDealPBN: (handle: string) => Promise<string>,
): Promise<DDSolutionResult> {
  if (!isDDSAvailable()) {
    return { solution: null, error: "DDS not available" };
  }
  try {
    const pbn = await getDealPBN(handle);
    const solution = await solveDealFromPBN(pbn);
    return { solution, error: null };
  } catch (err) {
    return {
      solution: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
