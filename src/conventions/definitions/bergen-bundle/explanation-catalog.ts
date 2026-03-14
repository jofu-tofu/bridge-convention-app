import { createExplanationCatalog, type ExplanationEntry, type ExplanationCatalogIR } from "../../../core/contracts/explanation-catalog";

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

const BERGEN_ENTRIES: ExplanationEntry[] = [
  // ── Fact-based entries: HCP thresholds ──────────────────────

  {
    explanationId: "bergen.hcp.splinter",
    factId: "hand.hcp",
    templateKey: "bergen.hcp.splinter.supporting",
    contrastiveTemplateKey: "bergen.hcp.splinter.whyNot",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "bergen.hcp.game",
    factId: "hand.hcp",
    templateKey: "bergen.hcp.game.supporting",
    contrastiveTemplateKey: "bergen.hcp.game.whyNot",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "bergen.hcp.limit",
    factId: "hand.hcp",
    templateKey: "bergen.hcp.limit.supporting",
    contrastiveTemplateKey: "bergen.hcp.limit.whyNot",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "bergen.hcp.constructive",
    factId: "hand.hcp",
    templateKey: "bergen.hcp.constructive.supporting",
    contrastiveTemplateKey: "bergen.hcp.constructive.whyNot",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "bergen.hcp.preemptive",
    factId: "hand.hcp",
    templateKey: "bergen.hcp.preemptive.supporting",
    contrastiveTemplateKey: "bergen.hcp.preemptive.whyNot",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },

  // ── Fact-based entries: suit support and shape ──────────────

  {
    explanationId: "bergen.support.majorFit",
    factId: "hand.suitLength.$suit",
    templateKey: "bergen.support.majorFit.supporting",
    contrastiveTemplateKey: "bergen.support.majorFit.whyNot",
    preferredLevel: "mechanical",
    roles: ["supporting", "blocking", "pedagogical"],
  },
  {
    explanationId: "bergen.shape.shortage",
    factId: "bridge.hasShortage",
    templateKey: "bergen.shape.shortage.supporting",
    contrastiveTemplateKey: "bergen.shape.shortage.whyNot",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking", "pedagogical"],
  },

  // ── R1: Meaning-based entries — responder initial bids ─────

  {
    explanationId: "bergen.r1.splinter",
    meaningId: "bergen:splinter",
    templateKey: "bergen.r1.splinter.semantic",
    contrastiveTemplateKey: "bergen.r1.splinter.whyNotDirectRaise",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "bergen.r1.gameRaise",
    meaningId: "bergen:game-raise",
    templateKey: "bergen.r1.gameRaise.semantic",
    contrastiveTemplateKey: "bergen.r1.gameRaise.whyNotSplinter",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "bergen.r1.limitRaise",
    meaningId: "bergen:limit-raise",
    templateKey: "bergen.r1.limitRaise.semantic",
    contrastiveTemplateKey: "bergen.r1.limitRaise.whyNot3C",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "bergen.r1.constructiveRaise",
    meaningId: "bergen:constructive-raise",
    templateKey: "bergen.r1.constructiveRaise.semantic",
    contrastiveTemplateKey: "bergen.r1.constructiveRaise.whyNot3D",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "bergen.r1.preemptiveRaise",
    meaningId: "bergen:preemptive-raise",
    templateKey: "bergen.r1.preemptiveRaise.semantic",
    contrastiveTemplateKey: "bergen.r1.preemptiveRaise.whyNotPass",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R2: Meaning-based entries — opener rebids ──────────────

  // After constructive raise (3C)
  {
    explanationId: "bergen.r2.gameAfterConstructive",
    meaningId: "bergen:opener-game-after-constructive",
    templateKey: "bergen.r2.gameAfterConstructive.semantic",
    contrastiveTemplateKey: "bergen.r2.gameAfterConstructive.whyNotTry",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "bergen.r2.signoffAfterConstructive",
    meaningId: "bergen:opener-signoff-after-constructive",
    templateKey: "bergen.r2.signoffAfterConstructive.semantic",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "bergen.r2.tryAfterConstructive",
    meaningId: "bergen:opener-try-after-constructive",
    templateKey: "bergen.r2.tryAfterConstructive.semantic",
    contrastiveTemplateKey: "bergen.r2.tryAfterConstructive.whyNotGame",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // After limit raise (3D)
  {
    explanationId: "bergen.r2.gameAfterLimit",
    meaningId: "bergen:opener-game-after-limit",
    templateKey: "bergen.r2.gameAfterLimit.semantic",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "bergen.r2.signoffAfterLimit",
    meaningId: "bergen:opener-signoff-after-limit",
    templateKey: "bergen.r2.signoffAfterLimit.semantic",
    contrastiveTemplateKey: "bergen.r2.signoffAfterLimit.whyNotGame",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // After preemptive raise (3M)
  {
    explanationId: "bergen.r2.gameAfterPreemptive",
    meaningId: "bergen:opener-game-after-preemptive",
    templateKey: "bergen.r2.gameAfterPreemptive.semantic",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "bergen.r2.passAfterPreemptive",
    meaningId: "bergen:opener-pass-after-preemptive",
    templateKey: "bergen.r2.passAfterPreemptive.semantic",
    contrastiveTemplateKey: "bergen.r2.passAfterPreemptive.whyNotGame",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R3: Meaning-based entries — responder continuations ────

  {
    explanationId: "bergen.r3.acceptGame",
    meaningId: "bergen:responder-accept-game",
    templateKey: "bergen.r3.acceptGame.semantic",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "bergen.r3.acceptSignoff",
    meaningId: "bergen:responder-accept-signoff",
    templateKey: "bergen.r3.acceptSignoff.semantic",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "bergen.r3.tryAccept",
    meaningId: "bergen:responder-try-accept",
    templateKey: "bergen.r3.tryAccept.semantic",
    contrastiveTemplateKey: "bergen.r3.tryAccept.whyNotReject",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "bergen.r3.tryReject",
    meaningId: "bergen:responder-try-reject",
    templateKey: "bergen.r3.tryReject.semantic",
    contrastiveTemplateKey: "bergen.r3.tryReject.whyNotAccept",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R4: Meaning-based entries — opener final acceptance ────

  {
    explanationId: "bergen.r4.openerAcceptAfterTry",
    meaningId: "bergen:opener-accept-after-try",
    templateKey: "bergen.r4.openerAcceptAfterTry.semantic",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── Opener HCP thresholds for rebid decisions ──────────────

  {
    explanationId: "bergen.opener.hcp.game17",
    factId: "hand.hcp",
    templateKey: "bergen.opener.hcp.game17.supporting",
    contrastiveTemplateKey: "bergen.opener.hcp.game17.whyNot",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "bergen.opener.hcp.try14",
    factId: "hand.hcp",
    templateKey: "bergen.opener.hcp.try14.supporting",
    contrastiveTemplateKey: "bergen.opener.hcp.try14.whyNot",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "bergen.opener.hcp.game15",
    factId: "hand.hcp",
    templateKey: "bergen.opener.hcp.game15.supporting",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "bergen.opener.hcp.game18",
    factId: "hand.hcp",
    templateKey: "bergen.opener.hcp.game18.supporting",
    contrastiveTemplateKey: "bergen.opener.hcp.game18.whyNot",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },

  // ── Responder HCP for game-try acceptance ──────────────────

  {
    explanationId: "bergen.responder.hcp.tryAccept",
    factId: "hand.hcp",
    templateKey: "bergen.responder.hcp.tryAccept.supporting",
    contrastiveTemplateKey: "bergen.responder.hcp.tryAccept.whyNot",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
];

export const BERGEN_EXPLANATION_CATALOG: ExplanationCatalogIR = createExplanationCatalog(BERGEN_ENTRIES);
