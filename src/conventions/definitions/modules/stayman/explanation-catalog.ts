import type {
  ExplanationEntry,
  FactExplanationEntry,
  MeaningExplanationEntry,
} from "../../../../core/contracts/explanation-catalog";
import type { StaymanFactId } from "./fact-ids";
import { STAYMAN_FACT_IDS } from "./fact-ids";
import type { StaymanMeaningId } from "./meaning-ids";
import { STAYMAN_MEANING_IDS } from "./meaning-ids";

// ─── Fact explanations (Record-exhaustive) ──────────────────

const FACT_EXPLANATIONS: Record<StaymanFactId, FactExplanationEntry> = {
  [STAYMAN_FACT_IDS.ELIGIBLE]: {
    explanationId: "nt.stayman.eligible",
    factId: STAYMAN_FACT_IDS.ELIGIBLE,
    templateKey: "nt.stayman.eligible.supporting",
    displayText: "Eligible for Stayman",
    contrastiveTemplateKey: "nt.stayman.eligible.whyNot",
    contrastiveDisplayText: "Not eligible for Stayman",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking", "pedagogical"],
  },
  [STAYMAN_FACT_IDS.PREFERRED]: {
    explanationId: "nt.stayman.preferred",
    factId: STAYMAN_FACT_IDS.PREFERRED,
    templateKey: "nt.stayman.preferred.supporting",
    displayText: "Stayman is the preferred convention",
    preferredLevel: "semantic",
    roles: ["supporting", "inferential"],
  },
  [STAYMAN_FACT_IDS.NS_HAVE_EIGHT_CARD_FIT_LIKELY]: {
    explanationId: "nt.stayman.nsHaveEightCardFitLikely",
    factId: STAYMAN_FACT_IDS.NS_HAVE_EIGHT_CARD_FIT_LIKELY,
    templateKey: "nt.stayman.nsHaveEightCardFitLikely.internal",
    displayText: "internal",
    preferredLevel: "mechanical",
    roles: [],
  },
  [STAYMAN_FACT_IDS.OPENER_STILL_BALANCED_LIKELY]: {
    explanationId: "nt.stayman.openerStillBalancedLikely",
    factId: STAYMAN_FACT_IDS.OPENER_STILL_BALANCED_LIKELY,
    templateKey: "nt.stayman.openerStillBalancedLikely.internal",
    displayText: "internal",
    preferredLevel: "mechanical",
    roles: [],
  },
  [STAYMAN_FACT_IDS.OPENER_HAS_SECOND_MAJOR_LIKELY]: {
    explanationId: "nt.stayman.openerHasSecondMajorLikely",
    factId: STAYMAN_FACT_IDS.OPENER_HAS_SECOND_MAJOR_LIKELY,
    templateKey: "nt.stayman.openerHasSecondMajorLikely.internal",
    displayText: "internal",
    preferredLevel: "mechanical",
    roles: [],
  },
};

// ─── Meaning explanations (Record-exhaustive) ───────────────

const MEANING_EXPLANATIONS: Record<StaymanMeaningId, MeaningExplanationEntry> = {
  [STAYMAN_MEANING_IDS.ASK_MAJOR]: {
    explanationId: "nt.stayman.askMajor",
    meaningId: STAYMAN_MEANING_IDS.ASK_MAJOR,
    templateKey: "nt.stayman.askMajor.semantic",
    displayText: "Stayman 2\u2663: asks opener for a 4-card major",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [STAYMAN_MEANING_IDS.SHOW_HEARTS]: {
    explanationId: "nt.stayman.showHearts",
    meaningId: STAYMAN_MEANING_IDS.SHOW_HEARTS,
    templateKey: "nt.stayman.showHearts.semantic",
    displayText: "Opener shows 4+ hearts in response to Stayman",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [STAYMAN_MEANING_IDS.SHOW_SPADES]: {
    explanationId: "nt.stayman.showSpades",
    meaningId: STAYMAN_MEANING_IDS.SHOW_SPADES,
    templateKey: "nt.stayman.showSpades.semantic",
    displayText: "Opener shows 4+ spades in response to Stayman",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [STAYMAN_MEANING_IDS.DENY_MAJOR]: {
    explanationId: "nt.stayman.denyMajor",
    meaningId: STAYMAN_MEANING_IDS.DENY_MAJOR,
    templateKey: "nt.stayman.denyMajor.semantic",
    displayText: "Opener bids 2\u2666 to deny holding a 4-card major",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [STAYMAN_MEANING_IDS.RAISE_GAME_HEARTS]: {
    explanationId: "nt.stayman.raiseGameHearts",
    meaningId: STAYMAN_MEANING_IDS.RAISE_GAME_HEARTS,
    templateKey: "nt.stayman.raiseGameHearts.semantic",
    displayText: "Raise to 4\u2665 with game values and a heart fit",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [STAYMAN_MEANING_IDS.RAISE_INVITE_HEARTS]: {
    explanationId: "nt.stayman.raiseInviteHearts",
    meaningId: STAYMAN_MEANING_IDS.RAISE_INVITE_HEARTS,
    templateKey: "nt.stayman.raiseInviteHearts.semantic",
    displayText: "Invite in hearts (3\u2665) with invitational values and a heart fit",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [STAYMAN_MEANING_IDS.NT_GAME_NO_FIT]: {
    explanationId: "nt.stayman.ntGameNoFit",
    meaningId: STAYMAN_MEANING_IDS.NT_GAME_NO_FIT,
    templateKey: "nt.stayman.ntGameNoFit.semantic",
    displayText: "Bid 3NT with game values but no heart fit",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [STAYMAN_MEANING_IDS.NT_INVITE_NO_FIT]: {
    explanationId: "nt.stayman.ntInviteNoFit",
    meaningId: STAYMAN_MEANING_IDS.NT_INVITE_NO_FIT,
    templateKey: "nt.stayman.ntInviteNoFit.semantic",
    displayText: "Bid 2NT to invite game with no heart fit",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [STAYMAN_MEANING_IDS.RAISE_GAME_SPADES]: {
    explanationId: "nt.stayman.raiseGameSpades",
    meaningId: STAYMAN_MEANING_IDS.RAISE_GAME_SPADES,
    templateKey: "nt.stayman.raiseGameSpades.semantic",
    displayText: "Raise to 4\u2660 with game values and a spade fit",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [STAYMAN_MEANING_IDS.RAISE_INVITE_SPADES]: {
    explanationId: "nt.stayman.raiseInviteSpades",
    meaningId: STAYMAN_MEANING_IDS.RAISE_INVITE_SPADES,
    templateKey: "nt.stayman.raiseInviteSpades.semantic",
    displayText: "Invite in spades (3\u2660) with invitational values and a spade fit",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [STAYMAN_MEANING_IDS.NT_GAME_NO_FIT_2S]: {
    explanationId: "nt.stayman.ntGameNoFit2S",
    meaningId: STAYMAN_MEANING_IDS.NT_GAME_NO_FIT_2S,
    templateKey: "nt.stayman.ntGameNoFit2S.semantic",
    displayText: "Bid 3NT with game values but no spade fit",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [STAYMAN_MEANING_IDS.NT_INVITE_NO_FIT_2S]: {
    explanationId: "nt.stayman.ntInviteNoFit2S",
    meaningId: STAYMAN_MEANING_IDS.NT_INVITE_NO_FIT_2S,
    templateKey: "nt.stayman.ntInviteNoFit2S.semantic",
    displayText: "Bid 2NT to invite game with no spade fit",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [STAYMAN_MEANING_IDS.NT_GAME_AFTER_DENIAL]: {
    explanationId: "nt.stayman.ntGameAfterDenial",
    meaningId: STAYMAN_MEANING_IDS.NT_GAME_AFTER_DENIAL,
    templateKey: "nt.stayman.ntGameAfterDenial.semantic",
    displayText: "Bid 3NT with game values after opener denies a major",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [STAYMAN_MEANING_IDS.NT_INVITE_AFTER_DENIAL]: {
    explanationId: "nt.stayman.ntInviteAfterDenial",
    meaningId: STAYMAN_MEANING_IDS.NT_INVITE_AFTER_DENIAL,
    templateKey: "nt.stayman.ntInviteAfterDenial.semantic",
    displayText: "Bid 2NT to invite game after opener denies a major",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
};

// ─── Composed export ────────────────────────────────────────

export const STAYMAN_EXPLANATION_ENTRIES: readonly ExplanationEntry[] = [
  ...Object.values(FACT_EXPLANATIONS),
  ...Object.values(MEANING_EXPLANATIONS),
];
