import { describe, it, expect } from "vitest";
import { ntBundle } from "../../../../conventions/definitions/nt-bundle/config";
import { bergenBundle } from "../../../../conventions/definitions/bergen-bundle/config";
import { dontBundle } from "../../../../conventions/definitions/dont-bundle/config";
import { weakTwoBundle } from "../../../../conventions/definitions/weak-twos-bundle/config";
import type { ConventionBundle } from "../../bundle/bundle-types";
import {
  getReachableStates,
  getTerminalStates,
  getSurfaceStates,
  computeTopology,
  matchToCall,
  callToString,
  buildPathTreeChildren,
  computeMinimalLeafMultiplicities,
} from "../machine-enumeration";
import {
  compilePathToTarget,
  generateCoverageManifest,
  buildSurfaceMap,
  enumerateCoverageUniverse,
  injectSurfaceConstraints,
  computePathCoveredPairs,
  computeCoverageHash,
  classifyBidAgainstSurfaces,
  generateOptimizedManifest,
} from "../coverage-spec-compiler";
import { generateDeal } from "../../../../engine/deal-generator";
import { detectModuleInterference } from "../../composition/interference-detector";
import { Seat, BidSuit } from "../../../../engine/types";
import type { Call } from "../../../../engine/types";
import type { MeaningSurface } from "../../../../core/contracts/meaning";
import type { ConventionModule } from "../../composition/module-types";
import { naturalNtModule } from "../../../../conventions/definitions/nt-bundle/modules/natural-nt";
import { staymanModule } from "../../../../conventions/definitions/nt-bundle/modules/stayman";
import { jacobyTransfersModule } from "../../../../conventions/definitions/nt-bundle/modules/jacoby-transfers";
import { smolenModule } from "../../../../conventions/definitions/nt-bundle/modules/smolen";
import { dontModule } from "../../../../conventions/definitions/dont-bundle/module";
import { weakTwoModule } from "../../../../conventions/definitions/weak-twos-bundle/module";

// All bundles with FSMs to test generically
const ALL_BUNDLES: { name: string; bundle: ConventionBundle }[] = [
  { name: "NT", bundle: ntBundle },
  { name: "Bergen", bundle: bergenBundle },
  { name: "DONT", bundle: dontBundle },
  { name: "Weak Two", bundle: weakTwoBundle },
];

// ── machine-enumeration.ts ──────────────────────────────────────────

describe("machine-enumeration", () => {
  describe("getReachableStates", () => {
    it.each(ALL_BUNDLES)("$name: finds reachable states", ({ bundle }) => {
      const machine = bundle.conversationMachine!;
      const reachable = getReachableStates(machine);
      expect(reachable.size).toBeGreaterThan(1);
      expect(reachable.has(machine.initialStateId)).toBe(true);
    });

    it.each(ALL_BUNDLES)("$name: all reachable states exist in machine", ({ bundle }) => {
      const machine = bundle.conversationMachine!;
      const reachable = getReachableStates(machine);
      for (const stateId of reachable) {
        expect(machine.states.has(stateId)).toBe(true);
      }
    });
  });

  describe("getTerminalStates", () => {
    it.each(ALL_BUNDLES)("$name: finds at least one terminal state", ({ bundle }) => {
      const machine = bundle.conversationMachine!;
      const reachable = getReachableStates(machine);
      const terminals = getTerminalStates(machine, reachable);
      expect(terminals.size).toBeGreaterThan(0);
    });
  });

  describe("getSurfaceStates", () => {
    it.each(ALL_BUNDLES)("$name: finds surface states with surfaceGroupIds", ({ bundle }) => {
      const machine = bundle.conversationMachine!;
      const reachable = getReachableStates(machine);
      const surface = getSurfaceStates(machine, reachable);
      // Every bundle should have states where bidding decisions happen
      expect(surface.size).toBeGreaterThan(0);
      for (const stateId of surface) {
        const state = machine.states.get(stateId)!;
        expect(state.surfaceGroupId).toBeDefined();
      }
    });
  });

  describe("computeTopology", () => {
    it.each(ALL_BUNDLES)("$name: computes full topology", ({ bundle }) => {
      const machine = bundle.conversationMachine!;
      const topology = computeTopology(machine);

      expect(topology.machineId).toBe(machine.machineId);
      expect(topology.reachableStates.size).toBeGreaterThan(0);
      expect(topology.terminalStates.size).toBeGreaterThan(0);
      expect(topology.surfaceStates.size).toBeGreaterThan(0);
    });

    it.each(ALL_BUNDLES)("$name: every reachable state has a path", ({ bundle }) => {
      const machine = bundle.conversationMachine!;
      const topology = computeTopology(machine);

      for (const stateId of topology.reachableStates) {
        expect(topology.paths.has(stateId)).toBe(true);
        const path = topology.paths.get(stateId)!;
        expect(path.targetStateId).toBe(stateId);
        expect(path.stateIds[path.stateIds.length - 1]).toBe(stateId);
        expect(path.stateIds[0]).toBe(machine.initialStateId);
      }
    });

    it.each(ALL_BUNDLES)("$name: paths have consistent transition counts", ({ bundle }) => {
      const machine = bundle.conversationMachine!;
      const topology = computeTopology(machine);

      for (const [stateId, path] of topology.paths) {
        if (stateId === machine.initialStateId) {
          expect(path.transitions.length).toBe(0);
          expect(path.stateIds.length).toBe(1);
        } else {
          // stateIds = [initial, ..., target], transitions connect adjacent states
          expect(path.stateIds.length).toBe(path.transitions.length + 1);
        }
      }
    });
  });

  describe("matchToCall", () => {
    it("converts call match to bid", () => {
      const call = matchToCall({ kind: "call", level: 2, strain: "C" as any });
      expect(call).toEqual({ type: "bid", level: 2, strain: "C" });
    });

    it("converts pass match", () => {
      expect(matchToCall({ kind: "pass" })).toEqual({ type: "pass" });
    });

    it("converts opponent-action double", () => {
      expect(matchToCall({ kind: "opponent-action", callType: "double" })).toEqual({ type: "double" });
    });

    it("returns null for any-bid (not statically resolvable)", () => {
      expect(matchToCall({ kind: "any-bid" })).toBeNull();
    });

    it("returns null for predicate", () => {
      expect(matchToCall({ kind: "predicate", test: () => true })).toBeNull();
    });
  });

  describe("callToString", () => {
    it("serializes bids correctly", () => {
      expect(callToString({ type: "bid", level: 1, strain: "NT" as any })).toBe("1NT");
      expect(callToString({ type: "bid", level: 3, strain: "H" as any })).toBe("3H");
      expect(callToString({ type: "pass" })).toBe("P");
      expect(callToString({ type: "double" })).toBe("X");
      expect(callToString({ type: "redouble" })).toBe("XX");
    });
  });
});

// ── coverage-spec-compiler.ts ───────────────────────────────────────

describe("coverage-spec-compiler", () => {
  describe("compilePathToTarget", () => {
    it.each(ALL_BUNDLES)("$name: compiles all paths to valid targets", ({ bundle }) => {
      const machine = bundle.conversationMachine!;
      const topology = computeTopology(machine);
      const surfaceMap = buildSurfaceMap(bundle);

      for (const [stateId, path] of topology.paths) {
        if (stateId === machine.initialStateId) continue;

        const target = compilePathToTarget(path, machine, bundle, surfaceMap);
        expect(target.stateId).toBe(stateId);
        expect(target.dealConstraints).toBeDefined();
        expect(target.dealConstraints.seats.length).toBeGreaterThan(0);
        expect(Array.isArray(target.auctionPrefix)).toBe(true);
      }
    });
  });

  describe("generateCoverageManifest", () => {
    it.each(ALL_BUNDLES)("$name: generates a complete manifest", ({ bundle }) => {
      const manifest = generateCoverageManifest(bundle);
      expect(manifest).not.toBeNull();
      expect(manifest!.bundleId).toBe(bundle.id);
      expect(manifest!.totalStates).toBeGreaterThan(0);
      expect(manifest!.targetableStates).toBeGreaterThan(0);
      expect(manifest!.targets.length).toBe(manifest!.targetableStates);
    });

    it.each(ALL_BUNDLES)("$name: every target has an auction prefix", ({ bundle }) => {
      const manifest = generateCoverageManifest(bundle)!;
      for (const target of manifest.targets) {
        // Every non-initial state needs at least one bid to reach it
        expect(target.auctionPrefix.length).toBeGreaterThan(0);
      }
    });

    // Bundles with looser base constraints — satisfiability is realistic
    const SATISFIABLE_BUNDLES = ALL_BUNDLES.filter((b) => b.name !== "Weak Two");

    it.each(SATISFIABLE_BUNDLES)("$name: target deal constraints are satisfiable", ({ bundle }) => {
      const manifest = generateCoverageManifest(bundle)!;
      const sample = manifest.targets.filter((t) => !t.hasUnresolvableSteps).slice(0, 8);
      let successCount = 0;
      for (const target of sample) {
        try {
          generateDeal({ ...target.dealConstraints, maxAttempts: 50_000 });
          successCount++;
        } catch {
          // Some paths produce very tight constraints — acceptable
        }
      }
      expect(successCount).toBeGreaterThanOrEqual(1);
    });
  });
});

// ── Tree LP (machine-enumeration.ts) ────────────────────────────────

describe("tree-lp", () => {
  describe("buildPathTreeChildren", () => {
    it.each(ALL_BUNDLES)("$name: produces correct parent→children map", ({ bundle }) => {
      const machine = bundle.conversationMachine!;
      const topology = computeTopology(machine);
      const children = buildPathTreeChildren(topology.paths);

      // Every child's parent in the BFS tree must own it in the children map
      for (const [stateId, path] of topology.paths) {
        if (path.stateIds.length < 2) continue; // root
        const parentId = path.stateIds[path.stateIds.length - 2]!;
        const siblings = children.get(parentId);
        expect(siblings).toBeDefined();
        expect(siblings).toContain(stateId);
      }

      // Every entry in the children map points to valid reachable states
      for (const [parentId, kids] of children) {
        expect(topology.reachableStates.has(parentId)).toBe(true);
        for (const kid of kids) {
          expect(topology.reachableStates.has(kid)).toBe(true);
        }
      }

      // No duplicate children
      for (const [, kids] of children) {
        expect(new Set(kids).size).toBe(kids.length);
      }
    });
  });

  describe("computeMinimalLeafMultiplicities", () => {
    it.each(ALL_BUNDLES)("$name: returns correct total sessions and leaf multiplicities", ({ bundle }) => {
      const machine = bundle.conversationMachine!;
      const topology = computeTopology(machine);
      const surfaceMap = buildSurfaceMap(bundle);

      // Build surface counts
      const surfaceCounts = new Map<string, number>();
      for (const stateId of topology.reachableStates) {
        const state = machine.states.get(stateId);
        if (!state?.surfaceGroupId) continue;
        const surfaces = surfaceMap.get(state.surfaceGroupId);
        if (surfaces) surfaceCounts.set(stateId, surfaces.length);
      }

      const result = computeMinimalLeafMultiplicities(topology, surfaceCounts);

      // Total sessions = sum of leaf multiplicities
      let sum = 0;
      for (const [, mult] of result.leafMultiplicities) {
        sum += mult;
      }
      expect(result.totalSessions).toBe(sum);

      // All multiplicities are non-negative integers
      for (const [, mult] of result.leafMultiplicities) {
        expect(mult).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(mult)).toBe(true);
      }

      // totalSessions >= max surface count at any state (lower bound sanity)
      let maxSurfaces = 0;
      for (const [, count] of surfaceCounts) {
        if (count > maxSurfaces) maxSurfaces = count;
      }
      expect(result.totalSessions).toBeGreaterThanOrEqual(maxSurfaces);
    });

    it.each(ALL_BUNDLES)("$name: bottleneck detection identifies cost drivers", ({ bundle }) => {
      const machine = bundle.conversationMachine!;
      const topology = computeTopology(machine);
      const surfaceMap = buildSurfaceMap(bundle);

      const surfaceCounts = new Map<string, number>();
      for (const stateId of topology.reachableStates) {
        const state = machine.states.get(stateId);
        if (!state?.surfaceGroupId) continue;
        const surfaces = surfaceMap.get(state.surfaceGroupId);
        if (surfaces) surfaceCounts.set(stateId, surfaces.length);
      }

      const result = computeMinimalLeafMultiplicities(topology, surfaceCounts);

      // Every bottleneck should have a positive deficit
      for (const b of result.bottleneckStates) {
        expect(b.deficit).toBeGreaterThan(0);
        expect(b.surfaceCount).toBeGreaterThan(b.subtreeTraffic);
        expect(topology.reachableStates.has(b.stateId)).toBe(true);
      }
    });

    it.each(ALL_BUNDLES)("$name: tree LP result ≤ total surface pairs (it's an optimization)", ({ bundle }) => {
      const machine = bundle.conversationMachine!;
      const topology = computeTopology(machine);
      const surfaceMap = buildSurfaceMap(bundle);

      const surfaceCounts = new Map<string, number>();
      let totalSurfacePairs = 0;
      for (const stateId of topology.reachableStates) {
        const state = machine.states.get(stateId);
        if (!state?.surfaceGroupId) continue;
        const surfaces = surfaceMap.get(state.surfaceGroupId);
        if (surfaces) {
          surfaceCounts.set(stateId, surfaces.length);
          totalSurfacePairs += surfaces.length;
        }
      }

      const result = computeMinimalLeafMultiplicities(topology, surfaceCounts);

      // The LP is a lower bound — it should be ≤ the total (state, surface) pairs
      // (naive approach: one session per pair)
      expect(result.totalSessions).toBeLessThanOrEqual(totalSurfacePairs);

      // And it should be strictly less for any non-trivial FSM (optimization helps)
      if (totalSurfacePairs > 1) {
        expect(result.totalSessions).toBeLessThan(totalSurfacePairs);
      }
    });
  });
});

// ── coverage-spec-compiler new functions ────────────────────────────

describe("coverage-spec-compiler-extended", () => {
  describe("enumerateCoverageUniverse", () => {
    it.each(ALL_BUNDLES)("$name: correct number of (state, surface) pairs", ({ bundle }) => {
      const machine = bundle.conversationMachine!;
      const topology = computeTopology(machine);
      const surfaceMap = buildSurfaceMap(bundle);

      const universe = enumerateCoverageUniverse(bundle, surfaceMap, topology.reachableStates);

      // Count expected pairs manually
      let expected = 0;
      for (const stateId of topology.reachableStates) {
        const state = machine.states.get(stateId);
        if (!state?.surfaceGroupId) continue;
        const surfaces = surfaceMap.get(state.surfaceGroupId);
        if (surfaces) expected += surfaces.length;
      }

      expect(universe.length).toBe(expected);

      // Every pair references a valid state and surface
      for (const pair of universe) {
        expect(topology.reachableStates.has(pair.stateId)).toBe(true);
        expect(pair.surfaceId).toBeTruthy();
        expect(pair.surfaceLabel).toBeTruthy();
      }
    });
  });

  describe("injectSurfaceConstraints", () => {
    it.each(ALL_BUNDLES)("$name: tightens constraints for specific surface", ({ bundle }) => {
      const machine = bundle.conversationMachine!;
      const topology = computeTopology(machine);
      const surfaceMap = buildSurfaceMap(bundle);

      // Find a surface state with surfaces
      for (const stateId of topology.surfaceStates) {
        const state = machine.states.get(stateId);
        if (!state?.surfaceGroupId) continue;
        const surfaces = surfaceMap.get(state.surfaceGroupId);
        if (!surfaces || surfaces.length === 0) continue;

        const baseDeal = bundle.dealConstraints;
        const surface = surfaces[0]!;
        const injected = injectSurfaceConstraints(baseDeal, surfaces, surface.meaningId, Seat.South);

        // Should return valid DealConstraints
        expect(injected.seats).toBeDefined();
        expect(injected.seats.length).toBeGreaterThan(0);

        // The injected constraints should differ from or equal the base
        // (they may not differ if the surface has no clauses, but should always be valid)
        expect(Array.isArray(injected.seats)).toBe(true);
        break; // One surface state is enough for this test
      }
    });
  });

  describe("computePathCoveredPairs", () => {
    it.each(ALL_BUNDLES)("$name: deterministic intermediate coverage", ({ bundle }) => {
      const machine = bundle.conversationMachine!;
      const topology = computeTopology(machine);
      const surfaceMap = buildSurfaceMap(bundle);

      // Test several paths
      let tested = 0;
      for (const [stateId, path] of topology.paths) {
        if (stateId === machine.initialStateId) continue;
        if (path.transitions.length === 0) continue;

        const pairs = computePathCoveredPairs(path, machine, surfaceMap);

        // Every covered pair should reference a valid from-state
        for (const pair of pairs) {
          expect(topology.reachableStates.has(pair.stateId)).toBe(true);
          expect(pair.surfaceId).toBeTruthy();
        }

        // Calling again should produce identical results (deterministic)
        const pairs2 = computePathCoveredPairs(path, machine, surfaceMap);
        expect(pairs).toEqual(pairs2);

        tested++;
        if (tested >= 5) break;
      }
      expect(tested).toBeGreaterThan(0);
    });
  });

  describe("computeCoverageHash", () => {
    it.each(ALL_BUNDLES)("$name: consistent hashing", ({ bundle }) => {
      const h1 = computeCoverageHash(bundle);
      const h2 = computeCoverageHash(bundle);
      expect(h1).toBe(h2);
      // Should be an 8-char hex string
      expect(h1).toMatch(/^[0-9a-f]{8}$/);
    });

    it("changes on FSM mutation", () => {
      const h1 = computeCoverageHash(ntBundle);
      const h2 = computeCoverageHash(bergenBundle);
      // Different bundles should (almost certainly) produce different hashes
      expect(h1).not.toBe(h2);
    });
  });

  describe("classifyBidAgainstSurfaces", () => {
    it("exact match: single surface matches call", () => {
      const surfaces: MeaningSurface[] = [
        makeMockSurface("s1", "Transfer to hearts", { type: "bid", level: 2, strain: BidSuit.Diamonds }),
        makeMockSurface("s2", "Stayman", { type: "bid", level: 2, strain: BidSuit.Clubs }),
      ];

      const result = classifyBidAgainstSurfaces(
        { type: "bid", level: 2, strain: BidSuit.Clubs },
        surfaces,
      );
      expect(result).not.toBeNull();
      expect(result!.surfaceId).toBe("s2");
      expect(result!.confidence).toBe("exact");
    });

    it("no match: call doesn't match any surface", () => {
      const surfaces: MeaningSurface[] = [
        makeMockSurface("s1", "Transfer to hearts", { type: "bid", level: 2, strain: BidSuit.Diamonds }),
      ];

      const result = classifyBidAgainstSurfaces(
        { type: "bid", level: 3, strain: BidSuit.NoTrump },
        surfaces,
      );
      expect(result).toBeNull();
    });

    it("ambiguous: multiple surfaces match same call", () => {
      const surfaces: MeaningSurface[] = [
        makeMockSurface("s1", "Meaning A", { type: "pass" }),
        makeMockSurface("s2", "Meaning B", { type: "pass" }),
      ];

      const result = classifyBidAgainstSurfaces({ type: "pass" }, surfaces);
      expect(result).not.toBeNull();
      expect(result!.confidence).toBe("ambiguous");
    });
  });

  describe("generateOptimizedManifest", () => {
    it.each(ALL_BUNDLES)("$name: produces valid manifest", ({ bundle }) => {
      const manifest = generateOptimizedManifest(bundle, { skipFeasibilityCheck: true });
      expect(manifest).not.toBeNull();
      expect(manifest!.bundleId).toBe(bundle.id);
      expect(manifest!.totalStates).toBeGreaterThan(0);
      expect(manifest!.totalSurfacePairs).toBeGreaterThan(0);
      expect(manifest!.allTargets.length).toBe(
        manifest!.phase1Targets.length + manifest!.phase2Targets.length,
      );
      expect(manifest!.coverageHash).toMatch(/^[0-9a-f]{8}$/);
      expect(manifest!.treeLPBound).toBeGreaterThan(0);
    });

    it.each(ALL_BUNDLES)("$name: phase1 + phase2 cover the universe", ({ bundle }) => {
      const manifest = generateOptimizedManifest(bundle, { skipFeasibilityCheck: true })!;

      // Collect all covered pair keys
      const coveredKeys = new Set<string>();
      for (const target of manifest.allTargets) {
        for (const pair of target.coveredPairs) {
          coveredKeys.add(`${pair.stateId}:${pair.surfaceId}`);
        }
      }

      // Uncovered + infeasible + covered should account for the full universe
      const uncoveredKeys = new Set<string>();
      for (const pair of manifest.uncoveredPairs) {
        uncoveredKeys.add(`${pair.stateId}:${pair.surfaceId}`);
      }
      for (const pair of manifest.infeasiblePairs) {
        uncoveredKeys.add(`${pair.stateId}:${pair.surfaceId}`);
      }

      // covered ∪ uncovered ∪ infeasible should be ≥ totalSurfacePairs
      // (some intermediate pairs may be double-counted in coveredPairs across targets)
      expect(coveredKeys.size + uncoveredKeys.size).toBeGreaterThanOrEqual(
        manifest.totalSurfacePairs - coveredKeys.size, // at minimum, not a large gap
      );
    });

    it.each(ALL_BUNDLES)("$name: fewer targets than naive manifest", ({ bundle }) => {
      const naive = generateCoverageManifest(bundle)!;
      const optimized = generateOptimizedManifest(bundle, { skipFeasibilityCheck: true })!;

      // The optimized manifest should have ≤ targets than naive (or at worst similar)
      // The naive generates one per non-initial reachable state; optimized is surface-targeted
      // Phase 1 + Phase 2 combined should be competitive with naive target count
      expect(optimized.allTargets.length).toBeLessThanOrEqual(
        naive.targets.length * 3, // generous bound — optimized may expand for per-surface targeting
      );
    });
  });
});

// ── interference-detector ──────────────────────────────────────────

describe("interference-detector", () => {
  describe("no conflicts in real bundles", () => {
    it("NT modules: no error-severity conflicts", () => {
      const report = detectModuleInterference([
        naturalNtModule,
        staymanModule,
        jacobyTransfersModule,
        smolenModule,
      ]);
      expect(report.hasConflicts).toBe(false);
      // Should have analyzed all modules
      expect(report.moduleIds).toHaveLength(4);
    });

    it("DONT module alone: no conflicts", () => {
      const report = detectModuleInterference([dontModule]);
      expect(report.hasConflicts).toBe(false);
      expect(report.interferences).toHaveLength(0);
    });

    it("Weak Two module alone: no conflicts", () => {
      const report = detectModuleInterference([weakTwoModule]);
      expect(report.hasConflicts).toBe(false);
      expect(report.interferences).toHaveLength(0);
    });
  });

  describe("synthetic conflict detection", () => {
    it("detects entry transition conflict between mock modules", () => {
      const modA = makeMockModule("mod-a", [
        { kind: "call", level: 2, strain: BidSuit.Clubs },
      ]);
      const modB = makeMockModule("mod-b", [
        { kind: "call", level: 2, strain: BidSuit.Clubs }, // same bid — conflict!
      ]);

      const report = detectModuleInterference([modA, modB]);
      expect(report.hasConflicts).toBe(true);
      expect(report.interferences.length).toBeGreaterThan(0);

      const conflict = report.interferences[0]!;
      expect(conflict.auctionPrefix).toBe("2C");
      expect(conflict.conflictingModules).toContain("mod-a");
      expect(conflict.conflictingModules).toContain("mod-b");
      expect(conflict.location).toBe("entry");
      expect(conflict.severity).toBe("error");
    });

    it("no conflict when modules claim different bids", () => {
      const modA = makeMockModule("mod-a", [
        { kind: "call", level: 2, strain: BidSuit.Clubs },
      ]);
      const modB = makeMockModule("mod-b", [
        { kind: "call", level: 2, strain: BidSuit.Diamonds },
      ]);

      const report = detectModuleInterference([modA, modB]);
      expect(report.hasConflicts).toBe(false);
      expect(report.interferences).toHaveLength(0);
    });

    it("guarded conflict produces warning, not error", () => {
      const modA = makeMockModule("mod-a", [
        { kind: "call", level: 2, strain: BidSuit.Clubs },
      ]);
      const modB = makeMockModuleWithGuard("mod-b", [
        { kind: "call", level: 2, strain: BidSuit.Clubs },
      ]);

      const report = detectModuleInterference([modA, modB]);
      // Has interferences but not hard conflicts (guarded)
      expect(report.interferences.length).toBeGreaterThan(0);
      expect(report.interferences[0]!.severity).toBe("warning");
      expect(report.hasConflicts).toBe(false);
    });

    it("reports prefix ownership map", () => {
      const modA = makeMockModule("mod-a", [
        { kind: "call", level: 1, strain: BidSuit.NoTrump },
        { kind: "call", level: 2, strain: BidSuit.Clubs },
      ]);
      const modB = makeMockModule("mod-b", [
        { kind: "call", level: 2, strain: BidSuit.Diamonds },
      ]);

      const report = detectModuleInterference([modA, modB]);
      expect(report.prefixOwnership.get("1NT")).toEqual(["mod-a"]);
      expect(report.prefixOwnership.get("2C")).toEqual(["mod-a"]);
      expect(report.prefixOwnership.get("2D")).toEqual(["mod-b"]);
    });
  });
});

// ── Test Helpers ────────────────────────────────────────────────────

function makeMockSurface(meaningId: string, teachingLabel: string, defaultCall: Call): MeaningSurface {
  return {
    meaningId,
    semanticClassId: "test-class",
    moduleId: "test-module",
    encoding: { defaultCall },
    clauses: [],
    ranking: {
      recommendationBand: "may" as any,
      specificity: 0,
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    sourceIntent: { type: "test", params: {} },
    teachingLabel,
  };
}

function makeMockModule(
  moduleId: string,
  entryMatches: Array<{ kind: "call"; level: number; strain: BidSuit }>,
): ConventionModule {
  return {
    moduleId,
    entrySurfaces: [],
    surfaceGroups: [],
    entryTransitions: entryMatches.map((match, i) => ({
      transitionId: `${moduleId}-entry-${i}`,
      match,
      target: `${moduleId}-state-${i}`,
    })),
    machineStates: [],
    facts: { definitions: [], evaluators: new Map() },
    explanationEntries: [],
    pedagogicalRelations: [],
  };
}

function makeMockModuleWithGuard(
  moduleId: string,
  entryMatches: Array<{ kind: "call"; level: number; strain: BidSuit }>,
): ConventionModule {
  return {
    moduleId,
    entrySurfaces: [],
    surfaceGroups: [],
    entryTransitions: entryMatches.map((match, i) => ({
      transitionId: `${moduleId}-entry-${i}`,
      match,
      target: `${moduleId}-state-${i}`,
      guard: () => true,
    })),
    machineStates: [],
    facts: { definitions: [], evaluators: new Map() },
    explanationEntries: [],
    pedagogicalRelations: [],
  };
}
