import { describe, it, expect } from "vitest";
import { bundleToRuntimeModules } from "../bundle-adapter";
import type { ConventionBundle } from "../../bundle/bundle-types";
import type { SystemProfileIR } from "../../../../core/contracts/agreement-module";
import type { MeaningSurface } from "../../../../core/contracts/meaning";
import { Seat } from "../../../../engine/types";
import { buildAuction } from "../../../../engine/auction-helpers";
import { BASE_SYSTEM_SAYC } from "../../../../core/contracts/base-system-vocabulary";

// ─── Convention-agnostic Fixtures ────────────────────────────

function makeSurface(moduleId: string, meaningId: string): MeaningSurface {
  return {
    meaningId,
    semanticClassId: `${moduleId}:class`,
    moduleId,
    encoding: { defaultCall: { type: "pass" } },
    clauses: [],
    ranking: {
      recommendationBand: "should",
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    sourceIntent: { type: "test", params: {} },
    teachingLabel: `Test ${meaningId}`,
  };
}

/** Profile with single module, single sequence attachment. */
const singleSequenceProfile: SystemProfileIR = {
  profileId: "test-single-seq",
  baseSystem: BASE_SYSTEM_SAYC,
  modules: [
    {
      moduleId: "mod-a",
      kind: "add-on",
      attachments: [{ whenAuction: { kind: "sequence", calls: ["1NT"] } }],
    },
  ],
  conflictPolicy: { activationDefault: "simultaneous" },
};

/** Profile with single module, multiple OR attachments (like Bergen: 1H OR 1S). */
const multiAttachmentProfile: SystemProfileIR = {
  profileId: "test-multi-attach",
  baseSystem: BASE_SYSTEM_SAYC,
  modules: [
    {
      moduleId: "mod-raises",
      kind: "add-on",
      attachments: [
        { whenAuction: { kind: "sequence", calls: ["1H"] } },
        { whenAuction: { kind: "sequence", calls: ["1S"] } },
      ],
    },
  ],
  conflictPolicy: { activationDefault: "simultaneous" },
};

/** Profile with multiple modules (base + two add-ons with capability gates). */
const multiModuleProfile: SystemProfileIR = {
  profileId: "test-multi-mod",
  baseSystem: BASE_SYSTEM_SAYC,
  modules: [
    {
      moduleId: "base",
      kind: "base-system",
      attachments: [{ whenAuction: { kind: "sequence", calls: ["1C"] } }],
    },
    {
      moduleId: "addon-x",
      kind: "add-on",
      attachments: [{
        whenAuction: { kind: "sequence", calls: ["1C"] },
        requiresCapabilities: ["feature-x"],
      }],
    },
    {
      moduleId: "addon-y",
      kind: "add-on",
      attachments: [{
        whenAuction: { kind: "sequence", calls: ["1C"] },
        requiresCapabilities: ["feature-y"],
      }],
    },
  ],
  conflictPolicy: { activationDefault: "simultaneous" },
};

/** Unconditional profile — always active. */
const unconditionalProfile: SystemProfileIR = {
  profileId: "test-unconditional",
  baseSystem: BASE_SYSTEM_SAYC,
  modules: [
    { moduleId: "always-on", kind: "base-system", attachments: [{}] },
  ],
  conflictPolicy: { activationDefault: "simultaneous" },
};

function makeBundleWithSurfaces(
  overrides: Partial<ConventionBundle> = {},
): ConventionBundle {
  return {
    id: "test-bundle",
    name: "Test Bundle",
    memberIds: ["test-conv"],
    dealConstraints: { seats: [], dealer: Seat.North },
    meaningSurfaces: [
      { groupId: "group-a", surfaces: [makeSurface("mod-a", "mod-a:meaning")] },
    ],
    explanationCatalog: { version: "1.0.0", entries: [] },
    pedagogicalRelations: [],
    acceptableAlternatives: [],
    intentFamilies: [],
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────

describe("bundleToRuntimeModules with profile-only activation", () => {
  describe("single-sequence profile (e.g., 1NT trigger)", () => {
    it("getActiveIds activates on matching auction", () => {
      const bundle = makeBundleWithSurfaces({ systemProfile: singleSequenceProfile });
      const { getActiveIds } = bundleToRuntimeModules(bundle);

      const auction = buildAuction(Seat.North, ["1NT", "P"]);
      expect(getActiveIds(auction, Seat.South)).toEqual(["mod-a"]);
    });

    it("getActiveIds returns empty on non-matching auction", () => {
      const bundle = makeBundleWithSurfaces({ systemProfile: singleSequenceProfile });
      const { getActiveIds } = bundleToRuntimeModules(bundle);

      const auction = buildAuction(Seat.North, ["1H", "P"]);
      expect(getActiveIds(auction, Seat.South)).toEqual([]);
    });
  });

  describe("multi-attachment OR profile (e.g., Bergen: 1H or 1S)", () => {
    it("activates on first attachment match", () => {
      const bundle = makeBundleWithSurfaces({ systemProfile: multiAttachmentProfile });
      const { getActiveIds } = bundleToRuntimeModules(bundle);

      const auction = buildAuction(Seat.North, ["1H", "P"]);
      expect(getActiveIds(auction, Seat.South)).toEqual(["mod-raises"]);
    });

    it("activates on second attachment match", () => {
      const bundle = makeBundleWithSurfaces({ systemProfile: multiAttachmentProfile });
      const { getActiveIds } = bundleToRuntimeModules(bundle);

      const auction = buildAuction(Seat.North, ["1S", "P"]);
      expect(getActiveIds(auction, Seat.South)).toEqual(["mod-raises"]);
    });

    it("returns empty when no attachment matches", () => {
      const bundle = makeBundleWithSurfaces({ systemProfile: multiAttachmentProfile });
      const { getActiveIds } = bundleToRuntimeModules(bundle);

      const auction = buildAuction(Seat.North, ["1NT", "P"]);
      expect(getActiveIds(auction, Seat.South)).toEqual([]);
    });
  });

  describe("multi-module profile with capability gates", () => {
    it("activates all modules when all capabilities provided", () => {
      const bundle = makeBundleWithSurfaces({
        systemProfile: multiModuleProfile,
        declaredCapabilities: { "feature-x": "active", "feature-y": "active" },
      });
      const { getActiveIds } = bundleToRuntimeModules(bundle);

      const auction = buildAuction(Seat.North, ["1C", "P"]);
      expect(getActiveIds(auction, Seat.South)).toEqual(["base", "addon-x", "addon-y"]);
    });

    it("activates only base when no capabilities provided", () => {
      const bundle = makeBundleWithSurfaces({ systemProfile: multiModuleProfile });
      const { getActiveIds } = bundleToRuntimeModules(bundle);

      const auction = buildAuction(Seat.North, ["1C", "P"]);
      expect(getActiveIds(auction, Seat.South)).toEqual(["base"]);
    });

    it("activates base + one addon when only one capability provided", () => {
      const bundle = makeBundleWithSurfaces({
        systemProfile: multiModuleProfile,
        declaredCapabilities: { "feature-x": "active" },
      });
      const { getActiveIds } = bundleToRuntimeModules(bundle);

      const auction = buildAuction(Seat.North, ["1C", "P"]);
      expect(getActiveIds(auction, Seat.South)).toEqual(["base", "addon-x"]);
    });
  });

  describe("isActive on RuntimeModule (no surfaceRouter)", () => {
    it("returns true when profile activates", () => {
      const bundle = makeBundleWithSurfaces({
        systemProfile: unconditionalProfile,
        surfaceRouter: undefined,
      });
      const { modules } = bundleToRuntimeModules(bundle);

      const auction = buildAuction(Seat.North, ["1H", "P"]);
      expect(modules[0]!.isActive(auction, Seat.South)).toBe(true);
    });

    it("returns false when profile does not activate", () => {
      const bundle = makeBundleWithSurfaces({
        systemProfile: singleSequenceProfile,
        surfaceRouter: undefined,
      });
      const { modules } = bundleToRuntimeModules(bundle);

      const auction = buildAuction(Seat.North, ["1H", "P"]);
      expect(modules[0]!.isActive(auction, Seat.South)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("bundle with no systemProfile returns empty", () => {
      const bundle = makeBundleWithSurfaces({
        systemProfile: undefined,
      });
      const { getActiveIds } = bundleToRuntimeModules(bundle);

      const auction = buildAuction(Seat.North, ["1NT", "P"]);
      expect(getActiveIds(auction, Seat.South)).toEqual([]);
    });

    it("bundle with multiple surface groups creates one module per group", () => {
      const bundle = makeBundleWithSurfaces({
        systemProfile: unconditionalProfile,
        meaningSurfaces: [
          { groupId: "group-a", surfaces: [makeSurface("mod-a", "a:meaning")] },
          { groupId: "group-b", surfaces: [makeSurface("mod-b", "b:meaning")] },
          { groupId: "group-c", surfaces: [makeSurface("mod-c", "c:meaning")] },
        ],
      });
      const { modules } = bundleToRuntimeModules(bundle);

      expect(modules).toHaveLength(3);
      expect(modules.map(m => m.id)).toEqual(["group-a", "group-b", "group-c"]);
    });

    it("bundle with no meaningSurfaces returns empty modules", () => {
      const bundle = makeBundleWithSurfaces({
        systemProfile: unconditionalProfile,
        meaningSurfaces: undefined,
      });
      const { modules, getActiveIds } = bundleToRuntimeModules(bundle);

      expect(modules).toHaveLength(0);
      // getActiveIds still works even with no surfaces
      const auction = buildAuction(Seat.North, ["1H", "P"]);
      expect(getActiveIds(auction, Seat.South)).toEqual(["always-on"]);
    });
  });
});
