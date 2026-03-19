// ── Coverage Spec Compiler ──────────────────────────────────────────
//
// Transforms an FSM path into a concrete deal-generation spec:
// - Walks meaning surfaces along the path to accumulate hand constraints
// - Produces DealConstraints + auction prefix for each targetable state
//
// This enables FSM-coverage-driven testing: for any reachable state,
// we can generate a deal that exercises the auction path leading to it.

import { Seat } from "../../../engine/types";
import type { Suit, DealConstraints, SeatConstraint } from "../../../engine/types";
import { compileFactClause, type MutableSeatConstraint } from "./fact-compiler";
import type { MeaningSurface } from "../../../core/contracts/meaning";
import type { Call } from "../../../engine/types";
import type { ConventionBundle } from "../bundle/bundle-types";
import type { ConversationMachine } from "./machine-types";
import type { StatePath } from "./machine-enumeration";
import {
  computeTopology,
  pathToAuctionPrefix,
  callToString,
  buildPathTreeChildren,
  computeMinimalLeafMultiplicities,
} from "./machine-enumeration";
import type { TreeLPResult } from "./machine-enumeration";
import { resolveFactId } from "../pipeline/binding-resolver";
import { generateDeal } from "../../../engine/deal-generator";

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
    // the AND constraint subsumes the OR — clear minLengthAny entirely so the
    // deal generator uses the specific suit from the path, not any suit from the base.
    if (sc.minLength && sc.minLengthAny) {
      const hasOverlap = (Object.keys(sc.minLength) as Suit[]).some(
        suit => suit in sc.minLengthAny!,
      );
      if (hasOverlap) {
        sc.minLengthAny = undefined;
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

// ── (State, Surface) Coverage Atoms ─────────────────────────────────

/** The atomic unit of coverage: a specific surface at a specific state. */
export interface SurfaceCoveragePair {
  readonly stateId: string;
  readonly surfaceId: string; // meaningId
  readonly surfaceLabel: string; // teachingLabel
}

/** Coverage target with surface-level targeting and coverage tracking. */
export interface SurfaceCoverageTarget extends CoverageTarget {
  /** The specific surface to exercise at the target state (null = any). */
  readonly targetSurfaceId: string | undefined;
  readonly targetSurfaceLabel: string | undefined;
  /** All (state, surface) pairs deterministically covered by this target. */
  readonly coveredPairs: readonly SurfaceCoveragePair[];
  /** Phase origin: "leaf-sweep" for Phase 1, "gap-fill" for Phase 2. */
  readonly phase: "leaf-sweep" | "gap-fill";
}

/** Optimized coverage manifest with two-phase structure. */
export interface OptimizedCoverageManifest {
  readonly bundleId: string;
  readonly bundleName: string;
  readonly totalStates: number;
  /** Total (state, surface) pairs in the coverage universe. */
  readonly totalSurfacePairs: number;
  /** Phase 1: leaf-first sweep targets. */
  readonly phase1Targets: readonly SurfaceCoverageTarget[];
  /** Phase 2: gap-fill targets for uncovered intermediate surfaces. */
  readonly phase2Targets: readonly SurfaceCoverageTarget[];
  /** All targets combined (phase1 + phase2). */
  readonly allTargets: readonly SurfaceCoverageTarget[];
  /** Pairs that remain uncovered (infeasible or unresolvable). */
  readonly uncoveredPairs: readonly SurfaceCoveragePair[];
  /** Pairs whose deal constraints are infeasible. */
  readonly infeasiblePairs: readonly SurfaceCoveragePair[];
  /** Tree LP lower bound on test count. */
  readonly treeLPBound: number;
  /** Hash of FSM topology + surfaces for staleness detection. */
  readonly coverageHash: string;
  /** States that couldn't be reached at all. */
  readonly unreachableTargets: readonly { stateId: string; reason: string }[];
}

// ── Coverage Universe Enumeration ───────────────────────────────────

/**
 * Enumerate all (state, surface) pairs in a bundle's coverage universe.
 *
 * The coverage universe U = { (s, f) : s has surfaceGroupId, f ∈ surfaces(s) }.
 * This is the complete set of atoms that need to be exercised for full coverage.
 */
export function enumerateCoverageUniverse(
  bundle: ConventionBundle,
  surfaceMap: Map<string, readonly MeaningSurface[]>,
  reachableStates: ReadonlySet<string>,
): SurfaceCoveragePair[] {
  const machine = bundle.conversationMachine;
  if (!machine) return [];

  const pairs: SurfaceCoveragePair[] = [];
  for (const stateId of reachableStates) {
    const state = machine.states.get(stateId);
    if (!state?.surfaceGroupId) continue;
    const surfaces = surfaceMap.get(state.surfaceGroupId);
    if (!surfaces) continue;
    for (const surface of surfaces) {
      pairs.push({
        stateId,
        surfaceId: surface.meaningId,
        surfaceLabel: surface.teachingLabel,
      });
    }
  }
  return pairs;
}

// ── Surface Constraint Injection ────────────────────────────────────

/**
 * Tighten deal constraints to exercise a specific surface at the target state.
 *
 * Finds the surface by meaningId in the active surfaces list, then
 * compiles its clauses into additional seat constraints for the
 * appropriate seat. Returns a new DealConstraints with the extra
 * constraints merged in.
 */
export function injectSurfaceConstraints(
  base: DealConstraints,
  activeSurfaces: readonly MeaningSurface[],
  targetSurfaceId: string,
  seat: Seat,
): DealConstraints {
  const surface = activeSurfaces.find((s) => s.meaningId === targetSurfaceId);
  if (!surface) return base; // Surface not found — fall back to base

  // Build a mutable copy of the seat's constraint
  const existingForSeat = base.seats.find((sc) => sc.seat === seat);
  const builder: MutableSeatConstraint = existingForSeat
    ? {
        ...existingForSeat,
        minLength: existingForSeat.minLength ? { ...existingForSeat.minLength } : undefined,
        maxLength: existingForSeat.maxLength ? { ...existingForSeat.maxLength } : undefined,
        minLengthAny: existingForSeat.minLengthAny ? { ...existingForSeat.minLengthAny } : undefined,
      }
    : { seat };

  // Compile the target surface's clauses into the builder
  for (const clause of surface.clauses) {
    const resolvedFactId = surface.surfaceBindings
      ? resolveFactId(clause.factId, surface.surfaceBindings)
      : clause.factId;
    compileFactClause(builder, resolvedFactId, clause.operator, clause.value);
  }

  // Build the final constraint
  const builtSc: SeatConstraint = {
    seat: builder.seat,
    ...(builder.minHcp !== undefined && { minHcp: builder.minHcp }),
    ...(builder.maxHcp !== undefined && { maxHcp: builder.maxHcp }),
    ...(builder.balanced !== undefined && { balanced: builder.balanced }),
    ...(builder.minLength && Object.keys(builder.minLength).length > 0 && { minLength: builder.minLength }),
    ...(builder.maxLength && Object.keys(builder.maxLength).length > 0 && { maxLength: builder.maxLength }),
    ...(builder.minLengthAny && Object.keys(builder.minLengthAny).length > 0 && { minLengthAny: builder.minLengthAny }),
  };

  // Replace or add the seat constraint in the list
  const newSeats = base.seats.filter((sc) => sc.seat !== seat);
  newSeats.push(builtSc);

  return { ...base, seats: newSeats };
}

// ── Path Coverage Analysis ──────────────────────────────────────────

/**
 * Compute which (state, surface) pairs a path deterministically covers.
 *
 * For each transition in the path, the fromState's matching surface is
 * deterministically exercised (because the transition's call matches
 * exactly one surface's defaultCall). At the target state, the caller
 * specifies which surface to exercise.
 */
export function computePathCoveredPairs(
  path: StatePath,
  machine: ConversationMachine,
  surfaceMap: Map<string, readonly MeaningSurface[]>,
  targetSurfaceId?: string,
): SurfaceCoveragePair[] {
  const pairs: SurfaceCoveragePair[] = [];

  // Intermediate states: surface determined by transition call
  for (const step of path.transitions) {
    if (!step.call) continue;
    const fromState = machine.states.get(step.fromStateId);
    if (!fromState?.surfaceGroupId) continue;
    const surfaces = surfaceMap.get(fromState.surfaceGroupId);
    if (!surfaces) continue;

    const matchingSurface = surfaces.find((s) => {
      const dc = s.encoding.defaultCall;
      if (step.call!.type !== dc.type) return false;
      if (dc.type === "bid" && step.call!.type === "bid") {
        return dc.level === step.call!.level && dc.strain === step.call!.strain;
      }
      return true;
    });

    if (matchingSurface) {
      pairs.push({
        stateId: step.fromStateId,
        surfaceId: matchingSurface.meaningId,
        surfaceLabel: matchingSurface.teachingLabel,
      });
    }
  }

  // Target state: specific surface if requested
  if (targetSurfaceId) {
    const targetState = machine.states.get(path.targetStateId);
    if (targetState?.surfaceGroupId) {
      const surfaces = surfaceMap.get(targetState.surfaceGroupId);
      const targetSurface = surfaces?.find((s) => s.meaningId === targetSurfaceId);
      if (targetSurface) {
        pairs.push({
          stateId: path.targetStateId,
          surfaceId: targetSurface.meaningId,
          surfaceLabel: targetSurface.teachingLabel,
        });
      }
    }
  }

  return pairs;
}

// ── Feasibility Pre-Pass ────────────────────────────────────────────

/**
 * Check whether deal constraints are satisfiable within a given attempt limit.
 *
 * Used as a pre-filter before including (state, surface) pairs in the
 * coverage plan. Infeasible pairs are reported as convention definition
 * issues rather than test failures.
 */
export function checkTargetFeasibility(
  dealConstraints: DealConstraints,
  maxAttempts: number = 500,
): boolean {
  try {
    generateDeal({ ...dealConstraints, maxAttempts });
    return true;
  } catch {
    return false;
  }
}

// ── Staleness Guard ─────────────────────────────────────────────────

/**
 * Compute a hash of the FSM topology + surface definitions.
 *
 * Compare before each test run to detect FSM changes that would
 * invalidate a cached test plan. Uses a simple string hash (FNV-1a)
 * over state IDs, transition IDs, surface group IDs, and surface
 * meaning IDs — fast enough to run on every invocation.
 */
export function computeCoverageHash(bundle: ConventionBundle): string {
  const parts: string[] = [];
  const machine = bundle.conversationMachine;
  if (machine) {
    // State structure
    for (const [stateId, state] of machine.states) {
      parts.push(`S:${stateId}:${state.surfaceGroupId ?? ""}:${state.parentId ?? ""}`);
      for (const t of state.transitions) {
        parts.push(`T:${t.transitionId}:${t.target}:${t.match.kind}`);
      }
    }
  }
  // Surface definitions
  for (const group of bundle.meaningSurfaces ?? []) {
    parts.push(`G:${group.groupId}`);
    for (const surface of group.surfaces) {
      parts.push(`F:${surface.meaningId}:${surface.clauses.length}`);
    }
  }
  return fnv1aHash(parts.join("|"));
}

/** FNV-1a hash → hex string. */
function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

// ── Observation Reconciliation ──────────────────────────────────────

/** Result of classifying an observed bid against surfaces at a state. */
export interface BidClassification {
  readonly surfaceId: string;
  readonly surfaceLabel: string;
  readonly confidence: "exact" | "ambiguous";
}

/**
 * Classify an observed bid against the surfaces active at a state.
 *
 * After a test session, the agent's actual bid is compared to the
 * surfaces' defaultCalls to determine which surface was exercised.
 * Returns null if no surface matches the bid.
 */
export function classifyBidAgainstSurfaces(
  call: Call,
  surfaces: readonly MeaningSurface[],
): BidClassification | null {
  const matches: MeaningSurface[] = [];
  for (const surface of surfaces) {
    const dc = surface.encoding.defaultCall;
    if (call.type !== dc.type) continue;
    if (call.type === "bid" && dc.type === "bid") {
      if (call.level === dc.level && call.strain === dc.strain) {
        matches.push(surface);
      }
    } else {
      // pass/double/redouble match by type
      matches.push(surface);
    }
  }

  if (matches.length === 0) return null;
  if (matches.length === 1) {
    return {
      surfaceId: matches[0]!.meaningId,
      surfaceLabel: matches[0]!.teachingLabel,
      confidence: "exact",
    };
  }
  // Multiple surfaces map to same call — ambiguous
  return {
    surfaceId: matches[0]!.meaningId,
    surfaceLabel: matches[0]!.teachingLabel,
    confidence: "ambiguous",
  };
}

// ── Optimized Coverage Manifest (Two-Phase Algorithm) ───────────────
//
// Phase 1: Leaf-first sweep — one target per (leaf, surface) pair.
//          Each target deterministically covers intermediate surfaces.
// Phase 2: Gap-fill — identify uncovered (state, surface) pairs and
//          generate targeted tests using greedy set-cover.

/**
 * Generate an optimized coverage manifest using the two-phase algorithm.
 *
 * Returns a plan that covers all feasible (state, surface) pairs with
 * near-minimal test sessions, driven by the tree LP lower bound.
 */
export function generateOptimizedManifest(
  bundle: ConventionBundle,
  options?: {
    /** Max deal-generation attempts for feasibility pre-pass. Default 500. */
    feasibilityAttempts?: number;
    /** Skip feasibility check (faster, but may include infeasible targets). */
    skipFeasibilityCheck?: boolean;
  },
): OptimizedCoverageManifest | null {
  const machine = bundle.conversationMachine;
  if (!machine) return null;

  const topology = computeTopology(machine);
  const surfaceMap = buildSurfaceMap(bundle);
  const maxAttempts = options?.feasibilityAttempts ?? 500;

  // ── Step 1: Enumerate the coverage universe ──────────────────────
  const universe = enumerateCoverageUniverse(bundle, surfaceMap, topology.reachableStates);
  const covered = new Set<string>(); // "stateId:surfaceId" keys
  const infeasiblePairs: SurfaceCoveragePair[] = [];
  const unreachableTargets: { stateId: string; reason: string }[] = [];

  function pairKey(stateId: string, surfaceId: string): string {
    return `${stateId}:${surfaceId}`;
  }

  // ── Step 2: Compute surface counts for tree LP ───────────────────
  const surfaceCounts = new Map<string, number>();
  for (const stateId of topology.reachableStates) {
    const state = machine.states.get(stateId);
    if (!state?.surfaceGroupId) continue;
    const surfaces = surfaceMap.get(state.surfaceGroupId);
    if (surfaces) {
      surfaceCounts.set(stateId, surfaces.length);
    }
  }

  // ── Step 3: Compute tree LP lower bound ──────────────────────────
  const treeLPResult = computeMinimalLeafMultiplicities(topology, surfaceCounts);

  // ── Step 4: Phase 1 — Leaf sweep ─────────────────────────────────
  // For each path-tree leaf with surfaces, generate one target per surface.
  const phase1Targets: SurfaceCoverageTarget[] = [];
  const children = buildPathTreeChildren(topology.paths);

  // Identify path-tree leaves
  const pathTreeLeaves: string[] = [];
  for (const stateId of topology.reachableStates) {
    if (stateId === machine.initialStateId) continue;
    if (!children.has(stateId) || children.get(stateId)!.length === 0) {
      pathTreeLeaves.push(stateId);
    }
  }

  for (const leafId of pathTreeLeaves) {
    const path = topology.paths.get(leafId);
    if (!path) {
      unreachableTargets.push({ stateId: leafId, reason: "No BFS path found" });
      continue;
    }

    const leafState = machine.states.get(leafId);
    const leafSurfaces = leafState?.surfaceGroupId
      ? surfaceMap.get(leafState.surfaceGroupId) ?? []
      : [];

    if (leafSurfaces.length === 0) {
      // Leaf with no surfaces — generate one target for state coverage
      const baseTarget = compilePathToTarget(path, machine, bundle, surfaceMap);
      const coveredPairsForPath = computePathCoveredPairs(path, machine, surfaceMap);

      // Check feasibility
      if (!options?.skipFeasibilityCheck && !checkTargetFeasibility(baseTarget.dealConstraints, maxAttempts)) {
        continue;
      }

      for (const pair of coveredPairsForPath) {
        covered.add(pairKey(pair.stateId, pair.surfaceId));
      }

      phase1Targets.push({
        ...baseTarget,
        targetSurfaceId: undefined,
        targetSurfaceLabel: undefined,
        coveredPairs: coveredPairsForPath,
        phase: "leaf-sweep",
      });
      continue;
    }

    // One target per surface at the leaf
    for (const surface of leafSurfaces) {
      const baseTarget = compilePathToTarget(path, machine, bundle, surfaceMap);

      // Tighten constraints for this specific surface
      const tightenedConstraints = injectSurfaceConstraints(
        baseTarget.dealConstraints,
        leafSurfaces,
        surface.meaningId,
        Seat.South,
      );

      // Check feasibility
      if (!options?.skipFeasibilityCheck && !checkTargetFeasibility(tightenedConstraints, maxAttempts)) {
        infeasiblePairs.push({
          stateId: leafId,
          surfaceId: surface.meaningId,
          surfaceLabel: surface.teachingLabel,
        });
        continue;
      }

      // Compute covered pairs (intermediate + this leaf surface)
      const coveredPairsForPath = computePathCoveredPairs(
        path, machine, surfaceMap, surface.meaningId,
      );

      for (const pair of coveredPairsForPath) {
        covered.add(pairKey(pair.stateId, pair.surfaceId));
      }

      phase1Targets.push({
        ...baseTarget,
        dealConstraints: tightenedConstraints,
        targetSurfaceId: surface.meaningId,
        targetSurfaceLabel: surface.teachingLabel,
        coveredPairs: coveredPairsForPath,
        phase: "leaf-sweep",
      });
    }
  }

  // ── Step 5: Phase 2 — Gap analysis + greedy fill ─────────────────
  const phase2Targets: SurfaceCoverageTarget[] = [];
  const uncoveredPairs: SurfaceCoveragePair[] = [];

  // Find uncovered (state, surface) pairs
  const gapPairs: SurfaceCoveragePair[] = [];
  for (const pair of universe) {
    if (!covered.has(pairKey(pair.stateId, pair.surfaceId))) {
      gapPairs.push(pair);
    }
  }

  // For each gap pair, generate a targeted test
  for (const gap of gapPairs) {
    const path = topology.paths.get(gap.stateId);
    if (!path) {
      uncoveredPairs.push(gap);
      continue;
    }

    const state = machine.states.get(gap.stateId);
    if (!state?.surfaceGroupId) {
      uncoveredPairs.push(gap);
      continue;
    }

    const surfaces = surfaceMap.get(state.surfaceGroupId) ?? [];
    const baseTarget = compilePathToTarget(path, machine, bundle, surfaceMap);

    // Tighten constraints to exercise the specific gap surface
    const tightenedConstraints = injectSurfaceConstraints(
      baseTarget.dealConstraints,
      surfaces,
      gap.surfaceId,
      Seat.South,
    );

    // Check feasibility
    if (!options?.skipFeasibilityCheck && !checkTargetFeasibility(tightenedConstraints, maxAttempts)) {
      infeasiblePairs.push(gap);
      continue;
    }

    // Compute covered pairs for this gap-fill target
    const coveredPairsForPath = computePathCoveredPairs(
      path, machine, surfaceMap, gap.surfaceId,
    );

    // Mark newly covered pairs
    const newlyCovered: SurfaceCoveragePair[] = [];
    for (const pair of coveredPairsForPath) {
      const key = pairKey(pair.stateId, pair.surfaceId);
      if (!covered.has(key)) {
        covered.add(key);
        newlyCovered.push(pair);
      }
    }

    // Only add if this target covers at least the gap pair
    if (newlyCovered.length > 0 || covered.has(pairKey(gap.stateId, gap.surfaceId))) {
      phase2Targets.push({
        ...baseTarget,
        dealConstraints: tightenedConstraints,
        targetSurfaceId: gap.surfaceId,
        targetSurfaceLabel: gap.surfaceLabel,
        coveredPairs: coveredPairsForPath,
        phase: "gap-fill",
      });
    } else {
      uncoveredPairs.push(gap);
    }
  }

  const allTargets = [...phase1Targets, ...phase2Targets];
  const coverageHash = computeCoverageHash(bundle);

  return {
    bundleId: bundle.id,
    bundleName: bundle.name,
    totalStates: topology.reachableStates.size,
    totalSurfacePairs: universe.length,
    phase1Targets,
    phase2Targets,
    allTargets,
    uncoveredPairs,
    infeasiblePairs,
    treeLPBound: treeLPResult.totalSessions,
    coverageHash,
    unreachableTargets,
  };
}
