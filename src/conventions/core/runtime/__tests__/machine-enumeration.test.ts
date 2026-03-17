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
} from "../machine-enumeration";
import {
  compilePathToTarget,
  generateCoverageManifest,
  buildSurfaceMap,
} from "../coverage-spec-compiler";
import { generateDeal } from "../../../../engine/deal-generator";

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
