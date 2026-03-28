import type { ConventionConfig } from "../conventions";
import {
  Seat,
  Vulnerability,
  type Auction,
  type DealConstraints,
} from "../engine/types";
import type { DrillBundle, PlayPreference, PracticeRole } from "./drill-types";
import type { VulnerabilityDistribution, DrillSettings, PracticeMode } from "./drill-types";
import { DEFAULT_DRILL_TUNING } from "./drill-types";
import { createProtocolDrillConfig } from "./config-factory";
import { createDrillSession } from "./drill-session";
import { derivePracticeFocus } from "./practice-focus";
import { getBundleInput, specFromBundle, BASE_SYSTEM_SAYC, getSystemConfig, getBaseModuleIds, protocolSpecToStrategy, archetypeSupportsRoleSelection, getPrimaryCapability } from "../conventions";
import type { BaseSystemId } from "../conventions";
import { createInferenceEngine } from "../inference/inference-engine";
import { generateDeal as tsGenerateDeal } from "../engine/deal-generator";
import { mulberry32 } from "../engine/seeded-rng";

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

export function startDrill(
  convention: ConventionConfig,
  userSeat: Seat,
  rng?: () => number,
  seed?: number,
  options?: Partial<DrillSettings>,
  baseSystem?: BaseSystemId,
): DrillBundle {
  const resolvedSystem = baseSystem ?? BASE_SYSTEM_SAYC;
  const practiceMode: PracticeMode = options?.practiceMode ?? "decision-drill";
  const targetModuleId = (options as { targetModuleId?: string } | undefined)?.targetModuleId;

  // ── Role enforcement ─────────────────────────────────────────
  // Coerce invalid role to "responder" for conventions that don't support role selection
  const bundleInputForRole = getBundleInput(convention.id);
  const primaryCapId = bundleInputForRole
    ? getPrimaryCapability(bundleInputForRole.declaredCapabilities)
    : undefined;
  const eligibleForRoleSelection = primaryCapId
    ? archetypeSupportsRoleSelection(primaryCapId)
    : false;
  const requestedRole: PracticeRole = options?.practiceRole ?? "responder";
  const effectiveRole: PracticeRole = eligibleForRoleSelection ? requestedRole : "responder";

  // Resolve "both" to a concrete role
  let resolvedRole: "opener" | "responder";
  if (effectiveRole === "both") {
    const roleRoll = rng ? rng() : Math.random();
    resolvedRole = roleRoll < 0.5 ? "opener" : "responder";
  } else {
    resolvedRole = effectiveRole;
  }

  const config = createProtocolDrillConfig(convention.id, userSeat, {
    opponentMode: options?.opponentMode,
    baseSystem: resolvedSystem,
    playProfileId: options?.playProfileId,
    practiceMode,
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

  // ── Role-based constraint swapping ──────────────────────────
  // When practicing as opener, swap N↔S so South gets the opener's hand.
  if (resolvedRole === "opener") {
    if (resolvedConstraints.dealer === undefined) {
      // No explicit dealer — set dealer to South and swap seat constraints
      resolvedConstraints = {
        ...resolvedConstraints,
        dealer: userSeat,
        seats: resolvedConstraints.seats.map((sc) => ({ ...sc, seat: rotateSeat180(sc.seat) })),
      };
    } else if (resolvedConstraints.dealer !== userSeat) {
      resolvedConstraints = rotateDealConstraints(resolvedConstraints, userSeat);
    }
  }

  const constraints: DealConstraints = {
    ...resolvedConstraints,
    vulnerability,
    ...(rng ? { rng } : {}),
    ...(seed !== undefined ? { seed } : {}),
  };

  // Deal generation uses the TS generator exclusively. The WASM/Tauri engine
  // strips customCheck (non-serializable) via cleanConstraints(), which loses
  // the per-surface validation gate. The TS generator evaluates the full
  // constraint set including customCheck in one place (deal-generator.ts:checkSeatConstraint).
  const dealRng = rng ?? (seed !== undefined ? mulberry32(seed) : undefined);
  const { deal } = tsGenerateDeal(constraints, dealRng);
  // For full-auction mode or opener mode, skip the default auction prefix
  // (opener opens directly — no prefix needed)
  let initialAuction = (practiceMode === "full-auction" || resolvedRole === "opener")
    ? undefined
    : convention.defaultAuction
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

  // Derive practice focus from bundle memberIds + base system modules
  const baseIds = getBaseModuleIds(resolvedSystem)
    .filter(id => !bundleInput.memberIds.includes(id));
  const practiceFocus = derivePracticeFocus(bundleInput.memberIds, targetModuleId, baseIds);

  // Derive default play preference from practice mode
  const defaultPlayPreference: PlayPreference =
    practiceMode === "decision-drill" ? "skip"
      : "prompt";
  const playPreference = options?.playPreference ?? defaultPlayPreference;

  return {
    deal,
    session,
    initialAuction,
    strategy,
    nsInferenceEngine,
    ewInferenceEngine,
    isOffConvention,
    practiceMode,
    practiceFocus,
    playPreference,
    resolvedRole,
  };
}
