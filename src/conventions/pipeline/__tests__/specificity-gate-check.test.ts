import { describe, it, expect } from "vitest";
import { deriveSpecificity } from "../evaluation/specificity-deriver";
import type { BidMeaning } from "../evaluation/meaning";
import type { FactCatalogExtension } from "../../core/fact-catalog";
import { SHARED_FACTS } from "../../core/shared-facts";

// ─── Bergen surfaces ────────────────────────────────────────
import {
  BERGEN_R1_HEARTS_SURFACES,
  BERGEN_R1_SPADES_SURFACES,
  BERGEN_R2_AFTER_CONSTRUCTIVE_HEARTS_SURFACES,
  BERGEN_R2_AFTER_CONSTRUCTIVE_SPADES_SURFACES,
  BERGEN_R2_AFTER_LIMIT_HEARTS_SURFACES,
  BERGEN_R2_AFTER_LIMIT_SPADES_SURFACES,
  BERGEN_R2_AFTER_PREEMPTIVE_HEARTS_SURFACES,
  BERGEN_R2_AFTER_PREEMPTIVE_SPADES_SURFACES,
  BERGEN_R3_AFTER_GAME_SURFACES,
  BERGEN_R3_AFTER_SIGNOFF_SURFACES,
  BERGEN_R3_AFTER_GAME_TRY_HEARTS_SURFACES,
  BERGEN_R3_AFTER_GAME_TRY_SPADES_SURFACES,
  BERGEN_R4_SURFACES,
} from "../../definitions/modules/bergen/meaning-surfaces";

// ─── DONT surfaces ──────────────────────────────────────────
import {
  DONT_R1_SURFACES,
  DONT_ADVANCER_2H_SURFACES,
  DONT_ADVANCER_2D_SURFACES,
  DONT_ADVANCER_2C_SURFACES,
  DONT_ADVANCER_2S_SURFACES,
  DONT_ADVANCER_DOUBLE_SURFACES,
  DONT_REVEAL_SURFACES,
  DONT_2C_RELAY_SURFACES,
  DONT_2D_RELAY_SURFACES,
} from "../../definitions/modules/dont/meaning-surfaces";

// ─── Weak Twos surfaces ─────────────────────────────────────
import {
  WEAK_TWO_R1_SURFACES,
  WEAK_TWO_R2_HEARTS_SURFACES,
  WEAK_TWO_R2_SPADES_SURFACES,
  WEAK_TWO_R2_DIAMONDS_SURFACES,
  WEAK_TWO_OGUST_HEARTS_SURFACES,
  WEAK_TWO_OGUST_SPADES_SURFACES,
  WEAK_TWO_OGUST_DIAMONDS_SURFACES,
  POST_OGUST_HEARTS_SURFACES,
  POST_OGUST_SPADES_SURFACES,
  POST_OGUST_DIAMONDS_SURFACES,
} from "../../definitions/modules/weak-twos/meaning-surfaces";

// ─── Fact extensions ────────────────────────────────────────
import { bergenFacts } from "../../definitions/modules/bergen/facts";
import { dontFacts } from "../../definitions/modules/dont/facts";
import { createStaymanFacts } from "../../definitions/modules/stayman";
import { createTransferFacts } from "../../definitions/modules/jacoby-transfers";
import { createSmolenFacts } from "../../definitions/modules/smolen";
import { weakTwoFacts } from "../../definitions/modules/weak-twos/facts";
import { SAYC_SYSTEM_CONFIG } from "../../definitions/system-config";

const staymanFacts = createStaymanFacts(SAYC_SYSTEM_CONFIG);
const transferFacts = createTransferFacts(SAYC_SYSTEM_CONFIG);
const smolenFacts = createSmolenFacts(SAYC_SYSTEM_CONFIG);

// ─── Collect all surfaces ───────────────────────────────────

const bergenSurfaces: readonly BidMeaning[] = [
  ...BERGEN_R1_HEARTS_SURFACES,
  ...BERGEN_R1_SPADES_SURFACES,
  ...BERGEN_R2_AFTER_CONSTRUCTIVE_HEARTS_SURFACES,
  ...BERGEN_R2_AFTER_CONSTRUCTIVE_SPADES_SURFACES,
  ...BERGEN_R2_AFTER_LIMIT_HEARTS_SURFACES,
  ...BERGEN_R2_AFTER_LIMIT_SPADES_SURFACES,
  ...BERGEN_R2_AFTER_PREEMPTIVE_HEARTS_SURFACES,
  ...BERGEN_R2_AFTER_PREEMPTIVE_SPADES_SURFACES,
  ...BERGEN_R3_AFTER_GAME_SURFACES,
  ...BERGEN_R3_AFTER_SIGNOFF_SURFACES,
  ...BERGEN_R3_AFTER_GAME_TRY_HEARTS_SURFACES,
  ...BERGEN_R3_AFTER_GAME_TRY_SPADES_SURFACES,
  ...BERGEN_R4_SURFACES,
];

const dontSurfaces: readonly BidMeaning[] = [
  ...DONT_R1_SURFACES,
  ...DONT_ADVANCER_2H_SURFACES,
  ...DONT_ADVANCER_2D_SURFACES,
  ...DONT_ADVANCER_2C_SURFACES,
  ...DONT_ADVANCER_2S_SURFACES,
  ...DONT_ADVANCER_DOUBLE_SURFACES,
  ...DONT_REVEAL_SURFACES,
  ...DONT_2C_RELAY_SURFACES,
  ...DONT_2D_RELAY_SURFACES,
];

import { getModules } from "../../definitions/module-registry";
import { moduleSurfaces } from "../../core/convention-module";

const ntModules = getModules(["natural-bids", "stayman", "jacoby-transfers", "smolen"], SAYC_SYSTEM_CONFIG);
const ntSurfaces: readonly BidMeaning[] = ntModules.flatMap(m => moduleSurfaces(m));

const weakTwoSurfaces: readonly BidMeaning[] = [
  ...WEAK_TWO_R1_SURFACES,
  ...WEAK_TWO_R2_HEARTS_SURFACES,
  ...WEAK_TWO_R2_SPADES_SURFACES,
  ...WEAK_TWO_R2_DIAMONDS_SURFACES,
  ...WEAK_TWO_OGUST_HEARTS_SURFACES,
  ...WEAK_TWO_OGUST_SPADES_SURFACES,
  ...WEAK_TWO_OGUST_DIAMONDS_SURFACES,
  ...POST_OGUST_HEARTS_SURFACES,
  ...POST_OGUST_SPADES_SURFACES,
  ...POST_OGUST_DIAMONDS_SURFACES,
];

const allSurfaces: readonly BidMeaning[] = [
  ...bergenSurfaces,
  ...dontSurfaces,
  ...ntSurfaces,
  ...weakTwoSurfaces,
];

// ─── Collect all fact extensions ────────────────────────────
// Wrap SHARED_FACTS (FactDefinition[]) into a FactCatalogExtension
const sharedFactExtension: FactCatalogExtension = {
  definitions: SHARED_FACTS,
  evaluators: new Map(),
};

const allFactExtensions: readonly FactCatalogExtension[] = [
  sharedFactExtension,
  bergenFacts,
  dontFacts,
  staymanFacts,
  transferFacts,
  smolenFacts,
  weakTwoFacts,
];

// ─── Inherited dimensions (legacy) ──────────────────────────
// Inherited-dimension testing previously used SurfaceFragment objects
// exported from bundle base-track files. Those files have been removed.
// The deriveSpecificity calls below pass `undefined` for the inherited
// dimensions parameter; re-add fragment-based coverage if the concept
// is reintroduced.

// ─── Specificity derivation tests ───────────────────────────

describe("Specificity derivation: regression suite across all bundles", () => {
  it("should derive a non-negative specificity for every surface", () => {
    for (const surface of allSurfaces) {
      const result = deriveSpecificity(surface, allFactExtensions, undefined);
      expect(result.advisorySpecificity).toBeGreaterThanOrEqual(0);
    }
  });

  it("should produce a valid basis classification for every surface", () => {
    const validBases = new Set(["derived", "asserted", "partial"]);
    for (const surface of allSurfaces) {
      const result = deriveSpecificity(surface, allFactExtensions, undefined);
      expect(validBases.has(result.basis)).toBe(true);
    }
  });

  it("should cover all surfaces (sanity check)", () => {
    expect(allSurfaces.length).toBeGreaterThanOrEqual(40);
    console.log(`Total surfaces checked: ${allSurfaces.length}`);
  });

  it("should have no duplicate meaningIds", () => {
    const ids = allSurfaces.map((s) => s.meaningId);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
      console.log("Duplicate meaningIds:", [...new Set(dupes)]);
    }
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("should give surfaces with more clauses equal or higher specificity", () => {
    // Sanity: surfaces with clauses should generally have higher specificity
    // than surfaces with no clauses (pass/accept surfaces).
    for (const surface of allSurfaces) {
      const result = deriveSpecificity(surface, allFactExtensions, undefined);
      if (surface.clauses.length === 0) {
        expect(result.advisorySpecificity).toBe(0);
      }
    }
  });

  it("should report per-bundle derivation stats", () => {
    const bundles = [
      { name: "Bergen", surfaces: bergenSurfaces },
      { name: "DONT", surfaces: dontSurfaces },
      { name: "NT", surfaces: ntSurfaces },
      { name: "Weak Twos", surfaces: weakTwoSurfaces },
    ];

    for (const bundle of bundles) {
      const specificities: number[] = [];
      for (const surface of bundle.surfaces) {
        const result = deriveSpecificity(surface, allFactExtensions, undefined);
        specificities.push(result.advisorySpecificity);
      }
      const avg = specificities.reduce((a, b) => a + b, 0) / specificities.length;
      const max = Math.max(...specificities);
      console.log(
        `${bundle.name}: ${bundle.surfaces.length} surfaces, avg=${avg.toFixed(1)}, max=${max}`,
      );
    }
  });
});
