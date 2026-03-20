/**
 * Structural assertions that seam types between old and new composition paths
 * have the required fields. These tests freeze the contract boundary so that
 * changes to these types are detected early.
 */
import { describe, it, expect } from "vitest";
import type { SystemProfileIR } from "../agreement-module";
import type { EvaluationResult, RuntimeModule } from "../../../conventions/core/runtime/types";
import type { PublicSnapshot } from "../module-surface";
import { ForcingState } from "../bidding";
import { BASE_SYSTEM_SAYC } from "../base-system-vocabulary";

// Helper: assert a value structurally satisfies the interface at compile time
// and verify key fields exist at runtime via a factory.

describe("Seam type invariants", () => {
  describe("SystemProfileIR", () => {
    it("has required fields", () => {
      const profile: SystemProfileIR = {
        profileId: "test-profile",
        baseSystem: BASE_SYSTEM_SAYC,
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
      expect(profile.baseSystem).toBe(BASE_SYSTEM_SAYC);
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

});
