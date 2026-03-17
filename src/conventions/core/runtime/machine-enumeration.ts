// ── FSM Path Enumeration ────────────────────────────────────────────
//
// Generic utilities for enumerating reachable states, computing concrete
// paths from the initial state, and converting transition matches to
// Call objects.  These are the foundation for coverage-driven testing:
// instead of hoping random seeds hit interesting FSM states, we enumerate
// every state and derive the auction + constraints needed to reach it.

import type { Call, ContractBid } from "../../../engine/types";
import type {
  ConversationMachine,
  MachineTransition,
  TransitionMatch,
} from "./machine-types";
import { collectAncestorChain } from "./machine-evaluator";

// ── Types ───────────────────────────────────────────────────────────

/** A concrete path from the initial state to a target state. */
export interface StatePath {
  /** Ordered list of state IDs visited (includes initial and target). */
  readonly stateIds: readonly string[];
  /** Transitions fired along the path (one fewer than stateIds). */
  readonly transitions: readonly PathTransition[];
  /** The target state ID (last in stateIds). */
  readonly targetStateId: string;
}

/** A single transition step in a path. */
export interface PathTransition {
  readonly transitionId: string;
  readonly fromStateId: string;
  readonly toStateId: string;
  readonly match: TransitionMatch;
  /** The concrete call that would fire this transition, or null if
   *  the match is a predicate/submachine-return (not statically resolvable). */
  readonly call: Call | null;
  /** Which seat role fires this transition. */
  readonly role: "self" | "partner" | "opponent";
}

/** Summary of an FSM's reachable structure. */
export interface MachineTopology {
  readonly machineId: string;
  readonly reachableStates: ReadonlySet<string>;
  readonly terminalStates: ReadonlySet<string>;
  /** States with a surfaceGroupId (where bidding decisions happen). */
  readonly surfaceStates: ReadonlySet<string>;
  /** Forward edge map: stateId → set of target stateIds (includes inherited). */
  readonly forwardEdges: ReadonlyMap<string, ReadonlySet<string>>;
  /** One concrete path per reachable state (shortest by BFS). */
  readonly paths: ReadonlyMap<string, StatePath>;
}

// ── Reachability ────────────────────────────────────────────────────

/** Get all states reachable from the initial state via transition edges. */
export function getReachableStates(machine: ConversationMachine): Set<string> {
  const reachable = new Set<string>();
  function visit(stateId: string): void {
    if (reachable.has(stateId)) return;
    reachable.add(stateId);
    const state = machine.states.get(stateId);
    if (!state) return;
    for (const t of state.transitions) {
      visit(t.target);
    }
    if (state.submachineRef) {
      visit(state.submachineRef.returnTarget);
    }
  }
  visit(machine.initialStateId);
  return reachable;
}

/** Identify terminal states: no own transitions or all own transitions are self-loops. */
export function getTerminalStates(
  machine: ConversationMachine,
  reachable?: ReadonlySet<string>,
): Set<string> {
  const terminal = new Set<string>();
  const stateIds = reachable ?? machine.states.keys();
  for (const stateId of stateIds) {
    const state = machine.states.get(stateId);
    if (!state) continue;
    if (state.transitions.length === 0) {
      terminal.add(stateId);
    } else if (state.transitions.every((t) => t.target === stateId)) {
      terminal.add(stateId);
    }
  }
  return terminal;
}

/** Get states that have a surfaceGroupId (where bidding decisions occur). */
export function getSurfaceStates(
  machine: ConversationMachine,
  reachable?: ReadonlySet<string>,
): Set<string> {
  const surface = new Set<string>();
  const stateIds = reachable ?? machine.states.keys();
  for (const stateId of stateIds) {
    const state = machine.states.get(stateId);
    if (state?.surfaceGroupId) {
      surface.add(stateId);
    }
  }
  return surface;
}

// ── Transition → Call Conversion ────────────────────────────────────

/** Convert a TransitionMatch to a concrete Call, if statically possible. */
export function matchToCall(match: TransitionMatch): Call | null {
  switch (match.kind) {
    case "call":
      return {
        type: "bid",
        level: match.level as 1 | 2 | 3 | 4 | 5 | 6 | 7,
        strain: match.strain,
      };
    case "pass":
      return { type: "pass" };
    case "opponent-action": {
      if (match.callType === "double") return { type: "double" };
      if (match.callType === "redouble") return { type: "redouble" };
      if (match.callType === "bid" && match.level !== undefined && match.strain !== undefined) {
        return {
          type: "bid",
          level: match.level as 1 | 2 | 3 | 4 | 5 | 6 | 7,
          strain: match.strain,
        };
      }
      // Generic opponent-action without specific call — use double as default
      if (!match.callType) return { type: "double" };
      return null;
    }
    case "any-bid":
    case "predicate":
    case "submachine-return":
      return null;
  }
}

/** Infer the seat role a transition expects. */
export function inferTransitionRole(
  transition: MachineTransition,
): "self" | "partner" | "opponent" {
  if (transition.allowedRoles && transition.allowedRoles.length > 0) {
    return transition.allowedRoles[0]!;
  }
  if (transition.match.kind === "opponent-action") {
    return "opponent";
  }
  if (transition.match.kind === "pass" && transition.match.seatRole) {
    return transition.match.seatRole;
  }
  // Default: self for call/any-bid/pass
  return "self";
}

// ── Forward Edge Map ────────────────────────────────────────────────

/** Build a forward edge map including inherited parent transitions. */
export function buildForwardEdges(
  machine: ConversationMachine,
  reachable: ReadonlySet<string>,
): Map<string, Set<string>> {
  const edges = new Map<string, Set<string>>();
  for (const stateId of reachable) {
    const targets = new Set<string>();
    const chain = collectAncestorChain(machine.states, stateId);
    for (const ancestor of chain) {
      for (const t of ancestor.transitions) {
        targets.add(t.target);
      }
    }
    const state = machine.states.get(stateId);
    if (state?.submachineRef) {
      targets.add(state.submachineRef.returnTarget);
    }
    edges.set(stateId, targets);
  }
  return edges;
}

// ── BFS Path Computation ────────────────────────────────────────────

/**
 * BFS from the initial state to compute one shortest path to every
 * reachable state.  Each step records the transition + concrete call.
 *
 * The paths follow *own* transitions only (not inherited parent transitions)
 * to produce the most natural auction sequences.  When no own-transition
 * path exists, falls back to inherited transitions.
 */
export function computeShortestPaths(
  machine: ConversationMachine,
  reachable: ReadonlySet<string>,
): Map<string, StatePath> {
  const paths = new Map<string, StatePath>();
  const initial = machine.initialStateId;

  // Seed: initial state has a trivial path
  paths.set(initial, {
    stateIds: [initial],
    transitions: [],
    targetStateId: initial,
  });

  // BFS queue: [stateId, depth]
  const queue: string[] = [initial];
  const visited = new Set<string>([initial]);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentPath = paths.get(currentId)!;
    const state = machine.states.get(currentId);
    if (!state) continue;

    // Collect transitions: own + inherited (own first for natural paths)
    const allTransitions = collectTransitionsWithOrigin(machine, currentId);

    for (const { transition, originStateId: _origin } of allTransitions) {
      const target = transition.target;
      if (visited.has(target)) continue;
      if (!reachable.has(target)) continue;

      // Skip submachine-return (handled separately)
      if (transition.match.kind === "submachine-return") continue;

      visited.add(target);

      const call = matchToCall(transition.match);
      const role = inferTransitionRole(transition);

      const step: PathTransition = {
        transitionId: transition.transitionId,
        fromStateId: currentId,
        toStateId: target,
        match: transition.match,
        call,
        role,
      };

      const newPath: StatePath = {
        stateIds: [...currentPath.stateIds, target],
        transitions: [...currentPath.transitions, step],
        targetStateId: target,
      };

      paths.set(target, newPath);
      queue.push(target);
    }

    // Handle submachineRef: treat returnTarget as reachable via this state
    if (state.submachineRef && !visited.has(state.submachineRef.returnTarget)) {
      const returnTarget = state.submachineRef.returnTarget;
      if (reachable.has(returnTarget)) {
        visited.add(returnTarget);
        paths.set(returnTarget, {
          stateIds: [...currentPath.stateIds, returnTarget],
          transitions: [...currentPath.transitions],
          targetStateId: returnTarget,
        });
        queue.push(returnTarget);
      }
    }
  }

  return paths;
}

/** Collect transitions from a state including inherited, tagged with origin. */
function collectTransitionsWithOrigin(
  machine: ConversationMachine,
  stateId: string,
): { transition: MachineTransition; originStateId: string }[] {
  const result: { transition: MachineTransition; originStateId: string }[] = [];
  const chain = collectAncestorChain(machine.states, stateId);
  for (const ancestor of chain) {
    for (const t of ancestor.transitions) {
      result.push({ transition: t, originStateId: ancestor.stateId });
    }
  }
  return result;
}

// ── Full Topology ───────────────────────────────────────────────────

/** Compute the full topology of a machine: reachable states, terminals,
 *  surface states, forward edges, and shortest paths. */
export function computeTopology(machine: ConversationMachine): MachineTopology {
  const reachableStates = getReachableStates(machine);
  const terminalStates = getTerminalStates(machine, reachableStates);
  const surfaceStates = getSurfaceStates(machine, reachableStates);
  const forwardEdges = buildForwardEdges(machine, reachableStates);
  const paths = computeShortestPaths(machine, reachableStates);

  return {
    machineId: machine.machineId,
    reachableStates,
    terminalStates,
    surfaceStates,
    forwardEdges,
    paths,
  };
}

// ── Call Serialization ──────────────────────────────────────────────

/** Serialize a Call to a bid string ("1NT", "P", "X", "XX"). */
export function callToString(call: Call): string {
  if (call.type === "pass") return "P";
  if (call.type === "double") return "X";
  if (call.type === "redouble") return "XX";
  const bid = call as ContractBid;
  return `${bid.level}${bid.strain}`;
}

/** Extract the auction prefix (bid strings) from a path. */
export function pathToAuctionPrefix(path: StatePath): string[] {
  const bids: string[] = [];
  for (const step of path.transitions) {
    if (step.call) {
      bids.push(callToString(step.call));
    }
  }
  return bids;
}
