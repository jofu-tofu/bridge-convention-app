import { TauriIpcEngine } from "./tauri-ipc-engine";
import { WasmEngine, initWasm } from "./wasm-engine";
import { initDDS } from "./dds-client";
import type { EnginePort } from "./port";

// Runtime engine detection: Tauri IPC (desktop) or WASM (browser)
export async function createEngine(): Promise<EnginePort> {
  if ((window as any).__TAURI__) { // any: Tauri runtime global, not typed
    return new TauriIpcEngine();
  }
  await initWasm();
  // Fire-and-forget: DDS loads in background via Web Worker.
  // If user reaches EXPLANATION before worker is ready, isDDSAvailable()
  // returns false, DDS store catches the error, UI shows gracefully.
  initDDS().catch(() => {/* silent — isDDSAvailable() stays false, UI degrades gracefully */});
  return new WasmEngine();
}
