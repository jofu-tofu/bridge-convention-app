// ── Strategy Factory ─────────────────────────────────────────────────
//
// Single source of truth for constructing bidding strategies from
// convention specs.  Both CLI and stores use these instead of reaching
// directly into strategy/bidding/ internals.

import type { ConventionSpec, ConventionStrategy, BiddingStrategy } from "../conventions";
import { OpponentMode } from "./drill-types";
import { protocolSpecToStrategy } from "../conventions";
import { createStrategyChain } from "../session/heuristics/strategy-chain";
import { naturalFallbackStrategy } from "../session/heuristics/natural-fallback";
import { passStrategy } from "../session/heuristics/pass-strategy";

/** Create a convention bidding strategy from a protocol spec. */
export function createSpecStrategy(spec: ConventionSpec): ConventionStrategy {
  return protocolSpecToStrategy(spec);
}

/** Create a convention bidding strategy wrapped with natural fallback. */
export function createSpecStrategyWithFallback(spec: ConventionSpec): BiddingStrategy {
  return createStrategyChain([protocolSpecToStrategy(spec), naturalFallbackStrategy]);
}

/** Create an opponent bidding strategy based on opponent mode. */
export function createOpponentStrategy(mode: OpponentMode): BiddingStrategy {
  return mode === OpponentMode.Natural
    ? createStrategyChain([naturalFallbackStrategy])
    : passStrategy;
}
