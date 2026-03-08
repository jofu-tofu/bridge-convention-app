#!/usr/bin/env bash
# Create WASM stub files for browser builds when wasm-pack is not available.
# The stubs let Vite resolve the bridge-wasm alias so the build succeeds.
# At runtime, initWasm() fails and the app shows an error screen — there is
# no pure-TS EnginePort implementation for browser fallback (yet).

set -euo pipefail

PKG_DIR="src-tauri/crates/bridge-wasm/pkg"

if [ -f "$PKG_DIR/bridge_wasm.js" ] && [ -f "$PKG_DIR/index.js" ]; then
  echo "[wasm-stubs] WASM build or stubs already exist, skipping."
  exit 0
fi

echo "[wasm-stubs] Creating WASM stub files in $PKG_DIR..."
mkdir -p "$PKG_DIR"

cat > "$PKG_DIR/index.js" << 'STUB_JS'
let wasmModulePromise;

function loadBridgeWasm() {
  if (!wasmModulePromise) {
    wasmModulePromise = import("./bridge_wasm.js").catch((error) => {
      wasmModulePromise = undefined;
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `bridge-wasm package not built. Run npm run wasm:dev or npm run wasm:build. Original error: ${message}`,
      );
    });
  }
  return wasmModulePromise;
}

export default function init(...args) {
  return loadBridgeWasm().then((wasm) => wasm.default(...args));
}

export function generate_deal(args) {
  return loadBridgeWasm().then((wasm) => wasm.generate_deal(args));
}

export function evaluate_hand(args) {
  return loadBridgeWasm().then((wasm) => wasm.evaluate_hand(args));
}

export function get_suit_length(args) {
  return loadBridgeWasm().then((wasm) => wasm.get_suit_length(args));
}

export function is_balanced(args) {
  return loadBridgeWasm().then((wasm) => wasm.is_balanced(args));
}

export function get_legal_calls(args) {
  return loadBridgeWasm().then((wasm) => wasm.get_legal_calls(args));
}

export function add_call(args) {
  return loadBridgeWasm().then((wasm) => wasm.add_call(args));
}

export function is_auction_complete(args) {
  return loadBridgeWasm().then((wasm) => wasm.is_auction_complete(args));
}

export function get_contract(args) {
  return loadBridgeWasm().then((wasm) => wasm.get_contract(args));
}

export function calculate_score(args) {
  return loadBridgeWasm().then((wasm) => wasm.calculate_score(args));
}

export function get_legal_plays(args) {
  return loadBridgeWasm().then((wasm) => wasm.get_legal_plays(args));
}

export function get_trick_winner(args) {
  return loadBridgeWasm().then((wasm) => wasm.get_trick_winner(args));
}

export function solve_deal(args) {
  return loadBridgeWasm().then((wasm) => wasm.solve_deal(args));
}
STUB_JS

cat > "$PKG_DIR/bridge_wasm.js" << 'STUB_WASM'
// Stub: WASM module not available in this build.
// The app falls back to the pure-TS engine when init() rejects.
throw new Error("bridge-wasm not built — using pure-TS engine fallback");
STUB_WASM

echo "[wasm-stubs] Stubs created."
