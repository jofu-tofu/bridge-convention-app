import type { AlternativeGroup } from "../../../../core/contracts";

/**
 * Bergen alternative groups for grading tolerance.
 *
 * When the matched intent is one of these group members, other members in the
 * same group become acceptable alternatives. This prevents penalizing a student
 * who bids a slightly different Bergen raise when the HCP count is borderline.
 *
 * Uses bidNames (IntentNode.name) from the Bergen tree, matching
 * ResolvedCandidateDTO.bidName format.
 */
export const BERGEN_ALTERNATIVE_GROUPS: readonly AlternativeGroup[] = [
  // The three coded strength raises + preemptive for hearts.
  // At HCP boundaries (6/7, 10, 12/13), adjacent raises are acceptable alternatives.
  {
    label: "Bergen strength raises (hearts)",
    members: [
      "bergen-game-raise",
      "bergen-limit-raise",
      "bergen-constructive-raise",
      "bergen-preemptive-raise",
    ],
    tier: "alternative",
  },
  // Same for spades — same bidNames since the tree is suit-agnostic
  // (the tree dispatches on the opening bid suit, not the response bidName).
  {
    label: "Bergen strength raises (spades)",
    members: [
      "bergen-game-raise",
      "bergen-limit-raise",
      "bergen-constructive-raise",
      "bergen-preemptive-raise",
    ],
    tier: "alternative",
  },
  // Opener rebids after constructive: game vs signoff vs try.
  // A game try (14-16) is an acceptable alternative to game (17+) or signoff (<14).
  {
    label: "Opener rebid after constructive",
    members: [
      "bergen-rebid-game-after-constructive",
      "bergen-rebid-try-after-constructive",
      "bergen-rebid-signoff-after-constructive",
    ],
    tier: "alternative",
  },
  // Opener rebids after limit: game vs signoff.
  {
    label: "Opener rebid after limit",
    members: [
      "bergen-rebid-game-after-limit",
      "bergen-rebid-signoff-after-limit",
    ],
    tier: "alternative",
  },
  // Responder game-try decision: accept vs reject.
  {
    label: "Responder game try decision",
    members: [
      "bergen-try-accept",
      "bergen-try-reject",
    ],
    tier: "alternative",
  },
];
