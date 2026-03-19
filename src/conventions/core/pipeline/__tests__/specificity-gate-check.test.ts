import { describe, it, expect } from "vitest";
import { deriveSpecificity } from "../specificity-deriver";
import type { MeaningSurface, ConstraintDimension } from "../../../../core/contracts/meaning";
import type { FactCatalogExtension } from "../../../../core/contracts/fact-catalog";
import type { SurfaceFragment } from "../../../core/protocol/types";
import { SHARED_FACTS } from "../../../../core/contracts/shared-facts";

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
} from "../../../definitions/bergen-bundle/meaning-surfaces";

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
} from "../../../definitions/dont-bundle/meaning-surfaces";

// ─── NT surfaces ────────────────────────────────────────────
import {
  RESPONDER_SURFACES,
  OPENER_STAYMAN_SURFACES,
  STAYMAN_R3_AFTER_2H_SURFACES,
  STAYMAN_R3_AFTER_2S_SURFACES,
  STAYMAN_R3_AFTER_2D_SURFACES,
  INTERFERENCE_REDOUBLE_SURFACE,
  OPENER_TRANSFER_HEARTS_SURFACES,
  OPENER_TRANSFER_SPADES_SURFACES,
  TRANSFER_R3_HEARTS_SURFACES,
  TRANSFER_R3_SPADES_SURFACES,
  OPENER_SMOLEN_HEARTS_SURFACES,
  OPENER_SMOLEN_SPADES_SURFACES,
  OPENER_1NT_SURFACE,
} from "../../../definitions/nt-bundle/meaning-surfaces";

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
} from "../../../definitions/weak-twos-bundle/meaning-surfaces";

// ─── Fact extensions ────────────────────────────────────────
import { bergenFacts } from "../../../definitions/bergen-bundle/facts";
import { dontFacts } from "../../../definitions/dont-bundle/facts";
import { staymanFacts } from "../../../definitions/nt-bundle/modules/stayman";
import { transferFacts } from "../../../definitions/nt-bundle/modules/jacoby-transfers";
import { smolenFacts } from "../../../definitions/nt-bundle/modules/smolen";
import { ntResponseFacts } from "../../../definitions/nt-bundle/modules/natural-nt";
import { weakTwoFacts } from "../../../definitions/weak-twos-bundle/facts";

// ─── Surface fragment imports (for inherited dimensions) ────
import { BERGEN_SURFACE_FRAGMENTS } from "../../../definitions/bergen-bundle/base-track";
import { DONT_SURFACE_FRAGMENTS } from "../../../definitions/dont-bundle/base-track";
import { NT_SURFACE_FRAGMENTS } from "../../../definitions/nt-bundle/base-track";
import { WEAK_TWO_SURFACE_FRAGMENTS } from "../../../definitions/weak-twos-bundle/base-track";

// ─── Collect all surfaces ───────────────────────────────────

const bergenSurfaces: readonly MeaningSurface[] = [
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

const dontSurfaces: readonly MeaningSurface[] = [
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

const ntSurfaces: readonly MeaningSurface[] = [
  ...RESPONDER_SURFACES,
  ...OPENER_STAYMAN_SURFACES,
  ...STAYMAN_R3_AFTER_2H_SURFACES,
  ...STAYMAN_R3_AFTER_2S_SURFACES,
  ...STAYMAN_R3_AFTER_2D_SURFACES,
  INTERFERENCE_REDOUBLE_SURFACE,
  ...OPENER_TRANSFER_HEARTS_SURFACES,
  ...OPENER_TRANSFER_SPADES_SURFACES,
  ...TRANSFER_R3_HEARTS_SURFACES,
  ...TRANSFER_R3_SPADES_SURFACES,
  ...OPENER_SMOLEN_HEARTS_SURFACES,
  ...OPENER_SMOLEN_SPADES_SURFACES,
  ...OPENER_1NT_SURFACE,
];

const weakTwoSurfaces: readonly MeaningSurface[] = [
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

const allSurfaces: readonly MeaningSurface[] = [
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
  ntResponseFacts,
  weakTwoFacts,
];

// ─── Build inherited dimensions lookup ──────────────────────
// Maps each surface (by meaningId) to inherited dimensions from its
// containing SurfaceFragment. Surfaces not in any annotated fragment
// get no inherited dimensions.

const allFragments: Readonly<Record<string, SurfaceFragment>> = {
  ...BERGEN_SURFACE_FRAGMENTS,
  ...DONT_SURFACE_FRAGMENTS,
  ...NT_SURFACE_FRAGMENTS,
  ...WEAK_TWO_SURFACE_FRAGMENTS,
};

const inheritedDimsLookup = new Map<string, readonly ConstraintDimension[]>();
for (const fragment of Object.values(allFragments)) {
  if (fragment.inheritedDimensions && fragment.inheritedDimensions.length > 0) {
    for (const surface of fragment.surfaces) {
      inheritedDimsLookup.set(surface.meaningId, fragment.inheritedDimensions);
    }
  }
}

// ─── Gate check tests ───────────────────────────────────────

describe("Phase 3 Gate Check: derived vs authored specificity", () => {
  it("should report all mismatches between derived and authored specificity", () => {
    const mismatches: { meaningId: string; authored: number; derived: number }[] = [];

    for (const surface of allSurfaces) {
      const inherited = inheritedDimsLookup.get(surface.meaningId);
      const result = deriveSpecificity(surface, allFactExtensions, inherited);
      if (result.advisorySpecificity !== surface.ranking.specificity) {
        mismatches.push({
          meaningId: surface.meaningId,
          authored: surface.ranking.specificity,
          derived: result.advisorySpecificity,
        });
      }
    }

    // Report mismatches for debugging
    if (mismatches.length > 0) {
      console.log("Mismatches found:");
      for (const m of mismatches) {
        console.log(`  ${m.meaningId}: authored=${m.authored} derived=${m.derived}`);
      }
    }

    // This test reports mismatches for diagnostics. Derived specificity is the
    // source of truth — expect zero mismatches (authored values match derived).
    console.log(`MISMATCH count: ${mismatches.length} / ${allSurfaces.length}`);
    for (const m of mismatches) {
      console.log(`  MISMATCH ${m.meaningId}: authored=${m.authored} derived=${m.derived}`);
    }
    // Expect zero mismatches — authored values are set to match derived values
    expect(mismatches.length).toBe(0);
  });

  it("should achieve 100% match rate (derived = source of truth)", () => {
    let matches = 0;
    for (const surface of allSurfaces) {
      const inherited = inheritedDimsLookup.get(surface.meaningId);
      const result = deriveSpecificity(surface, allFactExtensions, inherited);
      if (result.advisorySpecificity === surface.ranking.specificity) matches++;
    }
    const matchRate = matches / allSurfaces.length;
    console.log(`Match rate: ${matches}/${allSurfaces.length} = ${(matchRate * 100).toFixed(1)}%`);
    expect(matchRate).toBe(1.0);
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

  it("should report per-bundle match rates", () => {
    const bundles = [
      { name: "Bergen", surfaces: bergenSurfaces },
      { name: "DONT", surfaces: dontSurfaces },
      { name: "NT", surfaces: ntSurfaces },
      { name: "Weak Twos", surfaces: weakTwoSurfaces },
    ];

    for (const bundle of bundles) {
      let matches = 0;
      const bundleMismatches: { meaningId: string; authored: number; derived: number }[] = [];

      for (const surface of bundle.surfaces) {
        const inherited = inheritedDimsLookup.get(surface.meaningId);
        const result = deriveSpecificity(surface, allFactExtensions, inherited);
        if (result.advisorySpecificity === surface.ranking.specificity) {
          matches++;
        } else {
          bundleMismatches.push({
            meaningId: surface.meaningId,
            authored: surface.ranking.specificity,
            derived: result.advisorySpecificity,
          });
        }
      }

      const rate = matches / bundle.surfaces.length;
      console.log(
        `${bundle.name}: ${matches}/${bundle.surfaces.length} = ${(rate * 100).toFixed(1)}%`,
      );
      if (bundleMismatches.length > 0) {
        for (const m of bundleMismatches) {
          console.log(`  MISMATCH ${m.meaningId}: authored=${m.authored} derived=${m.derived}`);
        }
      }
    }
  });
});
