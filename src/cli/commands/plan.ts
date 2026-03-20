// ── CLI plan command ────────────────────────────────────────────────

import {
  generateProtocolCoverageManifest,
  enumerateBaseTrackStates,
  getBaseModules,
} from "../../conventions/core";
import { createSpecStrategy } from "../../bootstrap/strategy-factory";
import { callsMatch } from "../../engine/call-helpers";

import type { Flags, OpponentMode, Vulnerability, ConventionSpec, Call, ScenarioConfig } from "../shared";
import {
  callKey,
  requireArg, optionalNumericArg,
  resolveSpec, resolveSystem, generateSeededDeal, resolveUserSeat,
  resolveAuction, buildContext, nextSeatClockwise, assignSeedScenario,
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

// ── Types ───────────────────────────────────────────────────────────

type SeedInfo = {
  seed: number;
  vulnerability: Vulnerability;
  opponents: OpponentMode;
};

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
  seeds: SeedInfo[];
};

// ── Public entry point ──────────────────────────────────────────────

export function runPlan(flags: Flags, scenarioConfig: ScenarioConfig): void {
  const bundleId = requireArg(flags, "bundle");
  const minAgentCount = optionalNumericArg(flags, "agents") ?? 3;
  const targetCoverage = optionalNumericArg(flags, "coverage") ?? 2;
  const maxSeeds = optionalNumericArg(flags, "max-seeds") ?? 500;
  const baseSeed = optionalNumericArg(flags, "seed") ?? 0;
  const maxAtomsPerAgent = optionalNumericArg(flags, "max-atoms") ?? 8;
  const maxSeedsPerAgent = optionalNumericArg(flags, "max-seeds-per-agent") ?? 5;

  const spec = resolveSpec(bundleId);
  const system = resolveSystem(bundleId);
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

  // ── Per-atom seed search with per-seed scenario assignment ──
  const atomPlans: AtomPlan[] = [];

  for (const atom of allAtoms) {
    const expectedCall = getExpectedCallForAtom(spec, atom);
    if (!expectedCall) continue;

    const info = stateInfo.get(atom.baseStateId);
    const depth = info?.depth ?? 0;
    const parentStateId = info?.parentStateId ?? null;
    const transitionBid = info?.transitionBid ?? null;

    const seeds: SeedInfo[] = [];

    for (let s = baseSeed; s < baseSeed + maxSeeds && seeds.length < targetCoverage; s++) {
      try {
        const scenario = assignSeedScenario(s, scenarioConfig);
        const deal = generateSeededDeal(system, s, scenario.vulnerability);
        const userSeat = resolveUserSeat(system, deal);
        const { auction, targeted } = resolveAuction(system, spec, deal, atom.baseStateId, userSeat);
        if (!targeted) continue;

        const activeSeat = auction.entries.length > 0
          ? nextSeatClockwise(auction.entries[auction.entries.length - 1]!.seat)
          : userSeat;
        const hand = deal.hands[activeSeat];
        const context = buildContext(hand, auction, activeSeat, scenario.vulnerability);
        const result = strategy.suggest(context);

        if (result && callsMatch(result.call, expectedCall)) {
          seeds.push({ seed: s, ...scenario });
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
  function findRoot(stateId: string): string {
    let cur = stateId;
    while (dependencyGraph[cur]?.parentStateId) {
      cur = dependencyGraph[cur]!.parentStateId!;
    }
    return cur;
  }

  const atomsByState = new Map<string, AtomPlan[]>();
  for (const ap of atomPlans) {
    if (ap.seeds.length === 0) continue;
    if (!atomsByState.has(ap.stateId)) atomsByState.set(ap.stateId, []);
    atomsByState.get(ap.stateId)!.push(ap);
  }

  function collectSubtreeAtoms(stateId: string): AtomPlan[] {
    const result = [...(atomsByState.get(stateId) ?? [])];
    const children = dependencyGraph[stateId]?.children ?? [];
    for (const child of children) {
      result.push(...collectSubtreeAtoms(child));
    }
    return result;
  }

  const coveredAtomCount = atomPlans.filter((a) => a.seeds.length > 0).length;
  const phase1AgentCount = Math.max(minAgentCount, Math.ceil(coveredAtomCount / maxAtomsPerAgent));
  const idealChunkSize = Math.ceil(coveredAtomCount / Math.max(phase1AgentCount, 1));

  type AtomChunk = { rootState: string; atoms: AtomPlan[] };

  function splitIntoChunks(stateId: string): AtomChunk[] {
    const subtreeAtoms = collectSubtreeAtoms(stateId);
    if (subtreeAtoms.length === 0) return [];

    const children = dependencyGraph[stateId]?.children ?? [];
    if (subtreeAtoms.length <= idealChunkSize || children.length === 0) {
      return [{ rootState: stateId, atoms: subtreeAtoms }];
    }

    const directAtoms = atomsByState.get(stateId) ?? [];
    const childChunks: AtomChunk[] = [];
    for (const child of children) {
      childChunks.push(...splitIntoChunks(child));
    }

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

  const roots = new Set<string>();
  for (const ap of atomPlans) {
    roots.add(findRoot(ap.stateId));
  }

  let allChunks: AtomChunk[] = [];
  for (const root of roots) {
    allChunks.push(...splitIntoChunks(root));
  }

  const refined: AtomChunk[] = [];
  for (const chunk of allChunks) {
    if (chunk.atoms.length <= idealChunkSize) {
      refined.push(chunk);
    } else {
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

  allChunks.sort((a, b) => b.atoms.length - a.atoms.length);

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

  for (const agent of phase1Agents) {
    agent.atoms.sort((a, b) => a.depth - b.depth);
  }

  function buildSubgraph(atoms: AtomPlan[]): typeof dependencyGraph {
    const relevantStates = new Set<string>();
    for (const ap of atoms) {
      let cur: string | null = ap.stateId;
      while (cur) {
        relevantStates.add(cur);
        cur = dependencyGraph[cur]?.parentStateId ?? null;
      }
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
  // Deduplicate seeds (same seed number) — each seed has a deterministic scenario
  const seenSeeds = new Set<number>();
  const uniqueSeedInfos: SeedInfo[] = [];
  for (const ap of atomPlans) {
    for (const si of ap.seeds) {
      if (!seenSeeds.has(si.seed)) {
        seenSeeds.add(si.seed);
        uniqueSeedInfos.push(si);
      }
    }
  }

  const playthroughInfo: { seedInfo: SeedInfo; userSteps: number; atomsCovered: string[] }[] = [];
  for (const si of uniqueSeedInfos) {
    try {
      const result = runSinglePlaythrough(system, spec, si.seed, atomCallMap, si.vulnerability, si.opponents);
      const userSteps = result.steps.filter((s) => s.isUserStep);
      playthroughInfo.push({
        seedInfo: si,
        userSteps: userSteps.length,
        atomsCovered: [...result.atomsCovered],
      });
    } catch {
      // Skip seeds that error during playthrough
    }
  }

  const phase2AgentCount = Math.max(minAgentCount, Math.ceil(playthroughInfo.length / maxSeedsPerAgent));
  const phase2Agents: { agentIndex: number; seeds: SeedInfo[]; estimatedSteps: number }[] = [];
  for (let i = 0; i < phase2AgentCount; i++) {
    phase2Agents.push({ agentIndex: i, seeds: [], estimatedSteps: 0 });
  }

  playthroughInfo.sort((a, b) => b.userSteps - a.userSteps);

  for (const pt of playthroughInfo) {
    const eligible = phase2Agents.filter((a) => a.seeds.length < maxSeedsPerAgent);
    if (eligible.length === 0) {
      const overflow = { agentIndex: phase2Agents.length, seeds: [pt.seedInfo], estimatedSteps: pt.userSteps };
      phase2Agents.push(overflow);
    } else {
      const minAgent = eligible.reduce((a, b) =>
        a.estimatedSteps <= b.estimatedSteps ? a : b,
      );
      minAgent.seeds.push(pt.seedInfo);
      minAgent.estimatedSteps += pt.userSteps;
    }
  }

  // ── Scenario distribution summary ──
  const allSeedInfos = atomPlans.flatMap((a) => a.seeds);
  const vulnCounts: Record<string, number> = {};
  const oppCounts: Record<string, number> = {};
  for (const si of allSeedInfos) {
    vulnCounts[si.vulnerability] = (vulnCounts[si.vulnerability] ?? 0) + 1;
    oppCounts[si.opponents] = (oppCounts[si.opponents] ?? 0) + 1;
  }

  // Stats
  const covered = atomPlans.filter((a) => a.seeds.length >= targetCoverage).length;
  const uncovered = atomPlans
    .filter((a) => a.seeds.length < targetCoverage)
    .map((a) => ({ atomId: a.atomId, seedsFound: a.seeds.length }));

  const isMixed = scenarioConfig.vuln.type === "mixed" || scenarioConfig.opponents.type === "mixed";

  console.log(JSON.stringify({
    bundle: bundleId,
    targetCoverage,
    totalAtoms: atomPlans.length,
    atomsCoveredAtTarget: covered,
    uncoveredAtoms: uncovered,
    maxDepth: Math.max(0, ...atomPlans.map((a) => a.depth)),

    // Scenario configuration
    scenarioMode: {
      vulnerability: scenarioConfig.vuln.type === "fixed" ? scenarioConfig.vuln.value : "mixed",
      opponents: scenarioConfig.opponents.type === "fixed" ? scenarioConfig.opponents.value : "mixed",
    },
    ...(isMixed ? {
      scenarioDistribution: {
        totalSeedSlots: allSeedInfos.length,
        vulnerabilityCounts: vulnCounts,
        opponentCounts: oppCounts,
      },
    } : {}),

    // Phase 1: Per-atom targeted evaluation (orchestrator-private, parallelized)
    phase1: {
      description: "Per-atom targeted evaluation distributed across parallel agents. Each agent evaluates its batch of atoms (each atom \u00d7 coverage seeds), walking in BFS order with stop-on-error via its dependency subgraph. Subtree-preserving assignment keeps parent-child atoms in the same agent.",
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
      description: "Playthrough integration testing. Agents run full playthroughs end-to-end using `play` command. Seeds are from Phase 1, balanced by step count. Each seed carries its own vulnerability and opponent mode.",
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
