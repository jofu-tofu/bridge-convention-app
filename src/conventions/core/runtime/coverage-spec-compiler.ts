// ── Coverage Spec Compiler ──────────────────────────────────────────
//
// Transforms an FSM path into a concrete deal-generation spec:
// - Walks meaning surfaces along the path to accumulate hand constraints
// - Produces DealConstraints + auction prefix for each targetable state
//
// This enables FSM-coverage-driven testing: for any reachable state,
// we can generate a deal that exercises the auction path leading to it.

import type { Seat, DealConstraints, SeatConstraint } from "../../../engine/types";
import { Suit } from "../../../engine/types";
import type { MeaningSurface, MeaningSurfaceClause } from "../../../core/contracts/meaning";
import type { ConventionBundle } from "../bundle/bundle-types";
import type { ConversationMachine } from "./machine-types";
import type { StatePath, PathTransition, MachineTopology } from "./machine-enumeration";
import {
  computeTopology,
  pathToAuctionPrefix,
  callToString,
} from "./machine-enumeration";

// ── Types ───────────────────────────────────────────────────────────

/** A fully compiled coverage target: everything needed to generate a deal
 *  and drop a user into a specific FSM state. */
export interface CoverageTarget {
  /** The FSM state this target exercises. */
  readonly stateId: string;
  /** The surface group active at this state (if any). */
  readonly surfaceGroupId: string | undefined;
  /** Auction prefix to reach this state (bid strings). */
  readonly auctionPrefix: readonly string[];
  /** Deal constraints that should produce hands consistent with the path. */
  readonly dealConstraints: DealConstraints;
  /** Which meaning surfaces are active for the user at this state. */
  readonly activeSurfaces: readonly MeaningSurface[];
  /** Whether the path contains unresolvable transitions (predicate/any-bid). */
  readonly hasUnresolvableSteps: boolean;
  /** Human-readable description of how we reach this state. */
  readonly pathDescription: string;
}

/** Full coverage manifest for a bundle. */
export interface CoverageManifest {
  readonly bundleId: string;
  readonly bundleName: string;
  readonly totalStates: number;
  readonly targetableStates: number;
  readonly targets: readonly CoverageTarget[];
  /** States that couldn't be targeted (predicate-only paths, etc.). */
  readonly unreachableTargets: readonly {
    readonly stateId: string;
    readonly reason: string;
  }[];
}

// ── Clause → SeatConstraint Compilation ─────────────────────────────

const SUIT_FACT_MAP: Record<string, Suit> = {
  "hand.suitLength.spades": Suit.Spades,
  "hand.suitLength.hearts": Suit.Hearts,
  "hand.suitLength.diamonds": Suit.Diamonds,
  "hand.suitLength.clubs": Suit.Clubs,
};

/** Accumulate constraints from a MeaningSurfaceClause onto a mutable SeatConstraint. */
function accumulateClause(
  constraint: MutableSeatConstraint,
  clause: MeaningSurfaceClause,
): void {
  // HCP constraints
  if (clause.factId === "hand.hcp") {
    if (clause.operator === "gte" && typeof clause.value === "number") {
      constraint.minHcp = Math.max(constraint.minHcp ?? 0, clause.value);
    } else if (clause.operator === "lte" && typeof clause.value === "number") {
      constraint.maxHcp = Math.min(constraint.maxHcp ?? 37, clause.value);
    } else if (clause.operator === "range" && typeof clause.value === "object" && "min" in clause.value) {
      constraint.minHcp = Math.max(constraint.minHcp ?? 0, clause.value.min);
      constraint.maxHcp = Math.min(constraint.maxHcp ?? 37, clause.value.max);
    }
    return;
  }

  // Suit length constraints
  const suit = SUIT_FACT_MAP[clause.factId];
  if (suit) {
    if (clause.operator === "gte" && typeof clause.value === "number") {
      if (!constraint.minLength) constraint.minLength = {};
      constraint.minLength[suit] = Math.max(constraint.minLength[suit] ?? 0, clause.value);
    } else if (clause.operator === "lte" && typeof clause.value === "number") {
      if (!constraint.maxLength) constraint.maxLength = {};
      constraint.maxLength[suit] = Math.min(constraint.maxLength[suit] ?? 13, clause.value);
    }
    return;
  }

  // Balanced constraint
  if (clause.factId === "hand.isBalanced" || clause.factId === "bridge.isBalanced") {
    if (clause.operator === "boolean" && clause.value === true) {
      constraint.balanced = true;
    }
    return;
  }

  // Four-card major → need at least one 4-card major
  if (clause.factId === "bridge.hasFourCardMajor" && clause.value === true) {
    if (!constraint.minLengthAny) constraint.minLengthAny = {};
    constraint.minLengthAny[Suit.Hearts] = Math.max(constraint.minLengthAny[Suit.Hearts] ?? 0, 4);
    constraint.minLengthAny[Suit.Spades] = Math.max(constraint.minLengthAny[Suit.Spades] ?? 0, 4);
    return;
  }

  // Five-card major → need at least one 5-card major
  if (clause.factId === "bridge.hasFiveCardMajor" && clause.value === true) {
    if (!constraint.minLengthAny) constraint.minLengthAny = {};
    constraint.minLengthAny[Suit.Hearts] = Math.max(constraint.minLengthAny[Suit.Hearts] ?? 0, 5);
    constraint.minLengthAny[Suit.Spades] = Math.max(constraint.minLengthAny[Suit.Spades] ?? 0, 5);
    return;
  }
}

interface MutableSeatConstraint {
  seat: Seat;
  minHcp?: number;
  maxHcp?: number;
  balanced?: boolean;
  minLength?: Partial<Record<Suit, number>>;
  maxLength?: Partial<Record<Suit, number>>;
  minLengthAny?: Partial<Record<Suit, number>>;
}

// ── Surface Lookup ──────────────────────────────────────────────────

/** Build a groupId → MeaningSurface[] lookup from a bundle. */
function buildSurfaceMap(
  bundle: ConventionBundle,
): Map<string, readonly MeaningSurface[]> {
  const map = new Map<string, readonly MeaningSurface[]>();
  for (const group of bundle.meaningSurfaces ?? []) {
    map.set(group.groupId, group.surfaces);
  }
  return map;
}

// ── Path → CoverageTarget Compilation ───────────────────────────────

/** Determine which seat a role maps to, given the user is South and
 *  the dealer (from base constraints). */
function roleToSeat(role: "self" | "partner" | "opponent", dealerIsNorth: boolean): Seat {
  // Convention: user is South, partner is North.
  // "self" = user's side, could be N or S depending on whose turn
  // For constraint purposes: opener = North (dealer), responder = South (user)
  if (role === "self" || role === "partner") {
    // Both NS — we tighten both
    return dealerIsNorth ? "S" as Seat : "N" as Seat;
  }
  return "E" as Seat; // opponent
}

/**
 * Compile a single FSM path into a CoverageTarget.
 *
 * Strategy:
 * 1. Start with the bundle's base dealConstraints
 * 2. Walk the path, collecting surfaces at each surface state
 * 3. For each surface whose defaultCall matches the transition's call,
 *    accumulate its clauses onto the appropriate seat constraint
 * 4. Produce the tightened DealConstraints + auction prefix
 */
export function compilePathToTarget(
  path: StatePath,
  machine: ConversationMachine,
  bundle: ConventionBundle,
  surfaceMap: Map<string, readonly MeaningSurface[]>,
): CoverageTarget {
  // Start with a mutable copy of base constraints
  const seatConstraints = new Map<Seat, MutableSeatConstraint>();
  for (const sc of bundle.dealConstraints.seats) {
    seatConstraints.set(sc.seat, { ...sc, minLength: sc.minLength ? { ...sc.minLength } : undefined, maxLength: sc.maxLength ? { ...sc.maxLength } : undefined });
  }

  let hasUnresolvableSteps = false;
  const pathParts: string[] = [];

  // Walk each transition in the path
  for (const step of path.transitions) {
    if (!step.call) {
      hasUnresolvableSteps = true;
      pathParts.push(`[?]`);
      continue;
    }

    pathParts.push(callToString(step.call));

    // Find the surface state we're leaving (fromState)
    const fromState = machine.states.get(step.fromStateId);
    if (!fromState?.surfaceGroupId) continue;

    const surfaces = surfaceMap.get(fromState.surfaceGroupId);
    if (!surfaces) continue;

    // Find the surface whose defaultCall matches this transition's call
    const matchingSurface = surfaces.find((s) => {
      const dc = s.encoding.defaultCall;
      if (step.call!.type !== dc.type) return false;
      if (dc.type === "bid" && step.call!.type === "bid") {
        return dc.level === step.call!.level && dc.strain === step.call!.strain;
      }
      return true; // pass/double/redouble match by type
    });

    if (!matchingSurface) continue;

    // Determine which seat this surface constrains
    // Opener = North (dealer), Responder = South, Opponents = E/W
    const seat = step.role === "opponent" ? ("E" as Seat) : (step.role === "self" ? ("S" as Seat) : ("N" as Seat));

    if (!seatConstraints.has(seat)) {
      seatConstraints.set(seat, { seat });
    }
    const sc = seatConstraints.get(seat)!;

    // Accumulate all clauses from the matching surface
    for (const clause of matchingSurface.clauses) {
      accumulateClause(sc, clause);
    }
  }

  // Build final DealConstraints
  const seats: SeatConstraint[] = [];
  for (const [, sc] of seatConstraints) {
    // When we have both minLength (AND) and minLengthAny (OR) for the same suit,
    // the AND constraint subsumes the OR for that suit — remove it from minLengthAny
    // to avoid contradictions where both must be satisfied.
    if (sc.minLength && sc.minLengthAny) {
      for (const suit of Object.keys(sc.minLength) as Suit[]) {
        if (suit in sc.minLengthAny) {
          delete sc.minLengthAny[suit];
        }
      }
    }

    const built: SeatConstraint = {
      seat: sc.seat,
      ...(sc.minHcp !== undefined && { minHcp: sc.minHcp }),
      ...(sc.maxHcp !== undefined && { maxHcp: sc.maxHcp }),
      ...(sc.balanced !== undefined && { balanced: sc.balanced }),
      ...(sc.minLength && Object.keys(sc.minLength).length > 0 && { minLength: sc.minLength }),
      ...(sc.maxLength && Object.keys(sc.maxLength).length > 0 && { maxLength: sc.maxLength }),
      ...(sc.minLengthAny && Object.keys(sc.minLengthAny).length > 0 && { minLengthAny: sc.minLengthAny }),
    };
    seats.push(built);
  }

  const dealConstraints: DealConstraints = {
    ...bundle.dealConstraints,
    seats,
  };

  // Target state's active surfaces
  const targetState = machine.states.get(path.targetStateId);
  const activeSurfaces = targetState?.surfaceGroupId
    ? surfaceMap.get(targetState.surfaceGroupId) ?? []
    : [];

  return {
    stateId: path.targetStateId,
    surfaceGroupId: targetState?.surfaceGroupId,
    auctionPrefix: pathToAuctionPrefix(path),
    dealConstraints,
    activeSurfaces,
    hasUnresolvableSteps,
    pathDescription: pathParts.join(" → ") || "(initial)",
  };
}

// ── Full Coverage Manifest ──────────────────────────────────────────

/**
 * Generate a complete coverage manifest for a bundle.
 * Enumerates every reachable FSM state, compiles a targeting spec for each.
 */
export function generateCoverageManifest(
  bundle: ConventionBundle,
): CoverageManifest | null {
  const machine = bundle.conversationMachine;
  if (!machine) return null;

  const topology = computeTopology(machine);
  const surfaceMap = buildSurfaceMap(bundle);
  const targets: CoverageTarget[] = [];
  const unreachableTargets: { stateId: string; reason: string }[] = [];

  for (const stateId of topology.reachableStates) {
    const path = topology.paths.get(stateId);
    if (!path) {
      unreachableTargets.push({ stateId, reason: "No path found by BFS" });
      continue;
    }

    // Skip the initial state itself (nothing to test)
    if (stateId === machine.initialStateId) continue;

    const target = compilePathToTarget(path, machine, bundle, surfaceMap);
    targets.push(target);
  }

  return {
    bundleId: bundle.id,
    bundleName: bundle.name,
    totalStates: topology.reachableStates.size,
    targetableStates: targets.length,
    targets,
    unreachableTargets,
  };
}
