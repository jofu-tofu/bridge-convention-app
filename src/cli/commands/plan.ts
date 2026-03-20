// ── CLI plan command ────────────────────────────────────────────────

import {
  generateProtocolCoverageManifest,
  enumerateBaseTrackStates,
  getBaseModules,
} from "../../conventions/core";
import { createSpecStrategy } from "../../bootstrap/strategy-factory";
import { callsMatch } from "../../engine/call-helpers";

import type { Flags, OpponentMode, Vulnerability, ConventionSpec, Call } from "../shared";
import {
  callKey,
  requireArg, optionalNumericArg,
  resolveSpec, resolveBundle, generateSeededDeal, resolveUserSeat,
  resolveAuction, buildContext, nextSeatClockwise,
} from "../shared";
import { buildAtomCallMap, runSinglePlaythrough } from "../playthrough";

function getExpectedCallForAtom(
  spec: ConventionSpec,
  atom: { baseStateId: string; meaningId: string },
): Call | null {
  for (const track of getBaseModules(spec)) {
    const state = track.states[atom.baseStateId];
    if (!state?.surface) continue;
    const fragment = spec.surfaces[state.surface];
    if (!fragment) continue;
    for (const surface of fragment.surfaces) {
      if (surface.meaningId === atom.meaningId) {
        return surface.encoding?.defaultCall ?? null;
      }
    }
  }
  return null;
}

export function runPlan(flags: Flags, vuln: Vulnerability, opponentMode: OpponentMode): void {
  const bundleId = requireArg(flags, "bundle");
  const minAgentCount = optionalNumericArg(flags, "agents") ?? 3;
  const targetCoverage = optionalNumericArg(flags, "coverage") ?? 2;
  const maxSeeds = optionalNumericArg(flags, "max-seeds") ?? 500;
  const baseSeed = optionalNumericArg(flags, "seed") ?? 0;
  const maxAtomsPerAgent = optionalNumericArg(flags, "max-atoms") ?? 8;
  const maxSeedsPerAgent = optionalNumericArg(flags, "max-seeds-per-agent") ?? 5;

  const spec = resolveSpec(bundleId);
  const bundle = resolveBundle(bundleId);
  const strategy = createSpecStrategy(spec);

  // All atoms from coverage manifest
  const manifest = generateProtocolCoverageManifest(spec);
  const allAtoms = [...manifest.baseAtoms, ...manifest.protocolAtoms];

  // Build BFS depth + parent info for each state
  const stateInfo = new Map<string, {
    depth: number;
    parentStateId: string | null;
    transitionBid: string | null;
  }>();

  for (const track of getBaseModules(spec)) {
    const paths = enumerateBaseTrackStates(track);
    for (const [stateId, path] of paths) {
      const depth = Math.max(0, path.transitions.length - 1);
      let parentStateId: string | null = null;
      let transitionBid: string | null = null;
      if (path.transitions.length >= 2) {
        const lastT = path.transitions[path.transitions.length - 1]!;
        parentStateId = lastT.fromStateId;
        transitionBid = lastT.call ? callKey(lastT.call) : null;
      }
      stateInfo.set(stateId, { depth, parentStateId, transitionBid });
    }
  }

  // Build dependency graph for stop-on-error propagation
  const dependencyGraph: Record<string, {
    depth: number;
    parentStateId: string | null;
    children: string[];
  }> = {};

  for (const [stateId, info] of stateInfo) {
    dependencyGraph[stateId] = {
      depth: info.depth,
      parentStateId: info.parentStateId,
      children: [],
    };
  }

  for (const [stateId, info] of stateInfo) {
    if (info.parentStateId && dependencyGraph[info.parentStateId]) {
      dependencyGraph[info.parentStateId]!.children.push(stateId);
    }
  }

  // For each atom: find seeds where the strategy recommends the expected bid
  type AtomPlan = {
    atomId: string;
    stateId: string;
    surfaceId: string;
    meaningId: string;
    meaningLabel: string;
    expectedBid: string;
    depth: number;
    parentStateId: string | null;
    transitionBid: string | null;
    seeds: number[];
  };

  const atomPlans: AtomPlan[] = [];

  for (const atom of allAtoms) {
    const expectedCall = getExpectedCallForAtom(spec, atom);
    if (!expectedCall) continue;

    const info = stateInfo.get(atom.baseStateId);
    const depth = info?.depth ?? 0;
    const parentStateId = info?.parentStateId ?? null;
    const transitionBid = info?.transitionBid ?? null;

    const seeds: number[] = [];

    for (let s = baseSeed; s < baseSeed + maxSeeds && seeds.length < targetCoverage; s++) {
      try {
        const deal = generateSeededDeal(bundle, s, vuln);
        const userSeat = resolveUserSeat(bundle, deal);
        const { auction, targeted } = resolveAuction(bundle, spec, deal, atom.baseStateId, userSeat);
        if (!targeted) continue;

        const activeSeat = auction.entries.length > 0
          ? nextSeatClockwise(auction.entries[auction.entries.length - 1]!.seat)
          : userSeat;
        const hand = deal.hands[activeSeat];
        const context = buildContext(hand, auction, activeSeat, vuln);
        const result = strategy.suggest(context);

        if (result && callsMatch(result.call, expectedCall)) {
          seeds.push(s);
        }
      } catch {
        // Skip seeds that error
      }
    }

    atomPlans.push({
      atomId: `${atom.baseStateId}/${atom.surfaceId}/${atom.meaningId}`,
      stateId: atom.baseStateId,
      surfaceId: atom.surfaceId,
      meaningId: atom.meaningId,
      meaningLabel: atom.meaningLabel,
      expectedBid: callKey(expectedCall),
      depth,
      parentStateId,
      transitionBid,
      seeds,
    });
  }

  // Sort by depth (BFS order)
  atomPlans.sort((a, b) => a.depth - b.depth);

  // ── Phase 1: Distribute atoms across agents in subtree-preserving batches ──
  // Find the root stateId for each atom by tracing up the dependency graph
  function findRoot(stateId: string): string {
    let cur = stateId;
    while (dependencyGraph[cur]?.parentStateId) {
      cur = dependencyGraph[cur]!.parentStateId!;
    }
    return cur;
  }

  // Index atoms by stateId for fast lookup (only atoms with seeds — uncovered atoms can't be evaluated)
  const atomsByState = new Map<string, AtomPlan[]>();
  for (const ap of atomPlans) {
    if (ap.seeds.length === 0) continue;
    if (!atomsByState.has(ap.stateId)) atomsByState.set(ap.stateId, []);
    atomsByState.get(ap.stateId)!.push(ap);
  }

  // Collect all atoms in a subtree rooted at stateId
  function collectSubtreeAtoms(stateId: string): AtomPlan[] {
    const result = [...(atomsByState.get(stateId) ?? [])];
    const children = dependencyGraph[stateId]?.children ?? [];
    for (const child of children) {
      result.push(...collectSubtreeAtoms(child));
    }
    return result;
  }

  // Build assignable chunks: recursively split large subtrees at child boundaries
  // to produce groups small enough for balanced distribution, while keeping
  // parent-child atoms together within each chunk.
  const coveredAtomCount = atomPlans.filter((a) => a.seeds.length > 0).length;
  // Auto-scale: ensure no agent exceeds maxAtomsPerAgent
  const phase1AgentCount = Math.max(minAgentCount, Math.ceil(coveredAtomCount / maxAtomsPerAgent));
  const idealChunkSize = Math.ceil(coveredAtomCount / Math.max(phase1AgentCount, 1));

  type AtomChunk = { rootState: string; atoms: AtomPlan[] };

  function splitIntoChunks(stateId: string): AtomChunk[] {
    const allAtoms = collectSubtreeAtoms(stateId);
    if (allAtoms.length === 0) return [];

    const children = dependencyGraph[stateId]?.children ?? [];
    // If this subtree fits in one agent's share, or has no children to split on, keep it whole
    if (allAtoms.length <= idealChunkSize || children.length === 0) {
      return [{ rootState: stateId, atoms: allAtoms }];
    }

    // Atoms directly at this state (not in any child subtree)
    const directAtoms = atomsByState.get(stateId) ?? [];

    // Recursively split each child subtree
    const childChunks: AtomChunk[] = [];
    for (const child of children) {
      childChunks.push(...splitIntoChunks(child));
    }

    // If there are direct atoms at this state, attach them to the largest child chunk
    // (they share the dependency relationship most closely)
    if (directAtoms.length > 0) {
      if (childChunks.length > 0) {
        const largest = childChunks.reduce((a, b) =>
          a.atoms.length >= b.atoms.length ? a : b,
        );
        largest.atoms.unshift(...directAtoms);
      } else {
        childChunks.push({ rootState: stateId, atoms: directAtoms });
      }
    }

    return childChunks;
  }

  // Build chunks from all root states
  const roots = new Set<string>();
  for (const ap of atomPlans) {
    roots.add(findRoot(ap.stateId));
  }

  let allChunks: AtomChunk[] = [];
  for (const root of roots) {
    allChunks.push(...splitIntoChunks(root));
  }

  // Final pass: split any remaining oversized chunks into idealChunkSize pieces.
  // This handles linear chains where subtree-splitting can't produce multiple chunks.
  // Atoms at the same BFS depth are independent, so splitting is safe.
  const refined: AtomChunk[] = [];
  for (const chunk of allChunks) {
    if (chunk.atoms.length <= idealChunkSize) {
      refined.push(chunk);
    } else {
      // Sort by depth so stop-on-error still works within each sub-chunk
      chunk.atoms.sort((a, b) => a.depth - b.depth);
      for (let i = 0; i < chunk.atoms.length; i += idealChunkSize) {
        refined.push({
          rootState: chunk.rootState,
          atoms: chunk.atoms.slice(i, i + idealChunkSize),
        });
      }
    }
  }
  allChunks = refined;

  // Sort chunks largest-first for greedy assignment
  allChunks.sort((a, b) => b.atoms.length - a.atoms.length);

  // Greedy assignment: assign each chunk to the agent with the fewest eval calls
  const phase1Agents: { agentIndex: number; atoms: AtomPlan[]; estimatedEvalCalls: number }[] = [];
  for (let i = 0; i < phase1AgentCount; i++) {
    phase1Agents.push({ agentIndex: i, atoms: [], estimatedEvalCalls: 0 });
  }

  for (const chunk of allChunks) {
    const minAgent = phase1Agents.reduce((a, b) =>
      a.estimatedEvalCalls <= b.estimatedEvalCalls ? a : b,
    );
    minAgent.atoms.push(...chunk.atoms);
    minAgent.estimatedEvalCalls += chunk.atoms.length * targetCoverage;
  }

  // Re-sort each agent's atoms by BFS depth for correct evaluation order
  for (const agent of phase1Agents) {
    agent.atoms.sort((a, b) => a.depth - b.depth);
  }

  // Build per-agent dependency subgraphs (only states relevant to their atoms)
  function buildSubgraph(atoms: AtomPlan[]): typeof dependencyGraph {
    const relevantStates = new Set<string>();
    for (const ap of atoms) {
      // Trace the full path from this atom's state to the root
      let cur: string | null = ap.stateId;
      while (cur) {
        relevantStates.add(cur);
        cur = dependencyGraph[cur]?.parentStateId ?? null;
      }
      // Include children of this state
      const entry = dependencyGraph[ap.stateId];
      if (entry) {
        for (const child of entry.children) relevantStates.add(child);
      }
    }
    const subgraph: typeof dependencyGraph = {};
    for (const stateId of relevantStates) {
      const entry = dependencyGraph[stateId];
      if (entry) {
        subgraph[stateId] = {
          depth: entry.depth,
          parentStateId: entry.parentStateId,
          children: entry.children.filter((c) => relevantStates.has(c)),
        };
      }
    }
    return subgraph;
  }

  // ── Phase 2: Playthrough seed selection ──
  const atomCallMap = buildAtomCallMap(spec);
  const uniqueSeeds = [...new Set(atomPlans.flatMap((a) => a.seeds))];

  const playthroughInfo: { seed: number; userSteps: number; atomsCovered: string[] }[] = [];
  for (const seed of uniqueSeeds) {
    try {
      const result = runSinglePlaythrough(bundle, spec, seed, atomCallMap, vuln, opponentMode);
      const userSteps = result.steps.filter((s) => s.isUserStep);
      playthroughInfo.push({
        seed,
        userSteps: userSteps.length,
        atomsCovered: [...result.atomsCovered],
      });
    } catch {
      // Skip seeds that error during playthrough
    }
  }

  // Distribute across agents balanced by step count
  // Auto-scale: ensure no agent exceeds maxSeedsPerAgent
  const phase2AgentCount = Math.max(minAgentCount, Math.ceil(playthroughInfo.length / maxSeedsPerAgent));
  const phase2Agents: { agentIndex: number; seeds: number[]; estimatedSteps: number }[] = [];
  for (let i = 0; i < phase2AgentCount; i++) {
    phase2Agents.push({ agentIndex: i, seeds: [], estimatedSteps: 0 });
  }

  // Sort by step count descending — assign largest first for better balance
  playthroughInfo.sort((a, b) => b.userSteps - a.userSteps);

  for (const pt of playthroughInfo) {
    // Find the agent with fewest steps that hasn't hit the seed cap
    const eligible = phase2Agents.filter((a) => a.seeds.length < maxSeedsPerAgent);
    if (eligible.length === 0) {
      // All agents at cap — add a new overflow agent
      const overflow = { agentIndex: phase2Agents.length, seeds: [pt.seed], estimatedSteps: pt.userSteps };
      phase2Agents.push(overflow);
    } else {
      const minAgent = eligible.reduce((a, b) =>
        a.estimatedSteps <= b.estimatedSteps ? a : b,
      );
      minAgent.seeds.push(pt.seed);
      minAgent.estimatedSteps += pt.userSteps;
    }
  }

  // Stats
  const covered = atomPlans.filter((a) => a.seeds.length >= targetCoverage).length;
  const uncovered = atomPlans
    .filter((a) => a.seeds.length < targetCoverage)
    .map((a) => ({ atomId: a.atomId, seedsFound: a.seeds.length }));

  console.log(JSON.stringify({
    bundle: bundleId,
    targetCoverage,
    totalAtoms: atomPlans.length,
    atomsCoveredAtTarget: covered,
    uncoveredAtoms: uncovered,
    maxDepth: Math.max(0, ...atomPlans.map((a) => a.depth)),

    // Phase 1: Per-atom targeted evaluation (orchestrator-private, parallelized)
    phase1: {
      description: "Per-atom targeted evaluation distributed across parallel agents. Each agent evaluates its batch of atoms (each atom × coverage seeds), walking in BFS order with stop-on-error via its dependency subgraph. Subtree-preserving assignment keeps parent-child atoms in the same agent.",
      atoms: atomPlans.map((ap) => ({
        atomId: ap.atomId,
        stateId: ap.stateId,
        surfaceId: ap.surfaceId,
        meaningId: ap.meaningId,
        meaningLabel: ap.meaningLabel,
        expectedBid: ap.expectedBid,
        depth: ap.depth,
        parentStateId: ap.parentStateId,
        transitionBid: ap.transitionBid,
        seeds: ap.seeds,
      })),
      dependencyGraph,
      agents: phase1Agents
        .filter((a) => a.atoms.length > 0)
        .map((a) => ({
        agentIndex: a.agentIndex,
        bundleId,
        estimatedEvalCalls: a.estimatedEvalCalls,
        atomCount: a.atoms.length,
        atoms: a.atoms.map((ap) => ({
          atomId: ap.atomId,
          stateId: ap.stateId,
          expectedBid: ap.expectedBid,
          depth: ap.depth,
          seeds: ap.seeds,
        })),
        dependencySubgraph: buildSubgraph(a.atoms),
      })),
    },

    // Phase 2: Playthrough integration testing (agent-driven)
    phase2: {
      description: "Playthrough integration testing. Agents run full playthroughs end-to-end using `play` command. Seeds are from Phase 1, balanced by step count.",
      totalPlaythroughSeeds: playthroughInfo.length,
      agents: phase2Agents
        .filter((a) => a.seeds.length > 0)
        .map((a) => ({
        agentIndex: a.agentIndex,
        bundleId,
        seeds: a.seeds,
        estimatedSteps: a.estimatedSteps,
      })),
    },
  }, null, 2));
}
