#!/usr/bin/env bash
# Vercel build script: ensures Rust + wasm-pack are available, then runs the
# full production build so the deployed app has a real WASM bundle.

set -euo pipefail

# --- Rust ---
# Vercel's build image may already have Rust at /rust/bin. If rustc is already
# on PATH, skip the install entirely. Otherwise install via rustup and source
# the env file from wherever rustup actually placed it.
if command -v rustc &>/dev/null; then
  echo "==> Rust already available, skipping install."
else
  echo "==> Installing Rust toolchain..."
  curl https://sh.rustup.rs -sSf | sh -s -- -y --profile minimal
  # rustup may install to $HOME/.cargo or /rust depending on the environment
  for env_file in "$HOME/.cargo/env" "/rust/env"; do
    if [ -f "$env_file" ]; then
      source "$env_file"
      break
    fi
  done
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
