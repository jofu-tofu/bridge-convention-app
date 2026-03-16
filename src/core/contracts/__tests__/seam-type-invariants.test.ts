/**
 * Structural assertions that seam types between old and new composition paths
 * have the required fields. These tests freeze the contract boundary so that
 * changes to these types are detected early.
 */
import { describe, it, expect } from "vitest";
import type { SystemProfileIR } from "../agreement-module";
import type { EvaluationResult, RuntimeModule } from "../../../conventions/core/runtime/types";
import type { PublicSnapshot } from "../module-surface";
import type { CompiledProfile } from "../../../conventions/core/profile/types";
import { ForcingState } from "../bidding";

// Helper: assert a value structurally satisfies the interface at compile time
// and verify key fields exist at runtime via a factory.

describe("Seam type invariants", () => {
  describe("SystemProfileIR", () => {
    it("has required fields", () => {
      const profile: SystemProfileIR = {
        profileId: "test-profile",
        baseSystem: "standard",
        modules: [
          {
            moduleId: "test-mod",
            kind: "base-system",
            attachments: [{ whenAuction: { kind: "by-role", role: "opener", lastCall: "1NT" } }],
          },
        ],
        conflictPolicy: { activationDefault: "simultaneous" },
      };

      expect(profile.profileId).toBe("test-profile");
      expect(profile.baseSystem).toBe("standard");
      expect(profile.modules).toHaveLength(1);
      expect(profile.conflictPolicy.activationDefault).toBe("simultaneous");
    });
  });

  describe("EvaluationResult", () => {
    it("has required fields", () => {
      const result: EvaluationResult = {
        publicSnapshot: {
          activeModuleIds: ["mod-1"],
          forcingState: ForcingState.Nonforcing,
          obligation: { kind: "none", obligatedSide: "responder" },
          agreedStrain: { type: "none" },
          competitionMode: "none",
          captain: "none",
          systemCapabilities: {},
          publicRegisters: {},
        },
        decisionSurfaces: [],
        diagnostics: [],
      };

      expect(result.publicSnapshot).toBeDefined();
      expect(result.decisionSurfaces).toBeDefined();
      expect(result.diagnostics).toBeDefined();
    });
  });

  describe("PublicSnapshot", () => {
    it("has required fields", () => {
      const snapshot: PublicSnapshot = {
        activeModuleIds: ["mod-1"],
        forcingState: ForcingState.Nonforcing,
        obligation: { kind: "none", obligatedSide: "opener" },
        agreedStrain: { type: "none" },
        competitionMode: "none",
        captain: "none",
        systemCapabilities: {},
        publicRegisters: {},
      };

      expect(snapshot.activeModuleIds).toBeDefined();
      expect(snapshot.forcingState).toBeDefined();
      expect(snapshot.obligation).toBeDefined();
      expect(snapshot.agreedStrain).toBeDefined();
      expect(snapshot.publicRegisters).toBeDefined();
    });
  });

  describe("RuntimeModule", () => {
    it("has required fields", () => {
      const mod: RuntimeModule = {
        id: "test-mod",
        capabilities: ["cap-1"],
        isActive: () => true,
        emitSurfaces: () => [],
      };

      expect(mod.id).toBe("test-mod");
      expect(mod.capabilities).toEqual(["cap-1"]);
      expect(typeof mod.isActive).toBe("function");
      expect(typeof mod.emitSurfaces).toBe("function");
    });
  });

  describe("CompiledProfile", () => {
    it("has required fields", () => {
      const compiled: CompiledProfile = {
        profileId: "test-compiled",
        profile: {
          profileId: "test-profile",
          baseSystem: "standard",
          modules: [],
          conflictPolicy: { activationDefault: "simultaneous" },
        },
        resolvedModules: [
          {
            moduleId: "mod-1",
            surfaceGroups: [{ groupId: "group-1", surfaces: [] }],
          },
        ],
        registries: {
          facts: {
            evaluators: new Map(),
            relationalEvaluators: new Map(),
          } as never, // FactCatalog is opaque — structural check only
          explanations: { version: "1.0.0", entries: [] },
        },
        pedagogicalRelations: [],
        alternativeGroups: [],
        indexes: {
          activation: { moduleAttachments: new Map([["mod-1", []]]) },
          capabilities: { moduleCapabilities: new Map([["mod-1", ["cap-1"]]]) },
        },
        machine: {
          machineId: "test-machine",
          initialStateId: "idle",
          states: new Map(),
          seatRole: () => "self",
        },
        policy: {
          priorityClassMapping: {
            obligatory: "must",
            preferredConventional: "should",
            preferredNatural: "should",
            neutralCorrect: "may",
            fallbackCorrect: "avoid",
          },
        },
      };

      expect(compiled.profileId).toBe("test-compiled");
      expect(compiled.profile.profileId).toBe("test-profile");
      expect(compiled.resolvedModules).toHaveLength(1);
      expect(compiled.registries.facts).toBeDefined();
      expect(compiled.registries.explanations).toBeDefined();
      expect(compiled.indexes.activation).toBeDefined();
      expect(compiled.indexes.capabilities).toBeDefined();
      expect(compiled.policy.priorityClassMapping).toBeDefined();
    });

    it("supports required machine field", () => {
      const compiled: CompiledProfile = {
        profileId: "minimal",
        profile: {
          profileId: "p",
          baseSystem: "standard",
          modules: [],
          conflictPolicy: { activationDefault: "simultaneous" },
        },
        resolvedModules: [],
        registries: {
          facts: { evaluators: new Map(), relationalEvaluators: new Map() } as never,
          explanations: { version: "1.0.0", entries: [] },
        },
        pedagogicalRelations: [],
        alternativeGroups: [],
        indexes: {
          activation: { moduleAttachments: new Map() },
          capabilities: { moduleCapabilities: new Map() },
        },
        machine: {
          machineId: "minimal-machine",
          initialStateId: "idle",
          states: new Map(),
          seatRole: () => "self",
        },
        policy: {
          priorityClassMapping: {
            obligatory: "must",
            preferredConventional: "should",
            preferredNatural: "should",
            neutralCorrect: "may",
            fallbackCorrect: "avoid",
          },
        },
      };

      expect(compiled.machine).toBeDefined();
      expect(compiled.machine.machineId).toBe("minimal-machine");
    });
  });
});
