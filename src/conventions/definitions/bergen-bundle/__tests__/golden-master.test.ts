/**
 * Golden-master characterization test for the Bergen bundle.
 *
 * Captures current bundle properties so that the ModulePackage migration
 * can verify nothing changes. Tests the public shape of bergenBundle —
 * not implementation details.
 */

import { describe, it, expect } from "vitest";
import { bergenBundle } from "../config";
import { ConventionCategory } from "../../../core/types";

describe("Bergen bundle golden master", () => {
  it("has correct identity fields", () => {
    expect(bergenBundle.id).toBe("bergen-bundle");
    expect(bergenBundle.name).toBe("Bergen Raises Bundle");
    expect(bergenBundle.memberIds).toEqual(["bergen-bundle", "bergen-raises"]);
    expect(bergenBundle.category).toBe(ConventionCategory.Constructive);
    expect(bergenBundle.description).toBe(
      "Bergen Raises — constructive, limit, and preemptive responses to 1M opening",
    );
  });

  it("has 13 surface groups", () => {
    expect(bergenBundle.meaningSurfaces).toBeDefined();
    expect(bergenBundle.meaningSurfaces!.length).toBe(13);
  });

  it("has correct surface group IDs", () => {
    const groupIds = bergenBundle.meaningSurfaces!.map((g) => g.groupId);
    expect(groupIds).toEqual([
      "responder-r1-hearts",
      "responder-r1-spades",
      "opener-after-constructive-hearts",
      "opener-after-constructive-spades",
      "opener-after-limit-hearts",
      "opener-after-limit-spades",
      "opener-after-preemptive-hearts",
      "opener-after-preemptive-spades",
      "responder-after-game",
      "responder-after-signoff",
      "responder-after-game-try-hearts",
      "responder-after-game-try-spades",
      "opener-r4-accept",
    ]);
  });

  it("R1 hearts has 5 surfaces", () => {
    const r1Hearts = bergenBundle.meaningSurfaces!.find(
      (g) => g.groupId === "responder-r1-hearts",
    );
    expect(r1Hearts).toBeDefined();
    expect(r1Hearts!.surfaces.length).toBe(5);
  });

  it("R1 spades has 5 surfaces", () => {
    const r1Spades = bergenBundle.meaningSurfaces!.find(
      (g) => g.groupId === "responder-r1-spades",
    );
    expect(r1Spades).toBeDefined();
    expect(r1Spades!.surfaces.length).toBe(5);
  });

  it("R1 surfaces preserve $suit bindings for hearts", () => {
    const r1Hearts = bergenBundle.meaningSurfaces!.find(
      (g) => g.groupId === "responder-r1-hearts",
    )!;
    for (const surface of r1Hearts.surfaces) {
      expect(surface.surfaceBindings).toEqual({ suit: "hearts" });
    }
  });

  it("R1 surfaces preserve $suit bindings for spades", () => {
    const r1Spades = bergenBundle.meaningSurfaces!.find(
      (g) => g.groupId === "responder-r1-spades",
    )!;
    for (const surface of r1Spades.surfaces) {
      expect(surface.surfaceBindings).toEqual({ suit: "spades" });
    }
  });

  it("has 1 fact extension", () => {
    expect(bergenBundle.factExtensions).toBeDefined();
    expect(bergenBundle.factExtensions!.length).toBe(1);
  });

  it("has a conversation machine with correct ID", () => {
    expect(bergenBundle.conversationMachine).toBeDefined();
    expect(bergenBundle.conversationMachine!.machineId).toBe("bergen-conversation");
  });

  it("conversation machine starts at idle", () => {
    expect(bergenBundle.conversationMachine!.initialStateId).toBe("idle");
  });

  it("conversation machine has expected state count", () => {
    const stateCount = bergenBundle.conversationMachine!.states.size;
    // idle + 2 major-opened + 2 r1 + 6 r2 + 4 r3 + 1 r4 + terminal + contested = 18
    expect(stateCount).toBe(18);
  });

  it("has system profile with bergen module", () => {
    expect(bergenBundle.systemProfile).toBeDefined();
    expect(bergenBundle.systemProfile!.profileId).toBe("bergen-sayc");
    expect(bergenBundle.systemProfile!.modules.length).toBe(1);
    expect(bergenBundle.systemProfile!.modules[0]!.moduleId).toBe("bergen");
  });

  it("has explanation catalog", () => {
    expect(bergenBundle.explanationCatalog).toBeDefined();
    expect(bergenBundle.explanationCatalog!.entries.length).toBeGreaterThan(0);
  });

  it("has pedagogical relations", () => {
    expect(bergenBundle.pedagogicalRelations).toBeDefined();
    expect(bergenBundle.pedagogicalRelations!.length).toBeGreaterThan(0);
  });

  it("has acceptable alternatives", () => {
    expect(bergenBundle.acceptableAlternatives).toBeDefined();
    expect(bergenBundle.acceptableAlternatives!.length).toBeGreaterThan(0);
  });

  it("has declared capabilities for major opening", () => {
    expect(bergenBundle.declaredCapabilities).toBeDefined();
    expect(bergenBundle.declaredCapabilities!["opening.major"]).toBe("active");
  });

  it("has a surface router function", () => {
    expect(bergenBundle.surfaceRouter).toBeDefined();
    expect(typeof bergenBundle.surfaceRouter).toBe("function");
  });

  it("total surface count across all groups", () => {
    const total = bergenBundle.meaningSurfaces!.reduce(
      (sum, g) => sum + g.surfaces.length,
      0,
    );
    // R1: 5+5=10, R2: 2+2+2+2+2+2=12, R3: 1+1+2+2=6, R4: 1 = 29
    expect(total).toBe(29);
  });

  it("all surfaces have moduleId 'bergen'", () => {
    for (const group of bergenBundle.meaningSurfaces!) {
      for (const surface of group.surfaces) {
        expect(surface.moduleId).toBe("bergen");
      }
    }
  });

  it("all surfaces have meaningId starting with 'bergen:'", () => {
    for (const group of bergenBundle.meaningSurfaces!) {
      for (const surface of group.surfaces) {
        expect(surface.meaningId).toMatch(/^bergen:/);
      }
    }
  });

  it("all surfaces have a teachingLabel", () => {
    for (const group of bergenBundle.meaningSurfaces!) {
      for (const surface of group.surfaces) {
        expect(surface.teachingLabel).toBeDefined();
        expect(surface.teachingLabel?.length).toBeGreaterThan(0);
      }
    }
  });
});
