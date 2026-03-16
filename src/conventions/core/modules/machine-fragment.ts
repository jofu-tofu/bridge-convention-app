import type { MachineState, MachineTransition, ConversationMachine } from "../runtime/machine-types";

/** A frontier exported by a module for other modules to attach to. */
export interface FrontierDeclaration {
  /** Semantic frontier ID (e.g., "stayman:deny-major"). */
  readonly frontierId: string;
  /** The internal state ID this frontier maps to. Only the profile compiler uses this. */
  readonly stateId: string;
}

/** A module's local FSM contribution. */
export interface MachineFragment {
  readonly states: readonly MachineState[];
  readonly entryTransitions: readonly MachineTransition[];
  readonly exportedFrontiers?: readonly FrontierDeclaration[];
  readonly submachines?: ReadonlyMap<string, ConversationMachine>;
}
