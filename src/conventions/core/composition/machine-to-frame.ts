/**
 * MachineState → FrameStateSpec converter.
 *
 * Converts module-authored hierarchical `MachineState[]` to the flat
 * runtime `FrameStateSpec[]` format consumed by the protocol frame.
 *
 * Conversion rules:
 * - Hierarchy flattening: child states inherit allowed parent transitions
 * - TransitionMatch → EventPattern mapping (5 kinds → flat when object)
 * - MachineEffect → EffectSpec[] mapping
 * - surfaceGroupId → surface (prefixed "sf:")
 * - exportTags → exportTags (1:1 passthrough)
 */

import type {
  MachineState,
  MachineTransition,
  MachineEffect,
  TransitionMatch,
} from "../runtime/machine-types";
import type {
  FrameStateSpec,
  TransitionSpec,
  EffectSpec,
  EventPattern,
} from "../protocol/types";
import type { BidSuit } from "../../../engine/types";

// ── TransitionMatch → EventPattern ──────────────────────────────────

function matchToEventPattern(match: TransitionMatch): EventPattern {
  switch (match.kind) {
    case "call":
      return {
        call: { type: "bid", level: match.level as 1 | 2 | 3 | 4 | 5 | 6 | 7, strain: match.strain },
      };
    case "pass":
      return match.seatRole
        ? { actor: match.seatRole, callType: "pass" }
        : { callType: "pass" };
    case "opponent-action": {
      const pattern: EventPattern = { actor: "opponent" };
      if (match.callType) {
        return { ...pattern, callType: match.callType };
      }
      if (match.level !== undefined && match.strain !== undefined) {
        return {
          ...pattern,
          call: { type: "bid", level: match.level as 1 | 2 | 3 | 4 | 5 | 6 | 7, strain: match.strain },
        };
      }
      return pattern;
    }
    case "any-bid":
      return { callType: "bid" };
    case "predicate":
      throw new Error(
        "predicate transitions not supported in auto-composition — " +
        "use BoolExpr guard on FrameStateSpec instead",
      );
    case "submachine-return":
      // Internal composition artifact — should not appear in final output
      throw new Error(
        "submachine-return transitions should be resolved before conversion",
      );
  }
}

// ── MachineEffect → EffectSpec[] ────────────────────────────────────

function effectToSpecs(effect: MachineEffect): readonly EffectSpec[] {
  const specs: EffectSpec[] = [];

  if (effect.setForcingState !== undefined) {
    specs.push({ op: "setReg", path: "forcing.state", value: effect.setForcingState });
  }

  if (effect.setObligation) {
    specs.push({ op: "setReg", path: "obligation.kind", value: effect.setObligation.kind });
    specs.push({ op: "setReg", path: "obligation.side", value: effect.setObligation.obligatedSide });
  }

  if (effect.setAgreedStrain) {
    const strain = effect.setAgreedStrain;
    if (strain.type === "none") {
      specs.push({ op: "clearReg", path: "agreement.strain" });
      specs.push({ op: "clearReg", path: "agreement.status" });
    } else {
      specs.push({
        op: "setReg",
        path: "agreement.strain",
        value: strain.suit
          ? { type: strain.type, suit: strain.suit }
          : { type: strain.type },
      });
      if (strain.confidence) {
        specs.push({ op: "setReg", path: "agreement.status", value: strain.confidence });
      }
    }
  }

  if (effect.setCompetitionMode !== undefined) {
    specs.push({ op: "setReg", path: "competition.mode", value: effect.setCompetitionMode });
  }

  if (effect.setCaptain !== undefined) {
    specs.push({ op: "setReg", path: "captain.side", value: effect.setCaptain });
  }

  return specs;
}

// ── MachineTransition → TransitionSpec ──────────────────────────────

function transitionToSpec(t: MachineTransition, targetStateId: string): TransitionSpec {
  const when = matchToEventPattern(t.match);
  // Self-targeting transitions → "STAY"
  const goto = t.target === targetStateId ? "STAY" : t.target;

  const spec: TransitionSpec = {
    transitionId: t.transitionId,
    when,
    goto,
    ...(t.effects ? { effects: effectToSpecs(t.effects) } : {}),
  };

  return spec;
}

// ── Hierarchy flattening ────────────────────────────────────────────

/** Build the full transition list for a state, including inherited parent transitions. */
function flattenTransitions(
  state: MachineState,
  stateMap: ReadonlyMap<string, MachineState>,
): readonly MachineTransition[] {
  const ownTransitions = [...state.transitions];

  // Walk up the parent chain and collect inherited transitions
  let currentParentId = state.parentId;
  while (currentParentId) {
    const parent = stateMap.get(currentParentId);
    if (!parent) break;

    // Filter parent transitions by allowedParentTransitions if specified
    const allowed = state.allowedParentTransitions;
    const parentTransitions = allowed
      ? parent.transitions.filter((t) => allowed.includes(t.transitionId))
      : parent.transitions;

    ownTransitions.push(...parentTransitions);
    currentParentId = parent.parentId;
  }

  return ownTransitions;
}

// ── Main converter ──────────────────────────────────────────────────

/**
 * Convert module-authored MachineState[] to runtime FrameStateSpec[].
 *
 * Abstract parent states (states that only provide transitions for children
 * to inherit) are excluded from the output — only leaf/concrete states
 * that have surfaceGroupId, transitions of their own, or entryEffects produce
 * FrameStateSpec entries.
 *
 * @param states Module's machine states
 * @returns Flat FrameStateSpec[] for the protocol frame
 */
export function machineStatesToFrameStates(
  states: readonly MachineState[],
): readonly FrameStateSpec[] {
  const stateMap = new Map<string, MachineState>();
  for (const s of states) stateMap.set(s.stateId, s);

  // Identify abstract parent states (states that are ONLY parents to other states
  // and have no surfaceGroupId, entryEffects, or exportTags of their own)
  const childParentIds = new Set(
    states.filter((s) => s.parentId).map((s) => s.parentId!),
  );
  const isAbstractParent = (s: MachineState): boolean =>
    childParentIds.has(s.stateId) &&
    !s.surfaceGroupId &&
    !s.entryEffects &&
    !s.exportTags &&
    s.transitions.length > 0 &&
    // A scope state's children inherit its transitions — the scope itself
    // isn't a real runtime state
    !states.some(
      (child) => child.parentId === s.stateId && child.stateId === s.stateId,
    );

  const result: FrameStateSpec[] = [];

  for (const state of states) {
    // Skip abstract parent/scope states — their transitions are inherited by children
    if (isAbstractParent(state)) continue;

    const allTransitions = flattenTransitions(state, stateMap);
    const eventTransitions = allTransitions.map((t) =>
      transitionToSpec(t, state.stateId),
    );

    const frameState: FrameStateSpec = {
      id: state.stateId,
      ...(state.surfaceGroupId ? { surface: `sf:${state.surfaceGroupId}` } : {}),
      ...(state.exportTags ? { exportTags: state.exportTags } : {}),
      ...(state.entryEffects ? { onEnter: effectToSpecs(state.entryEffects) } : {}),
      eventTransitions,
    };

    result.push(frameState);
  }

  return result;
}

// ── Export individual converters for testing ─────────────────────────

export { matchToEventPattern, effectToSpecs, transitionToSpec, flattenTransitions };
