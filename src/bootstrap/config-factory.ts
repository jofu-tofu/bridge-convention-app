import { Seat } from "../engine/types";
import type { BiddingStrategy, ConventionBiddingStrategy } from "../core/contracts";
import type { DrillConfig } from "./types";
import type { InferenceConfig } from "../inference/types";
import type { ConventionLookup } from "../conventions/core";
import { meaningBundleToStrategy } from "../strategy/bidding/meaning-strategy";
import { createStrategyChain } from "../strategy/bidding/strategy-chain";
import { naturalFallbackStrategy } from "../strategy/bidding/natural-fallback";
import { createHeuristicPlayStrategy } from "../strategy/play/heuristic-play";
import { createNaturalInferenceProvider } from "../inference/natural-inference";
import { getBundle, createSharedFactCatalog } from "../conventions/core";
import type { ConventionBundle } from "../conventions/core";
import { createFactCatalog } from "../core/contracts/fact-catalog";
import { createPosteriorEngine } from "../inference/posterior";

// User always bids as South. N/S = user partnership, E/W = opponents.
const NS_SEATS = new Set([Seat.North, Seat.South]);

/** Build a meaning-pipeline strategy from a ConventionBundle.
 *  Returns the strategy or null if the bundle has no meaningSurfaces. */
export function buildBundleStrategy(
  bundle: ConventionBundle,
): ConventionBiddingStrategy | null {
  if (!bundle.meaningSurfaces || bundle.meaningSurfaces.length === 0) return null;

  const factCatalog = bundle.factExtensions && bundle.factExtensions.length > 0
    ? createFactCatalog(createSharedFactCatalog(), ...bundle.factExtensions)
    : createSharedFactCatalog();

  return meaningBundleToStrategy(
    bundle.meaningSurfaces.map((g) => ({
      moduleId: g.groupId,
      surfaces: [...g.surfaces],
    })),
    bundle.id,
    {
      name: bundle.name,
      factCatalog,
      surfaceRouter: bundle.surfaceRouter,
      conversationMachine: bundle.conversationMachine,
      posteriorEngine: createPosteriorEngine(),
      surfaceRouterForCommitments: bundle.surfaceRouter,
      explanationCatalog: bundle.explanationCatalog,
    },
  );
}

/**
 * Creates a DrillConfig for a given convention and user seat.
 * - N/S partnership uses the bundle strategy (meaning pipeline)
 * - E/W partnership uses natural fallback (bids with 6+ HCP and 5+ suit, else passes)
 * - User seat gets "user"
 * - Wires inference configs: natural for all partnerships
 * - Defaults to heuristic play strategy
 */
export function createDrillConfig(
  conventionId: string,
  userSeat: Seat,
  _options?: {
    lookupConvention?: ConventionLookup;
  },
): DrillConfig {
  // Look up the bundle
  const bundle = getBundle(conventionId);
  if (!bundle) {
    throw new Error(
      `No bundle registered for "${conventionId}". Only bundle-based conventions are supported.`,
    );
  }

  const bundleStrategy = buildBundleStrategy(bundle);
  if (!bundleStrategy) {
    throw new Error(
      `Bundle "${conventionId}" has no meaning surfaces — cannot build strategy.`,
    );
  }

  const strategy = createStrategyChain([bundleStrategy, naturalFallbackStrategy]);
  const ewStrategy = createStrategyChain([naturalFallbackStrategy]);

  // N/S = convention strategy, E/W = natural fallback, user seat = "user"
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
  // (Convention inference is not yet wired for the meaning pipeline)
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
