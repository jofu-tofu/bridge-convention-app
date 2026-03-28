import { Seat } from "../engine/types";
import type { BiddingStrategy, BaseSystemId } from "../conventions";
import type { EnginePort } from "../engine/port";
import type { DrillConfig } from "./drill-types";
import type { OpponentMode, PracticeMode } from "./drill-types";
import { getSystemConfig } from "../conventions";
import type { InferenceConfig } from "../inference/types";
import { createSpecStrategyWithFallback, createOpponentStrategy } from "./strategy-factory";
import { createHeuristicPlayStrategy } from "../session/heuristics/heuristic-play";
import { createNaturalInferenceProvider } from "../inference/natural-inference";
import { getBundleInput, specFromBundle, specFromSystem } from "../conventions";
import type { PlayProfileId } from "./heuristics/play-profiles";
import { PLAY_PROFILES, BEGINNER_PROFILE } from "./heuristics/play-profiles";
import { createProfileStrategyProvider } from "./heuristics/profile-play-strategy";

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
  options: { opponentMode?: OpponentMode; baseSystem: BaseSystemId; playProfileId?: PlayProfileId; engine?: EnginePort; practiceMode?: PracticeMode },
): DrillConfig {
  const input = getBundleInput(conventionId);
  if (!input) {
    throw new Error(
      `No bundle registered for "${conventionId}".`,
    );
  }
  const systemConfig = getSystemConfig(options.baseSystem);

  // For full-auction and continuation-drill, build strategy from the full system
  // so the user can bid through prerequisite and follow-up modules too.
  const mode = options.practiceMode;
  const useSystemSpec = mode === "full-auction" || mode === "continuation-drill";
  const spec = useSystemSpec
    ? specFromSystem(options.baseSystem)
    : specFromBundle(input, systemConfig);
  if (!spec) {
    throw new Error(
      useSystemSpec
        ? `No ConventionSpec derivable for system "${options.baseSystem}".`
        : `No ConventionSpec derivable for "${conventionId}".`,
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

  // Inference: both partnerships use the same base system for now.
  // When separate opponent system selection is added, thread it as
  // options.opponentBaseSystem in config-factory, mirroring this pattern.
  const nsProvider = createNaturalInferenceProvider(systemConfig);
  const ewProvider = createNaturalInferenceProvider(systemConfig);
  const nsInferenceConfig: InferenceConfig = {
    ownPartnership: nsProvider,
    opponentPartnership: ewProvider,
  };
  const ewInferenceConfig: InferenceConfig = {
    ownPartnership: createNaturalInferenceProvider(systemConfig),
    opponentPartnership: createNaturalInferenceProvider(systemConfig),
  };

  const profile = options.playProfileId
    ? PLAY_PROFILES[options.playProfileId]
    : BEGINNER_PROFILE;
  const playStrategyProvider = createProfileStrategyProvider(profile, {
    engine: options.engine,
  });

  return {
    conventionId,
    userSeat,
    seatStrategies,
    playStrategy: createHeuristicPlayStrategy(),
    playStrategyProvider,
    nsInferenceConfig,
    ewInferenceConfig,
  };
}
