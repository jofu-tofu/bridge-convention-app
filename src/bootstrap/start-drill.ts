import type { EnginePort } from "../engine/port";
import type { ConventionConfig, ConventionLookup } from "../conventions/core";
import {
  Seat,
  type Auction,
  type Deal,
  type DealConstraints,
} from "../engine/types";
import type { DrillBundle } from "./types";
import type { OpponentMode } from "./types";
import type { ConventionBiddingStrategy } from "../core/contracts";
import { createDrillConfig, buildBundleStrategy } from "./config-factory";
import { createDrillSession } from "./session";
import { getBundle } from "../conventions/core";
import { createInferenceEngine } from "../inference/inference-engine";
import { generateDeal as tsGenerateDeal } from "../engine/deal-generator";
import { mulberry32 } from "../core/util/seeded-rng";

/** 180° table rotation: N↔S, E↔W */
export function rotateSeat180(seat: Seat): Seat {
  switch (seat) {
    case Seat.North: return Seat.South;
    case Seat.South: return Seat.North;
    case Seat.East: return Seat.West;
    case Seat.West: return Seat.East;
  }
}

export function rotateDealConstraints(
  base: DealConstraints,
  newDealer: Seat,
): DealConstraints {
  if (base.dealer === newDealer || base.dealer === undefined) return base;
  return {
    ...base,
    dealer: newDealer,
    seats: base.seats.map((sc) => ({ ...sc, seat: rotateSeat180(sc.seat) })),
  };
}

export function rotateAuction(auction: Auction): Auction {
  return {
    ...auction,
    entries: auction.entries.map((e) => ({ ...e, seat: rotateSeat180(e.seat) })),
  };
}

export async function startDrill(
  engine: EnginePort,
  convention: ConventionConfig,
  userSeat: Seat,
  rng?: () => number,
  seed?: number,
  options?: {
    lookupConvention?: ConventionLookup;
    opponentMode?: OpponentMode;
  },
): Promise<DrillBundle> {
  const config = createDrillConfig(convention.id, userSeat, {
    lookupConvention: options?.lookupConvention,
    opponentMode: options?.opponentMode,
  });
  const session = createDrillSession(config);

  // Build strategy: always meaning pipeline via bundle
  const bundle = getBundle(convention.id);
  if (!bundle) {
    throw new Error(
      `No bundle registered for "${convention.id}". Only bundle-based conventions are supported.`,
    );
  }
  const bundleStrategy = buildBundleStrategy(bundle);
  if (!bundleStrategy) {
    throw new Error(
      `Bundle "${convention.id}" has no meaning surfaces — cannot build strategy.`,
    );
  }
  const strategy: ConventionBiddingStrategy = bundleStrategy;

  // Resolve dealer randomization
  let resolvedConstraints = convention.dealConstraints;
  let dealerRotated = false;
  if (convention.allowedDealers && convention.allowedDealers.length > 1) {
    const roll = rng ? rng() : Math.random();
    const idx = Math.floor(roll * convention.allowedDealers.length);
    const chosenDealer = convention.allowedDealers[idx]!;
    if (chosenDealer !== convention.dealConstraints.dealer) {
      resolvedConstraints = rotateDealConstraints(convention.dealConstraints, chosenDealer);
      dealerRotated = true;
    }
  }

  const constraints: DealConstraints = {
    ...resolvedConstraints,
    ...(rng ? { rng } : {}),
    ...(seed !== undefined ? { seed } : {}),
  };

  // When a seed is provided, use the TS-side deal generator for guaranteed
  // deterministic results.  The WASM engine path (JS Number → Rust u64 via
  // serde_wasm_bindgen) can silently drop the seed, falling back to a
  // non-deterministic thread_rng.  The TS generator takes the seeded RNG
  // directly, so the same seed always produces the same deal.
  let deal: Deal;
  if (seed !== undefined) {
    const dealRng = rng ?? mulberry32(seed);
    const result = tsGenerateDeal(constraints, dealRng);
    deal = result.deal;
  } else {
    deal = await engine.generateDeal(constraints);
  }
  let initialAuction = convention.defaultAuction
    ? convention.defaultAuction(userSeat, deal)
    : undefined;
  if (initialAuction && dealerRotated) {
    initialAuction = rotateAuction(initialAuction);
  }

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
    strategy,
    nsInferenceEngine,
    ewInferenceEngine,
  };
}
