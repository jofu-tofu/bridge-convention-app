import type { DealConstraints, Deal, Auction } from "../../../engine/types";
import type { Seat } from "../../../engine/types";
import type { SurfaceGroup } from "../../../core/contracts/teaching-grading";
import type { SystemProfile } from "../../../core/contracts/agreement-module";
import type { ConventionConfig, ConventionTeaching } from "../../../core/contracts/convention";
import type { ConventionCategory } from "../../../core/contracts/convention";
import type { ConventionModule } from "../convention-module";
import { moduleSurfaces } from "../convention-module";

// ── Authored input ──────────────────────────────────────────────────

/**
 * What convention authors hand-write when defining a bundle.
 *
 * Deal constraints, off-convention constraints, default auction, and
 * allowed dealers are DERIVED from capabilities + R1 surface analysis
 * by `deriveBundleDealConstraints()` in `system-registry.ts`. Authors
 * declare `declaredCapabilities` and the derivation handles the rest.
 */
export interface BundleInput {
  readonly id: string;
  readonly name: string;
  readonly memberIds: readonly string[];
  /** If true, hidden from UI picker (e.g., parity testing bundle). */
  readonly internal?: boolean;
  /** Optional system profile for profile-based module activation. */
  readonly systemProfile?: SystemProfile;
  /** Capabilities to inject into profile-based activation. Only capabilities
   *  declared here are provided — bundles without this field get no capabilities.
   *  Also used by deal constraint derivation to determine opener constraints. */
  readonly declaredCapabilities?: Readonly<Record<string, string>>;
  /** Convention category for UI grouping. */
  readonly category: ConventionCategory;
  /** Human-readable description for UI display. */
  readonly description: string;
  /** Convention-level teaching metadata for learning UI. */
  readonly teaching?: ConventionTeaching;
  // ruleModules removed — modules are resolved by buildBundle() from memberIds via module-registry.
}

// ── Derived teaching content ────────────────────────────────────────

/**
 * Teaching/grading metadata derived from module content at bundle build time.
 * Computed by `buildBundle()`, NOT hand-authored.
 *
 * Stored alongside the bundle and passed to evaluation consumers for
 * bid grading (acceptable alternatives, near-miss detection).
 */
export interface DerivedTeachingContent {
  /** @derived From rule module structure. */
  readonly surfaceGroups: readonly SurfaceGroup[];
}

// ── Full computed bundle ────────────────────────────────────────────

/**
 * Complete convention bundle: authored input + derived constraints + derived teaching.
 *
 * Produced by `resolveBundle()`. Deal constraints are derived from capabilities
 * and R1 surface analysis — not hand-authored.
 */
export interface ConventionBundle extends BundleInput {
  /** Resolved convention modules (assembled by resolveBundle from memberIds). */
  readonly modules: readonly ConventionModule[];
  /** Derived teaching/grading metadata (surfaceGroups). */
  readonly derivedTeaching: DerivedTeachingContent;
  /** @derived Deal constraints from capability archetype + R1 surface analysis. */
  readonly dealConstraints: DealConstraints;
  /** @derived Off-convention constraints via complement negation. */
  readonly offConventionConstraints?: DealConstraints;
  /** @derived Default auction from capability archetype. */
  readonly defaultAuction?: (seat: Seat, deal?: Deal) => Auction | undefined;
  /** @derived Allowed dealers from capability archetype. */
  readonly allowedDealers?: readonly Seat[];
}

/** Checks whether any surface clause in any module references a system-provided fact.
 *  System facts have IDs prefixed with "system." (defined in system-fact-vocabulary.ts). */
function bundleUsesSystemFacts(modules: readonly ConventionModule[]): boolean {
  for (const mod of modules) {
    for (const surface of moduleSurfaces(mod)) {
      for (const clause of surface.clauses) {
        if (clause.factId.startsWith("system.")) return true;
      }
    }
  }
  return false;
}

/**
 * Creates a ConventionConfig from a ConventionBundle.
 * All metadata is derived from the bundle — no overrides needed.
 */
export function createConventionConfigFromBundle(
  bundle: ConventionBundle,
): ConventionConfig {
  return {
    id: bundle.id,
    name: bundle.name,
    description: bundle.description,
    category: bundle.category,
    dealConstraints: bundle.dealConstraints,
    offConventionConstraints: bundle.offConventionConstraints,
    defaultAuction: bundle.defaultAuction,
    internal: bundle.internal,
    teaching: bundle.teaching,
    allowedDealers: bundle.allowedDealers,
    variesBySystem: bundleUsesSystemFacts(bundle.modules) || undefined,
  };
}

/**
 * Re-derive a ConventionConfig's deal constraints for a different SystemConfig.
 *
 * With deal constraint derivation, constraints are always system-parameterized
 * via the capability archetype. The bundle's constraints are already derived
 * for the active system — re-resolve the bundle for a different system.
 *
 * @deprecated Prefer re-resolving the bundle via `resolveBundle(input, newSys)`.
 */
export function resolveConventionForSystem(
  config: ConventionConfig,
  _bundle: ConventionBundle | undefined,
  _sys: unknown,
): ConventionConfig {
  // Constraints are now always derived at bundle resolution time.
  // No factory-based re-derivation needed — the bundle already has
  // the correct constraints for its system.
  return config;
}
