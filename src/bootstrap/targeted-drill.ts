// ── Targeted Drill ─────────────────────────────────────────────────
//
// Generates a drill that drops the user into a specific FSM state.
// Used by ?targetState= URL param and the BridgeExpertReview skill.
//
// Flow:
// 1. Look up the bundle for the convention
// 2. Compute FSM topology + path to target state
// 3. Compile path into DealConstraints + auction prefix
// 4. Generate a deal satisfying those constraints
// 5. Return a DrillBundle with the prefilled auction

import type { EnginePort } from "../engine/port";
import type { ConventionConfig, ConventionLookup } from "../conventions/core";
import { Seat, type Auction } from "../engine/types";
import type { DrillBundle, OpponentMode } from "./types";
import { createDrillConfig, buildBundleStrategy } from "./config-factory";
import { createDrillSession } from "./session";
import { getBundle, computeTopology, compilePathToTarget, buildSurfaceMap } from "../conventions/core";
import { createInferenceEngine } from "../inference/inference-engine";
import { generateDeal as tsGenerateDeal } from "../engine/deal-generator";
import { buildAuction } from "../engine/auction-helpers";

/**
 * Start a drill targeting a specific FSM state.
 *
 * Returns null if the state can't be targeted (not found, no path, etc.).
 * The caller should fall back to a normal drill in that case.
 */
export function startTargetedDrill(
  _engine: EnginePort,
  convention: ConventionConfig,
  userSeat: Seat,
  targetStateId: string,
  options?: {
    lookupConvention?: ConventionLookup;
    opponentMode?: OpponentMode;
  },
): DrillBundle | null {
  const bundle = getBundle(convention.id);
  if (!bundle?.conversationMachine) return null;

  const machine = bundle.conversationMachine;
  const topology = computeTopology(machine);

  // Find the path to the target state
  const path = topology.paths.get(targetStateId);
  if (!path) return null;

  // Build surface map for constraint compilation
  const surfaceMap = buildSurfaceMap(bundle);

  // Compile the path into a coverage target
  const target = compilePathToTarget(path, machine, bundle, surfaceMap);

  // Generate a deal satisfying the compiled constraints
  let deal;
  try {
    const result = tsGenerateDeal(target.dealConstraints);
    deal = result.deal;
  } catch {
    // Constraints too tight — fall back
    return null;
  }

  // Build the prefilled auction from the path
  const dealer = target.dealConstraints.dealer ?? Seat.North;
  let initialAuction: Auction | undefined;
  if (target.auctionPrefix.length > 0) {
    initialAuction = buildAuction(dealer, [...target.auctionPrefix]);
  }

  // Build the drill config and session
  const config = createDrillConfig(convention.id, userSeat, {
    lookupConvention: options?.lookupConvention,
    opponentMode: "none",  // Targeted drills suppress opponents to ensure convention path is exercised
  });
  const session = createDrillSession(config);

  const bundleStrategy = buildBundleStrategy(bundle);
  if (!bundleStrategy) return null;

  // Create inference engines
  const nsInferenceEngine = config.nsInferenceConfig
    ? createInferenceEngine(config.nsInferenceConfig, Seat.North)
    : null;
  const ewInferenceEngine = config.ewInferenceConfig
    ? createInferenceEngine(config.ewInferenceConfig, Seat.East)
    : null;

  return {
    deal,
    session,
    initialAuction,
    strategy: bundleStrategy,
    nsInferenceEngine,
    ewInferenceEngine,
  };
}
