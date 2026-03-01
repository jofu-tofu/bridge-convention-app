// DialogueManager — replays an auction through transition rules
// to compute the current DialogueState.

import type { Auction } from "../../../engine/types";
import type { DialogueState } from "./dialogue-state";
import {
  ForcingState,
  PendingAction,
  CompetitionMode,
  CaptainRole,
  SystemMode,
} from "./dialogue-state";
import type { TransitionRule } from "./dialogue-transitions";
import { applyEffect, applyBackfillEffect, getEffectKeys } from "./dialogue-transitions";

/** The initial dialogue state before any bids. */
export const INITIAL_DIALOGUE_STATE: DialogueState = {
  familyId: null,
  forcingState: ForcingState.Nonforcing,
  agreedStrain: { type: "none" },
  pendingAction: PendingAction.None,
  competitionMode: CompetitionMode.Uncontested,
  captain: CaptainRole.Neither,
  systemMode: SystemMode.Off,
  conventionData: {},
};

/**
 * Replay the auction one bid at a time, applying transition rules.
 *
 * **Single-pass mode** (2 args): `conventionRules` tested in order, first match wins.
 * Used when convention config composes rules as `[...familyRules, ...baselineRules]`.
 *
 * **Two-pass mode** (3 args): For each auction entry:
 *   1. Convention pass: first matching convention rule fires, its effect applied fully.
 *   2. Baseline pass: first matching baseline rule fires, but only sets fields
 *      the convention rule didn't touch (backfill). Convention values always win.
 *
 * At most one convention rule and one baseline rule fire per entry. This is sufficient
 * because convention rules for a family are mutually exclusive by familyId guard,
 * and baseline rules are ordered by specificity.
 *
 * Deterministic and stateless — same inputs always produce same output.
 */
export function computeDialogueState(
  auction: Auction,
  conventionRules: readonly TransitionRule[],
  baselineRules?: readonly TransitionRule[],
): DialogueState {
  let state: DialogueState = INITIAL_DIALOGUE_STATE;

  for (let i = 0; i < auction.entries.length; i++) {
    const entry = auction.entries[i]!;

    if (!baselineRules) {
      // Single-pass mode: original behavior
      for (const rule of conventionRules) {
        if (rule.matches(state, entry.call, entry.seat, auction, i)) {
          const effect = rule.effects(state, entry.call, entry.seat, auction, i);
          state = applyEffect(state, effect);
          break;
        }
      }
    } else {
      // Two-pass mode: convention first, baseline backfills gaps
      let alreadySet = new Set<string>();

      // Pass 1: convention rules (first-match-wins)
      for (const rule of conventionRules) {
        if (rule.matches(state, entry.call, entry.seat, auction, i)) {
          const effect = rule.effects(state, entry.call, entry.seat, auction, i);
          alreadySet = new Set(getEffectKeys(effect));
          state = applyEffect(state, effect);
          break;
        }
      }

      // Pass 2: baseline rules (first-match-wins, backfill only)
      for (const rule of baselineRules) {
        if (rule.matches(state, entry.call, entry.seat, auction, i)) {
          const effect = rule.effects(state, entry.call, entry.seat, auction, i);
          state = applyBackfillEffect(state, effect, alreadySet);
          break;
        }
      }
    }
  }

  return state;
}
