/**
 * Local FSM advancement — advances a module's local phase based on
 * observations in a CommittedStep.
 *
 * Each RuleModule has a small local FSM (phases + transitions).
 * This function advances the phase by checking if any observation
 * in the step matches a transition's `on` pattern.
 */

import type { CommittedStep } from "../../../core/contracts/committed-step";
import type { PhaseTransition } from "../rule-module";
import { matchObs } from "./route-matcher";

/**
 * Advance the local FSM given a CommittedStep.
 *
 * Returns the new phase. If no transition matches, returns `currentPhase`.
 * First matching transition wins.
 *
 * **Actor-agnostic by design:** Phase transitions fire on observation shape
 * regardless of who bid. Only route matching in rules gets actor filtering.
 * Do not add actor matching to phase transitions.
 */
export function advanceLocalFsm<Phase extends string>(
  currentPhase: Phase,
  step: CommittedStep,
  transitions: readonly PhaseTransition<Phase>[],
): Phase {
  for (const transition of transitions) {
    // Check if current phase matches the transition's `from`
    if (!matchesFrom(currentPhase, transition.from)) continue;

    // Check if ANY observation in the step matches the transition's pattern
    if (step.publicActions.some((obs) => matchObs(transition.on, obs))) {
      return transition.to;
    }
  }

  return currentPhase;
}

function matchesFrom<Phase extends string>(
  current: Phase,
  from: Phase | readonly Phase[],
): boolean {
  if (Array.isArray(from)) {
    return (from as readonly Phase[]).includes(current);
  }
  return current === from;
}
