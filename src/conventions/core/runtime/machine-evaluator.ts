import type { Auction, Call } from "../../../engine/types";
import type { Seat } from "../../../engine/types";
import { ForcingState } from "../../../core/contracts/bidding";
import type { CandidateTransform } from "../../../core/contracts/meaning";
import type { PublicSnapshot } from "../../../core/contracts/module-surface";
import { buildPublicSnapshot } from "../../../core/contracts/module-surface";
import type { RuntimeDiagnostic } from "./types";
import type {
  ConversationMachine,
  MachineContext,
  MachineEffect,
  MachineEvalResult,
  MachineRegisters,
  MachineState,
  TransitionMatch,
} from "./machine-types";

/** Create default registers with neutral initial values. */
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

/** Walk from a state up through its parentId chain to the root. Returns descendant-first order. */
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

/** Immutably apply a MachineEffect to registers. */
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

/** Test whether a TransitionMatch matches a given call and seat role. */
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
      return call.type === "pass";
    case "any-bid":
      return call.type === "bid";
    case "opponent-action": {
      if (seatRole !== "opponent") return false;
      if (match.callType === undefined) return true;
      if (match.callType === "double") return call.type === "double";
      if (match.callType === "redouble") return call.type === "redouble";
      // callType "bid" matches any contract bid from opponent
      return call.type === "bid";
    }
    case "predicate":
      // Predicate tests are handled at the evaluateMachine level with full context
      // This function only handles structural matching; predicates always return false here
      return false;
  }
}

/** Collect transforms from state ancestry, descendant-first. */
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
    agreedStrain: registers.agreedStrain as PublicSnapshot["agreedStrain"],
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
 * 3. Collect surfaceGroupIds and transforms from final state ancestry
 */
export function evaluateMachine(
  machine: ConversationMachine,
  auction: Auction,
  seat: Seat,
): MachineEvalResult {
  let currentStateId = machine.initialStateId;
  let registers = createDefaultRegisters();
  const stateHistory: string[] = [currentStateId];
  const transitionHistory: string[] = [];
  const diagnostics: RuntimeDiagnostic[] = [];

  for (const entry of auction.entries) {
    const seatRole = machine.seatRole(auction, seat, entry.seat);
    const currentState = machine.states.get(currentStateId);
    if (!currentState) {
      diagnostics.push({
        level: "error",
        message: `State "${currentStateId}" not found in machine`,
      });
      break;
    }

    // Collect transitions: walk ancestor chain (descendant-first)
    const ancestorChain = collectAncestorChain(machine.states, currentStateId);
    const allTransitions = ancestorChain.flatMap((s) => s.transitions);

    const snapshot = registersToSnapshot(registers);

    // Find first matching transition
    let matched = false;
    for (const transition of allTransitions) {
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

      // Move to target
      currentStateId = transition.target;
      transitionHistory.push(transition.transitionId);

      // Apply target's entry effects
      const targetState = machine.states.get(transition.target);
      if (targetState?.entryEffects) {
        registers = applyMachineEffect(registers, targetState.entryEffects);
      }

      stateHistory.push(currentStateId);
      matched = true;
      break;
    }

    if (!matched) {
      // No transition matched — stay in current state (no diagnostic for this, it's normal)
    }
  }

  // Collect surface group IDs from current state + ancestors
  const ancestorChain = collectAncestorChain(machine.states, currentStateId);
  const activeSurfaceGroupIds: string[] = [];
  for (const state of ancestorChain) {
    if (state.surfaceGroupId) {
      activeSurfaceGroupIds.push(state.surfaceGroupId);
    }
  }

  // Collect transforms from ancestry
  const collectedTransforms = collectInheritedTransforms(
    machine.states,
    currentStateId,
  );

  return {
    context: {
      currentStateId,
      registers,
      stateHistory,
      transitionHistory,
    } satisfies MachineContext,
    activeSurfaceGroupIds,
    collectedTransforms,
    diagnostics,
  };
}
