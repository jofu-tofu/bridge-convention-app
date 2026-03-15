import type { AlternativeGroup } from "../../../core/contracts";

/**
 * DONT alternative groups for grading tolerance.
 *
 * When the matched intent is one of these group members, other members in the
 * same group become acceptable alternatives. This prevents penalizing a student
 * who bids at shape boundaries.
 */
export const DONT_ALTERNATIVE_GROUPS: readonly AlternativeGroup[] = [
  // Overcaller two-suited actions: at shape boundaries these are close.
  {
    label: "DONT overcaller two-suited actions",
    members: [
      "dont:both-majors-2h",
      "dont:diamonds-major-2d",
      "dont:clubs-higher-2c",
    ],
    tier: "alternative",
  },
  // Overcaller action alternatives: 6+ suit differentiated only by spades vs not.
  {
    label: "DONT overcaller long-suit actions",
    members: [
      "dont:natural-spades-2s",
      "dont:single-suited-double",
    ],
    tier: "alternative",
  },
];
