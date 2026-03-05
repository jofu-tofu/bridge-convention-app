#!/usr/bin/env bash
# Skip DDS WASM build if artifacts already exist.
# Warn and skip (don't fail) if emcc is not available.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="$PROJECT_DIR/static/dds"

if [ -f "$OUT_DIR/dds.wasm" ] && [ -f "$OUT_DIR/dds.js" ]; then
  echo "DDS WASM artifacts found, skipping build."
  exit 0
fi

if ! command -v emcc &>/dev/null; then
  echo "WARNING: DDS WASM artifacts not found and emcc not available." >&2
  echo "  DDS will be unavailable in browser builds." >&2
  echo "  To build: install Emscripten SDK, then run: bash scripts/build-dds-wasm.sh" >&2
  exit 0
fi

echo "DDS WASM artifacts not found, building..."
exec bash "$SCRIPT_DIR/build-dds-wasm.sh"
