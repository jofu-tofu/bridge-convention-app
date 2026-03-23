import {
  createExplanationCatalog,
  type ExplanationEntry,
  type ExplanationCatalog,
  type FactExplanationEntry,
  type MeaningExplanationEntry,
} from "../../../../core/contracts/explanation-catalog";
import { DONT_FACT_IDS, type DontFactId } from "./fact-ids";
import { DONT_MEANING_IDS, type DontMeaningId } from "./meaning-ids";

/**
 * DONT explanation catalog.
 *
 * Maps DONT facts and meanings to template keys for teaching projections.
 * Uses Record<DontFactId, ...> and Record<DontMeaningId, ...> for
 * compile-time exhaustiveness — missing any key is a tsc error.
 *
 * Covers three rounds:
 *   R1 — overcaller's action over 1NT (X, 2C, 2D, 2H, 2S)
 *   Adv — advancer's response (pass, relay, preference, escape)
 *   Reveal — overcaller's reveal after double -> 2C relay, or relay responses
 */

// ── Fact explanations ─────────────────────────────────────────────

const FACT_EXPLANATIONS: Record<DontFactId, FactExplanationEntry> = {
  // ── Overcaller R1 shape facts ──────────────────────────────────
  [DONT_FACT_IDS.BOTH_MAJORS]: {
    explanationId: "dont.bothMajors",
    factId: DONT_FACT_IDS.BOTH_MAJORS,
    templateKey: "dont.bothMajors.supporting",
    displayText: "5-4 or better in both majors",
    contrastiveTemplateKey: "dont.bothMajors.whyNot",
    contrastiveDisplayText: "Does not hold 5-4 or better in both majors",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [DONT_FACT_IDS.DIAMONDS_AND_MAJOR]: {
    explanationId: "dont.diamondsAndMajor",
    factId: DONT_FACT_IDS.DIAMONDS_AND_MAJOR,
    templateKey: "dont.diamondsAndMajor.supporting",
    displayText: "5+ diamonds with a 4+ card major",
    contrastiveTemplateKey: "dont.diamondsAndMajor.whyNot",
    contrastiveDisplayText: "Does not hold 5+ diamonds with a 4+ card major",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [DONT_FACT_IDS.CLUBS_AND_HIGHER]: {
    explanationId: "dont.clubsAndHigher",
    factId: DONT_FACT_IDS.CLUBS_AND_HIGHER,
    templateKey: "dont.clubsAndHigher.supporting",
    displayText: "5+ clubs with a 4+ card higher suit",
    contrastiveTemplateKey: "dont.clubsAndHigher.whyNot",
    contrastiveDisplayText: "Does not hold 5+ clubs with a 4+ card higher suit",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [DONT_FACT_IDS.NATURAL_SPADES]: {
    explanationId: "dont.naturalSpades",
    factId: DONT_FACT_IDS.NATURAL_SPADES,
    templateKey: "dont.naturalSpades.supporting",
    displayText: "6+ spades (natural)",
    contrastiveTemplateKey: "dont.naturalSpades.whyNot",
    contrastiveDisplayText: "Does not hold 6+ spades",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [DONT_FACT_IDS.SINGLE_SUITED]: {
    explanationId: "dont.singleSuited",
    factId: DONT_FACT_IDS.SINGLE_SUITED,
    templateKey: "dont.singleSuited.supporting",
    displayText: "6+ cards in one suit (not spades), no secondary 4+ suit",
    contrastiveTemplateKey: "dont.singleSuited.whyNot",
    contrastiveDisplayText:
      "Does not hold a single-suited hand (non-spades) without a secondary suit",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },

  // ── Overcaller reveal facts (after X -> 2C) ───────────────────
  [DONT_FACT_IDS.SINGLE_SUIT_CLUBS]: {
    explanationId: "dont.singleSuitClubs",
    factId: DONT_FACT_IDS.SINGLE_SUIT_CLUBS,
    templateKey: "dont.singleSuitClubs.supporting",
    displayText: "The 6+ single suit is clubs",
    contrastiveTemplateKey: "dont.singleSuitClubs.whyNot",
    contrastiveDisplayText: "The single suit is not clubs",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [DONT_FACT_IDS.SINGLE_SUIT_DIAMONDS]: {
    explanationId: "dont.singleSuitDiamonds",
    factId: DONT_FACT_IDS.SINGLE_SUIT_DIAMONDS,
    templateKey: "dont.singleSuitDiamonds.supporting",
    displayText: "The 6+ single suit is diamonds",
    contrastiveTemplateKey: "dont.singleSuitDiamonds.whyNot",
    contrastiveDisplayText: "The single suit is not diamonds",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [DONT_FACT_IDS.SINGLE_SUIT_HEARTS]: {
    explanationId: "dont.singleSuitHearts",
    factId: DONT_FACT_IDS.SINGLE_SUIT_HEARTS,
    templateKey: "dont.singleSuitHearts.supporting",
    displayText: "The 6+ single suit is hearts",
    contrastiveTemplateKey: "dont.singleSuitHearts.whyNot",
    contrastiveDisplayText: "The single suit is not hearts",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },

  // ── 2C relay response facts (clubs + higher suit identity) ─────
  [DONT_FACT_IDS.CLUBS_HIGHER_DIAMONDS]: {
    explanationId: "dont.clubsHigherDiamonds",
    factId: DONT_FACT_IDS.CLUBS_HIGHER_DIAMONDS,
    templateKey: "dont.clubsHigherDiamonds.supporting",
    displayText: "With clubs as anchor, the higher suit is diamonds",
    contrastiveTemplateKey: "dont.clubsHigherDiamonds.whyNot",
    contrastiveDisplayText: "The higher suit is not diamonds",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [DONT_FACT_IDS.CLUBS_HIGHER_HEARTS]: {
    explanationId: "dont.clubsHigherHearts",
    factId: DONT_FACT_IDS.CLUBS_HIGHER_HEARTS,
    templateKey: "dont.clubsHigherHearts.supporting",
    displayText: "With clubs as anchor, the higher suit is hearts",
    contrastiveTemplateKey: "dont.clubsHigherHearts.whyNot",
    contrastiveDisplayText: "The higher suit is not hearts",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [DONT_FACT_IDS.CLUBS_HIGHER_SPADES]: {
    explanationId: "dont.clubsHigherSpades",
    factId: DONT_FACT_IDS.CLUBS_HIGHER_SPADES,
    templateKey: "dont.clubsHigherSpades.supporting",
    displayText: "With clubs as anchor, the higher suit is spades",
    contrastiveTemplateKey: "dont.clubsHigherSpades.whyNot",
    contrastiveDisplayText: "The higher suit is not spades",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },

  // ── 2D relay response facts (diamonds + major identity) ────────
  [DONT_FACT_IDS.DIAMONDS_MAJOR_HEARTS]: {
    explanationId: "dont.diamondsMajorHearts",
    factId: DONT_FACT_IDS.DIAMONDS_MAJOR_HEARTS,
    templateKey: "dont.diamondsMajorHearts.supporting",
    displayText: "With diamonds as anchor, the major is hearts",
    contrastiveTemplateKey: "dont.diamondsMajorHearts.whyNot",
    contrastiveDisplayText: "The major is not hearts",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [DONT_FACT_IDS.DIAMONDS_MAJOR_SPADES]: {
    explanationId: "dont.diamondsMajorSpades",
    factId: DONT_FACT_IDS.DIAMONDS_MAJOR_SPADES,
    templateKey: "dont.diamondsMajorSpades.supporting",
    displayText: "With diamonds as anchor, the major is spades",
    contrastiveTemplateKey: "dont.diamondsMajorSpades.whyNot",
    contrastiveDisplayText: "The major is not spades",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },

  // ── Advancer support facts ─────────────────────────────────────
  [DONT_FACT_IDS.HAS_HEART_SUPPORT]: {
    explanationId: "dont.heartSupport",
    factId: DONT_FACT_IDS.HAS_HEART_SUPPORT,
    templateKey: "dont.heartSupport.supporting",
    displayText: "3+ hearts to support partner",
    contrastiveTemplateKey: "dont.heartSupport.whyNot",
    contrastiveDisplayText: "Fewer than 3 hearts to support partner",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [DONT_FACT_IDS.HAS_SPADE_SUPPORT]: {
    explanationId: "dont.spadeSupport",
    factId: DONT_FACT_IDS.HAS_SPADE_SUPPORT,
    templateKey: "dont.spadeSupport.supporting",
    displayText: "3+ spades to support partner",
    contrastiveTemplateKey: "dont.spadeSupport.whyNot",
    contrastiveDisplayText: "Fewer than 3 spades to support partner",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [DONT_FACT_IDS.HAS_DIAMOND_SUPPORT]: {
    explanationId: "dont.diamondSupport",
    factId: DONT_FACT_IDS.HAS_DIAMOND_SUPPORT,
    templateKey: "dont.diamondSupport.supporting",
    displayText: "3+ diamonds to support partner",
    contrastiveTemplateKey: "dont.diamondSupport.whyNot",
    contrastiveDisplayText: "Fewer than 3 diamonds to support partner",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [DONT_FACT_IDS.HAS_CLUB_SUPPORT]: {
    explanationId: "dont.clubSupport",
    factId: DONT_FACT_IDS.HAS_CLUB_SUPPORT,
    templateKey: "dont.clubSupport.supporting",
    displayText: "3+ clubs to support partner",
    contrastiveTemplateKey: "dont.clubSupport.whyNot",
    contrastiveDisplayText: "Fewer than 3 clubs to support partner",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [DONT_FACT_IDS.HAS_LONG_MINOR]: {
    explanationId: "dont.hasLongMinor",
    factId: DONT_FACT_IDS.HAS_LONG_MINOR,
    templateKey: "dont.hasLongMinor.supporting",
    displayText: "6+ in clubs or diamonds (long minor for escape)",
    contrastiveTemplateKey: "dont.hasLongMinor.whyNot",
    contrastiveDisplayText: "Does not hold 6+ in either minor",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [DONT_FACT_IDS.LONG_MINOR_IS_CLUBS]: {
    explanationId: "dont.longMinorIsClubs",
    factId: DONT_FACT_IDS.LONG_MINOR_IS_CLUBS,
    templateKey: "dont.longMinorIsClubs.supporting",
    displayText: "Longer minor is clubs (for 3C escape)",
    contrastiveTemplateKey: "dont.longMinorIsClubs.whyNot",
    contrastiveDisplayText: "Longer minor is not clubs",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  [DONT_FACT_IDS.LONG_MINOR_IS_DIAMONDS]: {
    explanationId: "dont.longMinorIsDiamonds",
    factId: DONT_FACT_IDS.LONG_MINOR_IS_DIAMONDS,
    templateKey: "dont.longMinorIsDiamonds.supporting",
    displayText: "Longer minor is diamonds (for 3D escape)",
    contrastiveTemplateKey: "dont.longMinorIsDiamonds.whyNot",
    contrastiveDisplayText: "Longer minor is not diamonds",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
};

// ── Meaning explanations ──────────────────────────────────────────

const MEANING_EXPLANATIONS: Record<DontMeaningId, MeaningExplanationEntry> = {
  // ── Stub: Opponent's 1NT opening ──────────────────────────────
  [DONT_MEANING_IDS.OPPONENT_1NT]: {
    explanationId: "dont.stub.opponent1nt",
    meaningId: DONT_MEANING_IDS.OPPONENT_1NT,
    templateKey: "dont.stub.opponent1nt.semantic",
    displayText: "internal",
    preferredLevel: "mechanical",
    roles: [],
  },

  // ── R1: Overcaller initial action ──────────────────────────────
  [DONT_MEANING_IDS.BOTH_MAJORS_2H]: {
    explanationId: "dont.r1.bothMajors",
    meaningId: DONT_MEANING_IDS.BOTH_MAJORS_2H,
    templateKey: "dont.r1.bothMajors.semantic",
    displayText: "2H: Both majors (5-4 or better)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [DONT_MEANING_IDS.DIAMONDS_MAJOR_2D]: {
    explanationId: "dont.r1.diamondsMajor",
    meaningId: DONT_MEANING_IDS.DIAMONDS_MAJOR_2D,
    templateKey: "dont.r1.diamondsMajor.semantic",
    displayText: "2D: Diamonds plus a major",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [DONT_MEANING_IDS.CLUBS_HIGHER_2C]: {
    explanationId: "dont.r1.clubsHigher",
    meaningId: DONT_MEANING_IDS.CLUBS_HIGHER_2C,
    templateKey: "dont.r1.clubsHigher.semantic",
    displayText: "2C: Clubs plus a higher suit",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [DONT_MEANING_IDS.NATURAL_SPADES_2S]: {
    explanationId: "dont.r1.naturalSpades",
    meaningId: DONT_MEANING_IDS.NATURAL_SPADES_2S,
    templateKey: "dont.r1.naturalSpades.semantic",
    displayText: "2S: Natural 6+ spades",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [DONT_MEANING_IDS.SINGLE_SUITED_DOUBLE]: {
    explanationId: "dont.r1.singleSuited",
    meaningId: DONT_MEANING_IDS.SINGLE_SUITED_DOUBLE,
    templateKey: "dont.r1.singleSuited.semantic",
    displayText: "Double: One long suit (6+), relay for identity",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [DONT_MEANING_IDS.OVERCALLER_PASS]: {
    explanationId: "dont.r1.overcallerPass",
    meaningId: DONT_MEANING_IDS.OVERCALLER_PASS,
    templateKey: "dont.r1.overcallerPass.semantic",
    displayText: "Pass: No DONT action (hand does not qualify)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── Advancer after 2H (both majors) ───────────────────────────
  [DONT_MEANING_IDS.ACCEPT_HEARTS_PASS]: {
    explanationId: "dont.adv.acceptHearts",
    meaningId: DONT_MEANING_IDS.ACCEPT_HEARTS_PASS,
    templateKey: "dont.adv.acceptHearts.semantic",
    displayText: "Pass: Accept hearts as trump",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [DONT_MEANING_IDS.PREFER_SPADES_2S]: {
    explanationId: "dont.adv.preferSpades",
    meaningId: DONT_MEANING_IDS.PREFER_SPADES_2S,
    templateKey: "dont.adv.preferSpades.semantic",
    displayText: "2S: Prefer spades (3+ spades, fewer than 3 hearts)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [DONT_MEANING_IDS.ESCAPE_CLUBS_3C]: {
    explanationId: "dont.adv.escapeClubs",
    meaningId: DONT_MEANING_IDS.ESCAPE_CLUBS_3C,
    templateKey: "dont.adv.escapeClubs.semantic",
    displayText: "3C: Escape to long clubs (6+), no major fit",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [DONT_MEANING_IDS.ESCAPE_DIAMONDS_3D]: {
    explanationId: "dont.adv.escapeDiamonds",
    meaningId: DONT_MEANING_IDS.ESCAPE_DIAMONDS_3D,
    templateKey: "dont.adv.escapeDiamonds.semantic",
    displayText: "3D: Escape to long diamonds (6+), no major fit",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── Advancer after 2D (diamonds + major) ──────────────────────
  [DONT_MEANING_IDS.ACCEPT_DIAMONDS_PASS]: {
    explanationId: "dont.adv.acceptDiamonds",
    meaningId: DONT_MEANING_IDS.ACCEPT_DIAMONDS_PASS,
    templateKey: "dont.adv.acceptDiamonds.semantic",
    displayText: "Pass: Accept diamonds as trump (3+ diamonds)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [DONT_MEANING_IDS.RELAY_2H_AFTER_2D]: {
    explanationId: "dont.adv.relay2hAfter2d",
    meaningId: DONT_MEANING_IDS.RELAY_2H_AFTER_2D,
    templateKey: "dont.adv.relay2hAfter2d.semantic",
    displayText: "2H: Relay asking which major partner holds",
    preferredLevel: "mechanical",
    roles: ["pedagogical"],
  },

  // ── Advancer after 2C (clubs + higher) ─────────────────────────
  [DONT_MEANING_IDS.ACCEPT_CLUBS_PASS]: {
    explanationId: "dont.adv.acceptClubs",
    meaningId: DONT_MEANING_IDS.ACCEPT_CLUBS_PASS,
    templateKey: "dont.adv.acceptClubs.semantic",
    displayText: "Pass: Accept clubs as trump (3+ clubs)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [DONT_MEANING_IDS.RELAY_2D_AFTER_2C]: {
    explanationId: "dont.adv.relay2dAfter2c",
    meaningId: DONT_MEANING_IDS.RELAY_2D_AFTER_2C,
    templateKey: "dont.adv.relay2dAfter2c.semantic",
    displayText: "2D: Relay asking which higher suit partner holds",
    preferredLevel: "mechanical",
    roles: ["pedagogical"],
  },

  // ── Advancer after 2S (natural spades) ─────────────────────────
  [DONT_MEANING_IDS.ACCEPT_SPADES_PASS]: {
    explanationId: "dont.adv.acceptSpades",
    meaningId: DONT_MEANING_IDS.ACCEPT_SPADES_PASS,
    templateKey: "dont.adv.acceptSpades.semantic",
    displayText: "Pass: Accept spades as trump (3+ spades)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [DONT_MEANING_IDS.ACCEPT_SPADES_FALLBACK]: {
    explanationId: "dont.adv.acceptSpadesFallback",
    meaningId: DONT_MEANING_IDS.ACCEPT_SPADES_FALLBACK,
    templateKey: "dont.adv.acceptSpadesFallback.semantic",
    displayText: "Pass: Accept spades by default (no better option)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── Advancer after X (double -- single suited) ─────────────────
  [DONT_MEANING_IDS.FORCED_RELAY_2C]: {
    explanationId: "dont.adv.forcedRelay",
    meaningId: DONT_MEANING_IDS.FORCED_RELAY_2C,
    templateKey: "dont.adv.forcedRelay.semantic",
    displayText: "2C: Forced relay after partner's double",
    preferredLevel: "mechanical",
    roles: ["pedagogical"],
  },

  // ── Overcaller reveal after X -> 2C ────────────────────────────
  [DONT_MEANING_IDS.REVEAL_CLUBS_PASS]: {
    explanationId: "dont.reveal.clubs",
    meaningId: DONT_MEANING_IDS.REVEAL_CLUBS_PASS,
    templateKey: "dont.reveal.clubs.semantic",
    displayText: "Pass: 6+ clubs (was the mystery suit)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [DONT_MEANING_IDS.REVEAL_DIAMONDS_2D]: {
    explanationId: "dont.reveal.diamonds",
    meaningId: DONT_MEANING_IDS.REVEAL_DIAMONDS_2D,
    templateKey: "dont.reveal.diamonds.semantic",
    displayText: "2D: 6+ diamonds",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [DONT_MEANING_IDS.REVEAL_HEARTS_2H]: {
    explanationId: "dont.reveal.hearts",
    meaningId: DONT_MEANING_IDS.REVEAL_HEARTS_2H,
    templateKey: "dont.reveal.hearts.semantic",
    displayText: "2H: 6+ hearts",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── Overcaller reply after 2C -> 2D relay ──────────────────────
  [DONT_MEANING_IDS.CLUBS_HIGHER_DIAMONDS_PASS]: {
    explanationId: "dont.relay2c.diamondsPass",
    meaningId: DONT_MEANING_IDS.CLUBS_HIGHER_DIAMONDS_PASS,
    templateKey: "dont.relay2c.diamondsPass.semantic",
    displayText: "Pass: Higher suit is diamonds (already bid via relay)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [DONT_MEANING_IDS.CLUBS_HIGHER_HEARTS_2H]: {
    explanationId: "dont.relay2c.hearts2h",
    meaningId: DONT_MEANING_IDS.CLUBS_HIGHER_HEARTS_2H,
    templateKey: "dont.relay2c.hearts2h.semantic",
    displayText: "2H: Higher suit is hearts",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [DONT_MEANING_IDS.CLUBS_HIGHER_SPADES_2S]: {
    explanationId: "dont.relay2c.spades2s",
    meaningId: DONT_MEANING_IDS.CLUBS_HIGHER_SPADES_2S,
    templateKey: "dont.relay2c.spades2s.semantic",
    displayText: "2S: Higher suit is spades",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── Overcaller reply after 2D -> 2H relay ──────────────────────
  [DONT_MEANING_IDS.DIAMONDS_MAJOR_HEARTS_PASS]: {
    explanationId: "dont.relay2d.heartsPass",
    meaningId: DONT_MEANING_IDS.DIAMONDS_MAJOR_HEARTS_PASS,
    templateKey: "dont.relay2d.heartsPass.semantic",
    displayText: "Pass: The major is hearts (already bid via relay)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [DONT_MEANING_IDS.DIAMONDS_MAJOR_SPADES_2S]: {
    explanationId: "dont.relay2d.spades2s",
    meaningId: DONT_MEANING_IDS.DIAMONDS_MAJOR_SPADES_2S,
    templateKey: "dont.relay2d.spades2s.semantic",
    displayText: "2S: The major is spades",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
};

// ── Composed export ───────────────────────────────────────────────

export const DONT_ENTRIES: readonly ExplanationEntry[] = [
  ...Object.values(FACT_EXPLANATIONS),
  ...Object.values(MEANING_EXPLANATIONS),
];

export const DONT_EXPLANATION_CATALOG: ExplanationCatalog =
  createExplanationCatalog([...DONT_ENTRIES]);
