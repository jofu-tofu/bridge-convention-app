/**
 * MachineFragment — a module's FSM contribution to the compiled machine.
 *
 * Each module contributes states, entry transitions (for the dispatch point),
 * and optionally declares exported frontiers that other modules can hand off to.
 */
import type {
  MachineState,
  MachineTransition,
  ConversationMachine,
} from "../runtime/machine-types";

/**
 * A named frontier that a module exports for cross-module handoff.
 *
 * Frontiers are the decoupled alternative to exposed states:
 * instead of one module knowing another module's state ID,
 * the exporting module declares a frontier with a semantic name,
 * and the consuming module references that frontier by ID.
 */
export interface FrontierDeclaration {
  /** Semantic identifier for this frontier (e.g., "stayman:deny-major"). */
  readonly frontierId: string;
  /** The actual machine state ID this frontier maps to. */
  readonly stateId: string;
}

/**
 * A module's FSM contribution to the assembled machine.
 */
export interface MachineFragment {
  /** Module-owned FSM states. */
  readonly states: readonly MachineState[];
  /** Transitions to be added to the dispatch/entry state. */
  readonly entryTransitions: readonly MachineTransition[];
  /** Frontiers this module exports for other modules to hand off to. */
  readonly exportedFrontiers?: readonly FrontierDeclaration[];
  /** Submachines this module contributes. */
  readonly submachines?: ReadonlyMap<string, ConversationMachine>;
}
