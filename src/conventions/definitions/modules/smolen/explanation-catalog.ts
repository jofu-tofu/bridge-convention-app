import type {
  ExplanationEntry,
  FactExplanationEntry,
  MeaningExplanationEntry,
} from "../../../core/explanation-catalog";

import { SMOLEN_FACT_IDS, SMOLEN_MEANING_IDS } from "./ids";
import type { SmolenFactId, SmolenMeaningId } from "./ids";

// ─── Fact explanations (exhaustive over SmolenFactId) ────────

const FACT_EXPLANATIONS: Record<SmolenFactId, FactExplanationEntry> = {
  [SMOLEN_FACT_IDS.HAS_FIVE_HEARTS]: {
    explanationId: "nt.smolen.fiveHearts",
    factId: SMOLEN_FACT_IDS.HAS_FIVE_HEARTS,
    templateKey: "nt.smolen.fiveHearts.supporting",
    displayText: "Has 5+ hearts for Smolen",
    contrastiveTemplateKey: "nt.smolen.fiveHearts.whyNot",
    contrastiveDisplayText: "Does not have 5+ hearts",
    preferredLevel: "mechanical",
    roles: ["supporting", "blocking"],
  },
  [SMOLEN_FACT_IDS.HAS_FIVE_SPADES]: {
    explanationId: "nt.smolen.fiveSpades",
    factId: SMOLEN_FACT_IDS.HAS_FIVE_SPADES,
    templateKey: "nt.smolen.fiveSpades.supporting",
    displayText: "Has 5+ spades for Smolen",
    contrastiveTemplateKey: "nt.smolen.fiveSpades.whyNot",
    contrastiveDisplayText: "Does not have 5+ spades",
    preferredLevel: "mechanical",
    roles: ["supporting", "blocking"],
  },
  [SMOLEN_FACT_IDS.HAS_FOUR_HEARTS]: {
    explanationId: "nt.smolen.fourHearts",
    factId: SMOLEN_FACT_IDS.HAS_FOUR_HEARTS,
    templateKey: "nt.smolen.fourHearts.supporting",
    displayText: "Has 4 hearts for Smolen",
    contrastiveTemplateKey: "nt.smolen.fourHearts.whyNot",
    contrastiveDisplayText: "Does not have 4 hearts",
    preferredLevel: "mechanical",
    roles: ["supporting", "blocking"],
  },
  [SMOLEN_FACT_IDS.HAS_FOUR_SPADES]: {
    explanationId: "nt.smolen.fourSpades",
    factId: SMOLEN_FACT_IDS.HAS_FOUR_SPADES,
    templateKey: "nt.smolen.fourSpades.supporting",
    displayText: "Has 4 spades for Smolen",
    contrastiveTemplateKey: "nt.smolen.fourSpades.whyNot",
    contrastiveDisplayText: "Does not have 4 spades",
    preferredLevel: "mechanical",
    roles: ["supporting", "blocking"],
  },
  [SMOLEN_FACT_IDS.OPENER_HAS_HEART_FIT]: {
    explanationId: "nt.smolen.openerHeartFit",
    factId: SMOLEN_FACT_IDS.OPENER_HAS_HEART_FIT,
    templateKey: "nt.smolen.openerHeartFit.supporting",
    displayText: "Opener has 3+ hearts (fit for Smolen)",
    contrastiveTemplateKey: "nt.smolen.openerHeartFit.whyNot",
    contrastiveDisplayText: "Opener has fewer than 3 hearts",
    preferredLevel: "mechanical",
    roles: ["supporting", "blocking"],
  },
  [SMOLEN_FACT_IDS.OPENER_HAS_SPADES_FIT]: {
    explanationId: "nt.smolen.openerSpadesFit",
    factId: SMOLEN_FACT_IDS.OPENER_HAS_SPADES_FIT,
    templateKey: "nt.smolen.openerSpadesFit.supporting",
    displayText: "Opener has 3+ spades (fit for Smolen)",
    contrastiveTemplateKey: "nt.smolen.openerSpadesFit.whyNot",
    contrastiveDisplayText: "Opener has fewer than 3 spades",
    preferredLevel: "mechanical",
    roles: ["supporting", "blocking"],
  },
};

// ─── Meaning explanations (exhaustive over SmolenMeaningId) ──

const MEANING_EXPLANATIONS: Record<SmolenMeaningId, MeaningExplanationEntry> = {
  [SMOLEN_MEANING_IDS.BID_SHORT_HEARTS]: {
    explanationId: "nt.smolen.bidShortHearts",
    meaningId: SMOLEN_MEANING_IDS.BID_SHORT_HEARTS,
    templateKey: "nt.smolen.bidShortHearts.semantic",
    displayText: "Smolen 3\u2665: shows 4 hearts and 5+ spades, game-forcing",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [SMOLEN_MEANING_IDS.BID_SHORT_SPADES]: {
    explanationId: "nt.smolen.bidShortSpades",
    meaningId: SMOLEN_MEANING_IDS.BID_SHORT_SPADES,
    templateKey: "nt.smolen.bidShortSpades.semantic",
    displayText: "Smolen 3\u2660: shows 4 spades and 5+ hearts, game-forcing",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [SMOLEN_MEANING_IDS.PLACE_FOUR_HEARTS]: {
    explanationId: "nt.smolen.placeFourHearts",
    meaningId: SMOLEN_MEANING_IDS.PLACE_FOUR_HEARTS,
    templateKey: "nt.smolen.placeFourHearts.semantic",
    displayText: "Place 4\u2665: opener confirms heart fit after Smolen 3\u2660",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [SMOLEN_MEANING_IDS.ACCEPT_SPADES_3S]: {
    explanationId: "nt.smolen.acceptSpades3s",
    meaningId: SMOLEN_MEANING_IDS.ACCEPT_SPADES_3S,
    templateKey: "nt.smolen.acceptSpades3s.semantic",
    displayText: "Accept 3\u2660: opener confirms spade fit after Smolen 3\u2665",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [SMOLEN_MEANING_IDS.RESPONDER_PLACE_FOUR_SPADES]: {
    explanationId: "nt.smolen.responderPlaceFourSpades",
    meaningId: SMOLEN_MEANING_IDS.RESPONDER_PLACE_FOUR_SPADES,
    templateKey: "nt.smolen.responderPlaceFourSpades.semantic",
    displayText: "Place 4\u2660: responder completes to game after opener's 3\u2660 acceptance",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [SMOLEN_MEANING_IDS.PLACE_THREE_NT_NO_HEART_FIT]: {
    explanationId: "nt.smolen.placeThreeNtNoHeartFit",
    meaningId: SMOLEN_MEANING_IDS.PLACE_THREE_NT_NO_HEART_FIT,
    templateKey: "nt.smolen.placeThreeNtNoHeartFit.semantic",
    displayText: "Place 3NT: opener has no heart fit after Smolen 3\u2660",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [SMOLEN_MEANING_IDS.PLACE_THREE_NT_NO_SPADE_FIT]: {
    explanationId: "nt.smolen.placeThreeNtNoSpadeFit",
    meaningId: SMOLEN_MEANING_IDS.PLACE_THREE_NT_NO_SPADE_FIT,
    templateKey: "nt.smolen.placeThreeNtNoSpadeFit.semantic",
    displayText: "Place 3NT: opener has no spade fit after Smolen 3\u2665",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [SMOLEN_MEANING_IDS.STAYMAN_ENTRY_5H4S]: {
    explanationId: "nt.smolen.staymanEntry5h4s",
    meaningId: SMOLEN_MEANING_IDS.STAYMAN_ENTRY_5H4S,
    templateKey: "nt.smolen.staymanEntry5h4s.semantic",
    displayText: "Stayman 2\u2663 with 5 hearts + 4 spades, planning Smolen",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [SMOLEN_MEANING_IDS.STAYMAN_ENTRY_5S4H]: {
    explanationId: "nt.smolen.staymanEntry5s4h",
    meaningId: SMOLEN_MEANING_IDS.STAYMAN_ENTRY_5S4H,
    templateKey: "nt.smolen.staymanEntry5s4h.semantic",
    displayText: "Stayman 2\u2663 with 5 spades + 4 hearts, planning Smolen",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
};

// ─── Combined export ─────────────────────────────────────────

export const SMOLEN_EXPLANATION_ENTRIES: readonly ExplanationEntry[] = [
  ...Object.values(FACT_EXPLANATIONS),
  ...Object.values(MEANING_EXPLANATIONS),
];
