/**
 * Convention bundle factory — every bundle is composed from modules.
 *
 * Usage:
 *   const composed = composeModules(skeleton, [myModule]);
 *   export const myBundle = createBundle({ id: "my-bundle", composed, ... });
 *
 * The factory maps ComposedBundle fields into ConventionBundle shape and
 * defaults array-typed optional fields to `[]`.
 */
import type { ConventionBundle } from "./bundle-types";
import type { DealConstraints, Seat, Deal, Auction } from "../../../engine/types";
import type { SystemProfileIR } from "../../../core/contracts/agreement-module";
import type { AlternativeGroup, IntentFamily } from "../../../core/contracts/tree-evaluation";
import type { ConventionCategory } from "../types";
import type { ComposedBundle } from "../composition/compose";

// ── Config accepted by the factory ──────────────────────────────────────

export interface CreateBundleConfig {
  // ── Identity (required) ───────────────────────────────────────────────
  readonly id: string;
  readonly name: string;
  readonly memberIds: readonly string[];

  // ── Composition result (required) ─────────────────────────────────────
  /** The result of composeModules(skeleton, modules). All pipeline fields
   *  (surfaces, FSM, facts, router, explanations, pedagogy) come from here. */
  readonly composed: ComposedBundle;

  // ── Bundle-level concerns (required) ──────────────────────────────────
  readonly dealConstraints: DealConstraints;
  readonly systemProfile: SystemProfileIR;

  // ── Optional — defaults to `[]` for arrays, `undefined` for scalars ──
  readonly internal?: boolean;
  readonly defaultAuction?: (seat: Seat, deal?: Deal) => Auction | undefined;
  readonly declaredCapabilities?: Readonly<Record<string, string>>;
  readonly category?: ConventionCategory;
  readonly description?: string;
  readonly acceptableAlternatives?: readonly AlternativeGroup[];
  readonly intentFamilies?: readonly IntentFamily[];
}

// ── Factory ─────────────────────────────────────────────────────────────

export function createBundle(config: CreateBundleConfig): ConventionBundle {
  const { composed } = config;
  return {
    // Identity
    id: config.id,
    name: config.name,
    memberIds: config.memberIds,

    // Pipeline — derived from composition
    meaningSurfaces: [
      { groupId: composed.entrySurfaceGroupId, surfaces: composed.entrySurfaces },
      ...composed.surfaceGroups,
    ],
    conversationMachine: composed.conversationMachine,
    submachines: composed.submachines,
    factExtensions: composed.factExtensions,
    surfaceRouter: composed.surfaceRouter,
    explanationCatalog: composed.explanationCatalog,
    pedagogicalRelations: composed.pedagogicalRelations,

    // Bundle-level concerns
    dealConstraints: config.dealConstraints,
    systemProfile: config.systemProfile,

    // Optional — scalars pass through
    internal: config.internal,
    defaultAuction: config.defaultAuction,
    declaredCapabilities: config.declaredCapabilities,
    category: config.category,
    description: config.description,

    // Optional — arrays default to []
    acceptableAlternatives: config.acceptableAlternatives ?? [],
    intentFamilies: config.intentFamilies ?? [],
  };
}
