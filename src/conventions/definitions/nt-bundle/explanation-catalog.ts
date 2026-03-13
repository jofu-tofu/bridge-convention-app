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
    contrastiveTemplateKey: "nt.hcp.invite.whyNot",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "nt.hcp.game",
    factId: "module.ntResponse.gameValues",
    templateKey: "nt.hcp.game.supporting",
    contrastiveTemplateKey: "nt.hcp.game.whyNot",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "nt.hcp.slam",
    factId: "module.ntResponse.slamValues",
    templateKey: "nt.hcp.slam.supporting",
    contrastiveTemplateKey: "nt.hcp.slam.whyNot",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },

  // ─── Suit length requirements ─────────────────────────────────
  {
    explanationId: "nt.suit.fourCardMajor",
    factId: "bridge.hasFourCardMajor",
    templateKey: "nt.suit.fourCardMajor.supporting",
    contrastiveTemplateKey: "nt.suit.fourCardMajor.whyNot",
    preferredLevel: "mechanical",
    roles: ["supporting", "blocking", "pedagogical"],
  },
  {
    explanationId: "nt.suit.fiveCardMajor",
    factId: "bridge.hasFiveCardMajor",
    templateKey: "nt.suit.fiveCardMajor.supporting",
    contrastiveTemplateKey: "nt.suit.fiveCardMajor.whyNot",
    preferredLevel: "mechanical",
    roles: ["supporting", "blocking", "pedagogical"],
  },

  // ─── Shape ────────────────────────────────────────────────────
  {
    explanationId: "nt.shape.balanced",
    factId: "hand.isBalanced",
    templateKey: "nt.shape.balanced.supporting",
    contrastiveTemplateKey: "nt.shape.balanced.whyNot",
    preferredLevel: "semantic",
    roles: ["supporting", "inferential"],
  },

  // ─── Stayman module ───────────────────────────────────────────
  {
    explanationId: "nt.stayman.eligible",
    factId: "module.stayman.eligible",
    templateKey: "nt.stayman.eligible.supporting",
    contrastiveTemplateKey: "nt.stayman.eligible.whyNot",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking", "pedagogical"],
  },
  {
    explanationId: "nt.stayman.preferred",
    factId: "module.stayman.preferred",
    templateKey: "nt.stayman.preferred.supporting",
    preferredLevel: "semantic",
    roles: ["supporting", "inferential"],
  },
  {
    explanationId: "nt.stayman.askMajor",
    meaningId: "stayman:ask-major",
    templateKey: "nt.stayman.askMajor.semantic",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ─── Transfer module ──────────────────────────────────────────
  {
    explanationId: "nt.transfer.eligible",
    factId: "module.transfer.eligible",
    templateKey: "nt.transfer.eligible.supporting",
    contrastiveTemplateKey: "nt.transfer.eligible.whyNot",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking", "pedagogical"],
  },
  {
    explanationId: "nt.transfer.preferred",
    factId: "module.transfer.preferred",
    templateKey: "nt.transfer.preferred.supporting",
    preferredLevel: "semantic",
    roles: ["supporting", "inferential"],
  },
  {
    explanationId: "nt.transfer.toHearts",
    meaningId: "transfer:to-hearts",
    templateKey: "nt.transfer.toHearts.semantic",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "nt.transfer.toSpades",
    meaningId: "transfer:to-spades",
    templateKey: "nt.transfer.toSpades.semantic",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ─── HCP base fact ────────────────────────────────────────────
  {
    explanationId: "nt.hcp.base",
    factId: "hand.hcp",
    templateKey: "nt.hcp.base.mechanical",
    preferredLevel: "mechanical",
    roles: ["supporting"],
  },

  // ─── Major pattern ────────────────────────────────────────────
  {
    explanationId: "nt.suit.majorPattern",
    factId: "bridge.majorPattern",
    templateKey: "nt.suit.majorPattern.supporting",
    preferredLevel: "mechanical",
    roles: ["supporting", "inferential"],
  },
];

/** 1NT bundle explanation catalog. */
export const NT_EXPLANATION_CATALOG: ExplanationCatalogIR =
  createExplanationCatalog(NT_ENTRIES);
