import { Seat } from "../engine/types";
import type { BiddingStrategy } from "../core/contracts";
import type { DrillConfig } from "./types";
import type { OpponentMode } from "./types";
import type { InferenceConfig } from "../inference/types";
import { createSpecStrategyWithFallback, createOpponentStrategy } from "./strategy-factory";
import { createHeuristicPlayStrategy } from "../strategy/play/heuristic-play";
import { createNaturalInferenceProvider } from "../inference/natural-inference";
import { getSystemBundle, specFromBundle } from "../conventions/definitions/system-registry";

// User always bids as South. N/S = user partnership, E/W = opponents.
const NS_SEATS = new Set([Seat.North, Seat.South]);

// ── Protocol frame architecture path ────────────────────────────────

/**
 * Creates a DrillConfig from a ConventionBundle.
 * Throws if no bundle is registered for the given ID.
 */
export function createProtocolDrillConfig(
  conventionId: string,
  userSeat: Seat,
  options?: { opponentMode?: OpponentMode },
): DrillConfig {
  const bundle = getSystemBundle(conventionId);
  if (!bundle) {
    throw new Error(
      `No bundle registered for "${conventionId}".`,
    );
  }
  const spec = specFromBundle(bundle);
  if (!spec) {
    throw new Error(
      `No ConventionSpec derivable for "${conventionId}".`,
    );
  }

  const strategy = createSpecStrategyWithFallback(spec);
  const ewStrategy = createOpponentStrategy(options?.opponentMode ?? "natural");

  // N/S = protocol strategy, E/W = natural fallback, user seat = "user"
  function seatStrategy(seat: Seat): BiddingStrategy | "user" {
    if (seat === userSeat) return "user";
    if (NS_SEATS.has(seat)) return strategy;
    return ewStrategy;
  }
  const seatStrategies: Record<Seat, BiddingStrategy | "user"> = {
    [Seat.North]: seatStrategy(Seat.North),
    [Seat.East]: seatStrategy(Seat.East),
    [Seat.South]: seatStrategy(Seat.South),
    [Seat.West]: seatStrategy(Seat.West),
  };

  // Inference: natural for all partnerships
  const naturalProvider = createNaturalInferenceProvider();
  const nsInferenceConfig: InferenceConfig = {
    ownPartnership: naturalProvider,
    opponentPartnership: createNaturalInferenceProvider(),
  };
  const ewInferenceConfig: InferenceConfig = {
    ownPartnership: createNaturalInferenceProvider(),
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
