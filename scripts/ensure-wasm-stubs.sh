#!/usr/bin/env bash
# Create WASM stub files for browser builds when wasm-pack is not available.
# The stubs let Vite resolve the bridge-wasm alias so the build succeeds.
# At runtime, initWasm() fails and the app shows an error screen — there is
# no pure-TS EnginePort implementation for browser fallback (yet).

set -euo pipefail

PKG_DIR="crates/bridge-wasm/pkg"

if [ -f "$PKG_DIR/bridge_wasm.js" ] && [ -f "$PKG_DIR/index.js" ]; then
  echo "[wasm-stubs] WASM build or stubs already exist, skipping."
  exit 0
fi

echo "[wasm-stubs] Creating WASM stub files in $PKG_DIR..."
mkdir -p "$PKG_DIR"

cat > "$PKG_DIR/index.js" << 'STUB_JS'
let wasmModulePromise;

function loadBridgeWasm() {
  if (!wasmModulePromise) {
    wasmModulePromise = import("./bridge_wasm.js").catch((error) => {
      wasmModulePromise = undefined;
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `bridge-wasm package not built. Run npm run wasm:dev or npm run wasm:build. Original error: ${message}`,
      );
    });
  }
  return wasmModulePromise;
}

export default function init(...args) {
  return loadBridgeWasm().then((wasm) => wasm.default(...args));
}

export function generate_deal(args) {
  return loadBridgeWasm().then((wasm) => wasm.generate_deal(args));
}

export function evaluate_hand(args) {
  return loadBridgeWasm().then((wasm) => wasm.evaluate_hand(args));
}

export function get_suit_length(args) {
  return loadBridgeWasm().then((wasm) => wasm.get_suit_length(args));
}

export function is_balanced(args) {
  return loadBridgeWasm().then((wasm) => wasm.is_balanced(args));
}

export function get_legal_calls(args) {
  return loadBridgeWasm().then((wasm) => wasm.get_legal_calls(args));
}

export function add_call(args) {
  return loadBridgeWasm().then((wasm) => wasm.add_call(args));
}

export function is_auction_complete(args) {
  return loadBridgeWasm().then((wasm) => wasm.is_auction_complete(args));
}

export function get_contract(args) {
  return loadBridgeWasm().then((wasm) => wasm.get_contract(args));
}

export function calculate_score(args) {
  return loadBridgeWasm().then((wasm) => wasm.calculate_score(args));
}

export function get_legal_plays(args) {
  return loadBridgeWasm().then((wasm) => wasm.get_legal_plays(args));
}

export function get_trick_winner(args) {
  return loadBridgeWasm().then((wasm) => wasm.get_trick_winner(args));
}

export function solve_deal(args) {
  return loadBridgeWasm().then((wasm) => wasm.solve_deal(args));
}
STUB_JS

cat > "$PKG_DIR/bridge_wasm.js" << 'STUB_WASM'
// Stub: WASM module not available in this build.
// The app falls back to the pure-TS engine when init() rejects.
throw new Error("bridge-wasm not built — using pure-TS engine fallback");
STUB_WASM

# Type declaration stubs so npm run check / npx tsc --noEmit succeed without wasm-pack.
# The real build produces these from wasm-bindgen; stubs re-export TS engine types.
cat > "$PKG_DIR/index.d.ts" << 'STUB_DTS'
import type {
  Auction,
  AuctionEntry,
  Call,
  Card,
  Contract,
  DDSolution,
  Deal,
  DealConstraints,
  Hand,
  HandEvaluation,
  Seat,
  Suit,
  SuitLength,
  Trick,
  Vulnerability,
} from "../../../src/engine/types";

declare function init(input?: unknown): Promise<void>;
export { init as default };

export function generate_deal(input: {
  readonly constraints: DealConstraints;
}): Deal;

export function evaluate_hand(input: {
  readonly hand: Hand;
}): HandEvaluation;

export function get_suit_length(input: {
  readonly hand: Hand;
}): SuitLength;

export function is_balanced(input: {
  readonly hand: Hand;
}): boolean;

export function get_legal_calls(input: {
  readonly auction: Auction;
  readonly seat: Seat;
}): Call[];

export function add_call(input: {
  readonly auction: Auction;
  readonly entry: AuctionEntry;
}): Auction;

export function is_auction_complete(input: {
  readonly auction: Auction;
}): boolean;

export function get_contract(input: {
  readonly auction: Auction;
}): Contract | null;

export function calculate_score(input: {
  readonly contract: Contract;
  readonly tricksWon: number;
  readonly vulnerability: Vulnerability;
}): number;

export function get_legal_plays(input: {
  readonly hand: Hand;
  readonly leadSuit: Suit | null;
}): Card[];

export function get_trick_winner(input: {
  readonly trick: Trick;
}): Seat;

export function solve_deal(input: {
  readonly deal: Deal;
}): DDSolution;
STUB_DTS

cat > "$PKG_DIR/bridge_wasm.d.ts" << 'STUB_WASM_DTS'
/* tslint:disable */
/* eslint-disable */
// Stub type declarations for bridge-wasm when wasm-pack is not available.

// any: wasm-bindgen generated types use any for low-level bindings
export function add_call(input: any): any;
export function calculate_score(input: any): any;
export function evaluate_hand(input: any): any;
export function generate_deal(input: any): any;
export function get_contract(input: any): any;
export function get_legal_calls(input: any): any;
export function get_legal_plays(input: any): any;
export function get_suit_length(input: any): any;
export function get_trick_winner(input: any): any;
export function is_auction_complete(input: any): any;
export function is_balanced(input: any): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;
export type SyncInitInput = BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
}

export default function __wbg_init(module_or_path?: InitInput | Promise<InitInput>): Promise<InitOutput>;
STUB_WASM_DTS

echo "[wasm-stubs] Stubs created."
