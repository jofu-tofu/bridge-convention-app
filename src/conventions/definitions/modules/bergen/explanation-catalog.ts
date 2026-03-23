import type {
  ExplanationEntry,
  ExplanationCatalog,
  FactExplanationEntry,
  MeaningExplanationEntry,
} from "../../../../core/contracts/explanation-catalog";
import { createExplanationCatalog } from "../../../../core/contracts/explanation-catalog";
import { BERGEN_FACT_IDS, type BergenFactId } from "./fact-ids";
import { BERGEN_MEANING_IDS, type BergenMeaningId } from "./meaning-ids";

/**
 * Bergen Raises explanation catalog.
 *
 * Maps Bergen facts and meanings to template keys for teaching projections.
 * Uses Record<BergenFactId, ...> and Record<BergenMeaningId, ...> for
 * compile-time exhaustiveness — missing any key is a tsc error.
 *
 * Covers all four rounds:
 *   R1 — responder's initial Bergen raise (splinter, game, limit, constructive, preemptive)
 *   R2 — opener's rebid (game/signoff/try after each raise type)
 *   R3 — responder's continuation (accept game, accept signoff, try-accept, try-reject)
 *   R4 — opener's final acceptance after game try
 */

// ── Module fact explanations (Record-exhaustive) ─────────────────

const FACT_EXPLANATIONS: Record<BergenFactId, FactExplanationEntry> = {
  [BERGEN_FACT_IDS.HAS_MAJOR_SUPPORT]: {
    explanationId: "bergen.support.hasMajorSupport",
    factId: BERGEN_FACT_IDS.HAS_MAJOR_SUPPORT,
    templateKey: "bergen.support.hasMajorSupport.supporting",
    displayText: "Has 4-card support in at least one major",
    contrastiveTemplateKey: "bergen.support.hasMajorSupport.whyNot",
    contrastiveDisplayText: "Does not have 4-card support in either major",
    preferredLevel: "mechanical",
    roles: ["supporting", "blocking", "pedagogical"],
  },
};

// ── Shared-fact explanations (not keyed by BergenFactId) ─────────

const SHARED_FACT_EXPLANATIONS: readonly FactExplanationEntry[] = [
  // HCP thresholds for responder raises
  {
    explanationId: "bergen.hcp.splinter",
    factId: "hand.hcp",
    templateKey: "bergen.hcp.splinter.supporting",
    displayText: "Enough strength for a splinter raise",
    contrastiveTemplateKey: "bergen.hcp.splinter.whyNot",
    contrastiveDisplayText: "Not enough strength for a splinter raise",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "bergen.hcp.game",
    factId: "hand.hcp",
    templateKey: "bergen.hcp.game.supporting",
    displayText: "Enough HCP for a Bergen game raise",
    contrastiveTemplateKey: "bergen.hcp.game.whyNot",
    contrastiveDisplayText: "Not enough HCP for a Bergen game raise",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "bergen.hcp.limit",
    factId: "hand.hcp",
    templateKey: "bergen.hcp.limit.supporting",
    displayText: "Enough HCP for a limit raise",
    contrastiveTemplateKey: "bergen.hcp.limit.whyNot",
    contrastiveDisplayText: "Not enough HCP for a limit raise",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "bergen.hcp.constructive",
    factId: "hand.hcp",
    templateKey: "bergen.hcp.constructive.supporting",
    displayText: "Enough HCP for a constructive raise",
    contrastiveTemplateKey: "bergen.hcp.constructive.whyNot",
    contrastiveDisplayText: "Not enough HCP for a constructive raise",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "bergen.hcp.preemptive",
    factId: "hand.hcp",
    templateKey: "bergen.hcp.preemptive.supporting",
    displayText: "HCP consistent with a preemptive raise",
    contrastiveTemplateKey: "bergen.hcp.preemptive.whyNot",
    contrastiveDisplayText: "Too many HCP for a preemptive raise",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },

  // Suit support and shape
  {
    explanationId: "bergen.support.majorFit",
    factId: "hand.suitLength.$suit",
    templateKey: "bergen.support.majorFit.supporting",
    displayText: "Has enough support for opener's major",
    contrastiveTemplateKey: "bergen.support.majorFit.whyNot",
    contrastiveDisplayText: "Not enough support for opener's major",
    preferredLevel: "mechanical",
    roles: ["supporting", "blocking", "pedagogical"],
  },
  {
    explanationId: "bergen.shape.shortage",
    factId: "bridge.hasShortage",
    templateKey: "bergen.shape.shortage.supporting",
    displayText: "Has a short suit (singleton or void)",
    contrastiveTemplateKey: "bergen.shape.shortage.whyNot",
    contrastiveDisplayText: "No short suit for a splinter",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking", "pedagogical"],
  },

  // Opener HCP thresholds for rebid decisions
  {
    explanationId: "bergen.opener.hcp.game17",
    factId: "hand.hcp",
    templateKey: "bergen.opener.hcp.game17.supporting",
    displayText: "17+ HCP to bid game after constructive raise",
    contrastiveTemplateKey: "bergen.opener.hcp.game17.whyNot",
    contrastiveDisplayText: "Not enough HCP (need 17+) to bid game after constructive raise",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "bergen.opener.hcp.try14",
    factId: "hand.hcp",
    templateKey: "bergen.opener.hcp.try14.supporting",
    displayText: "14-16 HCP for a game try after constructive raise",
    contrastiveTemplateKey: "bergen.opener.hcp.try14.whyNot",
    contrastiveDisplayText: "HCP not in game-try range (14-16) after constructive raise",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "bergen.opener.hcp.game15",
    factId: "hand.hcp",
    templateKey: "bergen.opener.hcp.game15.supporting",
    displayText: "15+ HCP to accept the limit raise",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "bergen.opener.hcp.game18",
    factId: "bridge.totalPointsForRaise",
    templateKey: "bergen.opener.hcp.game18.supporting",
    displayText: "18+ total points to bid game over preemptive raise",
    contrastiveTemplateKey: "bergen.opener.hcp.game18.whyNot",
    contrastiveDisplayText: "Not enough total points (need 18+) to bid game over preemptive raise",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },

  // Responder HCP for game-try acceptance
  {
    explanationId: "bergen.responder.hcp.tryAccept",
    factId: "hand.hcp",
    templateKey: "bergen.responder.hcp.tryAccept.supporting",
    displayText: "Enough HCP to accept the game try",
    contrastiveTemplateKey: "bergen.responder.hcp.tryAccept.whyNot",
    contrastiveDisplayText: "Not enough HCP to accept the game try",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },

  // System-dependent 1NT range
  {
    explanationId: "bergen.system.oneNtRange",
    factId: "system.responder.oneNtRange",
    templateKey: "bergen.system.oneNtRange.supporting",
    displayText: "HCP within the system's 1NT response range",
    contrastiveTemplateKey: "bergen.system.oneNtRange.whyNot",
    contrastiveDisplayText: "HCP outside the system's 1NT response range",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
];

// ── Meaning explanations (Record-exhaustive) ─────────────────────

const MEANING_EXPLANATIONS: Record<BergenMeaningId, MeaningExplanationEntry> = {
  // ── Stub openings ───────────────────────────────────────────────

  [BERGEN_MEANING_IDS.OPENER_1H]: {
    explanationId: "bergen.stub.opener1h",
    meaningId: BERGEN_MEANING_IDS.OPENER_1H,
    templateKey: "bergen.stub.opener1h.semantic",
    displayText: "Opening 1\u2665: 12+ HCP with 5+ hearts",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BERGEN_MEANING_IDS.OPENER_1S]: {
    explanationId: "bergen.stub.opener1s",
    meaningId: BERGEN_MEANING_IDS.OPENER_1S,
    templateKey: "bergen.stub.opener1s.semantic",
    displayText: "Opening 1\u2660: 12+ HCP with 5+ spades",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R1: Responder raises — hearts ──────────────────────────────

  [BERGEN_MEANING_IDS.SPLINTER_HEARTS]: {
    explanationId: "bergen.r1.splinterHearts",
    meaningId: BERGEN_MEANING_IDS.SPLINTER_HEARTS,
    templateKey: "bergen.r1.splinterHearts.semantic",
    displayText: "Splinter in hearts: 12+ pts, 4+ trumps, shortness",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BERGEN_MEANING_IDS.GAME_RAISE_HEARTS]: {
    explanationId: "bergen.r1.gameRaiseHearts",
    meaningId: BERGEN_MEANING_IDS.GAME_RAISE_HEARTS,
    templateKey: "bergen.r1.gameRaiseHearts.semantic",
    displayText: "Bergen game raise in hearts: 13+ pts, 4+ trumps",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BERGEN_MEANING_IDS.LIMIT_RAISE_HEARTS]: {
    explanationId: "bergen.r1.limitRaiseHearts",
    meaningId: BERGEN_MEANING_IDS.LIMIT_RAISE_HEARTS,
    templateKey: "bergen.r1.limitRaiseHearts.semantic",
    displayText: "Bergen limit raise in hearts: 10-12 pts, 4+ trumps (3\u2666)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BERGEN_MEANING_IDS.CONSTRUCTIVE_RAISE_HEARTS]: {
    explanationId: "bergen.r1.constructiveRaiseHearts",
    meaningId: BERGEN_MEANING_IDS.CONSTRUCTIVE_RAISE_HEARTS,
    templateKey: "bergen.r1.constructiveRaiseHearts.semantic",
    displayText: "Bergen constructive raise in hearts: 7-10 pts, 4+ trumps (3\u2663)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BERGEN_MEANING_IDS.PREEMPTIVE_RAISE_HEARTS]: {
    explanationId: "bergen.r1.preemptiveRaiseHearts",
    meaningId: BERGEN_MEANING_IDS.PREEMPTIVE_RAISE_HEARTS,
    templateKey: "bergen.r1.preemptiveRaiseHearts.semantic",
    displayText: "Preemptive raise to 3\u2665: 0-6 pts, 4+ trumps",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BERGEN_MEANING_IDS.NATURAL_1NT_RESPONSE_HEARTS]: {
    explanationId: "bergen.r1.natural1ntHearts",
    meaningId: BERGEN_MEANING_IDS.NATURAL_1NT_RESPONSE_HEARTS,
    templateKey: "bergen.r1.natural1ntHearts.semantic",
    displayText: "Natural 1NT response to 1\u2665: within system range, no 4-card support",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R1: Responder raises — spades ─────────────────────────────

  [BERGEN_MEANING_IDS.SPLINTER_SPADES]: {
    explanationId: "bergen.r1.splinterSpades",
    meaningId: BERGEN_MEANING_IDS.SPLINTER_SPADES,
    templateKey: "bergen.r1.splinterSpades.semantic",
    displayText: "Splinter in spades: 12+ pts, 4+ trumps, shortness",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BERGEN_MEANING_IDS.GAME_RAISE_SPADES]: {
    explanationId: "bergen.r1.gameRaiseSpades",
    meaningId: BERGEN_MEANING_IDS.GAME_RAISE_SPADES,
    templateKey: "bergen.r1.gameRaiseSpades.semantic",
    displayText: "Bergen game raise in spades: 13+ pts, 4+ trumps",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BERGEN_MEANING_IDS.LIMIT_RAISE_SPADES]: {
    explanationId: "bergen.r1.limitRaiseSpades",
    meaningId: BERGEN_MEANING_IDS.LIMIT_RAISE_SPADES,
    templateKey: "bergen.r1.limitRaiseSpades.semantic",
    displayText: "Bergen limit raise in spades: 10-12 pts, 4+ trumps (3\u2666)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BERGEN_MEANING_IDS.CONSTRUCTIVE_RAISE_SPADES]: {
    explanationId: "bergen.r1.constructiveRaiseSpades",
    meaningId: BERGEN_MEANING_IDS.CONSTRUCTIVE_RAISE_SPADES,
    templateKey: "bergen.r1.constructiveRaiseSpades.semantic",
    displayText: "Bergen constructive raise in spades: 7-10 pts, 4+ trumps (3\u2663)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BERGEN_MEANING_IDS.PREEMPTIVE_RAISE_SPADES]: {
    explanationId: "bergen.r1.preemptiveRaiseSpades",
    meaningId: BERGEN_MEANING_IDS.PREEMPTIVE_RAISE_SPADES,
    templateKey: "bergen.r1.preemptiveRaiseSpades.semantic",
    displayText: "Preemptive raise to 3\u2660: 0-6 pts, 4+ trumps",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BERGEN_MEANING_IDS.NATURAL_1NT_RESPONSE_SPADES]: {
    explanationId: "bergen.r1.natural1ntSpades",
    meaningId: BERGEN_MEANING_IDS.NATURAL_1NT_RESPONSE_SPADES,
    templateKey: "bergen.r1.natural1ntSpades.semantic",
    displayText: "Natural 1NT response to 1\u2660: within system range, no 4-card support",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R2: Opener rebids after constructive raise — hearts ────────

  [BERGEN_MEANING_IDS.OPENER_GAME_AFTER_CONSTRUCTIVE_HEARTS]: {
    explanationId: "bergen.r2.gameAfterConstructiveHearts",
    meaningId: BERGEN_MEANING_IDS.OPENER_GAME_AFTER_CONSTRUCTIVE_HEARTS,
    templateKey: "bergen.r2.gameAfterConstructiveHearts.semantic",
    displayText: "Opener bids 4\u2665 after constructive raise (17+ HCP)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BERGEN_MEANING_IDS.OPENER_SIGNOFF_AFTER_CONSTRUCTIVE_HEARTS]: {
    explanationId: "bergen.r2.signoffAfterConstructiveHearts",
    meaningId: BERGEN_MEANING_IDS.OPENER_SIGNOFF_AFTER_CONSTRUCTIVE_HEARTS,
    templateKey: "bergen.r2.signoffAfterConstructiveHearts.semantic",
    displayText: "Opener signs off in 3\u2665 after constructive raise",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R2: Opener rebids after constructive raise — spades ────────

  [BERGEN_MEANING_IDS.OPENER_GAME_AFTER_CONSTRUCTIVE_SPADES]: {
    explanationId: "bergen.r2.gameAfterConstructiveSpades",
    meaningId: BERGEN_MEANING_IDS.OPENER_GAME_AFTER_CONSTRUCTIVE_SPADES,
    templateKey: "bergen.r2.gameAfterConstructiveSpades.semantic",
    displayText: "Opener bids 4\u2660 after constructive raise (17+ HCP)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BERGEN_MEANING_IDS.OPENER_SIGNOFF_AFTER_CONSTRUCTIVE_SPADES]: {
    explanationId: "bergen.r2.signoffAfterConstructiveSpades",
    meaningId: BERGEN_MEANING_IDS.OPENER_SIGNOFF_AFTER_CONSTRUCTIVE_SPADES,
    templateKey: "bergen.r2.signoffAfterConstructiveSpades.semantic",
    displayText: "Opener signs off in 3\u2660 after constructive raise",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R2: Opener rebids after limit raise — hearts ──────────────

  [BERGEN_MEANING_IDS.OPENER_GAME_AFTER_LIMIT_HEARTS]: {
    explanationId: "bergen.r2.gameAfterLimitHearts",
    meaningId: BERGEN_MEANING_IDS.OPENER_GAME_AFTER_LIMIT_HEARTS,
    templateKey: "bergen.r2.gameAfterLimitHearts.semantic",
    displayText: "Opener accepts limit raise and bids 4\u2665 (15+ HCP)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BERGEN_MEANING_IDS.OPENER_SIGNOFF_AFTER_LIMIT_HEARTS]: {
    explanationId: "bergen.r2.signoffAfterLimitHearts",
    meaningId: BERGEN_MEANING_IDS.OPENER_SIGNOFF_AFTER_LIMIT_HEARTS,
    templateKey: "bergen.r2.signoffAfterLimitHearts.semantic",
    displayText: "Opener declines limit raise and signs off in 3\u2665",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R2: Opener rebids after limit raise — spades ──────────────

  [BERGEN_MEANING_IDS.OPENER_GAME_AFTER_LIMIT_SPADES]: {
    explanationId: "bergen.r2.gameAfterLimitSpades",
    meaningId: BERGEN_MEANING_IDS.OPENER_GAME_AFTER_LIMIT_SPADES,
    templateKey: "bergen.r2.gameAfterLimitSpades.semantic",
    displayText: "Opener accepts limit raise and bids 4\u2660 (15+ HCP)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BERGEN_MEANING_IDS.OPENER_SIGNOFF_AFTER_LIMIT_SPADES]: {
    explanationId: "bergen.r2.signoffAfterLimitSpades",
    meaningId: BERGEN_MEANING_IDS.OPENER_SIGNOFF_AFTER_LIMIT_SPADES,
    templateKey: "bergen.r2.signoffAfterLimitSpades.semantic",
    displayText: "Opener declines limit raise and signs off in 3\u2660",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R2: Opener rebids after preemptive raise — hearts ─────────

  [BERGEN_MEANING_IDS.OPENER_GAME_AFTER_PREEMPTIVE_HEARTS]: {
    explanationId: "bergen.r2.gameAfterPreemptiveHearts",
    meaningId: BERGEN_MEANING_IDS.OPENER_GAME_AFTER_PREEMPTIVE_HEARTS,
    templateKey: "bergen.r2.gameAfterPreemptiveHearts.semantic",
    displayText: "Opener bids 4\u2665 despite preemptive raise (18+ total pts)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BERGEN_MEANING_IDS.OPENER_PASS_AFTER_PREEMPTIVE_HEARTS]: {
    explanationId: "bergen.r2.passAfterPreemptiveHearts",
    meaningId: BERGEN_MEANING_IDS.OPENER_PASS_AFTER_PREEMPTIVE_HEARTS,
    templateKey: "bergen.r2.passAfterPreemptiveHearts.semantic",
    displayText: "Opener passes after preemptive raise to 3\u2665",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R2: Opener rebids after preemptive raise — spades ─────────

  [BERGEN_MEANING_IDS.OPENER_GAME_AFTER_PREEMPTIVE_SPADES]: {
    explanationId: "bergen.r2.gameAfterPreemptiveSpades",
    meaningId: BERGEN_MEANING_IDS.OPENER_GAME_AFTER_PREEMPTIVE_SPADES,
    templateKey: "bergen.r2.gameAfterPreemptiveSpades.semantic",
    displayText: "Opener bids 4\u2660 despite preemptive raise (18+ total pts)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BERGEN_MEANING_IDS.OPENER_PASS_AFTER_PREEMPTIVE_SPADES]: {
    explanationId: "bergen.r2.passAfterPreemptiveSpades",
    meaningId: BERGEN_MEANING_IDS.OPENER_PASS_AFTER_PREEMPTIVE_SPADES,
    templateKey: "bergen.r2.passAfterPreemptiveSpades.semantic",
    displayText: "Opener passes after preemptive raise to 3\u2660",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R3: Responder continuations — game try decisions ──────────

  [BERGEN_MEANING_IDS.RESPONDER_TRY_ACCEPT_HEARTS]: {
    explanationId: "bergen.r3.tryAcceptHearts",
    meaningId: BERGEN_MEANING_IDS.RESPONDER_TRY_ACCEPT_HEARTS,
    templateKey: "bergen.r3.tryAcceptHearts.semantic",
    displayText: "Accept game try and bid 4\u2665",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BERGEN_MEANING_IDS.RESPONDER_TRY_ACCEPT_SPADES]: {
    explanationId: "bergen.r3.tryAcceptSpades",
    meaningId: BERGEN_MEANING_IDS.RESPONDER_TRY_ACCEPT_SPADES,
    templateKey: "bergen.r3.tryAcceptSpades.semantic",
    displayText: "Accept game try and bid 4\u2660",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BERGEN_MEANING_IDS.RESPONDER_TRY_REJECT_HEARTS]: {
    explanationId: "bergen.r3.tryRejectHearts",
    meaningId: BERGEN_MEANING_IDS.RESPONDER_TRY_REJECT_HEARTS,
    templateKey: "bergen.r3.tryRejectHearts.semantic",
    displayText: "Reject game try and sign off in 3\u2665",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BERGEN_MEANING_IDS.RESPONDER_TRY_REJECT_SPADES]: {
    explanationId: "bergen.r3.tryRejectSpades",
    meaningId: BERGEN_MEANING_IDS.RESPONDER_TRY_REJECT_SPADES,
    templateKey: "bergen.r3.tryRejectSpades.semantic",
    displayText: "Reject game try and sign off in 3\u2660",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R3: Terminal pass surfaces (suit-independent) ─────────────

  [BERGEN_MEANING_IDS.RESPONDER_ACCEPT_GAME]: {
    explanationId: "bergen.r3.acceptGame",
    meaningId: BERGEN_MEANING_IDS.RESPONDER_ACCEPT_GAME,
    templateKey: "bergen.r3.acceptGame.semantic",
    displayText: "Responder accepts opener's game bid",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  [BERGEN_MEANING_IDS.RESPONDER_ACCEPT_SIGNOFF]: {
    explanationId: "bergen.r3.acceptSignoff",
    meaningId: BERGEN_MEANING_IDS.RESPONDER_ACCEPT_SIGNOFF,
    templateKey: "bergen.r3.acceptSignoff.semantic",
    displayText: "Responder accepts opener's signoff",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R4: Opener final acceptance (suit-independent) ────────────

  [BERGEN_MEANING_IDS.OPENER_ACCEPT_AFTER_TRY]: {
    explanationId: "bergen.r4.openerAcceptAfterTry",
    meaningId: BERGEN_MEANING_IDS.OPENER_ACCEPT_AFTER_TRY,
    templateKey: "bergen.r4.openerAcceptAfterTry.semantic",
    displayText: "Opener accepts game after responder accepts the try",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
};

// ── Composed export ──────────────────────────────────────────────

export const BERGEN_EXPLANATION_ENTRIES: readonly ExplanationEntry[] = [
  ...Object.values(FACT_EXPLANATIONS),
  ...SHARED_FACT_EXPLANATIONS,
  ...Object.values(MEANING_EXPLANATIONS),
];

export const BERGEN_EXPLANATION_CATALOG: ExplanationCatalog = createExplanationCatalog(
  [...BERGEN_EXPLANATION_ENTRIES],
);
