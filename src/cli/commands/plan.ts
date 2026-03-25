// ── CLI plan command ────────────────────────────────────────────────

import { enumerateRuleAtoms } from "../../conventions";
import type { RuleAtom } from "../../conventions";
import { createSpecStrategy } from "../../session/strategy-factory";
import { callsMatch } from "../../engine/call-helpers";

import type { Flags, OpponentMode, Vulnerability, Call, ScenarioConfig, Auction, Seat, Deal, ConventionBundle, ConventionSpec, BaseSystemId } from "../shared";
import {
  callKey,
  requireArg, optionalNumericArg,
  resolveSpec, resolveBundleWithRules,
  generateSeededDeal, resolveUserSeat,
  buildInitialAuction, buildContext, nextSeatClockwise, partnerOf,
  assignSeedScenario,
} from "../shared";
import { buildAtomCallMap, runSinglePlaythrough } from "../playthrough";

// ── Types ───────────────────────────────────────────────────────────

type SeedInfo = {
  seed: number;
  vulnerability: Vulnerability;
  opponents: OpponentMode;
};

type AtomPlan = {
  atomId: string;
  moduleId: string;
  meaningId: string;
  meaningLabel: string;
  expectedBid: string;
  turnGuard: string | null;
  primaryPhaseGuard: string | readonly string[] | null;
  seeds: SeedInfo[];
};

// ── Public entry point ──────────────────────────────────────────────

export function runPlan(flags: Flags, scenarioConfig: ScenarioConfig, baseSystem: BaseSystemId): void {
  const bundleId = requireArg(flags, "bundle");
  const minAgentCount = optionalNumericArg(flags, "agents") ?? 3;
  const targetCoverage = optionalNumericArg(flags, "coverage") ?? 2;
  const maxSeeds = optionalNumericArg(flags, "max-seeds") ?? 500;
  const baseSeed = optionalNumericArg(flags, "seed") ?? 0;
  const maxAtomsPerAgent = optionalNumericArg(flags, "max-atoms") ?? 8;
  const maxSeedsPerAgent = optionalNumericArg(flags, "max-seeds-per-agent") ?? 5;

  const spec = resolveSpec(bundleId, baseSystem);
  const bundle = resolveBundleWithRules(bundleId, baseSystem);
  const strategy = createSpecStrategy(spec);
  const modules = bundle.modules ?? [];

  // All atoms from rule enumeration
  const allAtoms = enumerateRuleAtoms(modules);

  // ── Per-atom seed search with per-seed scenario assignment ──
  const atomPlans: AtomPlan[] = [];

  for (const atom of allAtoms) {
    const seeds: SeedInfo[] = [];

    for (let s = baseSeed; s < baseSeed + maxSeeds && seeds.length < targetCoverage; s++) {
      try {
        const scenario = assignSeedScenario(s, scenarioConfig);
        const deal = generateSeededDeal(bundle, s, scenario.vulnerability);
        const userSeat = resolveUserSeat(bundle, deal);

        // Strategy-driven forward auction to find atom
        const { reached, auction } = buildForwardAuctionForAtom(
          bundle, spec, deal, userSeat, atom, scenario.vulnerability,
        );
        if (!reached) continue;

        const activeSeat = auction.entries.length > 0
          ? nextSeatClockwise(auction.entries[auction.entries.length - 1]!.seat)
          : userSeat;
        const hand = deal.hands[activeSeat];
        const context = buildContext(hand, auction, activeSeat, scenario.vulnerability);
        const result = strategy.suggest(context);

        if (result && callsMatch(result.call, atom.encoding)) {
          seeds.push({ seed: s, ...scenario });
        }
      } catch {
        // Skip seeds that error
      }
    }

    atomPlans.push({
      atomId: `${atom.moduleId}/${atom.meaningId}`,
      moduleId: atom.moduleId,
      meaningId: atom.meaningId,
      meaningLabel: atom.meaningLabel,
      expectedBid: callKey(atom.encoding),
      turnGuard: atom.turnGuard ?? null,
      primaryPhaseGuard: atom.primaryPhaseGuard ?? null,
      seeds,
    });
  }

  // ── Phase 1: Distribute atoms across agents by module grouping ──
  // Group atoms by module for coherent agent assignment
  const atomsByModule = new Map<string, AtomPlan[]>();
  for (const ap of atomPlans) {
    if (ap.seeds.length === 0) continue;
    if (!atomsByModule.has(ap.moduleId)) atomsByModule.set(ap.moduleId, []);
    atomsByModule.get(ap.moduleId)!.push(ap);
  }

  const coveredAtomCount = atomPlans.filter((a) => a.seeds.length > 0).length;
  const phase1AgentCount = Math.max(minAgentCount, Math.ceil(coveredAtomCount / maxAtomsPerAgent));

  const phase1Agents: { agentIndex: number; atoms: AtomPlan[]; estimatedEvalCalls: number }[] = [];
  for (let i = 0; i < phase1AgentCount; i++) {
    phase1Agents.push({ agentIndex: i, atoms: [], estimatedEvalCalls: 0 });
  }

  // Distribute module groups to agents (keep same-module atoms together)
  const moduleGroups = [...atomsByModule.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  );

  for (const [, moduleAtoms] of moduleGroups) {
    const minAgent = phase1Agents.reduce((a, b) =>
      a.estimatedEvalCalls <= b.estimatedEvalCalls ? a : b,
    );
    minAgent.atoms.push(...moduleAtoms);
    minAgent.estimatedEvalCalls += moduleAtoms.length * targetCoverage;
  }

  // ── Phase 2: Playthrough seed selection ──
  const atomCallMap = buildAtomCallMap(modules);
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
      const result = runSinglePlaythrough(bundle, spec, si.seed, atomCallMap, si.vulnerability, si.opponents);
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
    system: baseSystem,
    targetCoverage,
    totalAtoms: atomPlans.length,
    atomsCoveredAtTarget: covered,
    uncoveredAtoms: uncovered,

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
      description: "Per-atom targeted evaluation distributed across parallel agents. Each agent evaluates its batch of atoms grouped by module.",
      atoms: atomPlans.map((ap) => ({
        atomId: ap.atomId,
        moduleId: ap.moduleId,
        meaningId: ap.meaningId,
        meaningLabel: ap.meaningLabel,
        expectedBid: ap.expectedBid,
        turnGuard: ap.turnGuard,
        primaryPhaseGuard: ap.primaryPhaseGuard,
        seeds: ap.seeds,
      })),
      agents: phase1Agents
        .filter((a) => a.atoms.length > 0)
        .map((a) => ({
        agentIndex: a.agentIndex,
        bundleId,
        estimatedEvalCalls: a.estimatedEvalCalls,
        atomCount: a.atoms.length,
        atoms: a.atoms.map((ap) => ({
          atomId: ap.atomId,
          expectedBid: ap.expectedBid,
          seeds: ap.seeds,
        })),
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

// ── Helpers ─────────────────────────────────────────────────────────

/** Strategy-driven forward auction — extends auction until atom's encoding is reached. */
function buildForwardAuctionForAtom(
  bundle: ConventionBundle,
  spec: ConventionSpec,
  deal: Deal,
  userSeat: Seat,
  atom: RuleAtom,
  vuln: Vulnerability,
): { auction: Auction; reached: boolean } {
  const strategy = createSpecStrategy(spec);
  const partner = partnerOf(userSeat);
  const initAuction = buildInitialAuction(bundle, userSeat, deal);
  const entries: { seat: Seat; call: Call }[] = [...initAuction.entries];
  const maxBids = 20;

  for (let iter = 0; iter < maxBids; iter++) {
    const activeSeat = entries.length > 0
      ? nextSeatClockwise(entries[entries.length - 1]!.seat)
      : userSeat;

    // Opponents always pass
    if (activeSeat !== userSeat && activeSeat !== partner) {
      entries.push({ seat: activeSeat, call: { type: "pass" } });
      if (entries.length >= 4) {
        const tail = entries.slice(-3);
        if (tail.every((e) => e.call.type === "pass") && entries.some((e) => e.call.type === "bid")) {
          return { auction: { entries, isComplete: true }, reached: false };
        }
      }
      continue;
    }

    const hand = deal.hands[activeSeat];
    const auction: Auction = { entries: [...entries], isComplete: false };
    const context = buildContext(hand, auction, activeSeat, vuln);
    const result = strategy.suggest(context);

    if (!result) {
      return { auction: { entries, isComplete: false }, reached: false };
    }

    if (callsMatch(result.call, atom.encoding)) {
      return { auction: { entries, isComplete: false }, reached: true };
    }

    entries.push({ seat: activeSeat, call: result.call });
  }

  return { auction: { entries, isComplete: false }, reached: false };
}
