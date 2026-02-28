#!/bin/bash
set -e
PKG_DIR="src-tauri/crates/bridge-wasm/pkg"
if [ ! -f "$PKG_DIR/bridge_wasm.js" ]; then
  echo "[wasm] pkg/ not found, building..."
  wasm-pack build src-tauri/crates/bridge-wasm --target web --out-dir pkg --dev
else
  echo "[wasm] pkg/ exists, skipping build (run 'npm run wasm:dev' to rebuild)"
fi
