/**
 * Structural health characterization tests — lint + interference analysis
 * on all real bundles.
 *
 * These lock in the current static analysis state as proper CI tests,
 * replacing ad-hoc CLI `verify lint` and `verify interfere` runs.
 */

import { describe, it, expect } from "vitest";

// Side-effect import: registers all bundles + conventions
import "../../../conventions";

import { listSystemBundles } from "../../../conventions/definitions/system-registry";
import { lintModule } from "../../../cli/verify/lint";
import { analyzeBundle } from "../../../cli/verify/interfere";
import type { ConventionBundle } from "../../core";
import type { LintDiagnostic } from "../../../cli/verify/types";

// ── Helpers ──────────────────────────────────────────────────────────

function getNonInternalBundles(): ConventionBundle[] {
  return listSystemBundles().filter(
    (b) => !b.internal && b.ruleModules && b.ruleModules.length > 0,
  ) as ConventionBundle[];
}

// ── Per-bundle lint ──────────────────────────────────────────────────

describe("per-bundle lint", () => {
  const bundles = getNonInternalBundles();

  describe.each(bundles.map((b) => [b.id, b] as const))("%s", (_id, bundle) => {
    it("has no lint errors", () => {
      const allDiags: LintDiagnostic[] = [];

      for (const mod of bundle.ruleModules!) {
        const diags = lintModule(mod);
        const errors = diags.filter((d) => d.severity === "error");
        allDiags.push(...errors);
      }

      expect(allDiags).toEqual([]);
    });
  });
});

// ── Per-bundle interference ──────────────────────────────────────────

describe("per-bundle interference", () => {
  const bundles = getNonInternalBundles();

  describe.each(bundles.map((b) => [b.id, b] as const))("%s", (_id, bundle) => {
    it("high-risk encoding collision count is stable", () => {
      const interactions = analyzeBundle(bundle.ruleModules!);

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
      const interactions = analyzeBundle(bundle.ruleModules!);

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

      for (const mod of bundle.ruleModules!) {
        const diags = lintModule(mod);
        warningCount += diags.filter((d) => d.severity === "warn").length;
      }

      expect(warningCount).toMatchSnapshot();
    },
  );
});
