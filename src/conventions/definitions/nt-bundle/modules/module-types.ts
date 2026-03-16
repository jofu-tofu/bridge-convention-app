import type { MeaningSurface } from "../../../../core/contracts/meaning-surface";
import type {
  MachineState,
  MachineTransition,
  ConversationMachine,
} from "../../../core/runtime/machine-types";
import type { FactCatalogExtension } from "../../../../core/contracts/fact-catalog";
import type { ExplanationEntry } from "../../../../core/contracts/explanation-catalog";
import type { PedagogicalRelation } from "../../../../core/contracts/pedagogical-relations";

/**
 * A self-contained convention module within the 1NT response system.
 *
 * Each module owns its bidding logic, facts, FSM states, and teaching data.
 * Modules are composed bottom-up into bundles by the composition layer
 * (see ../compose.ts). The bundle handles cross-module concerns like
 * alternatives, inter-module pedagogical relations, and shared FSM
 * infrastructure (idle, nt-opened, responder-r1, terminal, nt-contested).
 */
export interface NtConventionModule {
  readonly moduleId: string;

  // ── Surfaces ──────────────────────────────────────────────────

  /** Surfaces for the R1 decision point (responder's first bid after 1NT-P).
   *  Each module contributes its own entry surfaces with its own clauses. */
  readonly r1Surfaces: readonly MeaningSurface[];

  /** Post-R1 surface groups (this module's conversation tree).
   *  Multiple modules may contribute to the same groupId; composition merges them. */
  readonly surfaceGroups: readonly {
    readonly groupId: string;
    readonly surfaces: readonly MeaningSurface[];
  }[];

  // ── Machine contribution ──────────────────────────────────────

  /** Transitions contributed to the shared responder-r1 dispatch state. */
  readonly r1Transitions: readonly MachineTransition[];

  /** Module-owned FSM states (post-R1 subtree). */
  readonly machineStates: readonly MachineState[];

  /** Transitions contributed to states owned by other modules.
   *  Hook transitions are prepended to the target state's transition array.
   *  Example: Smolen hooks into Stayman's responder-r3-stayman-2d state. */
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
