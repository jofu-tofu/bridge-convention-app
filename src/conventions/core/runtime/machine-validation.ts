import type { RuntimeDiagnostic } from "./types";
import type { ConversationMachine, MachineState, TransitionMatch } from "./machine-types";

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

  // Note: parentId is for inheritance, not reachability — a child is only
  // reachable if a transition targets it. Transition reachability is fully
  // handled by the visit() traversal above.
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

// ── Transition Completeness Validation ──────────────────────────────

/**
 * Canonical key for a TransitionMatch — two matches with the same key
 * would match the same input, so a child transition with this key
 * preempts a parent transition with the same key.
 */
function matchKey(match: TransitionMatch): string {
  switch (match.kind) {
    case "call":
      return `call:${match.level}${match.strain}`;
    case "pass":
      return match.seatRole ? `pass:${match.seatRole}` : "pass";
    case "any-bid":
      return "any-bid";
    case "opponent-action": {
      const parts = ["opponent-action"];
      if (match.callType) parts.push(match.callType);
      if (match.level !== undefined) parts.push(String(match.level));
      if (match.strain !== undefined) parts.push(match.strain);
      return parts.join(":");
    }
    case "predicate":
      return `predicate:${match.test.toString().slice(0, 60)}`;
    case "submachine-return":
      return "submachine-return";
  }
}

/** Broad category — a child transition covers a parent transition if they
 *  share the same broadKey (e.g., any "pass" covers any "pass"). */
function broadKey(match: TransitionMatch): string {
  switch (match.kind) {
    case "call":
    case "any-bid":
      return "bid";
    case "pass":
      return "pass";
    case "opponent-action":
      return "opponent-action";
    case "predicate":
      return "predicate";
    case "submachine-return":
      return "submachine-return";
  }
}

/** A parent leak: a parent transition that will fire for a child state
 *  because the child has no transition that preempts it. */
export interface ParentTransitionLeak {
  readonly childStateId: string;
  readonly parentStateId: string;
  readonly parentTransitionId: string;
  readonly parentTransitionMatch: TransitionMatch;
  readonly parentTransitionTarget: string;
}

/**
 * Validate transition completeness for a ConversationMachine.
 *
 * For every child state that has a parent, checks whether the child
 * has explicit transitions covering each of the parent's transition
 * match kinds. A parent transition that "leaks through" to a child
 * (because the child has no transition with the same match kind)
 * is almost always a bug — the child forgets to handle that input
 * and the parent's transition fires with unintended semantics.
 *
 * Returns an array of leaks. An empty array means the machine is
 * transition-complete: every child state explicitly handles or
 * overrides every parent transition.
 */
export function validateTransitionCompleteness(
  machine: ConversationMachine,
): readonly ParentTransitionLeak[] {
  const leaks: ParentTransitionLeak[] = [];
  const { states } = machine;

  for (const [childId, childState] of states) {
    if (childState.parentId === null) continue;

    // Collect the child's own match keys (exact) and broad keys
    const childExactKeys = new Set(childState.transitions.map(t => matchKey(t.match)));
    const childBroadKeys = new Set(childState.transitions.map(t => broadKey(t.match)));

    // Allowed parent transitions — explicitly declared as intentional inheritance
    const allowed = new Set(childState.allowedParentTransitions ?? []);

    // Walk the ancestor chain (skip self)
    let ancestorId: string | null = childState.parentId;
    while (ancestorId !== null) {
      const ancestor = states.get(ancestorId);
      if (!ancestor) break;

      for (const transition of ancestor.transitions) {
        // Skip if the child explicitly allows this parent transition
        if (allowed.has(transition.transitionId)) continue;

        const exactKey = matchKey(transition.match);
        const broad = broadKey(transition.match);

        // The child is covered if it has EITHER:
        // 1. An exact match (same kind + params) — directly preempts
        // 2. A broader match that subsumes the parent's — e.g., "any-bid" covers "call:2H"
        //
        // For "pass" kind: only exact match counts (pass is pass)
        // For "call" kind: child needs either the same call or "any-bid"
        // For "opponent-action": exact match or broad "opponent-action" coverage

        const covered =
          childExactKeys.has(exactKey) ||
          // "any-bid" on child covers any "call" from parent
          (broad === "bid" && childBroadKeys.has("bid")) ||
          // Bare "pass" (no seatRole) covers any seat-specific "pass:*"
          (transition.match.kind === "pass" && childExactKeys.has("pass")) ||
          // pass:self + pass:opponent on child covers bare "pass" from parent
          (transition.match.kind === "pass" && !("seatRole" in transition.match && transition.match.seatRole) &&
            childExactKeys.has("pass:self") && childExactKeys.has("pass:opponent"));

        if (!covered) {
          leaks.push({
            childStateId: childId,
            parentStateId: ancestorId,
            parentTransitionId: transition.transitionId,
            parentTransitionMatch: transition.match,
            parentTransitionTarget: transition.target,
          });
        }
      }

      ancestorId = ancestor.parentId;
    }
  }

  return leaks;
}

/** Format a ParentTransitionLeak as a human-readable string. */
export function formatLeak(leak: ParentTransitionLeak): string {
  const match = leak.parentTransitionMatch;
  const matchDesc =
    match.kind === "call"
      ? `call(${match.level}${match.strain})`
      : match.kind === "opponent-action"
        ? `opponent-action(${match.callType ?? "any"})`
        : match.kind;
  return (
    `State "${leak.childStateId}" inherits parent transition ` +
    `"${leak.parentTransitionId}" [${matchDesc} → ${leak.parentTransitionTarget}] ` +
    `from "${leak.parentStateId}" without an explicit override`
  );
}
