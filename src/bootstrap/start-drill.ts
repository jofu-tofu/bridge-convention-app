import type { EnginePort } from "../engine/port";
import type { ConventionConfig, BiddingContext, ConventionLookup } from "../conventions/core";
import {
  Seat,
  type Auction,
  type DealConstraints,
  type SeatConstraint,
  type Hand,
} from "../engine/types";
import type { DrillBundle } from "./types";
import type { BiddingStrategy, ConventionBiddingStrategy } from "../core/contracts";
import { createDrillConfig, buildBundleStrategy } from "./config-factory";
import { createDrillSession } from "./session";
import { conventionToStrategy } from "../strategy/bidding/convention-strategy";
import { getConvention, getBundle } from "../conventions/core";
import { evaluateHand } from "../engine/hand-evaluator";
import type { BeliefData } from "../core/contracts";
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
    beliefProvider?: (ctx: BiddingContext) => BeliefData | undefined;
    lookupConvention?: ConventionLookup;
    opponentConventionId?: string;
  },
): Promise<DrillBundle> {
  const lookup = options?.lookupConvention ?? getConvention;
  const config = createDrillConfig(convention.id, userSeat, {
    opponentBidding: true,
    opponentConventionId: options?.opponentConventionId,
    beliefProvider: options?.beliefProvider,
    lookupConvention: options?.lookupConvention,
  });
  const session = createDrillSession(config);

  // Build strategy: use meaning pipeline only when the user explicitly selected a bundle ID.
  // Individual conventions stay on the tree pipeline.
  let strategy: ConventionBiddingStrategy;
  const bundle = getBundle(convention.id);
  const bundleStrategy = bundle ? buildBundleStrategy(bundle) : null;
  if (bundleStrategy) {
    strategy = bundleStrategy;
  } else {
    strategy = conventionToStrategy(convention, { lookupConvention: options?.lookupConvention });
  }

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

  // Build opponent pass constraints from defaultAuction
  let previewAuction = convention.defaultAuction
    ? convention.defaultAuction(userSeat)
    : undefined;
  if (previewAuction && dealerRotated) {
    previewAuction = rotateAuction(previewAuction);
  }
  const opponentConventionId = options?.opponentConventionId ?? "sayc";
  const opponentConvention = lookup(opponentConventionId);
  const opponentStrategy = conventionToStrategy(
    opponentConvention,
    { lookupConvention: options?.lookupConvention },
  );
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
