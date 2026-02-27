import { Seat } from "../engine/types";
import type { BiddingStrategy } from "../shared/types";
import type { DrillConfig } from "./types";
import type { InferenceConfig } from "../inference/types";
import { getConvention } from "../conventions/core/registry";
import { conventionToStrategy } from "../strategy/bidding/convention-strategy";
import { passStrategy } from "../strategy/bidding/pass-strategy";
import { createHeuristicPlayStrategy } from "../strategy/play/heuristic-play";
import { createNaturalInferenceProvider } from "../inference/natural-inference";
import { createConventionInferenceProvider } from "../inference/convention-inference";
import { SEATS } from "../engine/constants";

// User always bids as South. N/S = user partnership, E/W = opponents.
const NS_SEATS = new Set([Seat.North, Seat.South]);

/**
 * Creates a DrillConfig for a given convention and user seat.
 * - N/S partnership always uses the drilled convention strategy
 * - E/W partnership always uses the opponent strategy (SAYC by default)
 * - User seat gets "user"
 * - Wires inference configs: N/S convention-aware, E/W natural
 * - Defaults to heuristic play strategy
 */
export function createDrillConfig(
  conventionId: string,
  userSeat: Seat,
  options?: {
    opponentBidding?: boolean;
    opponentConventionId?: string;
  },
): DrillConfig {
  const convention = getConvention(conventionId);
  const strategy = conventionToStrategy(convention);

  // Wire opponent strategy
  let opponentStrategy: BiddingStrategy = passStrategy;
  const opponentBidding = options?.opponentBidding ?? false;
  const opponentConventionId = options?.opponentConventionId ?? "sayc";
  if (opponentBidding) {
    try {
      const opponentConvention = getConvention(opponentConventionId);
      opponentStrategy = conventionToStrategy(opponentConvention);
    } catch {
      // Fall back to pass if opponent convention not found
      opponentStrategy = passStrategy;
    }
  }

  // N/S = convention, E/W = opponent, user seat = "user"
  const seatStrategies = {} as Record<Seat, BiddingStrategy | "user">;
  for (const seat of SEATS) {
    if (seat === userSeat) {
      seatStrategies[seat] = "user";
    } else if (NS_SEATS.has(seat)) {
      seatStrategies[seat] = strategy;
    } else {
      seatStrategies[seat] = opponentStrategy;
    }
  }

  // Build N/S inference config: convention-aware for own bids, natural for opponents
  const naturalProvider = createNaturalInferenceProvider();
  const conventionProvider = createConventionInferenceProvider(conventionId);
  const nsInferenceConfig: InferenceConfig = {
    ownPartnership: conventionProvider,
    opponentPartnership: naturalProvider,
  };

  // Build E/W inference config: natural by default, convention-aware when opponentBidding
  let ewOwnProvider = createNaturalInferenceProvider();
  if (opponentBidding) {
    try {
      // Verify convention exists before creating provider
      getConvention(opponentConventionId);
      ewOwnProvider = createConventionInferenceProvider(opponentConventionId);
    } catch {
      // Fall back to natural if opponent convention not found
      ewOwnProvider = createNaturalInferenceProvider();
    }
  }
  const ewInferenceConfig: InferenceConfig = {
    ownPartnership: ewOwnProvider,
    opponentPartnership: createNaturalInferenceProvider(),
  };

  return {
    conventionId,
    userSeat,
    seatStrategies,
    playStrategy: createHeuristicPlayStrategy(),
    nsInferenceConfig,
    ewInferenceConfig,
  };
}
