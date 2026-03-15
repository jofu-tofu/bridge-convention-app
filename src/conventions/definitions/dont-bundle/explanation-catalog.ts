import { createExplanationCatalog, type ExplanationEntry, type ExplanationCatalogIR } from "../../../core/contracts/explanation-catalog";

/**
 * DONT explanation catalog.
 *
 * Maps DONT facts and meanings to template keys for teaching projections.
 *
 * Covers three rounds:
 *   R1 — overcaller's action over 1NT (X, 2C, 2D, 2H, 2S)
 *   Adv — advancer's response (pass, relay)
 *   Reveal — overcaller's reveal after double → 2C relay
 */

const DONT_ENTRIES: ExplanationEntry[] = [
  // ── Fact-based entries: shape and support requirements ─────

  {
    explanationId: "dont.bothMajors",
    factId: "module.dont.bothMajors",
    templateKey: "dont.bothMajors.supporting",
    displayText: "5-4 or better in both majors",
    contrastiveTemplateKey: "dont.bothMajors.whyNot",
    contrastiveDisplayText: "Does not hold 5-4 or better in both majors",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "dont.diamondsAndMajor",
    factId: "module.dont.diamondsAndMajor",
    templateKey: "dont.diamondsAndMajor.supporting",
    displayText: "5+ diamonds with a 4+ card major",
    contrastiveTemplateKey: "dont.diamondsAndMajor.whyNot",
    contrastiveDisplayText: "Does not hold 5+ diamonds with a 4+ card major",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "dont.clubsAndHigher",
    factId: "module.dont.clubsAndHigher",
    templateKey: "dont.clubsAndHigher.supporting",
    displayText: "5+ clubs with a 4+ card higher suit",
    contrastiveTemplateKey: "dont.clubsAndHigher.whyNot",
    contrastiveDisplayText: "Does not hold 5+ clubs with a 4+ card higher suit",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "dont.naturalSpades",
    factId: "module.dont.naturalSpades",
    templateKey: "dont.naturalSpades.supporting",
    displayText: "6+ spades (natural)",
    contrastiveTemplateKey: "dont.naturalSpades.whyNot",
    contrastiveDisplayText: "Does not hold 6+ spades",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "dont.singleSuited",
    factId: "module.dont.singleSuited",
    templateKey: "dont.singleSuited.supporting",
    displayText: "6+ cards in one suit (not spades), no secondary 4+ suit",
    contrastiveTemplateKey: "dont.singleSuited.whyNot",
    contrastiveDisplayText: "Does not hold a single-suited hand (non-spades) without a secondary suit",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "dont.heartSupport",
    factId: "module.dont.hasHeartSupport",
    templateKey: "dont.heartSupport.supporting",
    displayText: "3+ hearts to support partner",
    contrastiveTemplateKey: "dont.heartSupport.whyNot",
    contrastiveDisplayText: "Fewer than 3 hearts to support partner",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "dont.spadeSupport",
    factId: "module.dont.hasSpadeSupport",
    templateKey: "dont.spadeSupport.supporting",
    displayText: "3+ spades to support partner",
    contrastiveTemplateKey: "dont.spadeSupport.whyNot",
    contrastiveDisplayText: "Fewer than 3 spades to support partner",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },

  // ── R1: Meaning-based entries — overcaller actions ──────────

  {
    explanationId: "dont.r1.bothMajors",
    meaningId: "dont:both-majors-2h",
    templateKey: "dont.r1.bothMajors.semantic",
    displayText: "2H: Both majors (5-4 or better)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "dont.r1.diamondsMajor",
    meaningId: "dont:diamonds-major-2d",
    templateKey: "dont.r1.diamondsMajor.semantic",
    displayText: "2D: Diamonds plus a major",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "dont.r1.clubsHigher",
    meaningId: "dont:clubs-higher-2c",
    templateKey: "dont.r1.clubsHigher.semantic",
    displayText: "2C: Clubs plus a higher suit",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "dont.r1.naturalSpades",
    meaningId: "dont:natural-spades-2s",
    templateKey: "dont.r1.naturalSpades.semantic",
    displayText: "2S: Natural 6+ spades",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "dont.r1.singleSuited",
    meaningId: "dont:single-suited-double",
    templateKey: "dont.r1.singleSuited.semantic",
    displayText: "Double: One long suit (6+), relay for identity",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── Advancer: Meaning-based entries — advancer responses ────

  {
    explanationId: "dont.adv.acceptSuit",
    meaningId: "dont:accept-partner-suit",
    templateKey: "dont.adv.acceptSuit.semantic",
    displayText: "Pass: Accept partner's shown suit",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "dont.adv.forcedRelay",
    meaningId: "dont:forced-relay-2c",
    templateKey: "dont.adv.forcedRelay.semantic",
    displayText: "2C: Forced relay after partner's double",
    preferredLevel: "mechanical",
    roles: ["pedagogical"],
  },

  // ── Reveal: Meaning-based entries — overcaller reveals ──────

  {
    explanationId: "dont.reveal.clubs",
    meaningId: "dont:reveal-clubs",
    templateKey: "dont.reveal.clubs.semantic",
    displayText: "Pass: 6+ clubs (was the mystery suit)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "dont.reveal.diamonds",
    meaningId: "dont:reveal-diamonds",
    templateKey: "dont.reveal.diamonds.semantic",
    displayText: "2D: 6+ diamonds",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "dont.reveal.hearts",
    meaningId: "dont:reveal-hearts",
    templateKey: "dont.reveal.hearts.semantic",
    displayText: "2H: 6+ hearts",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
];

export const DONT_EXPLANATION_CATALOG: ExplanationCatalogIR = createExplanationCatalog(DONT_ENTRIES);
