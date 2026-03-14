import { describe, it, expect } from "vitest";
import { bundleToRuntimeModules } from "../bundle-adapter";
import type { ConventionBundle } from "../../bundle/bundle-types";
import type { SystemProfileIR } from "../../../../core/contracts/agreement-module";
import type { MeaningSurface } from "../../../../core/contracts/meaning-surface";
import { Seat } from "../../../../engine/types";
import { buildAuction } from "../../../../engine/auction-helpers";

/** Minimal profile that activates a module when ntOpenerContext capability is present. */
const profileRequiringNtCapability: SystemProfileIR = {
  profileId: "test-profile",
  modules: [
    {
      moduleId: "test-module",
      kind: "base-system",
      attachments: [
        {
          requiresCapabilities: ["ntOpenerContext"],
        },
      ],
    },
  ],
  baseSystem: "test",
  conflictPolicy: { activationDefault: "simultaneous" },
};

/** Minimal profile that activates a module unconditionally (no capability requirement). */
const unconditionalProfile: SystemProfileIR = {
  profileId: "test-unconditional",
  modules: [
    {
      moduleId: "test-module",
      kind: "base-system",
      attachments: [{}],
    },
  ],
  baseSystem: "test",
  conflictPolicy: { activationDefault: "simultaneous" },
};

const dummySurface: MeaningSurface = {
  meaningId: "test:dummy",
  semanticClassId: "test:dummy-class",
  moduleId: "test-module",
  encoding: {
    defaultCall: { type: "pass" },
  },
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

function makeBundleWithSurfaces(
  overrides: Partial<ConventionBundle> = {},
): ConventionBundle {
  return {
    id: "test-bundle",
    name: "Test Bundle",
    memberIds: ["test-conv"],
    dealConstraints: { seats: [], dealer: Seat.North },
    activationFilter: () => ["test-conv"],
    meaningSurfaces: [{ groupId: "test-group", surfaces: [dummySurface] }],
    ...overrides,
  };
}

describe("bundleToRuntimeModules capability injection", () => {
  it("does NOT inject ntOpenerContext for a bundle with meaningSurfaces but no declaredCapabilities", () => {
    const bundle = makeBundleWithSurfaces({
      systemProfile: profileRequiringNtCapability,
      // no declaredCapabilities — simulates Bergen-like bundle
    });

    const { getActiveIds } = bundleToRuntimeModules(bundle);
    const auction = buildAuction(Seat.North, ["1H", "P"]);
    const activeIds = getActiveIds(auction, Seat.South);

    // Module requires ntOpenerContext capability, which should NOT be injected
    expect(activeIds).toEqual([]);
  });

  it("injects ntOpenerContext when declaredCapabilities includes it", () => {
    const bundle = makeBundleWithSurfaces({
      systemProfile: profileRequiringNtCapability,
      declaredCapabilities: { ntOpenerContext: "active" },
    });

    const { getActiveIds } = bundleToRuntimeModules(bundle);
    const auction = buildAuction(Seat.North, ["1NT", "P"]);
    const activeIds = getActiveIds(auction, Seat.South);

    // Module requires ntOpenerContext, which IS declared — module activates
    expect(activeIds).toEqual(["test-module"]);
  });

  it("falls through to activationFilter when bundle has no systemProfile", () => {
    const bundle = makeBundleWithSurfaces({
      // no systemProfile — falls through to activationFilter
    });

    const { getActiveIds } = bundleToRuntimeModules(bundle);
    const auction = buildAuction(Seat.North, ["1H", "P"]);
    const activeIds = getActiveIds(auction, Seat.South);

    // Without systemProfile, activationFilter is used
    expect(activeIds).toEqual(["test-conv"]);
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
