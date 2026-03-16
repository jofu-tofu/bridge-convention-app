import type { DealConstraints, Seat, Deal, Auction } from "../../../engine/types";
import type { MeaningSurface } from "../../../core/contracts/meaning";
import type { FactCatalogExtension } from "../../../core/contracts/fact-catalog";
import type { ExplanationCatalogIR } from "../../../core/contracts/explanation-catalog";
import type { AlternativeGroup, IntentFamily } from "../../../core/contracts/tree-evaluation";
import type { PedagogicalRelation } from "../../../core/contracts/teaching-projection";
import type { SystemProfileIR } from "../../../core/contracts/agreement-module";
import type { ConventionConfig } from "../types";
import { ConventionCategory } from "../types";
import type { ConversationMachine } from "../runtime/machine-types";

export interface RoutedSurfaceGroup {
  readonly groupId: string;
  readonly surfaces: readonly MeaningSurface[];
  /** Legacy predicate-based routing. New bundles use FSM-based routing via composeModules(). */
  readonly isActive?: (auction: Auction, seat: Seat) => boolean;
}

export interface ConventionBundle {
  readonly id: string;
  readonly name: string;
  readonly memberIds: readonly string[];
  /** If true, hidden from UI picker (e.g., parity testing bundle). */
  readonly internal?: boolean;
  readonly dealConstraints: DealConstraints;
  readonly defaultAuction?: (seat: Seat, deal?: Deal) => Auction | undefined;
  /** Meaning surfaces organized by group.
   *  When present, the meaning pipeline is used for this bundle. */
  readonly meaningSurfaces?: readonly {
    readonly groupId: string;
    readonly surfaces: readonly MeaningSurface[];
  }[];
  /** Fact catalog extensions from module definitions. */
  readonly factExtensions?: readonly FactCatalogExtension[];
  /** Optional surface router for round-aware filtering. When absent, all surfaces are evaluated. */
  readonly surfaceRouter?: (auction: Auction, seat: Seat) => readonly MeaningSurface[];
  /** Optional system profile for profile-based module activation. */
  readonly systemProfile?: SystemProfileIR;
  /** Optional conversation machine for hierarchical FSM-driven surface selection. */
  readonly conversationMachine?: ConversationMachine;
  /** Capabilities to inject into profile-based activation. Only capabilities
   *  declared here are provided — bundles without this field get no capabilities. */
  readonly declaredCapabilities?: Readonly<Record<string, string>>;
  /** Convention category for UI grouping. */
  readonly category?: ConventionCategory;
  /** Human-readable description for UI display. */
  readonly description?: string;
  /** Explanation catalog for enriching teaching projections with template keys. */
  readonly explanationCatalog?: ExplanationCatalogIR;
  /** Pedagogical relations for enriching WhyNot entries with family/strength relationships. */
  readonly pedagogicalRelations?: readonly PedagogicalRelation[];
  /** Alternative groups for grading acceptable alternatives in teaching resolution. */
  readonly acceptableAlternatives?: readonly AlternativeGroup[];
  /** Intent families for relationship-aware credit in teaching resolution. */
  readonly intentFamilies?: readonly IntentFamily[];
}

/**
 * Creates a ConventionConfig from a ConventionBundle with optional overrides.
 * Eliminates boilerplate convention-config.ts files in each bundle definition.
 */
export function createConventionConfigFromBundle(
  bundle: ConventionBundle,
  overrides: {
    name: string;
    description?: string;
    categoryFallback?: ConventionCategory;
  },
): ConventionConfig {
  return {
    id: bundle.id,
    name: overrides.name,
    description: overrides.description ?? bundle.description ?? "",
    category: bundle.category ?? overrides.categoryFallback ?? ConventionCategory.Constructive,
    dealConstraints: bundle.dealConstraints,
    defaultAuction: bundle.defaultAuction,
    internal: bundle.internal,
  };
}
