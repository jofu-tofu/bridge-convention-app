import type { MeaningSurface } from "../../../core/contracts/meaning";
import type {
  MachineState,
  MachineTransition,
  ConversationMachine,
} from "../runtime/machine-types";
import type { FactCatalogExtension } from "../../../core/contracts/fact-catalog";
import type { ExplanationEntry } from "../../../core/contracts/explanation-catalog";
import type { PedagogicalRelation } from "../../../core/contracts/teaching-projection";

/**
 * A self-contained convention module that can be composed into a bundle.
 *
 * Each module owns its bidding logic, facts, FSM states, and teaching data.
 * Modules are composed bottom-up into bundles by a composition layer that
 * provides shared FSM infrastructure (via BundleSkeleton) and handles
 * cross-module concerns.
 *
 * The "entry" concept generalizes the dispatch point where modules plug in:
 * - For 1NT responses: the responder-r1 state after 1NT-P
 * - For Bergen: the responder-r1-{suit} state after 1M-P
 * - For DONT: the overcaller-r1 state after opponent's 1NT
 */
export interface ConventionModule {
  readonly moduleId: string;

  // ── Dependencies ───────────────────────────────────────────────

  /** Fact IDs this module requires from other modules.
   *  Composition validates that all declared dependencies are satisfied. */
  readonly requires?: readonly string[];

  /** State IDs this module exposes for other modules to hook into.
   *  Maps a symbolic name to the actual state ID, enabling refactor-safe hooks.
   *  Example: Stayman exposes { afterOpener2D: "responder-r3-stayman-2d" }. */
  readonly exposedStates?: Readonly<Record<string, string>>;

  // ── Surfaces ──────────────────────────────────────────────────

  /** Surfaces for the shared entry/dispatch point.
   *  Each module contributes its own entry surfaces with its own clauses. */
  readonly entrySurfaces: readonly MeaningSurface[];

  /** Post-entry surface groups (this module's conversation tree).
   *  Multiple modules may contribute to the same groupId; composition merges them. */
  readonly surfaceGroups: readonly {
    readonly groupId: string;
    readonly surfaces: readonly MeaningSurface[];
  }[];

  // ── Machine contribution ──────────────────────────────────────

  /** Transitions contributed to the shared entry/dispatch state. */
  readonly entryTransitions: readonly MachineTransition[];

  /** Module-owned FSM states (post-entry subtree). */
  readonly machineStates: readonly MachineState[];

  /** Transitions contributed to states owned by other modules.
   *  Hook transitions are prepended to the target state's transition array.
   *  Use the target module's `exposedStates` for refactor-safe state references. */
  readonly hookTransitions?: readonly {
    readonly targetStateId: string;
    readonly transitions: readonly MachineTransition[];
  }[];

  /** Submachines this module requires. */
  readonly submachines?: ReadonlyMap<string, ConversationMachine>;

  // ── Facts ─────────────────────────────────────────────────────

  readonly facts: FactCatalogExtension;

  // ── Teaching ──────────────────────────────────────────────────

  /** Explanation entries for teaching projections. */
  readonly explanationEntries: readonly ExplanationEntry[];

  /** Intra-module pedagogical relations. */
  readonly pedagogicalRelations: readonly PedagogicalRelation[];
}
