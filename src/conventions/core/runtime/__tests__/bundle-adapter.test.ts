import { describe, it, expect } from "vitest";
import { bundleToRuntimeModules } from "../bundle-adapter";
import type { ConventionBundle } from "../../bundle/bundle-types";
import type { SystemProfile } from "../../../../core/contracts/agreement-module";
import type { BidMeaning } from "../../../../core/contracts/meaning";
import { Seat } from "../../../../engine/types";
import { buildAuction } from "../../../../engine/auction-helpers";
import { CAP_OPENING_1NT } from "../../../definitions/capability-vocabulary";
import { BASE_SYSTEM_SAYC } from "../../../../core/contracts/base-system-vocabulary";
import { ConventionCategory } from "../../../../core/contracts/convention";

/** Minimal profile that activates a module when opening.1nt capability is present. */
const profileRequiringNtCapability: SystemProfile = {
  profileId: "test-profile",
  modules: [
    {
      moduleId: "test-module",
      kind: "base-system",
      attachments: [
        {
          requiresCapabilities: [CAP_OPENING_1NT],
        },
      ],
    },
  ],
  baseSystem: BASE_SYSTEM_SAYC,
  conflictPolicy: { activationDefault: "simultaneous" },
};

/** Minimal profile that activates a module unconditionally (no capability requirement). */
const unconditionalProfile: SystemProfile = {
  profileId: "test-unconditional",
  modules: [
    {
      moduleId: "test-module",
      kind: "base-system",
      attachments: [{}],
    },
  ],
  baseSystem: BASE_SYSTEM_SAYC,
  conflictPolicy: { activationDefault: "simultaneous" },
};

const dummySurface: BidMeaning = {
  meaningId: "test:dummy",
  semanticClassId: "test:dummy-class",
  moduleId: "test-module",
  encoding: {
    defaultCall: { type: "pass" },
  },
  clauses: [],
  ranking: {
    recommendationBand: "should",
    modulePrecedence: 0,
    intraModuleOrder: 0,
  },
  sourceIntent: { type: "test", params: {} },
  teachingLabel: "Test dummy",
};

function makeBundleWithSurfaces(
  overrides: Partial<ConventionBundle> = {},
): ConventionBundle {
  return {
    id: "test-bundle",
    name: "Test Bundle",
    category: ConventionCategory.Constructive,
    description: "test",
    memberIds: ["test-conv"],
    dealConstraints: { seats: [], dealer: Seat.North },
    meaningSurfaces: [{ groupId: "test-group", surfaces: [dummySurface] }],
    explanationCatalog: { version: "1.0.0", entries: [] },
    teachingRelations: [],
    acceptableAlternatives: [],
    intentFamilies: [],
    ...overrides,
  };
}

describe("bundleToRuntimeModules capability injection", () => {
  it("does NOT inject opening.1nt for a bundle with meaningSurfaces but no declaredCapabilities", () => {
    const bundle = makeBundleWithSurfaces({
      systemProfile: profileRequiringNtCapability,
      // no declaredCapabilities — simulates Bergen-like bundle
    });

    const { getActiveIds } = bundleToRuntimeModules(bundle);
    const auction = buildAuction(Seat.North, ["1H", "P"]);
    const activeIds = getActiveIds(auction, Seat.South);

    // Module requires opening.1nt capability, which should NOT be injected
    expect(activeIds).toEqual([]);
  });

  it("injects opening.1nt when declaredCapabilities includes it", () => {
    const bundle = makeBundleWithSurfaces({
      systemProfile: profileRequiringNtCapability,
      declaredCapabilities: { [CAP_OPENING_1NT]: "active" },
    });

    const { getActiveIds } = bundleToRuntimeModules(bundle);
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const activeIds = getActiveIds(auction, Seat.South);

    // Module requires opening.1nt, which IS declared — module activates
    expect(activeIds).toEqual(["test-module"]);
  });

  it("returns empty when bundle has no systemProfile", () => {
    const bundle = makeBundleWithSurfaces({
      // no systemProfile — returns empty
    });

    const { getActiveIds } = bundleToRuntimeModules(bundle);
    const auction = buildAuction(Seat.North, ["1H", "P"]);
    const activeIds = getActiveIds(auction, Seat.South);

    // Without systemProfile, returns empty
    expect(activeIds).toEqual([]);
  });

  it("activates modules that have no capability requirements regardless of declaredCapabilities", () => {
    const bundle = makeBundleWithSurfaces({
      systemProfile: unconditionalProfile,
      // no declaredCapabilities
    });

    const { getActiveIds } = bundleToRuntimeModules(bundle);
    const auction = buildAuction(Seat.North, ["1H", "P"]);
    const activeIds = getActiveIds(auction, Seat.South);

    // Module has no capability requirements — activates regardless
    expect(activeIds).toEqual(["test-module"]);
  });
});
