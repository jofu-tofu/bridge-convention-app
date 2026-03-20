/**
 * ConventionModule — the formal contract for a self-contained convention module.
 *
 * A module is an independent unit of bidding logic. It owns its surfaces, facts,
 * FSM states, teaching metadata, and grading metadata. Modules must NOT import
 * from other modules — this is the fundamental decoupling invariant.
 *
 * Bundles (bidding systems) compose modules via system profiles. Cross-module
 * wiring (hook transitions, composed surfaces, cross-module pedagogical relations)
 * belongs exclusively at the system/bundle level.
 */

import type { MeaningSurface } from "./meaning";
import type { FactCatalogExtension } from "./fact-catalog";
import type { ExplanationEntry } from "./explanation-catalog";
import type { PedagogicalRelation } from "./teaching-projection";
import type { AlternativeGroup, IntentFamily } from "./tree-evaluation";
import type {
  MachineState,
  MachineTransition,
  ConversationMachine,
} from "../../conventions/core/runtime/machine-types";

export interface ConventionModule {
  /** Unique module identifier (kebab-case). */
  readonly moduleId: string;

  // ── Bidding logic ────────────────────────────────────────────

  /** Entry-round surfaces (responder's first bid options). */
  readonly entrySurfaces: readonly MeaningSurface[];

  /** Named surface groups for subsequent rounds/states. */
  readonly surfaceGroups: readonly {
    readonly groupId: string;
    readonly surfaces: readonly MeaningSurface[];
  }[];

  /** Entry-round FSM transitions. */
  readonly entryTransitions: readonly MachineTransition[];

  /** FSM states owned by this module. */
  readonly machineStates: readonly MachineState[];

  /** Module-derived fact definitions and evaluators. */
  readonly facts: FactCatalogExtension;

  // ── Teaching ─────────────────────────────────────────────────

  /** Explanation entries for teaching projections. */
  readonly explanationEntries: readonly ExplanationEntry[];

  /** Pedagogical relation graph (intra-module only). */
  readonly pedagogicalRelations: readonly PedagogicalRelation[];

  // ── Grading ──────────────────────────────────────────────────

  /** Alternative groups for grading tolerance (intra-module only). */
  readonly alternatives: readonly AlternativeGroup[];

  /** Intent families for relationship-aware grading credit. */
  readonly intentFamilies: readonly IntentFamily[];

  // ── Optional extensions ──────────────────────────────────────

  /** Hook transitions to inject into another module's FSM state.
   *  Applied by the bundle/system composition layer, not by the module itself.
   *  Uses string state IDs — no direct imports from other modules. */
  readonly hookTransitions?: readonly {
    readonly targetStateId: string;
    readonly transitions: readonly MachineTransition[];
  }[];

  /** Submachines for nested FSM invocation. */
  readonly submachines?: ReadonlyMap<string, ConversationMachine>;

  /** States exposed to the composition layer for hook wiring.
   *  Keys are semantic names, values are FSM state IDs. */
  readonly exposedStates?: Readonly<Record<string, string>>;
}
