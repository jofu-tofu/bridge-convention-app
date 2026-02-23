#!/bin/bash
# Start dev server with public sharing via cloudflared tunnel
# Usage: npm run dev:share
#
# Requires: cloudflared (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
#   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared

set -euo pipefail

PORT=1420

if ! command -v cloudflared &>/dev/null; then
  echo "ERROR: cloudflared not found. Install it first:"
  echo "  curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared"
  exit 1
fi

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $TUNNEL_PID 2>/dev/null || true
  [ -n "${VITE_PID:-}" ] && kill $VITE_PID 2>/dev/null || true
  wait $TUNNEL_PID 2>/dev/null || true
  [ -n "${VITE_PID:-}" ] && wait $VITE_PID 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Check if dev server is already running
if curl -s http://localhost:$PORT >/dev/null 2>&1; then
  echo "Dev server already running on port $PORT — reusing it."
  VITE_PID=""
else
  # Start Vite dev server in background with --host to accept tunnel connections
  npx vite dev --host 0.0.0.0 --port $PORT &
  VITE_PID=$!

  echo "Waiting for dev server on port $PORT..."
  for i in $(seq 1 30); do
    if curl -s http://localhost:$PORT >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
fi

# Start cloudflared tunnel
echo ""
echo "Starting tunnel..."
cloudflared tunnel --url http://localhost:$PORT &
TUNNEL_PID=$!

# Wait for both processes
wait $VITE_PID $TUNNEL_PID
