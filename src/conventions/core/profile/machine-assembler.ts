/**
 * Machine assembler: combines MachineFragment[] into a ConversationMachine.
 *
 * Strategy:
 * 1. Create infrastructure "idle" state as initial state
 * 2. Idle state gets all fragments' entryTransitions (dispatch point)
 * 3. Collect all states from all fragments
 * 4. For each HandoffSpec: find the frontier's stateId, prepend handoff transitions
 * 5. Call buildConversationMachine() to produce the final machine
 */

import type { MachineFragment, HandoffSpec } from "../modules";
import type { MachineState, ConversationMachine } from "../runtime/machine-types";
import { buildConversationMachine } from "../runtime/machine-types";

/**
 * Assemble a ConversationMachine from module fragments and cross-module handoffs.
 *
 * @param machineId - Unique ID for the assembled machine
 * @param fragments - MachineFragment[] from all module packages
 * @param handoffs - HandoffSpec[] for cross-module coupling via frontiers
 * @returns A fully assembled ConversationMachine
 */
export function assembleMachine(
  machineId: string,
  fragments: readonly MachineFragment[],
  handoffs: readonly HandoffSpec[],
): ConversationMachine {
  // 1. Collect all entry transitions from fragments
  const allEntryTransitions = fragments.flatMap((f) => f.entryTransitions);

  // 2. Create the infrastructure idle state with entry transitions as dispatch
  const idleState: MachineState = {
    stateId: "idle",
    parentId: null,
    transitions: allEntryTransitions,
  };

  // 3. Collect all states from all fragments into a mutable map for handoff patching
  const stateMap = new Map<string, MachineState>();
  for (const fragment of fragments) {
    for (const state of fragment.states) {
      stateMap.set(state.stateId, state);
    }
  }

  // 4. Build a frontier-to-stateId index across all fragments
  const frontierIndex = new Map<string, string>();
  for (const fragment of fragments) {
    for (const frontier of fragment.exportedFrontiers ?? []) {
      frontierIndex.set(frontier.frontierId, frontier.stateId);
    }
  }

  // 5. Resolve handoff boundaries: prepend handoff transitions to frontier states
  for (const handoff of handoffs) {
    if (handoff.trigger.kind !== "frontier") continue; // Only frontier triggers resolve via state mapping
    const targetStateId = frontierIndex.get(handoff.trigger.frontierId);
    if (targetStateId === undefined) {
      continue; // Frontier not found — skip silently (could add diagnostics later)
    }
    const existingState = stateMap.get(targetStateId);
    if (existingState === undefined) {
      continue;
    }
    // Prepend handoff transitions before existing transitions
    const patchedState: MachineState = {
      ...existingState,
      transitions: [...handoff.transitions, ...existingState.transitions],
    };
    stateMap.set(targetStateId, patchedState);
  }

  // 6. Assemble final states array: idle + all fragment states
  const allStates: MachineState[] = [idleState, ...stateMap.values()];

  return buildConversationMachine(machineId, allStates);
}
