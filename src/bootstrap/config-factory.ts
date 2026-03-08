import { Seat } from "../engine/types";
import type { BiddingStrategy, BidResult } from "../core/contracts";
import type { DrillConfig } from "./types";
import type { InferenceConfig } from "../inference/types";
import { getConvention, computeDialogueState } from "../conventions/core";
import type { ConventionConfig, BiddingContext, ConventionLookup } from "../conventions/core";
import { conventionToStrategy } from "../strategy/bidding/convention-strategy";
import type { ConventionStrategyOptions } from "../strategy/bidding/convention-strategy";
import { passStrategy } from "../strategy/bidding/pass-strategy";
import { createStrategyChain } from "../strategy/bidding/strategy-chain";
import type { StrategyChainOptions } from "../strategy/bidding/strategy-chain";
import { naturalFallbackStrategy } from "../strategy/bidding/natural-fallback";
import { createHeuristicPlayStrategy } from "../strategy/play/heuristic-play";
import { createNaturalInferenceProvider } from "../inference/natural-inference";
import { createConventionInferenceProvider } from "../inference/convention-inference";
import { ForcingState } from "../core/contracts";
import { SEATS } from "../engine/constants";
import type { BeliefData } from "../core/contracts";
import { createFitConfidenceRanker } from "../strategy/bidding/fit-ranker";

// User always bids as South. N/S = user partnership, E/W = opponents.
const NS_SEATS = new Set([Seat.North, Seat.South]);

/** Creates a result filter that rejects Pass when the dialogue state is forcing.
 *  The filter is a closure over the convention config — forcing knowledge stays
 *  in the convention layer, and the chain stays generic. */
function createForcingFilter(config: ConventionConfig): StrategyChainOptions["resultFilter"] {
  return (result: BidResult, context: BiddingContext) => {
    if (result.call.type !== "pass") return true;
    const state = computeDialogueState(
      context.auction,
      config.transitionRules ?? [],
      config.baselineRules,
    );
    const isForced = state.forcingState === ForcingState.ForcingOneRound
      || state.forcingState === ForcingState.GameForcing;
    return !isForced;
  };
}

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
    beliefProvider?: (ctx: BiddingContext) => BeliefData | undefined;
    lookupConvention?: ConventionLookup;
  },
): DrillConfig {
  const lookup = options?.lookupConvention ?? getConvention;
  const convention = lookup(conventionId);

  // Wire belief + ranker + interpretation options into convention strategy
  const strategyOptions: ConventionStrategyOptions = {};
  if (options?.beliefProvider) {
    strategyOptions.beliefProvider = options.beliefProvider;
  }
  if (options?.lookupConvention) {
    strategyOptions.lookupConvention = options.lookupConvention;
  }
  // Always create the ranker — it no-ops when belief is undefined
  strategyOptions.ranker = createFitConfidenceRanker();

  // Wire convention inference provider for partner interpretation model
  const conventionProviderForInterpretation = createConventionInferenceProvider(conventionId, options?.lookupConvention);
  strategyOptions.interpretationProvider = conventionProviderForInterpretation;

  const strategy = createStrategyChain(
    [conventionToStrategy(convention, strategyOptions), naturalFallbackStrategy],
    { resultFilter: createForcingFilter(convention) },
  );

  // Wire opponent strategy
  let opponentStrategy: BiddingStrategy = passStrategy;
  const opponentBidding = options?.opponentBidding ?? false;
  const opponentConventionId = options?.opponentConventionId ?? "sayc";
  const opponentStrategyOptions = options?.lookupConvention
    ? { lookupConvention: options.lookupConvention }
    : undefined;
  if (opponentBidding) {
    try {
      const opponentConvention = lookup(opponentConventionId);
      opponentStrategy = createStrategyChain([
        conventionToStrategy(opponentConvention, opponentStrategyOptions),
        naturalFallbackStrategy,
      ]);
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
  const conventionProvider = createConventionInferenceProvider(conventionId, options?.lookupConvention);
  const nsInferenceConfig: InferenceConfig = {
    ownPartnership: conventionProvider,
    opponentPartnership: naturalProvider,
  };

  // Build E/W inference config: natural by default, convention-aware when opponentBidding
  let ewOwnProvider = createNaturalInferenceProvider();
  if (opponentBidding) {
    try {
      // Verify convention exists before creating provider
      lookup(opponentConventionId);
      ewOwnProvider = createConventionInferenceProvider(opponentConventionId, options?.lookupConvention);
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
