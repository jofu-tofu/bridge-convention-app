/**
 * Machine assembler — compiles MachineFragments from ModulePackages into
 * a unified ConversationMachine.
 *
 * Creates an "idle" initial state (unless a fragment already provides one),
 * collects entry transitions from all fragments into the idle state,
 * and resolves handoffs by mapping frontier IDs to target state IDs.
 */
import type { MachineState, ConversationMachine } from "../runtime/machine-types";
import { buildConversationMachine } from "../runtime/machine-types";
import type { MachineFragment } from "./machine-fragment";
import type { HandoffSpec } from "./handoff";

export interface AssembleMachineOptions {
  /** Machine ID for the assembled conversation machine. */
  readonly machineId: string;
  /** If provided, these states are included as infrastructure states. */
  readonly skeletonStates?: readonly MachineState[];
  /** The state ID where entry transitions from fragments are injected.
   *  Defaults to "idle". If skeletonStates provides this state, entry
   *  transitions are appended to its existing transitions. */
  readonly dispatchStateId?: string;
}

export interface AssembleMachineResult {
  readonly machine: ConversationMachine;
  readonly submachines: ReadonlyMap<string, ConversationMachine>;
}

/**
 * Assemble MachineFragments and HandoffSpecs into a ConversationMachine.
 *
 * Algorithm:
 * 1. Collect all states from fragments into a state map
 * 2. Collect all entry transitions from fragments
 * 3. Build frontier index from all exported frontiers
 * 4. Resolve handoffs: for each handoff, look up the frontier's target state
 *    and prepend the handoff's transitions to that state
 * 5. Create or augment the idle state with collected entry transitions
 * 6. Build the final ConversationMachine
 */
export function assembleMachine(
  fragments: readonly MachineFragment[],
  handoffs: readonly HandoffSpec[],
  options: AssembleMachineOptions,
): AssembleMachineResult {
  const dispatchStateId = options.dispatchStateId ?? "idle";

  // 1. Collect all states from fragments + skeleton
  const stateMap = new Map<string, MachineState>();
  if (options.skeletonStates) {
    for (const state of options.skeletonStates) {
      stateMap.set(state.stateId, state);
    }
  }
  for (const fragment of fragments) {
    for (const state of fragment.states) {
      stateMap.set(state.stateId, state);
    }
  }

  // 2. Collect all entry transitions
  const allEntryTransitions = fragments.flatMap((f) => f.entryTransitions);

  // 3. Build frontier index
  const frontierIndex = new Map<string, string>();
  for (const fragment of fragments) {
    if (fragment.exportedFrontiers) {
      for (const frontier of fragment.exportedFrontiers) {
        frontierIndex.set(frontier.frontierId, frontier.stateId);
      }
    }
  }

  // 4. Resolve handoffs: prepend transitions to target states
  for (const handoff of handoffs) {
    if (handoff.trigger.kind === "frontier") {
      const targetStateId = frontierIndex.get(handoff.trigger.frontierId);
      if (targetStateId) {
        const targetState = stateMap.get(targetStateId);
        if (targetState) {
          stateMap.set(targetStateId, {
            ...targetState,
            transitions: [...handoff.transitions, ...targetState.transitions],
          });
        }
      }
    }
    // capability and visible-meaning triggers are resolved at runtime, not compile time
  }

  // 5. Inject entry transitions into the dispatch state
  const existingDispatch = stateMap.get(dispatchStateId);
  if (existingDispatch) {
    // Dispatch state exists (from skeleton or fragment) — append entry transitions
    stateMap.set(dispatchStateId, {
      ...existingDispatch,
      transitions: [...allEntryTransitions, ...existingDispatch.transitions],
    });
  } else {
    // Create auto-generated idle/dispatch state
    stateMap.set(dispatchStateId, {
      stateId: dispatchStateId,
      parentId: null,
      transitions: allEntryTransitions,
    });
  }

  // 6. Collect submachines
  const submachines = new Map<string, ConversationMachine>();
  for (const fragment of fragments) {
    if (fragment.submachines) {
      for (const [id, machine] of fragment.submachines) {
        submachines.set(id, machine);
      }
    }
  }

  // 7. Build the machine
  const allStates = Array.from(stateMap.values());
  const machine = buildConversationMachine(options.machineId, allStates);

  return { machine, submachines };
}
