import type { RuntimeDiagnostic } from "./types";
import type { ConversationMachine } from "./machine-types";

/**
 * Validate a ConversationMachine for structural integrity.
 *
 * Checks:
 * - All transition targets reference existing states
 * - All parentId references exist
 * - No orphan states (all reachable from initial via transitions or parentId)
 * - No duplicate transition IDs within a state
 */
export function validateMachine(
  machine: ConversationMachine,
): readonly RuntimeDiagnostic[] {
  const diagnostics: RuntimeDiagnostic[] = [];
  const { states, initialStateId } = machine;

  // Check all parentId references exist
  for (const [stateId, state] of states) {
    if (state.parentId !== null && !states.has(state.parentId)) {
      diagnostics.push({
        level: "error",
        message: `State "${stateId}" references nonexistent parent "${state.parentId}"`,
      });
    }
  }

  // Check all transition targets exist + duplicate transition IDs
  for (const [stateId, state] of states) {
    const seenTransitionIds = new Set<string>();
    for (const transition of state.transitions) {
      if (!states.has(transition.target)) {
        diagnostics.push({
          level: "error",
          message: `Transition "${transition.transitionId}" in state "${stateId}" targets nonexistent state "${transition.target}"`,
        });
      }
      if (seenTransitionIds.has(transition.transitionId)) {
        diagnostics.push({
          level: "warn",
          message: `Duplicate transition ID "${transition.transitionId}" in state "${stateId}"`,
        });
      }
      seenTransitionIds.add(transition.transitionId);
    }
  }

  // Check for orphan states (not reachable from initial)
  const reachable = new Set<string>();

  function visit(stateId: string): void {
    if (reachable.has(stateId)) return;
    reachable.add(stateId);

    const state = states.get(stateId);
    if (!state) return;

    // Follow transitions
    for (const transition of state.transitions) {
      visit(transition.target);
    }
  }

  // Start from initial state
  visit(initialStateId);

  // Also mark states reachable via parentId chains from reachable states
  // A child state is reachable if any transition targets it OR it's the initial state
  // We also consider children of reachable states as reachable (parentId relationship)
  let changed = true;
  while (changed) {
    changed = false;
    for (const [stateId, state] of states) {
      if (!reachable.has(stateId) && state.parentId !== null && reachable.has(state.parentId)) {
        // A state whose parent is reachable is NOT automatically reachable
        // unless it can be transitioned to. Skip this — parentId is for inheritance.
      }
      // But a state that is reachable makes its transition targets reachable (already handled)
    }
  }

  // Also: states that are transition targets from any reachable state are reachable (already handled by visit)
  // Check: states reachable via parentId from reachable children need not be reachable themselves
  // Only report states that cannot be reached by any transition path from initialStateId
  for (const stateId of states.keys()) {
    if (!reachable.has(stateId)) {
      diagnostics.push({
        level: "warn",
        message: `State "${stateId}" is not reachable from initial state "${initialStateId}"`,
      });
    }
  }

  return diagnostics;
}
