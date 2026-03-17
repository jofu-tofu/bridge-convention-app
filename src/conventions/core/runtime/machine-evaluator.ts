import type { Auction, Call } from "../../../engine/types";
import type { Seat } from "../../../engine/types";
import { ForcingState } from "../../../core/contracts/bidding";
import type { CandidateTransform } from "../../../core/contracts/meaning";
import type { PublicSnapshot } from "../../../core/contracts/module-surface";
import { buildPublicSnapshot } from "../../../core/contracts/module-surface";
import type { RuntimeDiagnostic } from "./types";
import type { HandoffTrace } from "../../../core/contracts/provenance";
import { areSamePartnership } from "../../../engine/constants";
import type {
  ConversationMachine,
  MachineContext,
  MachineEffect,
  MachineEvalResult,
  MachineRegisters,
  MachineState,
  SubmachineFrame,
  TransitionMatch,
} from "./machine-types";

/** Create default registers with neutral initial values. @internal */
export function createDefaultRegisters(): MachineRegisters {
  return {
    forcingState: ForcingState.Nonforcing,
    obligation: { kind: "None", obligatedSide: "opener" },
    agreedStrain: { type: "none" },
    competitionMode: "None",
    captain: "none",
    systemCapabilities: {},
  };
}

/** Walk from a state up through its parentId chain to the root. Returns descendant-first order. @internal */
export function collectAncestorChain(
  states: ReadonlyMap<string, MachineState>,
  stateId: string,
): MachineState[] {
  const chain: MachineState[] = [];
  let currentId: string | null = stateId;
  while (currentId !== null) {
    const state = states.get(currentId);
    if (!state) break;
    chain.push(state);
    currentId = state.parentId;
  }
  return chain;
}

/** Immutably apply a MachineEffect to registers. @internal */
export function applyMachineEffect(
  registers: MachineRegisters,
  effect: MachineEffect,
): MachineRegisters {
  let result = { ...registers };
  if (effect.setForcingState !== undefined) {
    result = { ...result, forcingState: effect.setForcingState };
  }
  if (effect.setObligation !== undefined) {
    result = { ...result, obligation: effect.setObligation };
  }
  if (effect.setAgreedStrain !== undefined) {
    result = { ...result, agreedStrain: effect.setAgreedStrain };
  }
  if (effect.setCompetitionMode !== undefined) {
    result = { ...result, competitionMode: effect.setCompetitionMode };
  }
  if (effect.setCaptain !== undefined) {
    result = { ...result, captain: effect.setCaptain };
  }
  if (effect.setSystemCapabilities !== undefined) {
    result = {
      ...result,
      systemCapabilities: {
        ...result.systemCapabilities,
        ...effect.setSystemCapabilities,
      },
    };
  }
  // mergeRegisters is intentionally a no-op on typed fields —
  // it exists for future extension via custom registers
  return result;
}

/** Test whether a TransitionMatch matches a given call and seat role. @internal */
export function matchTransition(
  match: TransitionMatch,
  call: Call,
  seatRole: "self" | "partner" | "opponent",
): boolean {
  switch (match.kind) {
    case "call":
      return (
        call.type === "bid" &&
        call.level === match.level &&
        call.strain === match.strain
      );
    case "pass":
      if (call.type !== "pass") return false;
      // When seatRole filter is specified, only match passes from that role
      if (match.seatRole !== undefined && match.seatRole !== seatRole) return false;
      return true;
    case "any-bid":
      return call.type === "bid";
    case "opponent-action": {
      if (seatRole !== "opponent") return false;
      if (match.callType === undefined) return true;
      if (match.callType === "double") return call.type === "double";
      if (match.callType === "redouble") return call.type === "redouble";
      // callType "bid" matches contract bids from opponent, with optional level/strain filter
      if (call.type !== "bid") return false;
      if (match.level !== undefined && call.level !== match.level) return false;
      if (match.strain !== undefined && call.strain !== match.strain) return false;
      return true;
    }
    case "predicate":
      // Predicate tests are handled at the evaluateMachine level with full context
      // This function only handles structural matching; predicates always return false here
      return false;
    case "submachine-return":
      // Submachine return matching is handled at the evaluateMachine level
      // during state entry, not during call-based transition matching
      return false;
  }
}

/** Collect transforms from state ancestry, descendant-first. @internal */
export function collectInheritedTransforms(
  states: ReadonlyMap<string, MachineState>,
  stateId: string,
): CandidateTransform[] {
  const chain = collectAncestorChain(states, stateId);
  const transforms: CandidateTransform[] = [];
  for (const state of chain) {
    if (state.transforms) {
      transforms.push(...state.transforms);
    }
  }
  return transforms;
}

/** Build a PublicSnapshot from MachineRegisters for guard evaluation. */
function registersToSnapshot(registers: MachineRegisters): PublicSnapshot {
  return buildPublicSnapshot({
    activeModuleIds: [],
    forcingState: registers.forcingState,
    obligation: registers.obligation,
    agreedStrain: registers.agreedStrain,
    competitionMode: registers.competitionMode,
    captain: registers.captain,
    systemCapabilities: registers.systemCapabilities,
  });
}

/**
 * Evaluate a ConversationMachine against an auction from a given seat's perspective.
 *
 * Algorithm:
 * 1. Start from initialStateId with default registers
 * 2. For each auction entry:
 *    a. Determine seatRole
 *    b. Collect transitions from current state + ancestors (descendant-first)
 *    c. Test each transition's match + optional guard
 *    d. First match wins: apply transition effects, move to target, apply entry effects
 *    e. Handle submachine invocation and return
 *    f. Handle loop iteration tracking and exit
 * 3. Collect surfaceGroupIds and transforms from final state ancestry
 */
export function evaluateMachine(
  machine: ConversationMachine,
  auction: Auction,
  seat: Seat,
  submachines?: ReadonlyMap<string, ConversationMachine>,
): MachineEvalResult {
  // Build a lookup of all machines for submachine resolution
  const allMachines = new Map<string, ConversationMachine>();
  allMachines.set(machine.machineId, machine);
  if (submachines) {
    for (const [id, sub] of submachines) {
      allMachines.set(id, sub);
    }
  }

  let currentMachine = machine;
  let currentStateId = machine.initialStateId;
  let registers = createDefaultRegisters();
  const stateHistory: string[] = [];
  const transitionHistory: string[] = [];
  let interruptedFromStateId: string | null = null;
  const diagnostics: RuntimeDiagnostic[] = [];
  const submachineStack: SubmachineFrame[] = [];
  const handoffTraces: HandoffTrace[] = [];
  const loopCounters = new Map<string, number>();

  // Enter initial state (skip entry effects for backward compatibility)
  enterState(currentStateId, false);

  for (const entry of auction.entries) {
    const seatRole = currentMachine.seatRole(auction, seat, entry.seat);
    const currentState = currentMachine.states.get(currentStateId);
    if (!currentState) {
      diagnostics.push({
        level: "error",
        message: `State "${currentStateId}" not found in machine`,
      });
      break;
    }

    // Collect transitions: walk ancestor chain (descendant-first)
    const ancestorChain = collectAncestorChain(
      currentMachine.states,
      currentStateId,
    );
    const allTransitions = ancestorChain.flatMap((s) => s.transitions);

    const snapshot = registersToSnapshot(registers);

    // Find first matching transition
    let matched = false;
    for (const transition of allTransitions) {
      // Skip submachine-return transitions during call matching
      if (transition.match.kind === "submachine-return") continue;

      // Role filter: explicit allowedRoles overrides defaults; otherwise
      // call/any-bid default to self+partner only (opponent bids are interference)
      if (transition.allowedRoles) {
        if (!transition.allowedRoles.includes(seatRole)) continue;
      } else if (
        (transition.match.kind === "call" || transition.match.kind === "any-bid") &&
        seatRole === "opponent"
      ) {
        continue;
      }

      let isMatch: boolean;
      if (transition.match.kind === "predicate") {
        isMatch = transition.match.test(entry.call, entry.seat, snapshot);
      } else {
        isMatch = matchTransition(transition.match, entry.call, seatRole);
      }

      if (!isMatch) continue;

      // Check guard
      if (transition.guard && !transition.guard(snapshot)) continue;

      // Apply transition effects
      if (transition.effects) {
        registers = applyMachineEffect(registers, transition.effects);
      }

      transitionHistory.push(transition.transitionId);

      if (transition.match.kind === "opponent-action") {
        interruptedFromStateId = currentStateId;
      }

      // Handle exitLoop: redirect to loop's exitTarget
      if (transition.exitLoop) {
        const loopState = findLoopState(
          currentMachine.states,
          currentStateId,
        );
        if (loopState?.loopConfig) {
          loopCounters.delete(loopState.stateId);
          enterState(loopState.loopConfig.exitTarget, true);
          matched = true;
          break;
        }
      }

      // Enter target state
      enterState(transition.target, true);
      matched = true;
      break;
    }

    if (!matched) {
      // No transition matched — stay in current state (no diagnostic for this, it's normal)
    }
  }

  // Collect surface group IDs from current state + ancestors
  const finalAncestorChain = collectAncestorChain(
    currentMachine.states,
    currentStateId,
  );
  const activeSurfaceGroupIds: string[] = [];
  for (const state of finalAncestorChain) {
    if (state.surfaceGroupId) {
      activeSurfaceGroupIds.push(state.surfaceGroupId);
    }
  }

  // Collect transforms from ancestry
  const collectedTransforms = collectInheritedTransforms(
    currentMachine.states,
    currentStateId,
  );

  return {
    context: {
      currentStateId,
      registers,
      stateHistory,
      transitionHistory,
      submachineStack,
      interruptedFromStateId,
    } satisfies MachineContext,
    activeSurfaceGroupIds,
    collectedTransforms,
    diagnostics,
    handoffTraces,
  };

  /**
   * Enter a state, handling submachine invocation, submachine return,
   * and loop tracking. May cascade recursively for submachine chains.
   */
  function enterState(stateId: string, applyEffects: boolean): void {
    const state = currentMachine.states.get(stateId);
    if (!state) {
      diagnostics.push({
        level: "error",
        message: `State "${stateId}" not found in machine "${currentMachine.machineId}"`,
      });
      return;
    }

    // Loop re-entry check (before committing to state entry)
    if (state.loopConfig) {
      if (loopCounters.has(stateId)) {
        const count = loopCounters.get(stateId)! + 1;
        if (count >= state.loopConfig.maxIterations) {
          // Max iterations reached — auto-exit to exitTarget
          loopCounters.delete(stateId);
          enterState(state.loopConfig.exitTarget, true);
          return;
        }
        loopCounters.set(stateId, count);
      } else {
        loopCounters.set(stateId, 0);
      }
    }

    // Commit: update current state
    currentStateId = stateId;
    stateHistory.push(stateId);

    // Apply entry effects (skipped for machine initial states)
    if (applyEffects && state.entryEffects) {
      registers = applyMachineEffect(registers, state.entryEffects);
    }

    // Submachine invocation
    if (state.submachineRef) {
      const sub = allMachines.get(state.submachineRef.machineId);
      if (sub) {
        submachineStack.push({
          parentMachineId: currentMachine.machineId,
          returnStateId: state.submachineRef.returnTarget,
          parentRegisters: { ...registers },
        });
        handoffTraces.push({
          fromModuleId: currentMachine.machineId,
          toModuleId: sub.machineId,
          reason: `Submachine invocation from state "${stateId}"`,
        });
        currentMachine = sub;
        enterState(sub.initialStateId, false); // submachine initial: skip entry effects
        return;
      }
    }

    // Submachine completion: check for submachine-return or terminal state
    if (submachineStack.length > 0) {
      const returnTransition = state.transitions.find(
        (t) => t.match.kind === "submachine-return",
      );
      const isTerminal = state.transitions.length === 0;

      if (returnTransition || isTerminal) {
        // Apply return transition effects if explicit
        if (returnTransition?.effects) {
          registers = applyMachineEffect(registers, returnTransition.effects);
        }
        if (returnTransition) {
          transitionHistory.push(returnTransition.transitionId);
        }

        // Pop submachine frame and return to parent
        const frame = submachineStack.pop()!;
        currentMachine = allMachines.get(frame.parentMachineId)!;
        registers = frame.parentRegisters;
        enterState(frame.returnStateId, true); // return target: apply entry effects
        return;
      }
    }
  }

  /** Find the nearest loop state in the ancestor chain. */
  function findLoopState(
    states: ReadonlyMap<string, MachineState>,
    stateId: string,
  ): MachineState | null {
    const chain = collectAncestorChain(states, stateId);
    for (const s of chain) {
      if (s.loopConfig) return s;
    }
    return null;
  }
}

// ─── Machine factory ───────────────────────────────────────────

/** Default seatRole: self for own bids, partner for partnership, opponent otherwise. */
function defaultSeatRole(
  _auction: Auction,
  seat: Seat,
  callSeat: Seat,
): "self" | "partner" | "opponent" {
  if (seat === callSeat) return "self";
  return areSamePartnership(seat, callSeat) ? "partner" : "opponent";
}

/** Build a ConversationMachine from an array of states with standard defaults. */
export function buildConversationMachine(
  machineId: string,
  states: readonly MachineState[],
  initialStateId = "idle",
): ConversationMachine {
  const stateMap = new Map<string, MachineState>();
  for (const s of states) stateMap.set(s.stateId, s);
  return {
    machineId,
    states: stateMap,
    initialStateId,
    seatRole: defaultSeatRole,
  };
}
