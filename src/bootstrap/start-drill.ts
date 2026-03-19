import type { EnginePort } from "../engine/port";
import type { ConventionConfig } from "../conventions/core";
import {
  Seat,
  type Auction,
  type Deal,
  type DealConstraints,
} from "../engine/types";
import type { DrillBundle } from "./types";
import type { OpponentMode } from "./types";
import { createProtocolDrillConfig } from "./config-factory";
import { createDrillSession } from "./session";
import { getConventionSpec } from "../conventions/spec-registry";
import { protocolSpecToStrategy } from "../strategy/bidding/protocol-adapter";
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
    opponentMode?: OpponentMode;
  },
): Promise<DrillBundle> {
  const config = createProtocolDrillConfig(convention.id, userSeat, {
    opponentMode: options?.opponentMode,
  });
  const session = createDrillSession(config);

  // Build strategy from the protocol spec
  const spec = getConventionSpec(convention.id);
  if (!spec) {
    throw new Error(`No ConventionSpec registered for "${convention.id}".`);
  }
  const strategy = protocolSpecToStrategy(spec);

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
  // deterministic results.
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
