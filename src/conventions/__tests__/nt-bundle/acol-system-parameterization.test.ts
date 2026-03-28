/**
 * Acol system parameterization tests.
 *
 * Verifies that rule module factories produce surfaces with Acol-correct
 * thresholds when parameterized with ACOL_SYSTEM_CONFIG (12-14 HCP for
 * 1NT opening, 10+ HCP for Stayman entry).
 */
import { describe, it, expect } from "vitest";
import { ACOL_SYSTEM_CONFIG, SAYC_SYSTEM_CONFIG } from "../../definitions/system-config";
import { moduleSurfaces } from "../../core/convention-module";
import { getModule } from "../../definitions/module-registry";
import { getBundleInput, specFromBundle } from "../../definitions/system-registry";

// ── Helpers ──────────────────────────────────────────────────────

/** Extract a surface by meaningId from a module's rules. */
function findSurface(moduleId: string, meaningId: string, sys = ACOL_SYSTEM_CONFIG) {
  const mod = getModule(moduleId, sys);
  expect(mod).toBeDefined();
  const surfaces = moduleSurfaces(mod!);
  return surfaces.find((s) => s.meaningId === meaningId);
}

/** Find a clause with the given factId and operator on a surface. */
function findClause(
  surface: { clauses: readonly { factId: string; operator: string; value: unknown }[] },
  factId: string,
  operator: string,
) {
  return surface.clauses.find((c) => c.factId === factId && c.operator === operator);
}

// ── Natural NT: 1NT opening surface ──────────────────────────────

describe("Acol 1NT opening surface (natural-bids rules)", () => {
  it("has 12+ HCP minimum for 1NT opening", () => {
    const surface = findSurface("natural-bids", "bridge:1nt-opening");
    expect(surface).toBeDefined();
    const gteClause = findClause(surface!, "hand.hcp", "gte");
    expect(gteClause).toBeDefined();
    expect(gteClause!.value).toBe(12);
  });

  it("has 14 HCP maximum for 1NT opening", () => {
    const surface = findSurface("natural-bids", "bridge:1nt-opening");
    expect(surface).toBeDefined();
    const lteClause = findClause(surface!, "hand.hcp", "lte");
    expect(lteClause).toBeDefined();
    expect(lteClause!.value).toBe(14);
  });

  it("has teaching label '12 to 14'", () => {
    const surface = findSurface("natural-bids", "bridge:1nt-opening");
    expect(surface).toBeDefined();
    expect(surface!.teachingLabel.name).toBe("12 to 14");
  });
});

// ── Stayman: R1 entry surface ────────────────────────────────────

describe("Acol Stayman R1 surface (stayman rules)", () => {
  it("requires 10+ HCP for Stayman entry (Acol)", () => {
    const surface = findSurface("stayman", "stayman:ask-major");
    expect(surface).toBeDefined();
    const gteClause = findClause(surface!, "hand.hcp", "gte");
    expect(gteClause).toBeDefined();
    expect(gteClause!.value).toBe(10);
  });
});

// ── SAYC baseline: verify originals are unchanged ────────────────

describe("SAYC surfaces remain unchanged", () => {
  it("SAYC 1NT opening has 15+ HCP minimum", () => {
    const surface = findSurface("natural-bids", "bridge:1nt-opening", SAYC_SYSTEM_CONFIG);
    expect(surface).toBeDefined();
    const gteClause = findClause(surface!, "hand.hcp", "gte");
    expect(gteClause!.value).toBe(15);
  });

  it("SAYC Stayman requires 8+ HCP", () => {
    const surface = findSurface("stayman", "stayman:ask-major", SAYC_SYSTEM_CONFIG);
    expect(surface).toBeDefined();
    const gteClause = findClause(surface!, "hand.hcp", "gte");
    expect(gteClause!.value).toBe(8);
  });
});

// ── Acol bundle-level verification (via resolveBundle) ───────────

describe("specFromBundle with Acol has correct thresholds", () => {
  it("spec surfaces include Acol thresholds (natural-bids via base modules)", () => {
    const input = getBundleInput("nt-bundle")!;
    const spec = specFromBundle(input, ACOL_SYSTEM_CONFIG)!;
    const allSurfaces = spec.modules.flatMap((m) => moduleSurfaces(m));
    const opening = allSurfaces.find((s) => s.meaningId === "bridge:1nt-opening");
    expect(opening).toBeDefined();
    const gteClause = findClause(opening!, "hand.hcp", "gte");
    expect(gteClause!.value).toBe(12);
  });
});
