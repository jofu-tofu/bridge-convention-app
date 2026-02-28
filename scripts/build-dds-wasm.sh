#!/usr/bin/env bash
# Build DDS (double dummy solver) C++ source to WASM via Emscripten.
# Produces public/dds/dds.js + public/dds/dds.wasm.
#
# Prerequisites: Emscripten SDK (emcc) must be on PATH.
# Usage: bash scripts/build-dds-wasm.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
VENDOR_DDS="$PROJECT_DIR/vendor/dds"
OUT_DIR="$PROJECT_DIR/public/dds"

if ! command -v emcc &>/dev/null; then
  echo "ERROR: emcc not found. Install Emscripten SDK first." >&2
  echo "  git clone https://github.com/emscripten-core/emsdk.git" >&2
  echo "  cd emsdk && ./emsdk install latest && ./emsdk activate latest" >&2
  echo "  source emsdk_env.sh" >&2
  exit 1
fi

if [ ! -d "$VENDOR_DDS/src" ]; then
  echo "ERROR: vendor/dds/src not found. Run: git clone --depth 1 --branch v2.9.0 https://github.com/dds-bridge/dds.git vendor/dds" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

# 24 of 27 .cpp files. Exclusions:
#   Par.cpp       — Emscripten string formatting issues, not needed with mode=-1
#   DealerPar.cpp — requires Par.cpp, not needed with mode=-1
#   dump.cpp      — debug-only output
SOURCES=(
  ABsearch ABstats CalcTables dds File Init LaterTricks Memory Moves PBN
  PlayAnalyser QuickTricks Scheduler SolveBoard SolverIF System ThreadMgr
  TimeStat TimeStatList Timer TimerGroup TimerList TransTableL TransTableS
  emscripten_stubs
)

SRC_FILES=""
for f in "${SOURCES[@]}"; do
  SRC_FILES="$SRC_FILES $VENDOR_DDS/src/$f.cpp"
done

echo "Building DDS WASM (${#SOURCES[@]} source files)..."

emcc -O2 -std=c++14 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME="createDDS" \
  -s EXPORTED_FUNCTIONS='["_SetResources","_CalcAllTablesPBN","_malloc","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["getValue","setValue","stringToUTF8"]' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=67108864 \
  -I "$VENDOR_DDS/include" \
  $SRC_FILES \
  -o "$OUT_DIR/dds.js"

# Record build hash for staleness detection
BUILD_HASH=$(cat "$SCRIPT_DIR/build-dds-wasm.sh" $SRC_FILES | sha256sum | cut -d' ' -f1)
echo "$BUILD_HASH" > "$OUT_DIR/BUILD_HASH"

echo "DDS WASM build complete:"
ls -lh "$OUT_DIR/dds.js" "$OUT_DIR/dds.wasm"
echo "BUILD_HASH: $BUILD_HASH"
