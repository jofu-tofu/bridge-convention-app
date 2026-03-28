/**
 * Structural health characterization tests — lint + interference analysis
 * + explanation coverage baseline on all real bundles.
 *
 * These lock in the current static analysis state as proper CI tests,
 * replacing ad-hoc CLI `verify lint` and `verify interfere` runs.
 *
 * Explanation coverage tests enforce zero gaps between module facts/meanings
 * and their explanation catalog entries. These tests fail if a new fact or
 * meaning is added without a corresponding explanation entry.
 */

import { describe, it, expect } from "vitest";

// Side-effect import: registers all bundles + conventions
import "../../../conventions";

import { listBundleInputs, resolveBundle } from "../../../conventions/definitions/system-registry";
import { SAYC_SYSTEM_CONFIG } from "../../definitions/system-config";
import { lintModule } from "../../../cli/verify/lint";
import { analyzeBundle } from "../../../cli/verify/interfere";
import { moduleSurfaces } from "../../core/convention-module";
import type { ConventionBundle } from "../../core";
import type { ConventionModule } from "../../core/convention-module";
import type { LintDiagnostic } from "../../../cli/verify/types";
import type { FactExplanationEntry, MeaningExplanationEntry } from "../../core/explanation-catalog";

// ── Helpers ──────────────────────────────────────────────────────────

function getNonInternalBundles(): ConventionBundle[] {
  return listBundleInputs()
    .map(i => resolveBundle(i, SAYC_SYSTEM_CONFIG))
    .filter(
      (b): b is ConventionBundle => !b.internal && b.modules !== undefined && b.modules.length > 0,
    );
}

// ── Per-bundle lint ──────────────────────────────────────────────────

describe("per-bundle lint", () => {
  const bundles = getNonInternalBundles();

  describe.each(bundles.map((b) => [b.id, b] as const))("%s", (_id, bundle) => {
    it("has no lint errors", () => {
      const allDiags: LintDiagnostic[] = [];

      for (const mod of bundle.modules) {
        const diags = lintModule(mod);
        const errors = diags.filter((d) => d.severity === "error");
        allDiags.push(...errors);
      }

      // The Stayman 5-4 invite R1 surface intentionally shares encoding
      // (2C) and meaningId (stayman:ask-major) with the standard Stayman
      // R1 surface. They have mutually exclusive conditions (hasFiveCardMajor
      // false vs true) and represent the same bid meaning from different
      // hand patterns. Filter out this known, intentional duplicate.
      const unexpected = allDiags.filter(
        (d) =>
          !(
            d.ruleId === "duplicate-encoding" &&
            d.message.includes("stayman:ask-major")
          ),
      );

      expect(unexpected).toEqual([]);
    });
  });
});

// ── Per-bundle interference ──────────────────────────────────────────

describe("per-bundle interference", () => {
  const bundles = getNonInternalBundles();

  describe.each(bundles.map((b) => [b.id, b] as const))("%s", (_id, bundle) => {
    it("high-risk encoding collision count is stable", () => {
      const interactions = analyzeBundle(bundle.modules);

      // Cross-module encoding collisions at the same band are expected in
      // multi-module bundles (e.g., Stayman 2H vs Jacoby Transfer accept 2H).
      // The rule interpreter resolves these via phase scoping at runtime.
      // We snapshot the count so regressions are caught.
      const highRiskEncodingCollisions = interactions.flatMap((pair) =>
        pair.edges.filter(
          (edge) => edge.kind === "encoding-collision" && edge.risk === "high",
        ),
      );

      expect(highRiskEncodingCollisions.length).toMatchSnapshot();
    });

    it("interference risk summary is stable", () => {
      const interactions = analyzeBundle(bundle.modules);

      const summary = {
        high: interactions.filter((p) => p.riskLevel === "high").length,
        medium: interactions.filter((p) => p.riskLevel === "medium").length,
        low: interactions.filter((p) => p.riskLevel === "low").length,
        none: interactions.filter((p) => p.riskLevel === "none").length,
      };

      expect(summary).toMatchSnapshot();
    });
  });
});

// ── Lint warning stability ───────────────────────────────────────────

describe("lint warning stability", () => {
  const bundles = getNonInternalBundles();

  it.each(bundles.map((b) => [b.id, b] as const))(
    "%s warning count is stable",
    (_id, bundle) => {
      let warningCount = 0;

      for (const mod of bundle.modules) {
        const diags = lintModule(mod);
        warningCount += diags.filter((d) => d.severity === "warn").length;
      }

      expect(warningCount).toMatchSnapshot();
    },
  );
});

// ── Explanation coverage (enforced) ──────────────────────────────────
//
// These tests enforce that every module fact and meaning has a
// corresponding explanation catalog entry. Adding a new fact or meaning
// without an explanation entry will cause a test failure.

/** Collect all fact IDs from a module's FactCatalogExtension definitions. */
function collectModuleFactIds(mod: ConventionModule): string[] {
  return mod.facts.definitions.map((d) => d.id);
}

/** Collect all meaning IDs from a module's surfaces (via states). */
function collectModuleMeaningIds(mod: ConventionModule): string[] {
  return moduleSurfaces(mod).map((s) => s.meaningId);
}

/** Collect all factIds referenced by a module's explanation entries. */
function collectExplainedFactIds(mod: ConventionModule): Set<string> {
  return new Set(
    mod.explanationEntries
      .filter((e): e is FactExplanationEntry => "factId" in e)
      .map((e) => e.factId),
  );
}

/** Collect all meaningIds referenced by a module's explanation entries. */
function collectExplainedMeaningIds(mod: ConventionModule): Set<string> {
  return new Set(
    mod.explanationEntries
      .filter((e): e is MeaningExplanationEntry => "meaningId" in e)
      .map((e) => e.meaningId),
  );
}

/** Collect all valid fact IDs across all modules in a bundle + shared facts. */
function collectAllBundleFactIds(bundle: ConventionBundle): Set<string> {
  const ids = new Set<string>();
  for (const mod of bundle.modules) {
    for (const def of mod.facts.definitions) {
      ids.add(def.id);
    }
  }
  return ids;
}

/** Check if a fact ID is a shared/system fact (hand.*, bridge.*, system.*). */
function isSharedFactId(factId: string): boolean {
  return (
    factId.startsWith("hand.") ||
    factId.startsWith("bridge.") ||
    factId.startsWith("system.")
  );
}

/** Check if a fact ID contains $suit binding template (e.g., module.weakTwo.topHonorCount.$suit). */
function isSuitBindingTemplate(factId: string): boolean {
  return factId.includes("$suit");
}

describe("explanation coverage", () => {
  const bundles = getNonInternalBundles();

  describe("every module fact has an explanation entry", () => {
    for (const bundle of bundles) {
      for (const mod of bundle.modules) {
        it(`${bundle.id} / ${mod.moduleId}: fact → explanation coverage`, () => {
          const factIds = collectModuleFactIds(mod);
          const explainedFacts = collectExplainedFactIds(mod);

          const missing = factIds.filter((id) => !explainedFacts.has(id));

          // Enforced: every module fact must have an explanation entry
          expect(missing).toEqual([]);
        });
      }
    }
  });

  describe("every module meaning has an explanation entry", () => {
    for (const bundle of bundles) {
      for (const mod of bundle.modules) {
        it(`${bundle.id} / ${mod.moduleId}: meaning → explanation coverage`, () => {
          const meaningIds = collectModuleMeaningIds(mod);
          const explainedMeanings = collectExplainedMeaningIds(mod);

          const missing = meaningIds.filter((id) => !explainedMeanings.has(id));

          // Enforced: every module meaning must have an explanation entry
          expect(missing).toEqual([]);
        });
      }
    }
  });

  describe("all explanation entry factIds reference valid facts", () => {
    for (const bundle of bundles) {
      // Collect all fact IDs across the entire bundle — explanation entries
      // in one module may legitimately reference facts from sibling modules
      // (e.g., natural-bids explanations referencing stayman posterior facts).
      const bundleFactIds = collectAllBundleFactIds(bundle);

      for (const mod of bundle.modules) {
        it(`${bundle.id} / ${mod.moduleId}: explanation factIds are valid`, () => {
          const orphanedRefs: { explanationId: string; factId: string }[] = [];

          for (const entry of mod.explanationEntries) {
            if (!("factId" in entry)) continue;

            // Accept: shared/system facts, bundle-defined facts, $suit templates
            if (isSharedFactId(entry.factId)) continue;
            if (bundleFactIds.has(entry.factId)) continue;
            if (isSuitBindingTemplate(entry.factId)) continue;

            orphanedRefs.push({
              explanationId: entry.explanationId,
              factId: entry.factId,
            });
          }

          // Enforced: all explanation factIds must reference valid facts
          expect(orphanedRefs).toEqual([]);
        });
      }
    }
  });
});
