/**
 * Convention bundle factory — eliminates boilerplate when defining new bundles.
 *
 * Usage:
 *   export const myBundle = createBundle({ id: "my-bundle", ... });
 *
 * The factory defaults array-typed optional fields to `[]` so callers
 * only specify what their convention actually provides.
 */
import type { ConventionBundle } from "./bundle-types";
import type { DealConstraints, Seat, Deal, Auction } from "../../../engine/types";
import type { MeaningSurface } from "../../../core/contracts/meaning";
import type { FactCatalogExtension } from "../../../core/contracts/fact-catalog";
import type { ConversationMachine } from "../runtime/machine-types";
import type { SystemProfileIR } from "../../../core/contracts/agreement-module";
import type { ExplanationCatalogIR } from "../../../core/contracts/explanation-catalog";
import type { PedagogicalRelation } from "../../../core/contracts/teaching-projection";
import type { AlternativeGroup, IntentFamily } from "../../../core/contracts/tree-evaluation";
import type { ConventionCategory } from "../types";

// ── Config accepted by the factory ──────────────────────────────────────

export interface CreateBundleConfig {
  // ── Identity (required) ───────────────────────────────────────────────
  readonly id: string;
  readonly name: string;
  readonly memberIds: readonly string[];

  // ── Deal setup (required) ─────────────────────────────────────────────
  readonly dealConstraints: DealConstraints;

  // ── Core pipeline (required) ──────────────────────────────────────────
  readonly meaningSurfaces: readonly {
    readonly groupId: string;
    readonly surfaces: readonly MeaningSurface[];
  }[];
  readonly conversationMachine: ConversationMachine;
  readonly systemProfile: SystemProfileIR;

  // ── Optional — defaults to `[]` for arrays, `undefined` for scalars ──
  readonly internal?: boolean;
  readonly defaultAuction?: (seat: Seat, deal?: Deal) => Auction | undefined;
  readonly factExtensions?: readonly FactCatalogExtension[];
  readonly surfaceRouter?: ConventionBundle["surfaceRouter"];
  readonly declaredCapabilities?: Readonly<Record<string, string>>;
  readonly category?: ConventionCategory;
  readonly description?: string;
  readonly explanationCatalog?: ExplanationCatalogIR;
  readonly pedagogicalRelations?: readonly PedagogicalRelation[];
  readonly acceptableAlternatives?: readonly AlternativeGroup[];
  readonly intentFamilies?: readonly IntentFamily[];
}

// ── Factory ─────────────────────────────────────────────────────────────

export function createBundle(config: CreateBundleConfig): ConventionBundle {
  return {
    // Identity
    id: config.id,
    name: config.name,
    memberIds: config.memberIds,

    // Deal setup
    dealConstraints: config.dealConstraints,

    // Core pipeline
    meaningSurfaces: config.meaningSurfaces,
    conversationMachine: config.conversationMachine,
    systemProfile: config.systemProfile,

    // Optional — scalars pass through
    internal: config.internal,
    defaultAuction: config.defaultAuction,
    surfaceRouter: config.surfaceRouter,
    declaredCapabilities: config.declaredCapabilities,
    category: config.category,
    description: config.description,
    explanationCatalog: config.explanationCatalog,

    // Optional — arrays default to []
    factExtensions: config.factExtensions ?? [],
    pedagogicalRelations: config.pedagogicalRelations ?? [],
    acceptableAlternatives: config.acceptableAlternatives ?? [],
    intentFamilies: config.intentFamilies ?? [],
  };
}
