import {
  createExplanationCatalog,
  type ExplanationEntry,
  type ExplanationCatalogIR,
} from "../../../core/contracts/explanation-catalog";

/**
 * 1NT bundle explanation catalog.
 *
 * Covers shared facts relevant to 1NT responses (HCP thresholds, suit lengths,
 * balanced shape) and module-derived facts for Stayman and Jacoby Transfers.
 * Entries reference stable fact IDs from the fact catalog and meaning IDs
 * from the semantic class vocabulary.
 */

const NT_ENTRIES: ExplanationEntry[] = [
  // ─── HCP thresholds ──────────────────────────────────────────
  {
    explanationId: "nt.hcp.invite",
    factId: "module.ntResponse.inviteValues",
    templateKey: "nt.hcp.invite.supporting",
    displayText: "Enough HCP to invite game",
    contrastiveTemplateKey: "nt.hcp.invite.whyNot",
    contrastiveDisplayText: "Not enough HCP to invite game",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "nt.hcp.game",
    factId: "module.ntResponse.gameValues",
    templateKey: "nt.hcp.game.supporting",
    displayText: "Enough HCP for game",
    contrastiveTemplateKey: "nt.hcp.game.whyNot",
    contrastiveDisplayText: "Not enough HCP for game",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "nt.hcp.slam",
    factId: "module.ntResponse.slamValues",
    templateKey: "nt.hcp.slam.supporting",
    displayText: "Enough HCP for slam exploration",
    contrastiveTemplateKey: "nt.hcp.slam.whyNot",
    contrastiveDisplayText: "Not enough HCP for slam",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },

  // ─── Suit length requirements ─────────────────────────────────
  {
    explanationId: "nt.suit.fourCardMajor",
    factId: "bridge.hasFourCardMajor",
    templateKey: "nt.suit.fourCardMajor.supporting",
    displayText: "Has a 4-card major",
    contrastiveTemplateKey: "nt.suit.fourCardMajor.whyNot",
    contrastiveDisplayText: "No 4-card major",
    preferredLevel: "mechanical",
    roles: ["supporting", "blocking", "pedagogical"],
  },
  {
    explanationId: "nt.suit.fiveCardMajor",
    factId: "bridge.hasFiveCardMajor",
    templateKey: "nt.suit.fiveCardMajor.supporting",
    displayText: "Has a 5-card major (prefer transfer)",
    contrastiveTemplateKey: "nt.suit.fiveCardMajor.whyNot",
    contrastiveDisplayText: "No 5-card major",
    preferredLevel: "mechanical",
    roles: ["supporting", "blocking", "pedagogical"],
  },

  // ─── Shape ────────────────────────────────────────────────────
  {
    explanationId: "nt.shape.balanced",
    factId: "hand.isBalanced",
    templateKey: "nt.shape.balanced.supporting",
    displayText: "Balanced hand shape",
    contrastiveTemplateKey: "nt.shape.balanced.whyNot",
    contrastiveDisplayText: "Unbalanced hand shape",
    preferredLevel: "semantic",
    roles: ["supporting", "inferential"],
  },

  // ─── Stayman module ───────────────────────────────────────────
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

  // ─── Transfer module ──────────────────────────────────────────
  {
    explanationId: "nt.transfer.eligible",
    factId: "module.transfer.eligible",
    templateKey: "nt.transfer.eligible.supporting",
    displayText: "Eligible for Jacoby Transfer",
    contrastiveTemplateKey: "nt.transfer.eligible.whyNot",
    contrastiveDisplayText: "Not eligible for transfer",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking", "pedagogical"],
  },
  {
    explanationId: "nt.transfer.preferred",
    factId: "module.transfer.preferred",
    templateKey: "nt.transfer.preferred.supporting",
    displayText: "Transfer is the preferred convention",
    preferredLevel: "semantic",
    roles: ["supporting", "inferential"],
  },
  {
    explanationId: "nt.transfer.toHearts",
    meaningId: "transfer:to-hearts",
    templateKey: "nt.transfer.toHearts.semantic",
    displayText: "Transfer to hearts: bid 2♦ to show 5+ hearts",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "nt.transfer.toSpades",
    meaningId: "transfer:to-spades",
    templateKey: "nt.transfer.toSpades.semantic",
    displayText: "Transfer to spades: bid 2♥ to show 5+ spades",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ─── HCP base fact ────────────────────────────────────────────
  {
    explanationId: "nt.hcp.base",
    factId: "hand.hcp",
    templateKey: "nt.hcp.base.mechanical",
    displayText: "High card points",
    preferredLevel: "mechanical",
    roles: ["supporting"],
  },

  // ─── Major pattern ────────────────────────────────────────────
  {
    explanationId: "nt.suit.majorPattern",
    factId: "bridge.majorPattern",
    templateKey: "nt.suit.majorPattern.supporting",
    displayText: "Major suit distribution",
    preferredLevel: "mechanical",
    roles: ["supporting", "inferential"],
  },

  // ─── Posterior facts ──────────────────────────────────────────
  {
    explanationId: "nt.posterior.partnerHas4Hearts",
    factId: "bridge.partnerHas4HeartsLikely",
    templateKey: "nt.posterior.partnerHas4Hearts",
    displayText: "Partner likely has 4+ hearts",
    preferredLevel: "semantic",
    roles: ["inferential"],
  },
  {
    explanationId: "nt.posterior.partnerHas4Spades",
    factId: "bridge.partnerHas4SpadesLikely",
    templateKey: "nt.posterior.partnerHas4Spades",
    displayText: "Partner likely has 4+ spades",
    preferredLevel: "semantic",
    roles: ["inferential"],
  },
  {
    explanationId: "nt.posterior.nsHaveEightCardFit",
    factId: "bridge.nsHaveEightCardFitLikely",
    templateKey: "nt.posterior.nsHaveEightCardFit",
    displayText: "N-S likely have an 8-card fit",
    preferredLevel: "semantic",
    roles: ["inferential"],
  },
  {
    explanationId: "nt.posterior.combinedHcpInRange",
    factId: "bridge.combinedHcpInRangeLikely",
    templateKey: "nt.posterior.combinedHcpInRange",
    displayText: "Combined HCP likely in game range",
    preferredLevel: "semantic",
    roles: ["inferential"],
  },
  {
    explanationId: "nt.posterior.openerStillBalanced",
    factId: "bridge.openerStillBalancedLikely",
    templateKey: "nt.posterior.openerStillBalanced",
    displayText: "Opener likely still has balanced shape",
    preferredLevel: "semantic",
    roles: ["inferential"],
  },
  {
    explanationId: "nt.posterior.openerHasSecondMajor",
    factId: "bridge.openerHasSecondMajorLikely",
    templateKey: "nt.posterior.openerHasSecondMajor",
    displayText: "Opener may have a second 4-card major",
    preferredLevel: "semantic",
    roles: ["inferential"],
  },
  // ─── Smolen module ────────────────────────────────────────────
  {
    explanationId: "nt.smolen.fiveHearts",
    factId: "module.smolen.hasFiveHearts",
    templateKey: "nt.smolen.fiveHearts.supporting",
    displayText: "Has 5+ hearts for Smolen",
    contrastiveTemplateKey: "nt.smolen.fiveHearts.whyNot",
    contrastiveDisplayText: "Does not have 5+ hearts",
    preferredLevel: "mechanical",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "nt.smolen.fiveSpades",
    factId: "module.smolen.hasFiveSpades",
    templateKey: "nt.smolen.fiveSpades.supporting",
    displayText: "Has 5+ spades for Smolen",
    contrastiveTemplateKey: "nt.smolen.fiveSpades.whyNot",
    contrastiveDisplayText: "Does not have 5+ spades",
    preferredLevel: "mechanical",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "nt.smolen.bidShortHearts",
    meaningId: "smolen:bid-short-hearts",
    templateKey: "nt.smolen.bidShortHearts.semantic",
    displayText: "Smolen 3H: shows 5+ hearts and 4 spades, game-forcing",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "nt.smolen.bidShortSpades",
    meaningId: "smolen:bid-short-spades",
    templateKey: "nt.smolen.bidShortSpades.semantic",
    displayText: "Smolen 3S: shows 5+ spades and 4 hearts, game-forcing",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "nt.smolen.openerHeartFit",
    factId: "module.smolen.openerHasHeartFit",
    templateKey: "nt.smolen.openerHeartFit.supporting",
    displayText: "Opener has 3+ hearts (fit for Smolen)",
    contrastiveTemplateKey: "nt.smolen.openerHeartFit.whyNot",
    contrastiveDisplayText: "Opener has fewer than 3 hearts",
    preferredLevel: "mechanical",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "nt.smolen.openerSpadesFit",
    factId: "module.smolen.openerHasSpadesFit",
    templateKey: "nt.smolen.openerSpadesFit.supporting",
    displayText: "Opener has 3+ spades (fit for Smolen)",
    contrastiveTemplateKey: "nt.smolen.openerSpadesFit.whyNot",
    contrastiveDisplayText: "Opener has fewer than 3 spades",
    preferredLevel: "mechanical",
    roles: ["supporting", "blocking"],
  },
];

/** 1NT bundle explanation catalog. */
export const NT_EXPLANATION_CATALOG: ExplanationCatalogIR =
  createExplanationCatalog(NT_ENTRIES);
