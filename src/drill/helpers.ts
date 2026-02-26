import type { EnginePort } from "../engine/port";
import type { ConventionConfig } from "../conventions/core/types";
import {
  Seat,
  type Deal,
  type Auction,
  type DealConstraints,
  type SeatConstraint,
  type Hand,
} from "../engine/types";
import type { DrillSession } from "./types";
import type { BiddingStrategy } from "../shared/types";
import { createDrillConfig } from "./config-factory";
import { createDrillSession } from "./session";
import { conventionToStrategy } from "../strategy/bidding/convention-strategy";
import { getConvention } from "../conventions/core/registry";
import { evaluateHand } from "../engine/hand-evaluator";

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
  gameStore: {
    startDrill: (
      deal: Deal,
      session: DrillSession,
      initialAuction?: Auction,
      strategy?: BiddingStrategy,
    ) => Promise<void>;
  },
  rng?: () => number,
  seed?: number,
) {
  const config = createDrillConfig(convention.id, userSeat, {
    opponentBidding: true,
  });
  const session = createDrillSession(config);
  const strategy = conventionToStrategy(convention);

  // Build opponent pass constraints from defaultAuction
  const previewAuction = convention.defaultAuction
    ? convention.defaultAuction(userSeat)
    : undefined;
  const opponentConvention = getConvention("sayc");
  const opponentStrategy = conventionToStrategy(opponentConvention);
  const passConstraints = buildOpponentPassConstraints(
    previewAuction,
    opponentStrategy,
  );

  // Compose: convention's N/S constraints + E/W pass constraints
  const constraints: DealConstraints = {
    ...convention.dealConstraints,
    seats: [...convention.dealConstraints.seats, ...passConstraints],
    ...(rng ? { rng } : {}),
    ...(seed !== undefined ? { seed } : {}),
  };

  const deal = await engine.generateDeal(constraints);
  const initialAuction = convention.defaultAuction
    ? convention.defaultAuction(userSeat, deal)
    : undefined;
  await gameStore.startDrill(deal, session, initialAuction, strategy);
}
