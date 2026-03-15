import type { AlternativeGroup } from "../../../core/contracts";

/**
 * Weak Two alternative groups for grading tolerance.
 *
 * When the matched intent is one of these group members, other members in the
 * same group become acceptable alternatives. This prevents penalizing a student
 * who bids at borderline HCP counts.
 */
export const WEAK_TWO_ALTERNATIVE_GROUPS: readonly AlternativeGroup[] = [
  // Responder action group: game raise, Ogust ask, invite raise
  // At HCP boundaries (14/15 vs 16+), adjacent actions are acceptable.
  {
    label: "Weak Two responder action (hearts)",
    members: [
      "weak-two-game-raise",
      "weak-two-ogust-ask",
      "weak-two-invite-raise",
    ],
    tier: "alternative",
  },
  {
    label: "Weak Two responder action (spades)",
    members: [
      "weak-two-game-raise",
      "weak-two-ogust-ask",
      "weak-two-invite-raise",
    ],
    tier: "alternative",
  },
  {
    label: "Weak Two responder action (diamonds)",
    members: [
      "weak-two-game-raise",
      "weak-two-ogust-ask",
      "weak-two-invite-raise",
    ],
    tier: "alternative",
  },
  // Ogust responses: at the 8/9 HCP boundary, min-good vs max-bad are close.
  {
    label: "Ogust Ogust responses",
    members: [
      "weak-two-ogust-solid",
      "weak-two-ogust-min-bad",
      "weak-two-ogust-min-good",
      "weak-two-ogust-max-bad",
      "weak-two-ogust-max-good",
    ],
    tier: "alternative",
  },
];
