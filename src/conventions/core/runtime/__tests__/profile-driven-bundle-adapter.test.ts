import { describe, it, expect } from "vitest";
import { bundleToRuntimeModules } from "../bundle-adapter";
import type { ConventionBundle } from "../../bundle/bundle-types";
import type { SystemProfileIR } from "../../../../core/contracts/agreement-module";
import type { MeaningSurface } from "../../../../core/contracts/meaning-surface";
import { Seat } from "../../../../engine/types";
import { buildAuction } from "../../../../engine/auction-helpers";

// ─── Fixtures ───────────────────────────────────────────────

const dummySurface: MeaningSurface = {
  meaningId: "test:dummy",
  semanticClassId: "test:dummy-class",
  moduleId: "test-module",
  encoding: { defaultCall: { type: "pass" } },
  clauses: [],
  ranking: {
    recommendationBand: "should",
    specificity: 1,
    modulePrecedence: 0,
    intraModuleOrder: 0,
  },
  sourceIntent: { type: "test", params: {} },
  teachingLabel: "Test dummy",
};

/** Profile that activates "stayman" module when auction starts with 1NT. */
const profileWith1NT: SystemProfileIR = {
  profileId: "test-1nt",
  baseSystem: "test",
  modules: [
    {
      moduleId: "stayman",
      kind: "add-on",
      attachments: [{ whenAuction: { kind: "sequence", calls: ["1NT"] } }],
    },
  ],
  conflictPolicy: { activationDefault: "simultaneous" },
};

/** Profile that activates "stayman" unconditionally (no auction guard). */
const unconditionalProfile: SystemProfileIR = {
  profileId: "test-unconditional",
  baseSystem: "test",
  modules: [
    {
      moduleId: "stayman",
      kind: "add-on",
      attachments: [{}],
    },
  ],
  conflictPolicy: { activationDefault: "simultaneous" },
};

// ─── Helper ─────────────────────────────────────────────────

function makeBundleWithSurfaces(
  overrides: Partial<ConventionBundle> = {},
): ConventionBundle {
  return {
    id: "test-bundle",
    name: "Test Bundle",
    memberIds: ["stayman"],
    dealConstraints: { seats: [], dealer: Seat.North },
    meaningSurfaces: [
      { groupId: "stayman", surfaces: [dummySurface] },
    ],
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────

describe("bundleToRuntimeModules with profile-only activation (no activationFilter)", () => {
  it("getActiveIds uses profile when activationFilter is undefined", () => {
    const bundle = makeBundleWithSurfaces({
      systemProfile: profileWith1NT,
    });

    const { getActiveIds } = bundleToRuntimeModules(bundle);

    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const activeIds = getActiveIds(auction, Seat.South);
    expect(activeIds).toEqual(["stayman"]);
  });

  it("isActive on RuntimeModule uses profile instead of activationFilter", () => {
    const bundle = makeBundleWithSurfaces({
      systemProfile: profileWith1NT,
      surfaceRouter: undefined,
    });

    const { modules } = bundleToRuntimeModules(bundle);
    expect(modules).toHaveLength(1);

    const staymanModule = modules[0]!;

    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    expect(staymanModule.isActive(auction, Seat.South)).toBe(true);
  });

  it("getActiveIds returns empty when profile conditions not met", () => {
    const bundle = makeBundleWithSurfaces({
      systemProfile: profileWith1NT,
    });

    const { getActiveIds } = bundleToRuntimeModules(bundle);

    const auction = buildAuction(Seat.North, ["1H", "P"]);
    const activeIds = getActiveIds(auction, Seat.South);
    expect(activeIds).toEqual([]);
  });

  it("modules.isActive returns true when profile activates the module", () => {
    const bundle = makeBundleWithSurfaces({
      systemProfile: unconditionalProfile,
      surfaceRouter: undefined,
    });

    const { modules } = bundleToRuntimeModules(bundle);
    const staymanModule = modules[0]!;

    const auction = buildAuction(Seat.North, ["1H", "P"]);
    expect(staymanModule.isActive(auction, Seat.South)).toBe(true);
  });

  it("modules.isActive returns false when profile does not activate", () => {
    const bundle = makeBundleWithSurfaces({
      systemProfile: profileWith1NT,
      surfaceRouter: undefined,
    });

    const { modules } = bundleToRuntimeModules(bundle);
    const staymanModule = modules[0]!;

    const auction = buildAuction(Seat.North, ["1H", "P"]);
    expect(staymanModule.isActive(auction, Seat.South)).toBe(false);
  });
});
