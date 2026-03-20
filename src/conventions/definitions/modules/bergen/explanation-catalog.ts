import { createExplanationCatalog, type ExplanationEntry, type ExplanationCatalogIR } from "../../../../core/contracts/explanation-catalog";

/**
 * Bergen Raises explanation catalog.
 *
 * Maps Bergen facts and meanings to template keys for teaching projections.
 * Source content derived from bergen-raises/explanations.ts decision/bid/condition
 * explanations, restructured for the ExplanationCatalog contract.
 *
 * Covers all four rounds:
 *   R1 — responder's initial Bergen raise (splinter, game, limit, constructive, preemptive)
 *   R2 — opener's rebid (game/signoff/try after each raise type)
 *   R3 — responder's continuation (accept game, accept signoff, try-accept, try-reject)
 *   R4 — opener's final acceptance after game try
 */

export const BERGEN_EXPLANATION_ENTRIES: ExplanationEntry[] = [
  // ── Fact-based entries: HCP thresholds ──────────────────────

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

  // ── Fact-based entries: suit support and shape ──────────────

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

  // ── R1: Meaning-based entries — responder initial bids ─────

  {
    explanationId: "bergen.r1.splinter",
    meaningId: "bergen:splinter",
    templateKey: "bergen.r1.splinter.semantic",
    displayText: "Splinter: shortness with game-forcing values",
    contrastiveTemplateKey: "bergen.r1.splinter.whyNotDirectRaise",
    contrastiveDisplayText: "Does not qualify for a splinter (consider a direct raise)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "bergen.r1.gameRaise",
    meaningId: "bergen:game-raise",
    templateKey: "bergen.r1.gameRaise.semantic",
    displayText: "Bergen game raise: 4+ support with game values",
    contrastiveTemplateKey: "bergen.r1.gameRaise.whyNotSplinter",
    contrastiveDisplayText: "Does not qualify for a game raise (consider splinter with shortness)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "bergen.r1.limitRaise",
    meaningId: "bergen:limit-raise",
    templateKey: "bergen.r1.limitRaise.semantic",
    displayText: "Bergen limit raise: invitational values with support",
    contrastiveTemplateKey: "bergen.r1.limitRaise.whyNot3C",
    contrastiveDisplayText: "Does not qualify for a limit raise",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "bergen.r1.constructiveRaise",
    meaningId: "bergen:constructive-raise",
    templateKey: "bergen.r1.constructiveRaise.semantic",
    displayText: "Bergen constructive raise: moderate values with support",
    contrastiveTemplateKey: "bergen.r1.constructiveRaise.whyNot3D",
    contrastiveDisplayText: "Does not qualify for a constructive raise",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "bergen.r1.preemptiveRaise",
    meaningId: "bergen:preemptive-raise",
    templateKey: "bergen.r1.preemptiveRaise.semantic",
    displayText: "Preemptive raise: weak hand with good support",
    contrastiveTemplateKey: "bergen.r1.preemptiveRaise.whyNotPass",
    contrastiveDisplayText: "Does not qualify for a preemptive raise (consider passing)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R2: Meaning-based entries — opener rebids ──────────────

  // After constructive raise (3C)
  {
    explanationId: "bergen.r2.gameAfterConstructive",
    meaningId: "bergen:opener-game-after-constructive",
    templateKey: "bergen.r2.gameAfterConstructive.semantic",
    displayText: "Opener bids game after constructive raise",
    contrastiveTemplateKey: "bergen.r2.gameAfterConstructive.whyNotTry",
    contrastiveDisplayText: "Opener prefers a game try over jumping to game",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "bergen.r2.signoffAfterConstructive",
    meaningId: "bergen:opener-signoff-after-constructive",
    templateKey: "bergen.r2.signoffAfterConstructive.semantic",
    displayText: "Opener signs off after constructive raise",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "bergen.r2.tryAfterConstructive",
    meaningId: "bergen:opener-try-after-constructive",
    templateKey: "bergen.r2.tryAfterConstructive.semantic",
    displayText: "Opener makes a game try after constructive raise",
    contrastiveTemplateKey: "bergen.r2.tryAfterConstructive.whyNotGame",
    contrastiveDisplayText: "Opener has enough to bid game directly",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // After limit raise (3D)
  {
    explanationId: "bergen.r2.gameAfterLimit",
    meaningId: "bergen:opener-game-after-limit",
    templateKey: "bergen.r2.gameAfterLimit.semantic",
    displayText: "Opener accepts the limit raise and bids game",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "bergen.r2.signoffAfterLimit",
    meaningId: "bergen:opener-signoff-after-limit",
    templateKey: "bergen.r2.signoffAfterLimit.semantic",
    displayText: "Opener declines the limit raise and signs off",
    contrastiveTemplateKey: "bergen.r2.signoffAfterLimit.whyNotGame",
    contrastiveDisplayText: "Not enough to accept the limit raise for game",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // After preemptive raise (3M)
  {
    explanationId: "bergen.r2.gameAfterPreemptive",
    meaningId: "bergen:opener-game-after-preemptive",
    templateKey: "bergen.r2.gameAfterPreemptive.semantic",
    displayText: "Opener bids game despite preemptive raise",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "bergen.r2.passAfterPreemptive",
    meaningId: "bergen:opener-pass-after-preemptive",
    templateKey: "bergen.r2.passAfterPreemptive.semantic",
    displayText: "Opener passes after preemptive raise",
    contrastiveTemplateKey: "bergen.r2.passAfterPreemptive.whyNotGame",
    contrastiveDisplayText: "Not enough to bid game over preemptive raise",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R3: Meaning-based entries — responder continuations ────

  {
    explanationId: "bergen.r3.acceptGame",
    meaningId: "bergen:responder-accept-game",
    templateKey: "bergen.r3.acceptGame.semantic",
    displayText: "Responder accepts opener's game bid",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "bergen.r3.acceptSignoff",
    meaningId: "bergen:responder-accept-signoff",
    templateKey: "bergen.r3.acceptSignoff.semantic",
    displayText: "Responder accepts opener's signoff",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "bergen.r3.tryAccept",
    meaningId: "bergen:responder-try-accept",
    templateKey: "bergen.r3.tryAccept.semantic",
    displayText: "Accept the game try and bid game",
    contrastiveTemplateKey: "bergen.r3.tryAccept.whyNotReject",
    contrastiveDisplayText: "Why accept the game try instead of rejecting",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "bergen.r3.tryReject",
    meaningId: "bergen:responder-try-reject",
    templateKey: "bergen.r3.tryReject.semantic",
    displayText: "Reject the game try and sign off",
    contrastiveTemplateKey: "bergen.r3.tryReject.whyNotAccept",
    contrastiveDisplayText: "Why reject the game try instead of accepting",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R4: Meaning-based entries — opener final acceptance ────

  {
    explanationId: "bergen.r4.openerAcceptAfterTry",
    meaningId: "bergen:opener-accept-after-try",
    templateKey: "bergen.r4.openerAcceptAfterTry.semantic",
    displayText: "Opener accepts game after responder accepts the try",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── Opener HCP thresholds for rebid decisions ──────────────

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
    factId: "hand.hcp",
    templateKey: "bergen.opener.hcp.game18.supporting",
    displayText: "18+ HCP to bid game over preemptive raise",
    contrastiveTemplateKey: "bergen.opener.hcp.game18.whyNot",
    contrastiveDisplayText: "Not enough HCP (need 18+) to bid game over preemptive raise",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },

  // ── Responder HCP for game-try acceptance ──────────────────

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
];

export const BERGEN_EXPLANATION_CATALOG: ExplanationCatalogIR = createExplanationCatalog(BERGEN_EXPLANATION_ENTRIES);
