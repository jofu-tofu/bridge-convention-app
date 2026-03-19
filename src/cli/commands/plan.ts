// ── CLI plan command ────────────────────────────────────────────────

import {
  generateProtocolCoverageManifest,
  enumerateBaseTrackStates,
  getBaseModules,
} from "../../conventions/core";
import { protocolSpecToStrategy } from "../../strategy/bidding/protocol-adapter";
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
  const agentCount = optionalNumericArg(flags, "agents") ?? 3;
  const targetCoverage = optionalNumericArg(flags, "coverage") ?? 2;
  const maxSeeds = optionalNumericArg(flags, "max-seeds") ?? 500;
  const baseSeed = optionalNumericArg(flags, "seed") ?? 0;

  const spec = resolveSpec(bundleId);
  const bundle = resolveBundle(bundleId);
  const strategy = protocolSpecToStrategy(spec);

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
  const phase2Agents: { agentIndex: number; seeds: number[]; estimatedSteps: number }[] = [];
  for (let i = 0; i < agentCount; i++) {
    phase2Agents.push({ agentIndex: i, seeds: [], estimatedSteps: 0 });
  }

  // Sort by step count descending — assign largest first for better balance
  playthroughInfo.sort((a, b) => b.userSteps - a.userSteps);

  for (const pt of playthroughInfo) {
    const minAgent = phase2Agents.reduce((a, b) =>
      a.estimatedSteps <= b.estimatedSteps ? a : b,
    );
    minAgent.seeds.push(pt.seed);
    minAgent.estimatedSteps += pt.userSteps;
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

    // Phase 1: Per-atom targeted evaluation (orchestrator-private)
    phase1: {
      description: "Per-atom targeted evaluation. Orchestrator walks atoms in BFS order, calls `eval --atom=ATOM_ID --seed=N` for viewports, grades with `eval --atom=ATOM_ID --seed=N --bid=X`, enforces stop-on-error via dependency graph.",
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
    },

    // Phase 2: Playthrough integration testing (agent-driven)
    phase2: {
      description: "Playthrough integration testing. Agents run full playthroughs end-to-end using `play` command. Seeds are from Phase 1, balanced by step count.",
      totalPlaythroughSeeds: playthroughInfo.length,
      agents: phase2Agents.map((a) => ({
        agentIndex: a.agentIndex,
        bundleId,
        seeds: a.seeds,
        estimatedSteps: a.estimatedSteps,
      })),
    },
  }, null, 2));
}
