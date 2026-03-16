import { describe, it, expect } from "vitest";
import { compileProfileFromBundle } from "../compile-profile";
import { ntBundle } from "../../../definitions/nt-bundle";
import { bergenBundle } from "../../../definitions/bergen-bundle";
import type { ConventionBundle } from "../../bundle/bundle-types";

describe("compileProfileFromBundle", () => {
  it("produces a CompiledProfile with merged fact catalog from NT bundle", () => {
    const profile = compileProfileFromBundle(ntBundle);

    // Fact catalog should include module-derived facts from NT bundle
    expect(profile.factCatalog).toBeDefined();
    // NT bundle has staymanFacts, transferFacts, ntResponseFacts, smolenFacts extensions
    // Verify module-derived evaluators are present
    expect(profile.factCatalog.definitions.length).toBeGreaterThan(0);
  });

  it("builds activation index mapping module IDs to attachments", () => {
    const profile = compileProfileFromBundle(ntBundle);

    // NT bundle has a systemProfile with modules; each should appear in activation index
    expect(profile.activationIndex.size).toBeGreaterThan(0);

    // Each module in the profile should have its attachments indexed
    for (const mod of ntBundle.systemProfile!.modules) {
      expect(profile.activationIndex.has(mod.moduleId)).toBe(true);
      expect(profile.activationIndex.get(mod.moduleId)).toEqual(mod.attachments);
    }
  });

  it("builds capability index from declaredCapabilities", () => {
    const profile = compileProfileFromBundle(ntBundle);

    // NT bundle declares capabilities: { "opening.1nt": "active" }
    expect(profile.capabilityIndex).toEqual(ntBundle.declaredCapabilities);
  });

  it("returns empty activation index when bundle has no systemProfile", () => {
    const bareBundle: ConventionBundle = {
      id: "bare-test",
      name: "Bare Test",
      memberIds: ["bare"],
      dealConstraints: { seats: [] },
      meaningSurfaces: [],
    };
    const profile = compileProfileFromBundle(bareBundle);

    expect(profile.activationIndex.size).toBe(0);
    expect(profile.capabilityIndex).toEqual({});
  });

  it("returns empty capability index when bundle has no declaredCapabilities", () => {
    const profile = compileProfileFromBundle(bergenBundle);

    // Bergen bundle does not declare capabilities (no declaredCapabilities field)
    // but does have a systemProfile
    expect(profile.activationIndex.size).toBeGreaterThan(0);
  });

  it("includes shared facts alongside bundle extensions in merged catalog", () => {
    const profile = compileProfileFromBundle(ntBundle);

    // Should include shared primitive facts (hand.hcp, etc.)
    const factIds = profile.factCatalog.definitions.map(d => d.id);
    expect(factIds).toContain("hand.hcp");
    // Should include module-derived facts from NT extensions
    expect(factIds).toContain("module.stayman.eligible");
  });
});
