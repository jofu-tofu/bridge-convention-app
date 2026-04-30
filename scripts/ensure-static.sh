#!/bin/bash
set -e
OUT=".generated/learn-data.json"

needs_extract=false

if [ ! -f "$OUT" ]; then
  echo "[static] $OUT not found, extracting..."
  needs_extract=true
elif [ -n "$(find crates/bridge-conventions/fixtures -type f -newer "$OUT" -print -quit)" ]; then
  echo "[static] Fixture files newer than $OUT, re-extracting..."
  needs_extract=true
elif [ -n "$(find crates/bridge-conventions/src crates/bridge-session/src crates/bridge-static/src -type f \( -name '*.rs' -o -name 'Cargo.toml' \) -newer "$OUT" -print -quit)" ]; then
  echo "[static] Relevant Rust sources newer than $OUT, re-extracting..."
  needs_extract=true
fi

if [ "$needs_extract" = true ]; then
  cargo build --release -p bridge-static
  mkdir -p .generated
  ./target/release/bridge-static --output "$OUT"
else
  echo "[static] $OUT up-to-date, skipping (run 'npm run static:extract' to force)"
fi
