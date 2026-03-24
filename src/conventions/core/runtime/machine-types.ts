/**
 * Machine types — retained for MachineRegisters re-export and ForcingState default.
 *
 * All FSM types (MachineState, MachineTransition, MachineEffect,
 * ConversationMachine, MachineEvalResult, MachineContext, SubmachineFrame)
 * have been removed. The rule-based system (RuleModule + NegotiationState)
 * replaced all FSM functionality.
 */

import type { MachineRegisters } from "../module-surface";
export type { MachineRegisters };
export { ForcingState } from "../../../strategy/bidding/bidding-types";
