/**
 * DDS Bridge — platform-conditional DDS dispatch.
 *
 * On desktop (Tauri): DDS runs natively via Rust bridge-engine.
 * On browser (WASM): Rust service returns error → bridge intercepts
 * and calls JS DDS Web Worker via dds-client.ts.
 *
 * This isolates DDS platform logic in its own module, keeping
 * WasmService thin.
 */

import type { DDSolutionResult } from "./response-types";
import { isDDSAvailable } from "../engine/dds-client";

/**
 * Get DDS solution using the JS Web Worker fallback.
 * The Rust WASM service can't run DDS (C++ FFI won't compile to wasm32),
 * so we fall back to the browser DDS Web Worker (Emscripten-compiled).
 *
 * @param _handle — session handle (unused — DDS worker needs raw deal, not handle).
 *   Full integration requires extracting the deal from the viewport.
 *   For now, returns a stub indicating DDS is not available via service handle.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- async to match ServicePort interface
export async function getDDSSolutionFromWorker(_handle: string): Promise<DDSolutionResult> {
  if (!isDDSAvailable()) {
    return { solution: null, error: "DDS not available" };
  }
  // DDS Web Worker integration requires the deal object, which isn't
  // accessible via session handle alone. Full DDS support via service
  // handle is follow-up work (requires a getDeal() service method or
  // extracting deal from viewport).
  return { solution: null, error: "DDS via service handle not yet implemented" };
}
