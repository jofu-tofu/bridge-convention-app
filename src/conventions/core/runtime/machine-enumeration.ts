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
      if (match.level < 1 || match.level > 7) return null;
      return {
        type: "bid",
        level: match.level as 1 | 2 | 3 | 4 | 5 | 6 | 7,
        strain: match.strain,
      };
    case "pass":
      return { type: "pass" };
    case "opponent-action": {
      if (match.callType === "double") return match.callHint ?? { type: "double" };
      if (match.callType === "redouble") return match.callHint ?? { type: "redouble" };
      if (match.callType === "bid" && match.level !== undefined && match.strain !== undefined) {
        if (match.level < 1 || match.level > 7) return null;
        return match.callHint ?? {
          type: "bid",
          level: match.level as 1 | 2 | 3 | 4 | 5 | 6 | 7,
          strain: match.strain,
        };
      }
      // Generic opponent-action without specific call — use callHint or default to double
      return match.callHint ?? { type: "double" };
    }
    case "any-bid":
      return match.callHint ?? null;
    case "submachine-return":
      return null;
    case "predicate":
      return match.callHint ?? null;
  }
}

/** Infer the seat role a transition expects. */
function inferTransitionRole(
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
function buildForwardEdges(
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
function computeShortestPaths(
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

  // BFS queue — use index to avoid O(n) shift()
  const queue: string[] = [initial];
  let queueIdx = 0;
  const visited = new Set<string>([initial]);

  while (queueIdx < queue.length) {
    const currentId = queue[queueIdx]!;
    queueIdx++;
    const currentPath = paths.get(currentId)!;
    const state = machine.states.get(currentId);
    if (!state) continue;

    // Collect transitions: own + inherited (descendant-first for natural paths)
    const allTransitions = collectInheritedTransitions(machine, currentId);

    for (const transition of allTransitions) {
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

/** Collect transitions from a state including inherited, descendant-first. */
function collectInheritedTransitions(
  machine: ConversationMachine,
  stateId: string,
): readonly MachineTransition[] {
  return collectAncestorChain(machine.states, stateId).flatMap((s) => s.transitions);
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

// ── Tree LP (Minimal Leaf Multiplicities) ───────────────────────────
//
// Solves the covering LP on the BFS path tree to compute the minimum
// number of test sessions needed for complete (state, surface) coverage.
//
// The LP:
//   Minimize  Σ_{l ∈ leaves} t(l)
//   s.t.  ∀s ∈ V: Σ_{l ∈ leaves(subtree(s))} t(l) ≥ surfaceCount(s)
//         t(l) ≥ 0, integer
//
// Because the constraints are laminar (nested subtrees), the LP
// relaxation has zero integrality gap and can be solved in O(|V|) time
// via a single bottom-up pass.

/** Result of the tree LP computation. */
export interface TreeLPResult {
  /** Total minimum test sessions needed. */
  readonly totalSessions: number;
  /** Multiplicity per leaf: how many sessions target each leaf. */
  readonly leafMultiplicities: ReadonlyMap<string, number>;
  /** States where surface count exceeds natural subtree traffic (cost drivers). */
  readonly bottleneckStates: readonly {
    readonly stateId: string;
    readonly surfaceCount: number;
    readonly subtreeTraffic: number;
    readonly deficit: number;
  }[];
}

/**
 * Build a parent→children map from the BFS path tree.
 *
 * In the BFS path tree, the parent of state S is the second-to-last
 * state in its BFS path (path.stateIds[path.stateIds.length - 2]).
 */
export function buildPathTreeChildren(
  paths: ReadonlyMap<string, StatePath>,
): Map<string, string[]> {
  const children = new Map<string, string[]>();
  for (const [stateId, path] of paths) {
    if (path.stateIds.length < 2) continue; // root has no parent
    const parentId = path.stateIds[path.stateIds.length - 2]!;
    let siblings = children.get(parentId);
    if (!siblings) {
      siblings = [];
      children.set(parentId, siblings);
    }
    siblings.push(stateId);
  }
  return children;
}

/**
 * Compute the set of path-tree leaves for each state's subtree.
 *
 * A path-tree leaf is a state with no children in the BFS path tree
 * (typically terminal states, but also unreachable-from-here states).
 */
function computeSubtreeLeaves(
  root: string,
  children: ReadonlyMap<string, readonly string[]>,
): Map<string, Set<string>> {
  const subtreeLeaves = new Map<string, Set<string>>();

  function dfs(nodeId: string): Set<string> {
    const kids = children.get(nodeId);
    if (!kids || kids.length === 0) {
      // Leaf node
      const leafSet = new Set([nodeId]);
      subtreeLeaves.set(nodeId, leafSet);
      return leafSet;
    }
    const combined = new Set<string>();
    for (const child of kids) {
      for (const leaf of dfs(child)) {
        combined.add(leaf);
      }
    }
    subtreeLeaves.set(nodeId, combined);
    return combined;
  }

  dfs(root);
  return subtreeLeaves;
}

/**
 * Compute the provably minimal number of test sessions needed to cover
 * all (state, surface) pairs via the tree LP.
 *
 * @param topology - The FSM topology (from computeTopology)
 * @param surfaceCounts - Map of stateId → number of meaning surfaces at that state.
 *                        States not in the map are treated as having 0 surfaces.
 * @returns TreeLPResult with leaf multiplicities and bottleneck analysis
 */
export function computeMinimalLeafMultiplicities(
  topology: MachineTopology,
  surfaceCounts: ReadonlyMap<string, number>,
): TreeLPResult {
  const { paths } = topology;
  const root = [...paths.entries()].find(
    ([, p]) => p.stateIds.length === 1,
  )?.[0];
  if (!root) {
    return { totalSessions: 0, leafMultiplicities: new Map(), bottleneckStates: [] };
  }

  const children = buildPathTreeChildren(paths);
  const subtreeLeafSets = computeSubtreeLeaves(root, children);

  // Identify path-tree leaves (states with no children in the BFS tree)
  const pathTreeLeaves = new Set<string>();
  for (const stateId of topology.reachableStates) {
    if (!children.has(stateId) || children.get(stateId)!.length === 0) {
      pathTreeLeaves.add(stateId);
    }
  }

  // Initialize leaf multiplicities: t(l) = surfaceCount(l) or 0
  const leafMult = new Map<string, number>();
  for (const leafId of pathTreeLeaves) {
    leafMult.set(leafId, surfaceCounts.get(leafId) ?? 0);
  }

  // Bottom-up pass: post-order traversal via DFS
  const bottleneckStates: {
    stateId: string;
    surfaceCount: number;
    subtreeTraffic: number;
    deficit: number;
  }[] = [];

  function postOrder(nodeId: string): void {
    const kids = children.get(nodeId);
    if (kids) {
      for (const child of kids) {
        postOrder(child);
      }
    }

    // Compute current subtree traffic
    const leaves = subtreeLeafSets.get(nodeId);
    if (!leaves || leaves.size === 0) return;

    let traffic = 0;
    for (const leafId of leaves) {
      traffic += leafMult.get(leafId) ?? 0;
    }

    const needed = surfaceCounts.get(nodeId) ?? 0;
    if (traffic < needed) {
      const deficit = needed - traffic;
      bottleneckStates.push({
        stateId: nodeId,
        surfaceCount: needed,
        subtreeTraffic: traffic,
        deficit,
      });

      // Distribute deficit to a leaf in the subtree
      // Pick the leaf with the smallest current multiplicity for balance
      let minLeaf: string | null = null;
      let minMult = Infinity;
      for (const leafId of leaves) {
        const m = leafMult.get(leafId) ?? 0;
        if (m < minMult) {
          minMult = m;
          minLeaf = leafId;
        }
      }
      if (minLeaf) {
        leafMult.set(minLeaf, (leafMult.get(minLeaf) ?? 0) + deficit);
      }
    }
  }

  postOrder(root);

  // Compute total sessions
  let totalSessions = 0;
  for (const [, mult] of leafMult) {
    totalSessions += mult;
  }

  return {
    totalSessions,
    leafMultiplicities: leafMult,
    bottleneckStates,
  };
}
