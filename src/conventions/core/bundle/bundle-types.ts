import type { DealConstraints, Deal, Auction } from "../../../engine/types";
import type { Seat } from "../../../engine/types";
import type { FactCatalogExtension } from "../../../core/contracts/fact-catalog";
import type { ExplanationCatalog } from "../../../core/contracts/explanation-catalog";
import type { AlternativeGroup, IntentFamily } from "../../../core/contracts/tree-evaluation";
import type { TeachingRelation } from "../../../core/contracts/teaching-projection";
import type { SystemProfile } from "../../../core/contracts/agreement-module";
import type { ConventionConfig, ConventionTeaching } from "../../../core/contracts/convention";
import { ConventionCategory } from "../../../core/contracts/convention";
import type { SystemConfig } from "../../../core/contracts/system-config";
import type { RuleModule } from "../rule-module";

export interface ConventionBundle {
  readonly id: string;
  readonly name: string;
  readonly memberIds: readonly string[];
  /** If true, hidden from UI picker (e.g., parity testing bundle). */
  readonly internal?: boolean;
  /** System-level bidding configuration (HCP ranges, thresholds).
   *  Convention modules use this to parameterize system-dependent values
   *  (e.g. 1NT range, invite/game thresholds) instead of hardcoding them. */
  readonly systemConfig?: SystemConfig;
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
  /** Fact catalog extensions from module definitions. */
  readonly factExtensions?: readonly FactCatalogExtension[];
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
  /** Explanation catalog for enriching teaching projections with template keys. */
  readonly explanationCatalog: ExplanationCatalog;
  /** Pedagogical relations for enriching WhyNot entries with family/strength relationships. */
  readonly teachingRelations: readonly TeachingRelation[];
  /** Alternative groups for grading acceptable alternatives in teaching resolution. */
  readonly acceptableAlternatives: readonly AlternativeGroup[];
  /** Intent families for relationship-aware credit in teaching resolution. */
  readonly intentFamilies: readonly IntentFamily[];
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
