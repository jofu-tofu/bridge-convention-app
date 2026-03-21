import { createExplanationCatalog, type ExplanationEntry, type ExplanationCatalog } from "../../../../core/contracts/explanation-catalog";

/**
 * Weak Two Bids explanation catalog.
 *
 * Maps weak two facts and meanings to template keys for teaching projections.
 *
 * Covers three rounds:
 *   R1 — opener's weak two opening (2D, 2H, 2S)
 *   R2 — responder's action (game raise, Ogust ask, invite, pass)
 *   R3 — opener's Ogust rebid (solid, min/bad, min/good, max/bad, max/good)
 */

export const WEAK_TWO_ENTRIES: ExplanationEntry[] = [
  // ── Fact-based entries: HCP and suit requirements ──────────

  {
    explanationId: "weakTwo.hcp.opener",
    factId: "module.weakTwo.inOpeningHcpRange",
    templateKey: "weakTwo.hcp.opener.supporting",
    displayText: "HCP in weak two opening range (6-11 vul, 5-11 NV)",
    contrastiveTemplateKey: "weakTwo.hcp.opener.whyNot",
    contrastiveDisplayText: "HCP not in weak two opening range",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "weakTwo.suitLength",
    factId: "hand.suitLength.$suit",
    templateKey: "weakTwo.suitLength.supporting",
    displayText: "6+ cards in the bid suit",
    contrastiveTemplateKey: "weakTwo.suitLength.whyNot",
    contrastiveDisplayText: "Fewer than 6 cards in the suit",
    preferredLevel: "mechanical",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "weakTwo.topHonors",
    factId: "module.weakTwo.topHonorCount.$suit",
    templateKey: "weakTwo.topHonors.supporting",
    displayText: "Top honor count (A, K, Q) in the opened suit",
    preferredLevel: "mechanical",
    roles: ["supporting", "pedagogical"],
  },
  {
    explanationId: "weakTwo.hcp.responderGame",
    factId: "hand.hcp",
    templateKey: "weakTwo.hcp.responderGame.supporting",
    displayText: "16+ HCP for game raise or Ogust ask",
    contrastiveTemplateKey: "weakTwo.hcp.responderGame.whyNot",
    contrastiveDisplayText: "Not enough HCP (need 16+) for game or Ogust",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "weakTwo.hcp.responderInvite",
    factId: "hand.hcp",
    templateKey: "weakTwo.hcp.responderInvite.supporting",
    displayText: "14-15 HCP for an invite raise",
    contrastiveTemplateKey: "weakTwo.hcp.responderInvite.whyNot",
    contrastiveDisplayText: "HCP not in invite range (14-15)",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },

  // ── Ogust dimension entries ────────────────────────────────

  {
    explanationId: "weakTwo.ogust.isMinimum",
    factId: "module.weakTwo.isMinimum",
    templateKey: "weakTwo.ogust.isMinimum.supporting",
    displayText: "Minimum hand (5-8 NV, 6-8 vul) for Ogust",
    contrastiveTemplateKey: "weakTwo.ogust.isMinimum.whyNot",
    contrastiveDisplayText: "Not minimum — hand is in the maximum range",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "weakTwo.ogust.isMaximum",
    factId: "module.weakTwo.isMaximum",
    templateKey: "weakTwo.ogust.isMaximum.supporting",
    displayText: "Maximum hand (9-11 HCP) for Ogust",
    contrastiveTemplateKey: "weakTwo.ogust.isMaximum.whyNot",
    contrastiveDisplayText: "Not maximum — hand is in the minimum range",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "weakTwo.ogust.isSolid",
    factId: "module.weakTwo.isSolid.$suit",
    templateKey: "weakTwo.ogust.isSolid.supporting",
    displayText: "Solid suit (AKQ) — bid 3NT",
    contrastiveTemplateKey: "weakTwo.ogust.isSolid.whyNot",
    contrastiveDisplayText: "Not solid — missing at least one top honor",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },

  // ── R1: Meaning-based entries — opener bids ────────────────

  {
    explanationId: "weakTwo.r1.open2h",
    meaningId: "weak-two:open-2h",
    templateKey: "weakTwo.r1.open2h.semantic",
    displayText: "Open 2H: 6+ hearts, 5-11 NV / 6-11 vul HCP",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "weakTwo.r1.open2s",
    meaningId: "weak-two:open-2s",
    templateKey: "weakTwo.r1.open2s.semantic",
    displayText: "Open 2S: 6+ spades, 5-11 NV / 6-11 vul HCP",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "weakTwo.r1.open2d",
    meaningId: "weak-two:open-2d",
    templateKey: "weakTwo.r1.open2d.semantic",
    displayText: "Open 2D: 6+ diamonds, 5-11 NV / 6-11 vul HCP",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R2: Meaning-based entries — responder actions ──────────

  {
    explanationId: "weakTwo.r2.gameRaise",
    meaningId: "weak-two:game-raise",
    templateKey: "weakTwo.r2.gameRaise.semantic",
    displayText: "Game raise: 16+ HCP with 3+ fit",
    contrastiveTemplateKey: "weakTwo.r2.gameRaise.whyNotOgust",
    contrastiveDisplayText: "Consider Ogust 2NT to learn more about opener's hand",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "weakTwo.r2.ogustAsk",
    meaningId: "weak-two:ogust-ask",
    templateKey: "weakTwo.r2.ogustAsk.semantic",
    displayText: "Ogust 2NT: ask opener to describe hand strength and quality",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "weakTwo.r2.inviteRaise",
    meaningId: "weak-two:invite-raise",
    templateKey: "weakTwo.r2.inviteRaise.semantic",
    displayText: "Invite raise: 14-15 HCP with 3+ support",
    contrastiveTemplateKey: "weakTwo.r2.inviteRaise.whyNotGame",
    contrastiveDisplayText: "Not enough for game (need 16+)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R3: Meaning-based entries — Ogust responses ────────────

  {
    explanationId: "weakTwo.r3.ogustSolid",
    meaningId: "weak-two:ogust-solid",
    templateKey: "weakTwo.r3.ogustSolid.semantic",
    displayText: "Solid suit (AKQ) — bid 3NT",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "weakTwo.r3.ogustMinBad",
    meaningId: "weak-two:ogust-min-bad",
    templateKey: "weakTwo.r3.ogustMinBad.semantic",
    displayText: "Minimum hand, bad suit (0-1 top honors) — bid 3C",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "weakTwo.r3.ogustMinGood",
    meaningId: "weak-two:ogust-min-good",
    templateKey: "weakTwo.r3.ogustMinGood.semantic",
    displayText: "Minimum hand, good suit (2+ top honors) — bid 3D",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "weakTwo.r3.ogustMaxBad",
    meaningId: "weak-two:ogust-max-bad",
    templateKey: "weakTwo.r3.ogustMaxBad.semantic",
    displayText: "Maximum hand, bad suit (0-1 top honors) — bid 3H",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "weakTwo.r3.ogustMaxGood",
    meaningId: "weak-two:ogust-max-good",
    templateKey: "weakTwo.r3.ogustMaxGood.semantic",
    displayText: "Maximum hand, good suit (2+ top honors) — bid 3S",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
];

export const WEAK_TWO_EXPLANATION_CATALOG: ExplanationCatalog = createExplanationCatalog(WEAK_TWO_ENTRIES);
