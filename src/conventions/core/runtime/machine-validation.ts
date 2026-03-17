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

// ── Interrupt Scoping Validation ────────────────────────────────────

export interface InterruptScopingViolation {
  readonly rule: "scope-only" | "local-target" | "coverage";
  readonly stateId: string;
  readonly message: string;
}

/**
 * Validate the "scoped interrupt" pattern for a ConversationMachine.
 *
 * Ensures that opponent-action transitions are declared only on scope
 * states (abstract parents), that they target descendants of the
 * declaring scope, and that every non-terminal state has interrupt
 * coverage via its ancestor chain.
 *
 * Rules:
 * 1. **Scope-only declaration** — opponent-action transitions may only
 *    appear on states that serve as `parentId` for at least one other state.
 * 2. **Local targeting** — opponent-action transitions on a scope state S
 *    must target a descendant of S (target's ancestor chain includes S).
 * 3. **Full coverage** — every non-terminal state (has ≥1 transition) must
 *    have at least one opponent-action transition reachable via its ancestor
 *    chain. The machine's initial state is exempt.
 */
export function validateInterruptScoping(
  machine: ConversationMachine,
): readonly InterruptScopingViolation[] {
  const violations: InterruptScopingViolation[] = [];
  const { states, initialStateId } = machine;

  // 1. Build parentStateIds — all stateIds that appear as another state's parentId
  const parentStateIds = new Set<string>();
  for (const [, state] of states) {
    if (state.parentId !== null) {
      parentStateIds.add(state.parentId);
    }
  }

  // Helper: check if a state has any opponent-action transition
  function hasOpponentAction(state: MachineState): boolean {
    return state.transitions.some((t) => t.match.kind === "opponent-action");
  }

  // Helper: get ancestor chain for a state (including self), walking parentId
  function getAncestorChain(stateId: string): string[] {
    const chain: string[] = [];
    let currentId: string | null = stateId;
    while (currentId !== null) {
      chain.push(currentId);
      const state = states.get(currentId);
      if (!state) break;
      currentId = state.parentId;
    }
    return chain;
  }

  // Rule 1: Scope-only declaration (initial state is exempt — it may use
  // opponent-action for convention activation, e.g. DONT matching opponent 1NT)
  for (const [stateId, state] of states) {
    if (stateId === initialStateId) continue;
    if (hasOpponentAction(state) && !parentStateIds.has(stateId)) {
      violations.push({
        rule: "scope-only",
        stateId,
        message:
          `State "${stateId}" declares an opponent-action transition but is not a scope state ` +
          `(no other state references it as parentId)`,
      });
    }
  }

  // Rule 2: Local targeting
  for (const [stateId, state] of states) {
    if (!parentStateIds.has(stateId)) continue;

    for (const transition of state.transitions) {
      if (transition.match.kind !== "opponent-action") continue;

      const targetAncestors = getAncestorChain(transition.target);
      if (!targetAncestors.includes(stateId)) {
        violations.push({
          rule: "local-target",
          stateId,
          message:
            `Scope state "${stateId}" has opponent-action transition targeting "${transition.target}", ` +
            `which is not a descendant of "${stateId}"`,
        });
      }
    }
  }

  // Rule 3: Full coverage
  for (const [stateId, state] of states) {
    // Initial state is exempt
    if (stateId === initialStateId) continue;
    // Terminal states (no outgoing transitions) are exempt
    if (state.transitions.length === 0) continue;

    const ancestors = getAncestorChain(stateId);
    const hasCoverage = ancestors.some((ancestorId) => {
      const ancestor = states.get(ancestorId);
      return ancestor !== undefined && hasOpponentAction(ancestor);
    });

    if (!hasCoverage) {
      violations.push({
        rule: "coverage",
        stateId,
        message:
          `State "${stateId}" has transitions but no ancestor (including itself) ` +
          `declares an opponent-action handler`,
      });
    }
  }

  return violations;
}

/** Format an InterruptScopingViolation as a human-readable string. */
export function formatInterruptViolation(v: InterruptScopingViolation): string {
  const prefix = v.rule === "coverage" ? "Warning" : "Error";
  return `[${prefix}] ${v.rule}: ${v.message}`;
}

// ── Role Safety Validation ──────────────────────────────────────────

export interface RoleSafetyViolation {
  readonly stateId: string;
  readonly transitionId: string;
  readonly message: string;
}

/**
 * Validate that transitions use the correct match types for their intended roles.
 *
 * Rule: `call` and `any-bid` transitions must not have `allowedRoles` containing
 * "opponent". If you want to match an opponent's bid, use `opponent-action` with
 * `callType: "bid"` instead.
 */
export function validateRoleSafety(
  machine: ConversationMachine,
): readonly RoleSafetyViolation[] {
  const violations: RoleSafetyViolation[] = [];
  const { states } = machine;

  for (const [stateId, state] of states) {
    for (const transition of state.transitions) {
      if (
        (transition.match.kind === "call" || transition.match.kind === "any-bid") &&
        transition.allowedRoles?.includes("opponent")
      ) {
        violations.push({
          stateId,
          transitionId: transition.transitionId,
          message:
            `Transition "${transition.transitionId}" in state "${stateId}" uses ` +
            `match kind "${transition.match.kind}" with allowedRoles including "opponent". ` +
            `Use opponent-action with callType: "bid" instead to match opponent bids.`,
        });
      }
    }
  }

  return violations;
}

// ── Interrupted State Well-Formedness Validation ────────────────────

export interface InterruptedStateViolation {
  readonly rule: "missing-surface" | "missing-competition-mode" | "missing-pass-handler";
  readonly stateId: string;
  readonly message: string;
}

/**
 * Validate that opponent-action target states (interrupted states) are properly formed.
 *
 * Rules:
 * A. **missing-surface** — the state must have a `surfaceGroupId`.
 * B. **missing-competition-mode** — the state must have `entryEffects` with
 *    `setCompetitionMode` set to a non-empty string.
 * C. **missing-pass-handler** — the state must have at least one transition
 *    with `match.kind === "pass"`.
 */
export function validateInterruptedStateWellFormedness(
  machine: ConversationMachine,
): readonly InterruptedStateViolation[] {
  const violations: InterruptedStateViolation[] = [];
  const { states } = machine;

  // Collect all states that are targets of opponent-action transitions
  const interruptedStateIds = new Set<string>();
  for (const [, state] of states) {
    for (const transition of state.transitions) {
      if (transition.match.kind === "opponent-action") {
        interruptedStateIds.add(transition.target);
      }
    }
  }

  for (const stateId of interruptedStateIds) {
    const state = states.get(stateId);
    if (!state) continue;

    // Rule A: must have surfaceGroupId
    if (!state.surfaceGroupId) {
      violations.push({
        rule: "missing-surface",
        stateId,
        message:
          `Interrupted state "${stateId}" has no surfaceGroupId. ` +
          `An interrupted state without surfaces is a black hole.`,
      });
    }

    // Rule B: must have entryEffects with setCompetitionMode
    if (!state.entryEffects?.setCompetitionMode) {
      violations.push({
        rule: "missing-competition-mode",
        stateId,
        message:
          `Interrupted state "${stateId}" does not set competitionMode on entry. ` +
          `When entering an interrupted state, the machine should record that competition occurred.`,
      });
    }

    // Rule C: must have at least one pass handler
    const hasPassHandler = state.transitions.some(
      (t) => t.match.kind === "pass",
    );
    if (!hasPassHandler) {
      violations.push({
        rule: "missing-pass-handler",
        stateId,
        message:
          `Interrupted state "${stateId}" has no pass handler. ` +
          `Without a pass handler, the machine gets stuck if everyone passes.`,
      });
    }
  }

  return violations;
}

// ── Terminal Reachability Validation ─────────────────────────────────

export interface TerminalReachabilityViolation {
  readonly stateId: string;
  readonly message: string;
}

/**
 * Validate that every reachable non-terminal state can reach a terminal state.
 *
 * Builds a directed graph of all possible state transitions (including inherited
 * parent transitions), then checks via reverse BFS from terminal states that
 * every reachable state can reach a terminal.
 */
export function validateTerminalReachability(
  machine: ConversationMachine,
): readonly TerminalReachabilityViolation[] {
  const { states, initialStateId } = machine;

  // Step 1: Determine reachable states (same logic as validateMachine + submachineRef)
  const reachable = new Set<string>();
  function visitReachable(stateId: string): void {
    if (reachable.has(stateId)) return;
    reachable.add(stateId);
    const state = states.get(stateId);
    if (!state) return;
    for (const transition of state.transitions) {
      visitReachable(transition.target);
    }
    // Follow submachineRef returnTarget as a reachable edge
    if (state.submachineRef) {
      visitReachable(state.submachineRef.returnTarget);
    }
  }
  visitReachable(initialStateId);

  // Step 2: Build directed graph including inherited parent transitions
  // For each state, collect transitions from self + all ancestors
  const forwardEdges = new Map<string, Set<string>>();
  const reverseEdges = new Map<string, Set<string>>();

  for (const stateId of reachable) {
    if (!forwardEdges.has(stateId)) forwardEdges.set(stateId, new Set());

    const state = states.get(stateId);
    if (!state) continue;

    // Collect all transitions from ancestor chain (self + parents)
    const allTransitions: string[] = [];

    let currentId: string | null = stateId;
    while (currentId !== null) {
      const current = states.get(currentId);
      if (!current) break;
      for (const transition of current.transitions) {
        allTransitions.push(transition.target);
      }
      currentId = current.parentId;
    }

    // Handle submachineRef — treat as edge to returnTarget
    if (state.submachineRef) {
      allTransitions.push(state.submachineRef.returnTarget);
    }

    for (const target of allTransitions) {
      forwardEdges.get(stateId)!.add(target);
      if (!reverseEdges.has(target)) reverseEdges.set(target, new Set());
      reverseEdges.get(target)!.add(stateId);
    }
  }

  // Step 3: Identify terminal states
  // A state is effectively terminal if:
  // - It has no own transitions (transitions: []), OR
  // - All its OWN transitions are self-loops (absorb state)
  // We check own transitions only, not inherited parent transitions, because
  // at runtime descendant-first matching means own transitions preempt inherited ones.
  const terminalStates = new Set<string>();
  for (const stateId of reachable) {
    const state = states.get(stateId);
    if (!state) continue;
    if (state.transitions.length === 0) {
      terminalStates.add(stateId);
    } else {
      const allOwnSelfLoop = state.transitions.every((t) => t.target === stateId);
      if (allOwnSelfLoop) {
        terminalStates.add(stateId);
      }
    }
  }

  // Step 4: Reverse BFS from terminal states to find all states that can reach terminal
  const canReachTerminal = new Set<string>();
  const queue: string[] = [...terminalStates];
  for (const t of terminalStates) {
    canReachTerminal.add(t);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const predecessors = reverseEdges.get(current);
    if (!predecessors) continue;
    for (const pred of predecessors) {
      if (!canReachTerminal.has(pred)) {
        canReachTerminal.add(pred);
        queue.push(pred);
      }
    }
  }

  // Step 5: Any reachable state NOT in canReachTerminal is a violation
  const violations: TerminalReachabilityViolation[] = [];
  for (const stateId of reachable) {
    if (!canReachTerminal.has(stateId)) {
      violations.push({
        stateId,
        message:
          `State "${stateId}" cannot reach any terminal state. ` +
          `All reachable states must have a path to a terminal state.`,
      });
    }
  }

  return violations;
}

// ── Interrupt Path Completeness Validation ──────────────────────────

export interface InterruptPathViolation {
  readonly rule: "uncovered-action-type";
  readonly stateId: string;
  readonly actionType: "double" | "bid" | "redouble";
  readonly message: string;
}

/**
 * Validate that interrupt handlers cover all opponent action types.
 *
 * For each scope state with opponent-action transitions, checks that the
 * required action types ("double" and "bid") are covered — either by a
 * catch-all (no callType) or by specific callType filters. Redouble is
 * treated as a warning.
 */
export function validateInterruptPathCompleteness(
  machine: ConversationMachine,
): readonly InterruptPathViolation[] {
  const violations: InterruptPathViolation[] = [];
  const { states, initialStateId } = machine;

  for (const [stateId, state] of states) {
    // Initial state is exempt — it may use opponent-action for convention
    // activation (e.g. DONT matching opponent 1NT) without full coverage
    if (stateId === initialStateId) continue;
    // Collect opponent-action transitions on this state
    const opponentActions = state.transitions.filter(
      (t) => t.match.kind === "opponent-action",
    );

    if (opponentActions.length === 0) continue;

    // Check if any is a catch-all (no callType filter)
    const hasCatchAll = opponentActions.some(
      (t) => t.match.kind === "opponent-action" && !t.match.callType,
    );

    if (hasCatchAll) continue; // Fully covered

    // Collect covered callTypes
    const coveredTypes = new Set<string>();
    for (const t of opponentActions) {
      if (t.match.kind === "opponent-action" && t.match.callType) {
        coveredTypes.add(t.match.callType);
      }
    }

    // Check required types: "double" and "bid"
    const requiredTypes: ("double" | "bid")[] = ["double", "bid"];
    for (const actionType of requiredTypes) {
      if (!coveredTypes.has(actionType)) {
        violations.push({
          rule: "uncovered-action-type",
          stateId,
          actionType,
          message:
            `State "${stateId}" has opponent-action transitions but does not cover ` +
            `action type "${actionType}". Add an opponent-action transition with ` +
            `callType: "${actionType}" or use a catch-all (no callType).`,
        });
      }
    }

    // Check redouble (warning-level)
    if (!coveredTypes.has("redouble")) {
      violations.push({
        rule: "uncovered-action-type",
        stateId,
        actionType: "redouble",
        message:
          `State "${stateId}" has opponent-action transitions but does not explicitly ` +
          `handle "redouble". Consider adding a handler or using a catch-all.`,
      });
    }
  }

  return violations;
}
