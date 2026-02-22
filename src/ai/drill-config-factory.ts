import type { Seat } from "../engine/types";
import type { BiddingStrategy } from "../shared/types";
import type { DrillConfig } from "./types";
import { getConvention } from "../conventions/registry";
import { conventionToStrategy } from "./convention-strategy";
import { passStrategy } from "./pass-strategy";
import { SEATS } from "../engine/constants";

/**
 * Creates a DrillConfig for a given convention and user seat.
 * - Convention participant seats get the convention strategy
 * - Non-participant opponents get passStrategy
 * - User seat gets "user"
 */
export function createDrillConfig(
  conventionId: string,
  userSeat: Seat,
): DrillConfig {
  const convention = getConvention(conventionId);
  const strategy = conventionToStrategy(convention);

  const participantSeats = new Set(
    convention.dealConstraints.seats.map((sc) => sc.seat),
  );

  const seatStrategies = {} as Record<Seat, BiddingStrategy | "user">;
  for (const seat of SEATS) {
    if (seat === userSeat) {
      seatStrategies[seat] = "user";
    } else if (participantSeats.has(seat)) {
      seatStrategies[seat] = strategy;
    } else {
      seatStrategies[seat] = passStrategy;
    }
  }

  return {
    conventionId,
    userSeat,
    seatStrategies,
  };
}
