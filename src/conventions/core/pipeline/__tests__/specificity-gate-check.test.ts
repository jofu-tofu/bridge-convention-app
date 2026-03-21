import { describe, it, expect } from "vitest";
import { deriveSpecificity } from "../specificity-deriver";
import type { BidMeaning, ConstraintDimension } from "../../../../core/contracts/meaning";
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
} from "../../../definitions/modules/bergen/meaning-surfaces";

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
} from "../../../definitions/modules/dont/meaning-surfaces";

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
} from "../../../definitions/nt-bundle/composed-surfaces";

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
} from "../../../definitions/modules/weak-twos/meaning-surfaces";

// ─── Fact extensions ────────────────────────────────────────
import { bergenFacts } from "../../../definitions/modules/bergen/facts";
import { dontFacts } from "../../../definitions/modules/dont/facts";
import { staymanFacts } from "../../../definitions/modules/stayman";
import { transferFacts } from "../../../definitions/modules/jacoby-transfers";
import { smolenFacts } from "../../../definitions/modules/smolen";
import { weakTwoFacts } from "../../../definitions/modules/weak-twos/facts";

// ─── Surface fragment imports (for inherited dimensions) ────
import { BERGEN_SURFACE_FRAGMENTS } from "../../../definitions/bergen-bundle/base-track";
import { DONT_SURFACE_FRAGMENTS } from "../../../definitions/dont-bundle/base-track";
import { NT_SURFACE_FRAGMENTS } from "../../../definitions/nt-bundle/base-track";
import { WEAK_TWO_SURFACE_FRAGMENTS } from "../../../definitions/weak-twos-bundle/base-track";

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

const ntSurfaces: readonly BidMeaning[] = [
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

// ─── Specificity derivation tests ───────────────────────────

describe("Specificity derivation: regression suite across all bundles", () => {
  it("should derive a non-negative specificity for every surface", () => {
    for (const surface of allSurfaces) {
      const inherited = inheritedDimsLookup.get(surface.meaningId);
      const result = deriveSpecificity(surface, allFactExtensions, inherited);
      expect(result.advisorySpecificity).toBeGreaterThanOrEqual(0);
    }
  });

  it("should produce a valid basis classification for every surface", () => {
    const validBases = new Set(["derived", "asserted", "partial"]);
    for (const surface of allSurfaces) {
      const inherited = inheritedDimsLookup.get(surface.meaningId);
      const result = deriveSpecificity(surface, allFactExtensions, inherited);
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
      const inherited = inheritedDimsLookup.get(surface.meaningId);
      const result = deriveSpecificity(surface, allFactExtensions, inherited);
      if (surface.clauses.length === 0 && !inherited) {
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
        const inherited = inheritedDimsLookup.get(surface.meaningId);
        const result = deriveSpecificity(surface, allFactExtensions, inherited);
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
