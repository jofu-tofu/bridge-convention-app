#!/usr/bin/env bash
# Vercel build script: installs Rust + wasm-pack, then runs the full production build.
# This replaces the stub-based approach so the app is fully functional at runtime.

set -euo pipefail

echo "==> Installing Rust toolchain..."
curl https://sh.rustup.rs -sSf | sh -s -- -y --profile minimal
source "$HOME/.cargo/env"
echo "    rustc $(rustc --version)"

echo "==> Installing wasm-pack..."
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
echo "    wasm-pack $(wasm-pack --version)"

echo "==> Building WASM + Vite production bundle..."
npm run build
