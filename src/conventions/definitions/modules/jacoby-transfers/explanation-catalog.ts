import type {
  ExplanationEntry,
  FactExplanationEntry,
  MeaningExplanationEntry,
} from "../../../../core/contracts/explanation-catalog";
import type { TransferFactId } from "./fact-ids";
import type { TransferMeaningId } from "./meaning-ids";

// ─── Fact explanations (exhaustive over TransferFactId) ─────

const FACT_EXPLANATIONS: Record<TransferFactId, FactExplanationEntry> = {
  "module.transfer.eligible": {
    explanationId: "nt.transfer.eligible",
    factId: "module.transfer.eligible",
    templateKey: "nt.transfer.eligible.supporting",
    displayText: "Eligible for Jacoby Transfer",
    contrastiveTemplateKey: "nt.transfer.eligible.whyNot",
    contrastiveDisplayText: "Not eligible for transfer",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking", "pedagogical"],
  },
  "module.transfer.preferred": {
    explanationId: "nt.transfer.preferred",
    factId: "module.transfer.preferred",
    templateKey: "nt.transfer.preferred.supporting",
    displayText: "Transfer is the preferred convention",
    preferredLevel: "semantic",
    roles: ["supporting", "inferential"],
  },
  "module.transfer.targetSuit": {
    explanationId: "nt.transfer.targetSuit",
    factId: "module.transfer.targetSuit",
    templateKey: "nt.transfer.targetSuit.supporting",
    displayText: "Transfer target suit determined by longest major",
    preferredLevel: "mechanical",
    roles: ["supporting"],
  },
  "module.transfer.openerHasHeartFit": {
    explanationId: "nt.transfer.openerHasHeartFit",
    factId: "module.transfer.openerHasHeartFit",
    templateKey: "nt.transfer.openerHasHeartFit.supporting",
    displayText: "Opener has 3+ hearts to fit responder's suit",
    contrastiveTemplateKey: "nt.transfer.openerHasHeartFit.whyNot",
    contrastiveDisplayText: "Opener lacks heart fit (fewer than 3 hearts)",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  "module.transfer.openerHasSpadesFit": {
    explanationId: "nt.transfer.openerHasSpadesFit",
    factId: "module.transfer.openerHasSpadesFit",
    templateKey: "nt.transfer.openerHasSpadesFit.supporting",
    displayText: "Opener has 3+ spades to fit responder's suit",
    contrastiveTemplateKey: "nt.transfer.openerHasSpadesFit.whyNot",
    contrastiveDisplayText: "Opener lacks spade fit (fewer than 3 spades)",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
};

// ─── Meaning explanations (exhaustive over TransferMeaningId) ─

const MEANING_EXPLANATIONS: Record<TransferMeaningId, MeaningExplanationEntry> = {
  // R1 — responder transfer bids
  "transfer:to-hearts": {
    explanationId: "nt.transfer.toHearts",
    meaningId: "transfer:to-hearts",
    templateKey: "nt.transfer.toHearts.semantic",
    displayText: "Transfer to hearts: bid 2\u2666 to show 5+ hearts",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "transfer:to-spades": {
    explanationId: "nt.transfer.toSpades",
    meaningId: "transfer:to-spades",
    templateKey: "nt.transfer.toSpades.semantic",
    displayText: "Transfer to spades: bid 2\u2665 to show 5+ spades",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // R2 — opener accepts transfer
  "transfer:accept": {
    explanationId: "nt.transfer.accept",
    meaningId: "transfer:accept",
    templateKey: "nt.transfer.accept.semantic",
    displayText: "Accept transfer: bid the target major (hearts)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "transfer:accept-spades": {
    explanationId: "nt.transfer.acceptSpades",
    meaningId: "transfer:accept-spades",
    templateKey: "nt.transfer.acceptSpades.semantic",
    displayText: "Accept transfer: bid the target major (spades)",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // R3 — responder rebids after hearts transfer accepted
  "transfer:signoff-hearts": {
    explanationId: "nt.transfer.signoffHearts",
    meaningId: "transfer:signoff-hearts",
    templateKey: "nt.transfer.signoffHearts.semantic",
    displayText: "Sign off in hearts: weak hand, pass and play in the major",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "transfer:game-hearts": {
    explanationId: "nt.transfer.gameHearts",
    meaningId: "transfer:game-hearts",
    templateKey: "nt.transfer.gameHearts.semantic",
    displayText: "Raise to 4\u2665: game values with 5+ hearts",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "transfer:nt-game-hearts": {
    explanationId: "nt.transfer.ntGameHearts",
    meaningId: "transfer:nt-game-hearts",
    templateKey: "nt.transfer.ntGameHearts.semantic",
    displayText: "Bid 3NT: game values, offers opener choice between 3NT and 4\u2665",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "transfer:invite-raise-hearts": {
    explanationId: "nt.transfer.inviteRaiseHearts",
    meaningId: "transfer:invite-raise-hearts",
    templateKey: "nt.transfer.inviteRaiseHearts.semantic",
    displayText: "Raise to 3\u2665: invitational with 6+ hearts, opener decides game",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "transfer:invite-hearts": {
    explanationId: "nt.transfer.inviteHearts",
    meaningId: "transfer:invite-hearts",
    templateKey: "nt.transfer.inviteHearts.semantic",
    displayText: "Bid 2NT: invitational with exactly 5 hearts, opener decides",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // R3 — responder rebids after spades transfer accepted
  "transfer:signoff-spades": {
    explanationId: "nt.transfer.signoffSpades",
    meaningId: "transfer:signoff-spades",
    templateKey: "nt.transfer.signoffSpades.semantic",
    displayText: "Sign off in spades: weak hand, pass and play in the major",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "transfer:game-spades": {
    explanationId: "nt.transfer.gameSpades",
    meaningId: "transfer:game-spades",
    templateKey: "nt.transfer.gameSpades.semantic",
    displayText: "Raise to 4\u2660: game values with 5+ spades",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "transfer:nt-game-spades": {
    explanationId: "nt.transfer.ntGameSpades",
    meaningId: "transfer:nt-game-spades",
    templateKey: "nt.transfer.ntGameSpades.semantic",
    displayText: "Bid 3NT: game values, offers opener choice between 3NT and 4\u2660",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "transfer:invite-raise-spades": {
    explanationId: "nt.transfer.inviteRaiseSpades",
    meaningId: "transfer:invite-raise-spades",
    templateKey: "nt.transfer.inviteRaiseSpades.semantic",
    displayText: "Raise to 3\u2660: invitational with 6+ spades, opener decides game",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "transfer:invite-spades": {
    explanationId: "nt.transfer.inviteSpades",
    meaningId: "transfer:invite-spades",
    templateKey: "nt.transfer.inviteSpades.semantic",
    displayText: "Bid 2NT: invitational with exactly 5 spades, opener decides",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // R4 — opener placement after responder's 3NT choice
  "transfer:correct-to-4h": {
    explanationId: "nt.transfer.correctTo4H",
    meaningId: "transfer:correct-to-4h",
    templateKey: "nt.transfer.correctTo4H.semantic",
    displayText: "Correct to 4\u2665: opener has 3+ hearts, prefer the major game",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "transfer:pass-3nt-hearts": {
    explanationId: "nt.transfer.pass3NTHearts",
    meaningId: "transfer:pass-3nt-hearts",
    templateKey: "nt.transfer.pass3NTHearts.semantic",
    displayText: "Pass 3NT: opener lacks heart fit, stay in notrump",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "transfer:correct-to-4s": {
    explanationId: "nt.transfer.correctTo4S",
    meaningId: "transfer:correct-to-4s",
    templateKey: "nt.transfer.correctTo4S.semantic",
    displayText: "Correct to 4\u2660: opener has 3+ spades, prefer the major game",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "transfer:pass-3nt-spades": {
    explanationId: "nt.transfer.pass3NTSpades",
    meaningId: "transfer:pass-3nt-spades",
    templateKey: "nt.transfer.pass3NTSpades.semantic",
    displayText: "Pass 3NT: opener lacks spade fit, stay in notrump",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // R4 — opener invite acceptance after responder's 2NT invite
  "transfer:accept-invite-hearts": {
    explanationId: "nt.transfer.acceptInviteHearts",
    meaningId: "transfer:accept-invite-hearts",
    templateKey: "nt.transfer.acceptInviteHearts.semantic",
    displayText: "Accept heart invite: bid 3\u2665 or 4\u2665 with maximum, fit confirmed",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "transfer:decline-invite-hearts": {
    explanationId: "nt.transfer.declineInviteHearts",
    meaningId: "transfer:decline-invite-hearts",
    templateKey: "nt.transfer.declineInviteHearts.semantic",
    displayText: "Decline heart invite: pass 2NT with minimum, no game",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "transfer:accept-invite-spades": {
    explanationId: "nt.transfer.acceptInviteSpades",
    meaningId: "transfer:accept-invite-spades",
    templateKey: "nt.transfer.acceptInviteSpades.semantic",
    displayText: "Accept spade invite: bid 3\u2660 or 4\u2660 with maximum, fit confirmed",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "transfer:decline-invite-spades": {
    explanationId: "nt.transfer.declineInviteSpades",
    meaningId: "transfer:decline-invite-spades",
    templateKey: "nt.transfer.declineInviteSpades.semantic",
    displayText: "Decline spade invite: pass 2NT with minimum, no game",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // R4 — opener invite-raise acceptance after responder's 3M invite raise
  "transfer:accept-invite-raise-hearts": {
    explanationId: "nt.transfer.acceptInviteRaiseHearts",
    meaningId: "transfer:accept-invite-raise-hearts",
    templateKey: "nt.transfer.acceptInviteRaiseHearts.semantic",
    displayText: "Accept heart invite raise: bid 4\u2665 with maximum, fit and extras",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "transfer:decline-invite-raise-hearts": {
    explanationId: "nt.transfer.declineInviteRaiseHearts",
    meaningId: "transfer:decline-invite-raise-hearts",
    templateKey: "nt.transfer.declineInviteRaiseHearts.semantic",
    displayText: "Decline heart invite raise: pass 3\u2665 with minimum",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "transfer:accept-invite-raise-spades": {
    explanationId: "nt.transfer.acceptInviteRaiseSpades",
    meaningId: "transfer:accept-invite-raise-spades",
    templateKey: "nt.transfer.acceptInviteRaiseSpades.semantic",
    displayText: "Accept spade invite raise: bid 4\u2660 with maximum, fit and extras",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "transfer:decline-invite-raise-spades": {
    explanationId: "nt.transfer.declineInviteRaiseSpades",
    meaningId: "transfer:decline-invite-raise-spades",
    templateKey: "nt.transfer.declineInviteRaiseSpades.semantic",
    displayText: "Decline spade invite raise: pass 3\u2660 with minimum",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
};

// ─── Exported array (consumed by module factory + explanation catalog) ─

export const TRANSFER_EXPLANATION_ENTRIES: readonly ExplanationEntry[] = [
  ...Object.values(FACT_EXPLANATIONS),
  ...Object.values(MEANING_EXPLANATIONS),
];
