// ── Coverage Spec Compiler ──────────────────────────────────────────
//
// Transforms an FSM path into a concrete deal-generation spec:
// - Walks meaning surfaces along the path to accumulate hand constraints
// - Produces DealConstraints + auction prefix for each targetable state
//
// This enables FSM-coverage-driven testing: for any reachable state,
// we can generate a deal that exercises the auction path leading to it.

import { Seat, Suit } from "../../../engine/types";
import type { DealConstraints, SeatConstraint } from "../../../engine/types";
import { compileFactClause, type MutableSeatConstraint } from "./fact-compiler";
import type { MeaningSurface } from "../../../core/contracts/meaning";
import type { ConventionBundle } from "../bundle/bundle-types";
import type { ConversationMachine } from "./machine-types";
import type { StatePath } from "./machine-enumeration";
import {
  computeTopology,
  pathToAuctionPrefix,
  callToString,
} from "./machine-enumeration";
import { resolveFactId } from "../pipeline/binding-resolver";

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
// Delegated to shared fact-compiler.ts — see compileFactClause import.

// ── Surface Lookup ──────────────────────────────────────────────────

/** Build a groupId → MeaningSurface[] lookup from a bundle's meaningSurfaces. */
export function buildSurfaceMap(
  bundle: ConventionBundle,
): Map<string, readonly MeaningSurface[]> {
  const map = new Map<string, readonly MeaningSurface[]>();
  for (const group of bundle.meaningSurfaces ?? []) {
    map.set(group.groupId, group.surfaces);
  }
  return map;
}

// ── Path → CoverageTarget Compilation ───────────────────────────────

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
    const seat: Seat = step.role === "opponent"
      ? Seat.East
      : step.role === "self" ? Seat.South : Seat.North;

    if (!seatConstraints.has(seat)) {
      seatConstraints.set(seat, { seat });
    }
    const sc = seatConstraints.get(seat)!;

    // Accumulate all clauses from the matching surface, resolving $-bindings
    for (const clause of matchingSurface.clauses) {
      const resolvedClause = matchingSurface.surfaceBindings
        ? { ...clause, factId: resolveFactId(clause.factId, matchingSurface.surfaceBindings) }
        : clause;
      compileFactClause(sc, resolvedClause.factId, resolvedClause.operator, resolvedClause.value);
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
