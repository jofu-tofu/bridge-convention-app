import { describe, it, expect } from "vitest";
import { createConventionConfigFromBundle, resolveConventionForSystem } from "../bundle-types";
import { ConventionCategory } from "../../../../core/contracts/convention";
import type { ConventionBundle } from "../bundle-types";
import type { ConventionConfig } from "../../../../core/contracts/convention";
import { SAYC_SYSTEM_CONFIG } from "../../../../core/contracts/system-config";
import { Seat } from "../../../../engine/types";

function stubBundle(overrides: Partial<ConventionBundle> = {}): ConventionBundle {
  return {
    id: "test-bundle",
    name: "Test Bundle",
    description: "Test description",
    category: ConventionCategory.Constructive,
    memberIds: [],
    dealConstraints: { seats: [{ seat: Seat.North, minHcp: 15 }], dealer: Seat.North },
    derivedTeaching: { acceptableAlternatives: [], surfaceGroups: [], relations: [] },
    ...overrides,
  } as ConventionBundle;
}

function stubConfig(overrides: Partial<ConventionConfig> = {}): ConventionConfig {
  return {
    id: "test-config",
    name: "Test Config",
    description: "desc",
    category: ConventionCategory.Constructive,
    dealConstraints: { seats: [], dealer: Seat.North },
    ...overrides,
  };
}

describe("createConventionConfigFromBundle", () => {
  it("uses bundle.id as config.id", () => {
    const result = createConventionConfigFromBundle(stubBundle({ id: "my-id" }));
    expect(result.id).toBe("my-id");
  });

  it("uses bundle.name as config.name", () => {
    const result = createConventionConfigFromBundle(stubBundle({ name: "Bundle Name" }));
    expect(result.name).toBe("Bundle Name");
  });

  it("uses bundle.description as config.description", () => {
    const result = createConventionConfigFromBundle(stubBundle({ description: "bundle desc" }));
    expect(result.description).toBe("bundle desc");
  });

  it("uses bundle.category as config.category", () => {
    const result = createConventionConfigFromBundle(
      stubBundle({ category: ConventionCategory.Competitive }),
    );
    expect(result.category).toBe(ConventionCategory.Competitive);
  });

  it("copies dealConstraints, offConventionConstraints, defaultAuction, internal, teaching, allowedDealers", () => {
    const offConstraints = { seats: [{ seat: Seat.East, minHcp: 10 }], dealer: Seat.East };
    const defaultAuction = () => undefined;
    const teaching = { purpose: "test purpose" };
    const bundle = stubBundle({
      offConventionConstraints: offConstraints,
      defaultAuction,
      internal: true,
      teaching,
      allowedDealers: [Seat.North, Seat.South],
    });

    const result = createConventionConfigFromBundle(bundle);

    expect(result.dealConstraints).toBe(bundle.dealConstraints);
    expect(result.offConventionConstraints).toBe(offConstraints);
    expect(result.defaultAuction).toBe(defaultAuction);
    expect(result.internal).toBe(true);
    expect(result.teaching).toBe(teaching);
    expect(result.allowedDealers).toEqual([Seat.North, Seat.South]);
  });
});

describe("resolveConventionForSystem", () => {
  const sys = SAYC_SYSTEM_CONFIG;

  it("returns config unchanged when bundle is undefined", () => {
    const config = stubConfig();
    expect(resolveConventionForSystem(config, undefined, sys)).toBe(config);
  });

  it("returns config unchanged when bundle is provided (no factory re-derivation)", () => {
    const config = stubConfig();
    expect(resolveConventionForSystem(config, stubBundle(), sys)).toBe(config);
  });
});
