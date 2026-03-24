import type { EnginePort } from "../engine/port";
import type { ConventionConfig } from "../conventions";
import {
  Seat,
  Vulnerability,
  type Auction,
  type Deal,
  type DealConstraints,
} from "../engine/types";
import type { DrillBundle } from "./types";
import type { VulnerabilityDistribution, DrillSettings } from "./types";
import { DEFAULT_DRILL_TUNING } from "./types";
import { createProtocolDrillConfig } from "./config-factory";
import { createDrillSession } from "./session";
import type { BaseSystemId } from "../conventions/definitions/system-config";
import { BASE_SYSTEM_SAYC } from "../conventions/definitions/system-config";
import { getSystemConfig } from "../conventions/definitions/system-config";
import { getBundleInput, specFromBundle } from "../conventions";
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

/** Pick a Vulnerability value from weighted distribution.
 *  "ours"/"theirs" are resolved relative to the user's partnership. */
export function pickVulnerability(
  dist: VulnerabilityDistribution,
  userSeat: Seat,
  roll: number,
): Vulnerability {
  const total = dist.none + dist.ours + dist.theirs + dist.both;
  if (total <= 0) return Vulnerability.None;
  const target = roll * total;
  const userIsNS = userSeat === Seat.North || userSeat === Seat.South;

  let acc = dist.none;
  if (target < acc) return Vulnerability.None;

  acc += dist.ours;
  if (target < acc) return userIsNS ? Vulnerability.NorthSouth : Vulnerability.EastWest;

  acc += dist.theirs;
  if (target < acc) return userIsNS ? Vulnerability.EastWest : Vulnerability.NorthSouth;

  return Vulnerability.Both;
}

export async function startDrill(
  engine: EnginePort,
  convention: ConventionConfig,
  userSeat: Seat,
  rng?: () => number,
  seed?: number,
  options?: Partial<DrillSettings>,
  baseSystem?: BaseSystemId,
): Promise<DrillBundle> {
  const resolvedSystem = baseSystem ?? BASE_SYSTEM_SAYC;
  const config = createProtocolDrillConfig(convention.id, userSeat, {
    opponentMode: options?.opponentMode,
    baseSystem: resolvedSystem,
  });
  const session = createDrillSession(config);

  // Build strategy from the bundle's spec
  const bundleInput = getBundleInput(convention.id);
  if (!bundleInput) {
    throw new Error(`No bundle registered for "${convention.id}".`);
  }
  const spec = specFromBundle(bundleInput, getSystemConfig(resolvedSystem));
  if (!spec) {
    throw new Error(`No ConventionSpec derivable for "${convention.id}".`);
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

  // Resolve vulnerability from tuning distribution
  const tuning = options?.tuning ?? DEFAULT_DRILL_TUNING;
  const vulRoll = rng ? rng() : Math.random();
  const vulnerability = pickVulnerability(
    tuning.vulnerabilityDistribution, userSeat, vulRoll,
  );

  // Resolve off-convention deal selection
  let isOffConvention = false;
  if (tuning.includeOffConvention) {
    const offConvRate = tuning.offConventionRate ?? 0.3;
    const offRoll = rng ? rng() : Math.random();
    if (offRoll < offConvRate) {
      // Use off-convention constraints if available, otherwise skip
      const offConstraints = convention.offConventionConstraints;
      if (offConstraints) {
        resolvedConstraints = dealerRotated
          ? rotateDealConstraints(offConstraints, resolvedConstraints.dealer!)
          : offConstraints;
        isOffConvention = true;
      }
    }
  }

  const constraints: DealConstraints = {
    ...resolvedConstraints,
    vulnerability,
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
    isOffConvention,
  };
}
