/**
 * Deal constraint derivation — derives deal constraints from authored convention data.
 *
 * Three sources:
 * 1. Capability archetype → opener constraints, default auction, allowed dealers
 * 2. R1 surface clause analysis → practitioner constraints (activation envelope)
 * 3. Complement negation → off-convention constraints
 *
 * This replaces hand-authored dealConstraints, offConventionConstraints,
 * dealConstraintFactory, offConventionConstraintFactory, defaultAuction,
 * and allowedDealers on BundleInput.
 */

import type { DealConstraints, SeatConstraint, Hand, Deal, Auction } from "../../engine/types";
import { Seat, Suit } from "../../engine/types";
import type { SystemConfig } from "./system-config";
import type { ConventionModule } from "../core/convention-module";
import type { StateEntry, TurnRole } from "../core/rule-module";
import type { BidMeaning } from "../pipeline/evaluation/meaning";
import type { FactComposition } from "../core/fact-catalog";
import type { BundleInput } from "../core/bundle/bundle-types";

import { getArchetype, getPrimaryCapability } from "./capability-constraint-registry";
import type { CapabilityArchetype } from "./capability-constraint-registry";
import { compileFactClause, SUIT_FACT_MAP, type MutableSeatConstraint } from "../core/runtime/fact-compiler";
import { invertComposition, type InvertedConstraint } from "../pipeline/facts/fact-inversion";
import {
  SYSTEM_RESPONDER_INVITE_VALUES,
  SYSTEM_RESPONDER_GAME_VALUES,
  SYSTEM_RESPONDER_SLAM_VALUES,
  SYSTEM_RESPONDER_WEAK_HAND,
  SYSTEM_DONT_OVERCALL_IN_RANGE,
  SYSTEM_RESPONDER_ONE_NT_RANGE,
} from "./system-fact-vocabulary";
import { calculateHcp, getSuitLength, isBalanced } from "../../engine/hand-evaluator";
import { SUIT_ORDER } from "../../engine/constants";

// ── Types ───────────────────────────────────────────────────────────

interface DerivedDealConstraints {
  readonly dealConstraints: DealConstraints;
  readonly offConventionConstraints?: DealConstraints;
  readonly defaultAuction?: (seat: Seat, deal?: Deal) => Auction | undefined;
  readonly allowedDealers?: readonly Seat[];
}

// ── Source 1: Capability archetype ──────────────────────────────────

function getCapabilityArchetype(input: BundleInput): CapabilityArchetype | undefined {
  const capId = getPrimaryCapability(input.declaredCapabilities);
  if (!capId) return undefined;
  return getArchetype(capId);
}

// ── Source 2: R1 surface analysis ───────────────────────────────────

/**
 * Find R1 (first practitioner decision) state entries for a module.
 *
 * Strategy: find entries matching the practitioner's turn at the NEAREST
 * reachable phase from initial. For modules where the practitioner bids
 * at the initial phase (distance 0), those entries are R1. For modules
 * where the practitioner bids after a transition (distance 1), those are R1.
 */
function findR1Entries<P extends string>(
  mod: ConventionModule<P>,
  practitionerTurn: TurnRole | undefined,
  minPhaseDistance: number = 0,
): readonly StateEntry<P>[] {
  const entries = mod.states ?? [];

  // Find entries matching practitioner turn
  const matching = entries.filter((e) => {
    if (practitionerTurn === undefined) {
      // No turn matching (e.g., DONT) — match entries without turn field
      return e.turn === undefined;
    }
    return e.turn === practitionerTurn;
  });

  if (matching.length === 0) return [];

  // Compute phase distances from initial via BFS
  const distances = computePhaseDistances(mod);

  // For each matching entry, get its minimum phase distance
  const withDistance = matching.map((e) => ({
    entry: e,
    distance: phaseDistance(e.phase, distances),
  }));

  // Return entries at the minimum distance >= minPhaseDistance
  const eligible = withDistance.filter((d) => d.distance >= minPhaseDistance);
  if (eligible.length === 0) return [];
  const minDist = Math.min(...eligible.map((d) => d.distance));
  return eligible
    .filter((d) => d.distance === minDist)
    .map((d) => d.entry);
}

function computePhaseDistances(mod: ConventionModule): Map<string, number> {
  const distances = new Map<string, number>();
  distances.set(mod.local.initial, 0);

  const queue: string[] = [mod.local.initial];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDist = distances.get(current)!;

    for (const t of mod.local.transitions) {
      const fromPhases = Array.isArray(t.from) ? t.from : [t.from];
      if (fromPhases.includes(current as never)) {
        const toPhase = t.to;
        if (!distances.has(toPhase)) {
          distances.set(toPhase, currentDist + 1);
          queue.push(toPhase);
        }
      }
    }
  }

  return distances;
}

function phaseDistance(
  phase: string | readonly string[],
  distances: Map<string, number>,
): number {
  const phases = Array.isArray(phase) ? phase : [phase];
  return Math.min(
    ...phases.map((p) => distances.get(p as string) ?? Infinity),
  );
}

/**
 * Resolve a system fact clause to primitive HCP constraints.
 * System facts are a finite known set — we handle them explicitly.
 */
function resolveSystemFactToHcp(
  factId: string,
  value: unknown,
  sys: SystemConfig,
): { minHcp?: number; maxHcp?: number } | undefined {
  if (value !== true) return undefined; // Only handle boolean true clauses

  switch (factId) {
    case SYSTEM_RESPONDER_INVITE_VALUES:
      return { minHcp: sys.responderThresholds.inviteMin, maxHcp: sys.responderThresholds.inviteMax };
    case SYSTEM_RESPONDER_GAME_VALUES:
      return { minHcp: sys.responderThresholds.gameMin };
    case SYSTEM_RESPONDER_SLAM_VALUES:
      return { minHcp: sys.responderThresholds.slamMin };
    case SYSTEM_RESPONDER_WEAK_HAND:
      return { maxHcp: sys.responderThresholds.inviteMin - 1 };
    case SYSTEM_DONT_OVERCALL_IN_RANGE:
      return { minHcp: sys.dontOvercall.minHcp, maxHcp: sys.dontOvercall.maxHcp };
    case SYSTEM_RESPONDER_ONE_NT_RANGE:
      return { minHcp: sys.oneNtResponseAfterMajor.minHcp, maxHcp: sys.oneNtResponseAfterMajor.maxHcp };
    default:
      return undefined;
  }
}

/** Check if a factId is a module-derived fact by looking in the module's fact catalog. */
function findFactComposition(
  factId: string,
  modules: readonly ConventionModule[],
): FactComposition | undefined {
  for (const mod of modules) {
    for (const def of mod.facts.definitions) {
      if (def.id === factId && def.composition) {
        return def.composition;
      }
    }
  }
  return undefined;
}

/**
 * Compile a single surface's clauses into a constraint for the practitioner seat.
 */
function compileSurfaceConstraint(
  surface: BidMeaning,
  practitionerSeat: Seat,
  sys: SystemConfig,
  modules: readonly ConventionModule[],
): MutableSeatConstraint {
  const builder: MutableSeatConstraint = { seat: practitionerSeat };

  for (const clause of surface.clauses) {
    const factId = clause.factId;
    const operator = clause.operator;
    const value = clause.value;

    // 1. Try primitive fact compilation (hand.hcp, hand.suitLength.*, bridge.*)
    // For $suit bindings, resolve using the surface's bindings or all suits
    if (factId.includes("$suit")) {
      const boundSuit = surface.surfaceBindings?.suit;
      if (boundSuit) {
        // Specific binding — resolve to that suit, using "any" mode for OR across surfaces
        const resolvedFactId = factId.replace("$suit", boundSuit);
        compileFactClause(builder, resolvedFactId, operator, value, { suitLengthMode: "any" });
      } else {
        // No binding — try all suit variants with OR semantics
        const suitNames = ["hearts", "spades", "diamonds", "clubs"];
        for (const suitName of suitNames) {
          const resolvedFactId = factId.replace("$suit", suitName);
          if (SUIT_FACT_MAP[resolvedFactId] !== undefined) {
            compileFactClause(builder, resolvedFactId, operator, value, { suitLengthMode: "any" });
          }
        }
      }
      continue;
    }

    // Handle bridge.hasFiveCardMajor/hasFourCardMajor with value: false → maxLength
    if (factId === "bridge.hasFiveCardMajor" && value === false) {
      if (!builder.maxLength) builder.maxLength = {};
      builder.maxLength[Suit.Hearts] = Math.min(builder.maxLength[Suit.Hearts] ?? 13, 4);
      builder.maxLength[Suit.Spades] = Math.min(builder.maxLength[Suit.Spades] ?? 13, 4);
      continue;
    }
    if (factId === "bridge.hasFourCardMajor" && value === false) {
      if (!builder.maxLength) builder.maxLength = {};
      builder.maxLength[Suit.Hearts] = Math.min(builder.maxLength[Suit.Hearts] ?? 13, 3);
      builder.maxLength[Suit.Spades] = Math.min(builder.maxLength[Suit.Spades] ?? 13, 3);
      continue;
    }

    // Try direct primitive compilation
    if (compileFactClause(builder, factId, operator, value, { suitLengthMode: "any" })) {
      continue;
    }

    // bridge.totalPointsForRaise ≈ hand.hcp + shortage_points (0-2 typical).
    // For deal generation, use a loose lower bound: totalPoints - 2.
    if (factId === "bridge.totalPointsForRaise") {
      compileTotalPointsAsHcp(builder, operator, value);
      continue;
    }

    // 2. Try system fact resolution
    const systemHcp = resolveSystemFactToHcp(factId, value, sys);
    if (systemHcp) {
      if (systemHcp.minHcp !== undefined) {
        builder.minHcp = Math.max(builder.minHcp ?? 0, systemHcp.minHcp);
      }
      if (systemHcp.maxHcp !== undefined) {
        builder.maxHcp = Math.min(builder.maxHcp ?? 37, systemHcp.maxHcp);
      }
      continue;
    }

    // 3. Try module-derived fact composition
    const composition = findFactComposition(factId, modules);
    if (composition && value === true) {
      const inverted = invertComposition(composition);
      mergeInvertedIntoBuilder(builder, inverted);
      continue;
    }

    // 4. Unknown fact — skip (unconstrained for this clause)
  }

  return builder;
}

/** Shortage points margin for converting totalPointsForRaise to HCP bounds. */
const SHORTAGE_MARGIN = 2;

function compileTotalPointsAsHcp(
  builder: MutableSeatConstraint,
  operator: string,
  value: unknown,
): void {
  // totalPointsForRaise = HCP + shortage_points.
  // For gte: hcp >= totalPoints - margin (loose lower bound)
  // For lte: hcp <= totalPoints (shortage ≥ 0, so HCP ≤ totalPoints)
  // For range: apply both
  if (operator === "gte") {
    const v = value as number;
    builder.minHcp = Math.max(builder.minHcp ?? 0, v - SHORTAGE_MARGIN);
  } else if (operator === "lte") {
    const v = value as number;
    builder.maxHcp = Math.min(builder.maxHcp ?? 37, v);
  } else if (operator === "range") {
    const range = value as { min: number; max: number };
    builder.minHcp = Math.max(builder.minHcp ?? 0, range.min - SHORTAGE_MARGIN);
    builder.maxHcp = Math.min(builder.maxHcp ?? 37, range.max);
  }
}

function mergeInvertedIntoBuilder(
  builder: MutableSeatConstraint,
  inverted: InvertedConstraint,
): void {
  if (inverted.minHcp !== undefined) {
    builder.minHcp = Math.max(builder.minHcp ?? 0, inverted.minHcp);
  }
  if (inverted.maxHcp !== undefined) {
    builder.maxHcp = Math.min(builder.maxHcp ?? 37, inverted.maxHcp);
  }
  if (inverted.balanced !== undefined) {
    builder.balanced = inverted.balanced;
  }

  // Suit length constraints from compositions use OR (minLengthAny) semantics
  // since they come from module-derived facts which are OR'd across surfaces
  if (inverted.minLength) {
    if (!builder.minLengthAny) builder.minLengthAny = {};
    for (const [suitKey, val] of Object.entries(inverted.minLength)) {
      const suit = suitKey as unknown as Suit;
      builder.minLengthAny[suit] = Math.max(builder.minLengthAny[suit] ?? 0, val);
    }
  }
  if (inverted.minLengthAny) {
    if (!builder.minLengthAny) builder.minLengthAny = {};
    for (const [suitKey, val] of Object.entries(inverted.minLengthAny)) {
      const suit = suitKey as unknown as Suit;
      // For OR merge: take the minimum across branches
      const existing = builder.minLengthAny[suit];
      builder.minLengthAny[suit] = existing !== undefined
        ? Math.min(existing, val)
        : val;
    }
  }
  if (inverted.maxLength) {
    if (!builder.maxLength) builder.maxLength = {};
    for (const [suitKey, val] of Object.entries(inverted.maxLength)) {
      const suit = suitKey as unknown as Suit;
      builder.maxLength[suit] = Math.min(builder.maxLength[suit] ?? 13, val);
    }
  }
}

/**
 * Derive the activation envelope (union of per-surface constraints).
 */
function computeActivationEnvelope(
  perSurfaceConstraints: MutableSeatConstraint[],
): MutableSeatConstraint {
  if (perSurfaceConstraints.length === 0) {
    return { seat: Seat.South };
  }

  const seat = perSurfaceConstraints[0]!.seat;
  const result: MutableSeatConstraint = { seat };

  // Union: loosest bounds
  let anyHasMinHcp = false;
  let allHaveMinHcp = true;
  let anyHasMaxHcp = false;
  let allHaveMaxHcp = true;

  for (const c of perSurfaceConstraints) {
    if (c.minHcp !== undefined) {
      result.minHcp = anyHasMinHcp
        ? Math.min(result.minHcp!, c.minHcp)
        : c.minHcp;
      anyHasMinHcp = true;
    } else {
      allHaveMinHcp = false;
    }

    if (c.maxHcp !== undefined) {
      result.maxHcp = anyHasMaxHcp
        ? Math.max(result.maxHcp!, c.maxHcp)
        : c.maxHcp;
      anyHasMaxHcp = true;
    } else {
      allHaveMaxHcp = false;
    }
  }

  // If any surface has NO minHcp constraint, the union is unconstrained
  if (!allHaveMinHcp) delete result.minHcp;
  if (!allHaveMaxHcp) delete result.maxHcp;

  // Merge suit-length constraints across surfaces.
  // Per-surface minLength (AND within surface) becomes minLengthAny (OR across surfaces)
  // in the envelope, since a hand needs to satisfy SOME surface, not ALL.
  const allMinLengthAny = new Map<Suit, number[]>();
  const allMaxLength = new Map<Suit, number[]>();

  for (const c of perSurfaceConstraints) {
    // minLength from individual surfaces → OR across surfaces = minLengthAny
    if (c.minLength) {
      for (const [suitKey, val] of Object.entries(c.minLength)) {
        const suit = suitKey as unknown as Suit;
        if (!allMinLengthAny.has(suit)) allMinLengthAny.set(suit, []);
        allMinLengthAny.get(suit)!.push(val);
      }
    }
    if (c.minLengthAny) {
      for (const [suitKey, val] of Object.entries(c.minLengthAny)) {
        const suit = suitKey as unknown as Suit;
        if (!allMinLengthAny.has(suit)) allMinLengthAny.set(suit, []);
        allMinLengthAny.get(suit)!.push(val);
      }
    }
    if (c.maxLength) {
      for (const [suitKey, val] of Object.entries(c.maxLength)) {
        const suit = suitKey as unknown as Suit;
        if (!allMaxLength.has(suit)) allMaxLength.set(suit, []);
        allMaxLength.get(suit)!.push(val);
      }
    }
  }

  // minLengthAny: take the minimum across all surfaces for each suit
  if (allMinLengthAny.size > 0) {
    result.minLengthAny = {};
    for (const [suit, values] of allMinLengthAny) {
      result.minLengthAny[suit] = Math.min(...values);
    }
  }

  // maxLength: in a union, take the MAXIMUM per suit (loosest bound).
  // Exclude a suit's maxLength if ANY surface requires a HIGHER minLength/minLengthAny
  // for that suit — the two constraints would contradict.
  if (allMaxLength.size > 0) {
    result.maxLength = {};
    for (const [suit, values] of allMaxLength) {
      const maxVal = Math.max(...values);
      // Check: does any surface require a higher minimum for this suit?
      const minVals = allMinLengthAny.get(suit);
      const highestMin = minVals ? Math.max(...minVals) : 0;
      if (maxVal >= highestMin) {
        result.maxLength[suit] = maxVal;
      }
      // Otherwise skip — maxLength would contradict minLengthAny
    }
    if (Object.keys(result.maxLength).length === 0) {
      delete result.maxLength;
    }
  }

  return result;
}

/**
 * Derive practitioner constraints from R1 surfaces across all modules.
 */
function derivePractitionerConstraints(
  modules: readonly ConventionModule[],
  archetype: CapabilityArchetype,
  sys: SystemConfig,
): MutableSeatConstraint {
  const allR1Surfaces: BidMeaning[] = [];

  for (const mod of modules) {
    const r1Entries = findR1Entries(mod, archetype.practitionerTurn, archetype.minPhaseDistance);
    for (const entry of r1Entries) {
      allR1Surfaces.push(...entry.surfaces);
    }
  }

  // Filter out "avoid" band surfaces (like pass fallbacks) — they don't
  // represent convention activation, just catch-alls
  const activeSurfaces = allR1Surfaces.filter(
    (s) => s.ranking.recommendationBand !== "avoid",
  );

  // If no active surfaces found, use all surfaces
  const surfacesToAnalyze = activeSurfaces.length > 0 ? activeSurfaces : allR1Surfaces;

  // Compile per-surface constraints
  const perSurface = surfacesToAnalyze.map((s) =>
    compileSurfaceConstraint(s, archetype.practitionerSeat, sys, modules),
  );

  // Compute activation envelope (union)
  return computeActivationEnvelope(perSurface);
}

// ── Source 3: Off-convention complement ─────────────────────────────

function satisfiesEnvelope(hand: Hand, envelope: MutableSeatConstraint): boolean {
  const hcp = calculateHcp(hand);
  if (envelope.minHcp !== undefined && hcp < envelope.minHcp) return false;
  if (envelope.maxHcp !== undefined && hcp > envelope.maxHcp) return false;

  if (envelope.balanced !== undefined && isBalanced(getSuitLength(hand)) !== envelope.balanced) {
    return false;
  }

  const shape = getSuitLength(hand);

  // Check minLengthAny (OR semantics)
  if (envelope.minLengthAny) {
    let anyMet = false;
    for (let i = 0; i < SUIT_ORDER.length; i++) {
      const min = envelope.minLengthAny[SUIT_ORDER[i]!];
      if (min !== undefined && shape[i]! >= min) {
        anyMet = true;
        break;
      }
    }
    if (!anyMet) return false;
  }

  // Check maxLength
  if (envelope.maxLength) {
    for (let i = 0; i < SUIT_ORDER.length; i++) {
      const max = envelope.maxLength[SUIT_ORDER[i]!];
      if (max !== undefined && shape[i]! > max) return false;
    }
  }

  return true;
}

function deriveOffConventionConstraints(
  openerConstraint: SeatConstraint,
  practitionerEnvelope: MutableSeatConstraint,
  dealer: Seat | undefined,
): DealConstraints {
  return {
    seats: [
      openerConstraint,
      {
        seat: practitionerEnvelope.seat,
        customCheck: (hand: Hand) => !satisfiesEnvelope(hand, practitionerEnvelope),
      },
    ],
    dealer,
  };
}

// ── Top-level derivation ────────────────────────────────────────────

/**
 * Derive all deal constraints from authored convention data.
 * Called by resolveBundle() instead of reading hand-authored fields.
 */
export function deriveBundleDealConstraints(
  input: BundleInput,
  modules: readonly ConventionModule[],
  sys: SystemConfig,
): DerivedDealConstraints {
  const archetype = getCapabilityArchetype(input);
  if (!archetype) {
    // No capability declared — fall back to minimal constraints
    return {
      dealConstraints: { seats: [], dealer: Seat.North },
    };
  }

  // Source 1: opener constraint from capability archetype
  const openerConstraint = archetype.openerConstraint(sys);
  const dealer = archetype.allowedDealers?.[0];

  // Source 2: practitioner constraint from R1 surface analysis
  const practitionerEnvelope = derivePractitionerConstraints(modules, archetype, sys);

  // Build the practitioner seat constraint
  const practitionerConstraint: SeatConstraint = {
    seat: practitionerEnvelope.seat,
    ...(practitionerEnvelope.minHcp !== undefined ? { minHcp: practitionerEnvelope.minHcp } : {}),
    ...(practitionerEnvelope.maxHcp !== undefined ? { maxHcp: practitionerEnvelope.maxHcp } : {}),
    ...(practitionerEnvelope.balanced !== undefined ? { balanced: practitionerEnvelope.balanced } : {}),
    ...(practitionerEnvelope.minLengthAny ? { minLengthAny: practitionerEnvelope.minLengthAny } : {}),
    ...(practitionerEnvelope.maxLength ? { maxLength: practitionerEnvelope.maxLength } : {}),
  };

  const dealConstraints: DealConstraints = {
    seats: [openerConstraint, practitionerConstraint],
    dealer,
  };

  // Source 3: off-convention = negation of practitioner envelope
  const offConventionConstraints = deriveOffConventionConstraints(
    openerConstraint,
    practitionerEnvelope,
    dealer,
  );

  return {
    dealConstraints,
    offConventionConstraints,
    defaultAuction: archetype.defaultAuction,
    allowedDealers: archetype.allowedDealers,
  };
}
