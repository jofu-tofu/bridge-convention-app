import type { ExplanationEntry } from "../../../../core/contracts/explanation-catalog";
import type { PedagogicalRelation } from "../../../../core/contracts/teaching-projection";

// ─── Explanation entries ─────────────────────────────────────

export const STAYMAN_EXPLANATION_ENTRIES: readonly ExplanationEntry[] = [
  {
    explanationId: "nt.stayman.eligible",
    factId: "module.stayman.eligible",
    templateKey: "nt.stayman.eligible.supporting",
    displayText: "Eligible for Stayman",
    contrastiveTemplateKey: "nt.stayman.eligible.whyNot",
    contrastiveDisplayText: "Not eligible for Stayman",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking", "pedagogical"],
  },
  {
    explanationId: "nt.stayman.preferred",
    factId: "module.stayman.preferred",
    templateKey: "nt.stayman.preferred.supporting",
    displayText: "Stayman is the preferred convention",
    preferredLevel: "semantic",
    roles: ["supporting", "inferential"],
  },
  {
    explanationId: "nt.stayman.askMajor",
    meaningId: "stayman:ask-major",
    templateKey: "nt.stayman.askMajor.semantic",
    displayText: "Stayman: asks opener for a 4-card major",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
];

// ─── Pedagogical relations ───────────────────────────────────

export const STAYMAN_PEDAGOGICAL_RELATIONS: readonly PedagogicalRelation[] = [
  // Stronger-than within Stayman R3
  {
    kind: "stronger-than",
    a: "stayman:raise-game-hearts",
    b: "stayman:raise-invite-hearts",
  },
  {
    kind: "stronger-than",
    a: "stayman:raise-game-spades",
    b: "stayman:raise-invite-spades",
  },
  {
    kind: "stronger-than",
    a: "stayman:nt-game-no-fit",
    b: "stayman:nt-invite-no-fit",
  },
  {
    kind: "stronger-than",
    a: "stayman:nt-game-after-denial",
    b: "stayman:nt-invite-after-denial",
  },
  // Continuation-of: raise game hearts → ask major
  {
    kind: "continuation-of",
    a: "stayman:raise-game-hearts",
    b: "stayman:ask-major",
  },
];
