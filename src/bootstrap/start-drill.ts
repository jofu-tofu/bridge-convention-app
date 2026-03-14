import type { EnginePort } from "../engine/port";
import type { ConventionConfig, ConventionLookup } from "../conventions/core";
import {
  Seat,
  type Auction,
  type DealConstraints,
  type SeatConstraint,
  type Hand,
} from "../engine/types";
import type { DrillBundle } from "./types";
import type { OpponentMode } from "./types";
import type { BiddingStrategy, ConventionBiddingStrategy } from "../core/contracts";
import { createDrillConfig, buildBundleStrategy } from "./config-factory";
import { createDrillSession } from "./session";
import { naturalFallbackStrategy } from "../strategy/bidding/natural-fallback";
import { passStrategy } from "../strategy/bidding/pass-strategy";
import { getBundle } from "../conventions/core";
import { evaluateHand } from "../engine/hand-evaluator";
import { createInferenceEngine } from "../inference/inference-engine";

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

/**
 * Analyze a convention's defaultAuction for E/W pass positions.
 * For each opponent pass, create a SeatConstraint with a customCheck
 * that verifies the opponent strategy would actually pass at that point.
 */
export function buildOpponentPassConstraints(
  defaultAuction: Auction | undefined,
  opponentStrategy: BiddingStrategy,
): SeatConstraint[] {
  if (!defaultAuction) return [];

  const constraints: SeatConstraint[] = [];
  for (let i = 0; i < defaultAuction.entries.length; i++) {
    const entry = defaultAuction.entries[i]!;
    const isOpponent = entry.seat === Seat.East || entry.seat === Seat.West;
    if (isOpponent && entry.call.type === "pass") {
      const auctionBefore: Auction = {
        entries: defaultAuction.entries.slice(0, i),
        isComplete: false,
      };
      const seat = entry.seat;
      constraints.push({
        seat,
        customCheck: (hand: Hand) => {
          const evaluation = evaluateHand(hand);
          const result = opponentStrategy.suggest({
            hand,
            auction: auctionBefore,
            seat,
            evaluation,
            opponentConventionIds: [],
          });
          return result === null || result.call.type === "pass";
        },
      });
    }
  }
  return constraints;
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

  // Build opponent constraints — use strategy matching opponent mode
  let previewAuction = convention.defaultAuction
    ? convention.defaultAuction(userSeat)
    : undefined;
  if (previewAuction && dealerRotated) {
    previewAuction = rotateAuction(previewAuction);
  }
  const opponentStrategy = options?.opponentMode === "none"
    ? passStrategy
    : naturalFallbackStrategy;
  const passConstraints = buildOpponentPassConstraints(
    previewAuction,
    opponentStrategy,
  );

  // Compose: convention's constraints (possibly rotated) + E/W pass constraints
  const constraints: DealConstraints = {
    ...resolvedConstraints,
    seats: [...resolvedConstraints.seats, ...passConstraints],
    ...(rng ? { rng } : {}),
    ...(seed !== undefined ? { seed } : {}),
  };

  const deal = await engine.generateDeal(constraints);
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
