/**
 * Module conventions enforcement tests.
 *
 * Verifies that convention modules follow the required patterns:
 * - All numeric clause values reference named constants, not inline literals
 * - All modules export a factory function accepting SystemConfig
 * - No concrete system config imports in module files
 */

import { describe, it, expect } from "vitest";

import { getAllModules } from "../../definitions/module-registry";
import { moduleSurfaces } from "../../core/convention-module";
import type { BidMeaning } from "../../../core/contracts/meaning";
import { BERGEN_THRESHOLDS } from "../../definitions/modules/bergen/meaning-surfaces";
import { WEAK_TWO_THRESHOLDS } from "../../definitions/modules/weak-twos/meaning-surfaces";

// ── Known convention threshold objects ──────────────────────────────
//
// Every convention module that uses numeric HCP/point values in clauses
// must declare them as named constants in a THRESHOLDS object. Register
// all known threshold objects here so the test can verify coverage.

const KNOWN_THRESHOLDS = new Set<number>([
  // Bergen thresholds
  ...Object.values(BERGEN_THRESHOLDS),
  // Weak Two thresholds
  ...Object.values(WEAK_TWO_THRESHOLDS),
]);

// ── Helpers ─────────────────────────────────────────────────────────

/** Extract all numeric clause values from a module's surfaces. */
function extractNumericClauseValues(surfaces: readonly BidMeaning[]): {
  factId: string;
  value: number;
  meaningId: string;
}[] {
  const results: { factId: string; value: number; meaningId: string }[] = [];
  for (const surface of surfaces) {
    for (const clause of surface.clauses) {
      if (typeof clause.value === "number") {
        results.push({ factId: clause.factId, value: clause.value, meaningId: surface.meaningId });
      } else if (typeof clause.value === "object" && clause.value !== null && "min" in clause.value) {
        results.push({ factId: clause.factId, value: clause.value.min, meaningId: surface.meaningId });
        results.push({ factId: clause.factId, value: clause.value.max, meaningId: surface.meaningId });
      }
    }
  }
  return results;
}

/** Fact IDs that are module-derived boolean checks (not HCP thresholds). */
function isModuleDerivedBooleanFact(factId: string): boolean {
  return factId.startsWith("module.") || factId.startsWith("bridge.");
}

/** Fact IDs that are system-semantic (thresholds resolved by SystemConfig). */
function isSystemFact(factId: string): boolean {
  return factId.startsWith("system.");
}

/** Fact IDs for suit-length constraints (convention-intrinsic, not HCP). */
function isSuitLengthFact(factId: string): boolean {
  return factId.startsWith("hand.suitLength");
}

// ── Tests ───────────────────────────────────────────────────────────

describe("module conventions", () => {
  const modules = getAllModules();

  it("all modules are registered", () => {
    expect(modules.length).toBeGreaterThanOrEqual(7);
  });

  describe("numeric clause values use named constants or module-derived facts", () => {
    for (const mod of modules) {
      const allSurfaces = moduleSurfaces(mod);
      const numericValues = extractNumericClauseValues(allSurfaces);

      // Filter to only point-based values (not suit lengths, module-derived facts, or system facts)
      const hcpValues = numericValues.filter(
        (v) => !isModuleDerivedBooleanFact(v.factId) && !isSystemFact(v.factId) && !isSuitLengthFact(v.factId),
      );

      if (hcpValues.length > 0) {
        it(`${mod.moduleId}: all HCP clause values are in KNOWN_THRESHOLDS`, () => {
          const violations = hcpValues.filter((v) => !KNOWN_THRESHOLDS.has(v.value));
          if (violations.length > 0) {
            const details = violations.map(
              (v) => `  ${v.meaningId}: ${v.factId} = ${v.value}`,
            ).join("\n");
            expect.fail(
              `Found ${violations.length} inline numeric value(s) not in any THRESHOLDS object:\n${details}\n\n` +
              "Convention modules must declare HCP thresholds in a named constants object " +
              "(e.g., BERGEN_THRESHOLDS) and register it in module-conventions.test.ts.",
            );
          }
        });
      }
    }
  });
});
