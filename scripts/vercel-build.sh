#!/usr/bin/env bash
# Vercel build script: ensures Rust + wasm-pack are available, then runs the
# full production build so the deployed app has a real WASM bundle.

set -euo pipefail

# --- Rust + wasm32 target ---
# Vercel's build image may have Rust pre-installed at /rust/bin WITHOUT the
# wasm32-unknown-unknown target and WITHOUT rustup. We need both rustc AND the
# wasm target, so check for the target — not just rustc.

needs_rustup=false

if ! command -v rustc &>/dev/null; then
  needs_rustup=true
elif ! rustc --print target-list 2>/dev/null | grep -q wasm32-unknown-unknown; then
  needs_rustup=true
elif ! command -v rustup &>/dev/null; then
  # rustc exists and knows about wasm32 but no rustup to add the target
  needs_rustup=true
fi

if $needs_rustup; then
  echo "==> Installing Rust toolchain via rustup (need wasm32 target)..."
  curl https://sh.rustup.rs -sSf | sh -s -- -y --profile minimal
  # Source env from wherever rustup placed it
  for env_file in "$HOME/.cargo/env" "/rust/env"; do
    if [ -f "$env_file" ]; then
      source "$env_file"
      break
    fi
  done
  rustup target add wasm32-unknown-unknown
else
  echo "==> Rust + wasm32 target already available."
  # Ensure the compiled target is installed (rustc knows about it but it may
  # not be installed in the sysroot)
  if ! rustup target list --installed 2>/dev/null | grep -q wasm32-unknown-unknown; then
    echo "==> Adding wasm32-unknown-unknown target..."
    rustup target add wasm32-unknown-unknown
  fi
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
