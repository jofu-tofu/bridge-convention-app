import type { AlternativeGroup } from "../../../core/contracts";

/**
 * Cross-convention alternative groups for teaching grading.
 * When Jacoby transfer is the selected bid, Stayman 2C grades as Acceptable.
 */
export const ntCrossConventionAlternatives: readonly AlternativeGroup[] = [
  {
    label: "NT response: transfer vs Stayman",
    members: [
      "stayman-ask",
      "transfer-to-hearts",
      "transfer-to-spades",
    ],
    tier: "alternative",
  },
];
