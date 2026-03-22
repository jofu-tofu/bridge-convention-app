import type { DealConstraints, Deal, Auction } from "../../../engine/types";
import type { Seat } from "../../../engine/types";
import type { AlternativeGroup, IntentFamily } from "../../../core/contracts/tree-evaluation";
import type { SystemProfile } from "../../../core/contracts/agreement-module";
import type { ConventionConfig, ConventionTeaching } from "../../../core/contracts/convention";
import { ConventionCategory } from "../../../core/contracts/convention";
import type { SystemConfig } from "../../../core/contracts/system-config";
import type { RuleModule } from "../rule-module";

// ── Authored input ──────────────────────────────────────────────────

/**
 * What convention authors hand-write when defining a bundle.
 *
 * Does NOT include derived fields. Those are computed by `buildBundle()`
 * from module registrations and rule modules, and returned separately
 * as `DerivedTeachingContent`.
 */
export interface BundleInput {
  readonly id: string;
  readonly name: string;
  readonly memberIds: readonly string[];
  /** If true, hidden from UI picker (e.g., parity testing bundle). */
  readonly internal?: boolean;
  readonly dealConstraints: DealConstraints;
  /** Deal constraints for off-convention hands (convention doesn't apply).
   *  Used when the user enables off-convention practice in drill tuning.
   *  When absent, a generic inversion of dealConstraints is used. */
  readonly offConventionConstraints?: DealConstraints;
  /** Factory to regenerate deal constraints for a different base system config.
   *  When present, resolveConventionForSystem() uses this instead of the static dealConstraints. */
  readonly dealConstraintFactory?: (sys: SystemConfig) => DealConstraints;
  /** Factory to regenerate off-convention constraints for a different base system config. */
  readonly offConventionConstraintFactory?: (sys: SystemConfig) => DealConstraints;
  readonly defaultAuction?: (seat: Seat, deal?: Deal) => Auction | undefined;
  /** Optional system profile for profile-based module activation. */
  readonly systemProfile?: SystemProfile;
  /** Capabilities to inject into profile-based activation. Only capabilities
   *  declared here are provided — bundles without this field get no capabilities. */
  readonly declaredCapabilities?: Readonly<Record<string, string>>;
  /** Convention category for UI grouping. */
  readonly category: ConventionCategory;
  /** Human-readable description for UI display. */
  readonly description: string;
  /** Convention-level teaching metadata for learning UI. */
  readonly teaching?: ConventionTeaching;
  /** If set, drill infrastructure picks a random dealer from this list. */
  readonly allowedDealers?: readonly Seat[];
  /** Rule modules for rule-based surface selection. */
  readonly ruleModules?: readonly RuleModule[];
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
  /** @derived From ALTERNATIVES teachingTags on surfaces. */
  readonly acceptableAlternatives: readonly AlternativeGroup[];
  /** @derived From teachingTags + rule module structure. */
  readonly intentFamilies: readonly IntentFamily[];
}

// ── Full computed bundle ────────────────────────────────────────────

/**
 * Complete convention bundle: authored input + derived teaching content.
 *
 * Produced by `buildBundle()`. The `teaching` content is derived and
 * cannot be set by authors.
 */
export interface ConventionBundle extends BundleInput {
  /** System-level bidding configuration (HCP ranges, thresholds).
   *  Convention modules use this to parameterize system-dependent values
   *  (e.g. 1NT range, invite/game thresholds) instead of hardcoding them. */
  readonly systemConfig?: SystemConfig;
  /** Derived teaching/grading metadata (acceptableAlternatives, intentFamilies). */
  readonly derivedTeaching: DerivedTeachingContent;
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
  };
}

/**
 * Re-derive a ConventionConfig's deal constraints for a different SystemConfig.
 *
 * Uses the bundle's constraint factories when available. When a bundle has no
 * factories (its constraints don't depend on the base system), the original
 * ConventionConfig is returned unchanged.
 */
export function resolveConventionForSystem(
  config: ConventionConfig,
  bundle: ConventionBundle | undefined,
  sys: SystemConfig,
): ConventionConfig {
  if (!bundle) return config;

  const hasDealFactory = !!bundle.dealConstraintFactory;
  const hasOffFactory = !!bundle.offConventionConstraintFactory;

  // Nothing to regenerate — constraints don't depend on system config
  if (!hasDealFactory && !hasOffFactory) return config;

  return {
    ...config,
    ...(hasDealFactory ? { dealConstraints: bundle.dealConstraintFactory!(sys) } : {}),
    ...(hasOffFactory ? { offConventionConstraints: bundle.offConventionConstraintFactory!(sys) } : {}),
  };
}
