#!/bin/bash
set -e
PKG_DIR="src-tauri/crates/bridge-wasm/pkg"

needs_build=false

if [ ! -f "$PKG_DIR/bridge_wasm.js" ]; then
  echo "[wasm] pkg/ not found, building dev WASM..."
  needs_build=true
elif ! grep -q "get_expected_bid" "$PKG_DIR/bridge_wasm.js"; then
  echo "[wasm] pkg/ missing dev-only bindings, rebuilding dev WASM..."
  needs_build=true
fi

if [ "$needs_build" = true ]; then
  wasm-pack build src-tauri/crates/bridge-wasm --target web --out-dir pkg --dev
else
  echo "[wasm] dev pkg/ exists, skipping build (run 'npm run wasm:dev' to rebuild)"
fi
