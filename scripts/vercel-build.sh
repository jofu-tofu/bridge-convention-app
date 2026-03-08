#!/usr/bin/env bash
# Vercel build script: ensures Rust + wasm-pack are available, then runs the
# full production build so the deployed app has a real WASM bundle.

set -euo pipefail

# --- Rust + wasm32 target ---
# Vercel's build image may have Rust pre-installed at /rust/bin WITHOUT the
# wasm32-unknown-unknown target and WITHOUT rustup. We need both rustc AND the
# wasm target. Additionally, rustup may auto-update the toolchain when cargo
# runs, so we must update to latest stable BEFORE adding the wasm32 target —
# otherwise the target gets installed for the old toolchain and cargo uses the
# new one.

if ! command -v rustup &>/dev/null; then
  echo "==> Installing Rust toolchain via rustup..."
  curl https://sh.rustup.rs -sSf | sh -s -- -y --profile minimal
  # Source env from wherever rustup placed it
  for env_file in "$HOME/.cargo/env" "/rust/env"; do
    if [ -f "$env_file" ]; then
      source "$env_file"
      break
    fi
  done
else
  echo "==> rustup found, updating to latest stable..."
  rustup update stable --no-self-update
fi

# Now add the wasm32 target to whatever toolchain is current
if ! rustup target list --installed 2>/dev/null | grep -q wasm32-unknown-unknown; then
  echo "==> Adding wasm32-unknown-unknown target..."
  rustup target add wasm32-unknown-unknown
else
  echo "==> wasm32-unknown-unknown target already installed."
fi
echo "    rustc $(rustc --version)"

# --- wasm-pack ---
if command -v wasm-pack &>/dev/null; then
  echo "==> wasm-pack already available, skipping install."
else
  echo "==> Installing wasm-pack..."
  curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi
echo "    wasm-pack $(wasm-pack --version)"

echo "==> Building WASM + Vite production bundle..."
npm run build
