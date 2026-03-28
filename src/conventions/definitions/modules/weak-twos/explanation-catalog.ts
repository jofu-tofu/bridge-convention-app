import {
  type ExplanationEntry,
  type FactExplanationEntry,
  type MeaningExplanationEntry,
} from "../../../core/explanation-catalog";
import type { WeakTwoFactId, WeakTwoMeaningId } from "./ids";

/**
 * Weak Two Bids explanation catalog.
 *
 * Maps weak two facts and meanings to template keys for teaching projections.
 * Uses Record exhaustiveness to guarantee every fact ID and meaning ID has
 * an explanation entry.
 *
 * Covers four rounds:
 *   R1 — opener's weak two opening (2D, 2H, 2S)
 *   R2 — responder's action (game raise, Ogust ask, invite, weak pass)
 *   R3 — opener's Ogust rebid (solid, min/bad, min/good, max/bad, max/good)
 *   R4 — responder's post-Ogust decision (game, signoff, 3NT, pass)
 */

// ── Fact explanations (exhaustive over WeakTwoFactId) ──────────

const FACT_EXPLANATIONS: Record<WeakTwoFactId, FactExplanationEntry> = {
  // ── Vulnerability-aware HCP range ─────────────────────────────
  "module.weakTwo.inOpeningHcpRange": {
    explanationId: "weakTwo.hcp.opener",
    factId: "module.weakTwo.inOpeningHcpRange",
    templateKey: "weakTwo.hcp.opener.supporting",
    displayText: "HCP in weak two opening range (6-11 vul, 5-11 NV)",
    contrastiveTemplateKey: "weakTwo.hcp.opener.whyNot",
    contrastiveDisplayText: "HCP not in weak two opening range",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  "module.weakTwo.isMaximum": {
    explanationId: "weakTwo.ogust.isMaximum",
    factId: "module.weakTwo.isMaximum",
    templateKey: "weakTwo.ogust.isMaximum.supporting",
    displayText: "Maximum hand (8-11 HCP) for Ogust",
    contrastiveTemplateKey: "weakTwo.ogust.isMaximum.whyNot",
    contrastiveDisplayText: "Not maximum — hand is in the minimum range",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  "module.weakTwo.isMinimum": {
    explanationId: "weakTwo.ogust.isMinimum",
    factId: "module.weakTwo.isMinimum",
    templateKey: "weakTwo.ogust.isMinimum.supporting",
    displayText: "Minimum hand (5-7 NV, 6-7 vul) for Ogust",
    contrastiveTemplateKey: "weakTwo.ogust.isMinimum.whyNot",
    contrastiveDisplayText: "Not minimum — hand is in the maximum range",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },

  // ── Per-suit solid (AKQ) facts ────────────────────────────────
  "module.weakTwo.isSolid.hearts": {
    explanationId: "weakTwo.ogust.isSolid.hearts",
    factId: "module.weakTwo.isSolid.hearts",
    templateKey: "weakTwo.ogust.isSolid.hearts.supporting",
    displayText: "Solid heart suit (AKQ) — bid 3NT",
    contrastiveTemplateKey: "weakTwo.ogust.isSolid.hearts.whyNot",
    contrastiveDisplayText: "Heart suit not solid — missing at least one top honor",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  "module.weakTwo.isSolid.spades": {
    explanationId: "weakTwo.ogust.isSolid.spades",
    factId: "module.weakTwo.isSolid.spades",
    templateKey: "weakTwo.ogust.isSolid.spades.supporting",
    displayText: "Solid spade suit (AKQ) — bid 3NT",
    contrastiveTemplateKey: "weakTwo.ogust.isSolid.spades.whyNot",
    contrastiveDisplayText: "Spade suit not solid — missing at least one top honor",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  "module.weakTwo.isSolid.diamonds": {
    explanationId: "weakTwo.ogust.isSolid.diamonds",
    factId: "module.weakTwo.isSolid.diamonds",
    templateKey: "weakTwo.ogust.isSolid.diamonds.supporting",
    displayText: "Solid diamond suit (AKQ) — bid 3NT",
    contrastiveTemplateKey: "weakTwo.ogust.isSolid.diamonds.whyNot",
    contrastiveDisplayText: "Diamond suit not solid — missing at least one top honor",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },

  // ── New suit forcing facts ───────────────────────────────────
  "module.weakTwo.hasNewSuit.hearts": {
    explanationId: "weakTwo.hasNewSuit.hearts",
    factId: "module.weakTwo.hasNewSuit.hearts",
    templateKey: "weakTwo.hasNewSuit.hearts.supporting",
    displayText: "Has 5+ cards in a suit other than hearts",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  "module.weakTwo.hasNewSuit.spades": {
    explanationId: "weakTwo.hasNewSuit.spades",
    factId: "module.weakTwo.hasNewSuit.spades",
    templateKey: "weakTwo.hasNewSuit.spades.supporting",
    displayText: "Has 5+ cards in a suit other than spades",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  "module.weakTwo.hasNewSuit.diamonds": {
    explanationId: "weakTwo.hasNewSuit.diamonds",
    factId: "module.weakTwo.hasNewSuit.diamonds",
    templateKey: "weakTwo.hasNewSuit.diamonds.supporting",
    displayText: "Has 5+ cards in a suit other than diamonds",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  "module.weakTwo.hasNsfSupport.hearts": {
    explanationId: "weakTwo.hasNsfSupport.hearts",
    factId: "module.weakTwo.hasNsfSupport.hearts",
    templateKey: "weakTwo.hasNsfSupport.hearts.supporting",
    displayText: "Opener has 3+ support for a non-heart suit",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  "module.weakTwo.hasNsfSupport.spades": {
    explanationId: "weakTwo.hasNsfSupport.spades",
    factId: "module.weakTwo.hasNsfSupport.spades",
    templateKey: "weakTwo.hasNsfSupport.spades.supporting",
    displayText: "Opener has 3+ support for a non-spade suit",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  "module.weakTwo.hasNsfSupport.diamonds": {
    explanationId: "weakTwo.hasNsfSupport.diamonds",
    factId: "module.weakTwo.hasNsfSupport.diamonds",
    templateKey: "weakTwo.hasNsfSupport.diamonds.supporting",
    displayText: "Opener has 3+ support for a non-diamond suit",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },

  // ── Per-suit top honor count facts ────────────────────────────
  "module.weakTwo.topHonorCount.hearts": {
    explanationId: "weakTwo.topHonors.hearts",
    factId: "module.weakTwo.topHonorCount.hearts",
    templateKey: "weakTwo.topHonors.hearts.supporting",
    displayText: "Top honor count (A, K, Q) in hearts",
    preferredLevel: "mechanical",
    roles: ["supporting", "pedagogical"],
  },
  "module.weakTwo.topHonorCount.spades": {
    explanationId: "weakTwo.topHonors.spades",
    factId: "module.weakTwo.topHonorCount.spades",
    templateKey: "weakTwo.topHonors.spades.supporting",
    displayText: "Top honor count (A, K, Q) in spades",
    preferredLevel: "mechanical",
    roles: ["supporting", "pedagogical"],
  },
  "module.weakTwo.topHonorCount.diamonds": {
    explanationId: "weakTwo.topHonors.diamonds",
    factId: "module.weakTwo.topHonorCount.diamonds",
    templateKey: "weakTwo.topHonors.diamonds.supporting",
    displayText: "Top honor count (A, K, Q) in diamonds",
    preferredLevel: "mechanical",
    roles: ["supporting", "pedagogical"],
  },
};

// ── Meaning explanations (exhaustive over WeakTwoMeaningId) ────

const MEANING_EXPLANATIONS: Record<WeakTwoMeaningId, MeaningExplanationEntry> = {
  // ── R1: Opener weak two openings ──────────────────────────────
  "weak-two:open-2h": {
    explanationId: "weakTwo.r1.open2h",
    meaningId: "weak-two:open-2h",
    templateKey: "weakTwo.r1.open2h.semantic",
    displayText: "Open 2H: 6+ hearts, 5-11 NV / 6-11 vul HCP",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:open-2s": {
    explanationId: "weakTwo.r1.open2s",
    meaningId: "weak-two:open-2s",
    templateKey: "weakTwo.r1.open2s.semantic",
    displayText: "Open 2S: 6+ spades, 5-11 NV / 6-11 vul HCP",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:open-2d": {
    explanationId: "weakTwo.r1.open2d",
    meaningId: "weak-two:open-2d",
    templateKey: "weakTwo.r1.open2d.semantic",
    displayText: "Open 2D: 6+ diamonds, 5-11 NV / 6-11 vul HCP",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R2: Responder actions (hearts) ────────────────────────────
  "weak-two:game-raise-hearts": {
    explanationId: "weakTwo.r2.gameRaise.hearts",
    meaningId: "weak-two:game-raise-hearts",
    templateKey: "weakTwo.r2.gameRaise.hearts.semantic",
    displayText: "Game raise in hearts: 16+ HCP with 3+ heart support",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:ogust-ask-hearts": {
    explanationId: "weakTwo.r2.ogustAsk.hearts",
    meaningId: "weak-two:ogust-ask-hearts",
    templateKey: "weakTwo.r2.ogustAsk.hearts.semantic",
    displayText: "Ogust 2NT over 2H: ask opener about hand strength and suit quality",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:invite-raise-hearts": {
    explanationId: "weakTwo.r2.inviteRaise.hearts",
    meaningId: "weak-two:invite-raise-hearts",
    templateKey: "weakTwo.r2.inviteRaise.hearts.semantic",
    displayText: "Invite raise in hearts: 14-15 HCP with 3+ heart support",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:preemptive-raise-hearts": {
    explanationId: "weakTwo.r2.preemptiveRaise.hearts",
    meaningId: "weak-two:preemptive-raise-hearts",
    templateKey: "weakTwo.r2.preemptiveRaise.hearts.semantic",
    displayText: "Preemptive raise in hearts: 6-13 total points with 3+ heart support",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:new-suit-forcing-hearts": {
    explanationId: "weakTwo.r2.newSuitForcing.hearts",
    meaningId: "weak-two:new-suit-forcing-hearts",
    templateKey: "weakTwo.r2.newSuitForcing.hearts.semantic",
    displayText: "New suit forcing over 2H: 16+ HCP with 5+ in a new suit, forcing one round",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:weak-pass-hearts": {
    explanationId: "weakTwo.r2.weakPass.hearts",
    meaningId: "weak-two:weak-pass-hearts",
    templateKey: "weakTwo.r2.weakPass.hearts.semantic",
    displayText: "Pass over 2H: not enough strength to raise or invoke Ogust",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R2: Responder actions (spades) ────────────────────────────
  "weak-two:game-raise-spades": {
    explanationId: "weakTwo.r2.gameRaise.spades",
    meaningId: "weak-two:game-raise-spades",
    templateKey: "weakTwo.r2.gameRaise.spades.semantic",
    displayText: "Game raise in spades: 16+ HCP with 3+ spade support",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:ogust-ask-spades": {
    explanationId: "weakTwo.r2.ogustAsk.spades",
    meaningId: "weak-two:ogust-ask-spades",
    templateKey: "weakTwo.r2.ogustAsk.spades.semantic",
    displayText: "Ogust 2NT over 2S: ask opener about hand strength and suit quality",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:invite-raise-spades": {
    explanationId: "weakTwo.r2.inviteRaise.spades",
    meaningId: "weak-two:invite-raise-spades",
    templateKey: "weakTwo.r2.inviteRaise.spades.semantic",
    displayText: "Invite raise in spades: 14-15 HCP with 3+ spade support",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:preemptive-raise-spades": {
    explanationId: "weakTwo.r2.preemptiveRaise.spades",
    meaningId: "weak-two:preemptive-raise-spades",
    templateKey: "weakTwo.r2.preemptiveRaise.spades.semantic",
    displayText: "Preemptive raise in spades: 6-13 total points with 3+ spade support",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:new-suit-forcing-spades": {
    explanationId: "weakTwo.r2.newSuitForcing.spades",
    meaningId: "weak-two:new-suit-forcing-spades",
    templateKey: "weakTwo.r2.newSuitForcing.spades.semantic",
    displayText: "New suit forcing over 2S: 16+ HCP with 5+ in a new suit, forcing one round",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:weak-pass-spades": {
    explanationId: "weakTwo.r2.weakPass.spades",
    meaningId: "weak-two:weak-pass-spades",
    templateKey: "weakTwo.r2.weakPass.spades.semantic",
    displayText: "Pass over 2S: not enough strength to raise or invoke Ogust",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R2: Responder actions (diamonds) ──────────────────────────
  "weak-two:game-raise-diamonds": {
    explanationId: "weakTwo.r2.gameRaise.diamonds",
    meaningId: "weak-two:game-raise-diamonds",
    templateKey: "weakTwo.r2.gameRaise.diamonds.semantic",
    displayText: "Game raise in diamonds: 16+ HCP with 3+ diamond support",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:ogust-ask-diamonds": {
    explanationId: "weakTwo.r2.ogustAsk.diamonds",
    meaningId: "weak-two:ogust-ask-diamonds",
    templateKey: "weakTwo.r2.ogustAsk.diamonds.semantic",
    displayText: "Ogust 2NT over 2D: ask opener about hand strength and suit quality",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:invite-raise-diamonds": {
    explanationId: "weakTwo.r2.inviteRaise.diamonds",
    meaningId: "weak-two:invite-raise-diamonds",
    templateKey: "weakTwo.r2.inviteRaise.diamonds.semantic",
    displayText: "Invite raise in diamonds: 14-15 HCP with 3+ diamond support",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:preemptive-raise-diamonds": {
    explanationId: "weakTwo.r2.preemptiveRaise.diamonds",
    meaningId: "weak-two:preemptive-raise-diamonds",
    templateKey: "weakTwo.r2.preemptiveRaise.diamonds.semantic",
    displayText: "Preemptive raise in diamonds: 6-13 total points with 3+ diamond support",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:new-suit-forcing-diamonds": {
    explanationId: "weakTwo.r2.newSuitForcing.diamonds",
    meaningId: "weak-two:new-suit-forcing-diamonds",
    templateKey: "weakTwo.r2.newSuitForcing.diamonds.semantic",
    displayText: "New suit forcing over 2D: 16+ HCP with 5+ in a new suit, forcing one round",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:weak-pass-diamonds": {
    explanationId: "weakTwo.r2.weakPass.diamonds",
    meaningId: "weak-two:weak-pass-diamonds",
    templateKey: "weakTwo.r2.weakPass.diamonds.semantic",
    displayText: "Pass over 2D: not enough strength to raise or invoke Ogust",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R3: Ogust responses (hearts) ──────────────────────────────
  "weak-two:ogust-solid-hearts": {
    explanationId: "weakTwo.r3.ogustSolid.hearts",
    meaningId: "weak-two:ogust-solid-hearts",
    templateKey: "weakTwo.r3.ogustSolid.hearts.semantic",
    displayText: "Solid heart suit (AKQ) — bid 3NT",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:ogust-min-bad-hearts": {
    explanationId: "weakTwo.r3.ogustMinBad.hearts",
    meaningId: "weak-two:ogust-min-bad-hearts",
    templateKey: "weakTwo.r3.ogustMinBad.hearts.semantic",
    displayText: "Minimum hand, bad heart suit (0-1 top honors) — bid 3C",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:ogust-min-good-hearts": {
    explanationId: "weakTwo.r3.ogustMinGood.hearts",
    meaningId: "weak-two:ogust-min-good-hearts",
    templateKey: "weakTwo.r3.ogustMinGood.hearts.semantic",
    displayText: "Minimum hand, good heart suit (2+ top honors) — bid 3D",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:ogust-max-bad-hearts": {
    explanationId: "weakTwo.r3.ogustMaxBad.hearts",
    meaningId: "weak-two:ogust-max-bad-hearts",
    templateKey: "weakTwo.r3.ogustMaxBad.hearts.semantic",
    displayText: "Maximum hand, bad heart suit (0-1 top honors) — bid 3H",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:ogust-max-good-hearts": {
    explanationId: "weakTwo.r3.ogustMaxGood.hearts",
    meaningId: "weak-two:ogust-max-good-hearts",
    templateKey: "weakTwo.r3.ogustMaxGood.hearts.semantic",
    displayText: "Maximum hand, good heart suit (2+ top honors) — bid 3S",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R3: Ogust responses (spades) ──────────────────────────────
  "weak-two:ogust-solid-spades": {
    explanationId: "weakTwo.r3.ogustSolid.spades",
    meaningId: "weak-two:ogust-solid-spades",
    templateKey: "weakTwo.r3.ogustSolid.spades.semantic",
    displayText: "Solid spade suit (AKQ) — bid 3NT",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:ogust-min-bad-spades": {
    explanationId: "weakTwo.r3.ogustMinBad.spades",
    meaningId: "weak-two:ogust-min-bad-spades",
    templateKey: "weakTwo.r3.ogustMinBad.spades.semantic",
    displayText: "Minimum hand, bad spade suit (0-1 top honors) — bid 3C",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:ogust-min-good-spades": {
    explanationId: "weakTwo.r3.ogustMinGood.spades",
    meaningId: "weak-two:ogust-min-good-spades",
    templateKey: "weakTwo.r3.ogustMinGood.spades.semantic",
    displayText: "Minimum hand, good spade suit (2+ top honors) — bid 3D",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:ogust-max-bad-spades": {
    explanationId: "weakTwo.r3.ogustMaxBad.spades",
    meaningId: "weak-two:ogust-max-bad-spades",
    templateKey: "weakTwo.r3.ogustMaxBad.spades.semantic",
    displayText: "Maximum hand, bad spade suit (0-1 top honors) — bid 3H",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:ogust-max-good-spades": {
    explanationId: "weakTwo.r3.ogustMaxGood.spades",
    meaningId: "weak-two:ogust-max-good-spades",
    templateKey: "weakTwo.r3.ogustMaxGood.spades.semantic",
    displayText: "Maximum hand, good spade suit (2+ top honors) — bid 3S",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R3: Ogust responses (diamonds) ────────────────────────────
  "weak-two:ogust-solid-diamonds": {
    explanationId: "weakTwo.r3.ogustSolid.diamonds",
    meaningId: "weak-two:ogust-solid-diamonds",
    templateKey: "weakTwo.r3.ogustSolid.diamonds.semantic",
    displayText: "Solid diamond suit (AKQ) — bid 3NT",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:ogust-min-bad-diamonds": {
    explanationId: "weakTwo.r3.ogustMinBad.diamonds",
    meaningId: "weak-two:ogust-min-bad-diamonds",
    templateKey: "weakTwo.r3.ogustMinBad.diamonds.semantic",
    displayText: "Minimum hand, bad diamond suit (0-1 top honors) — bid 3C",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:ogust-min-good-diamonds": {
    explanationId: "weakTwo.r3.ogustMinGood.diamonds",
    meaningId: "weak-two:ogust-min-good-diamonds",
    templateKey: "weakTwo.r3.ogustMinGood.diamonds.semantic",
    displayText: "Minimum hand, good diamond suit (2+ top honors) — bid 3D",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:ogust-max-bad-diamonds": {
    explanationId: "weakTwo.r3.ogustMaxBad.diamonds",
    meaningId: "weak-two:ogust-max-bad-diamonds",
    templateKey: "weakTwo.r3.ogustMaxBad.diamonds.semantic",
    displayText: "Maximum hand, bad diamond suit (0-1 top honors) — bid 3H",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:ogust-max-good-diamonds": {
    explanationId: "weakTwo.r3.ogustMaxGood.diamonds",
    meaningId: "weak-two:ogust-max-good-diamonds",
    templateKey: "weakTwo.r3.ogustMaxGood.diamonds.semantic",
    displayText: "Maximum hand, good diamond suit (2+ top honors) — bid 3S",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R3: Opener rebid after new suit forcing (hearts) ─────────
  "weak-two:nsf-support-hearts": {
    explanationId: "weakTwo.r3.nsfSupport.hearts",
    meaningId: "weak-two:nsf-support-hearts",
    templateKey: "weakTwo.r3.nsfSupport.hearts.semantic",
    displayText: "Support responder's new suit: 3+ cards in responder's suit",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:nsf-rebid-hearts": {
    explanationId: "weakTwo.r3.nsfRebid.hearts",
    meaningId: "weak-two:nsf-rebid-hearts",
    templateKey: "weakTwo.r3.nsfRebid.hearts.semantic",
    displayText: "Rebid hearts: no support for responder's suit, return to own suit",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R3: Opener rebid after new suit forcing (spades) ────────
  "weak-two:nsf-support-spades": {
    explanationId: "weakTwo.r3.nsfSupport.spades",
    meaningId: "weak-two:nsf-support-spades",
    templateKey: "weakTwo.r3.nsfSupport.spades.semantic",
    displayText: "Support responder's new suit: 3+ cards in responder's suit",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:nsf-rebid-spades": {
    explanationId: "weakTwo.r3.nsfRebid.spades",
    meaningId: "weak-two:nsf-rebid-spades",
    templateKey: "weakTwo.r3.nsfRebid.spades.semantic",
    displayText: "Rebid spades: no support for responder's suit, return to own suit",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R3: Opener rebid after new suit forcing (diamonds) ──────
  "weak-two:nsf-support-diamonds": {
    explanationId: "weakTwo.r3.nsfSupport.diamonds",
    meaningId: "weak-two:nsf-support-diamonds",
    templateKey: "weakTwo.r3.nsfSupport.diamonds.semantic",
    displayText: "Support responder's new suit: 3+ cards in responder's suit",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:nsf-rebid-diamonds": {
    explanationId: "weakTwo.r3.nsfRebid.diamonds",
    meaningId: "weak-two:nsf-rebid-diamonds",
    templateKey: "weakTwo.r3.nsfRebid.diamonds.semantic",
    displayText: "Rebid diamonds: no support for responder's suit, return to own suit",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R4: Post-Ogust responder rebid (hearts) ──────────────────
  "weak-two:post-ogust-game-hearts": {
    explanationId: "weakTwo.r4.postOgustGame.hearts",
    meaningId: "weak-two:post-ogust-game-hearts",
    templateKey: "weakTwo.r4.postOgustGame.hearts.semantic",
    displayText: "Bid game in hearts after Ogust: opener showed enough strength or quality",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:post-ogust-signoff-hearts": {
    explanationId: "weakTwo.r4.postOgustSignoff.hearts",
    meaningId: "weak-two:post-ogust-signoff-hearts",
    templateKey: "weakTwo.r4.postOgustSignoff.hearts.semantic",
    displayText: "Sign off in hearts after Ogust: opener is too weak for game",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:post-ogust-pass-hearts": {
    explanationId: "weakTwo.r4.postOgustPass.hearts",
    meaningId: "weak-two:post-ogust-pass-hearts",
    templateKey: "weakTwo.r4.postOgustPass.hearts.semantic",
    displayText: "Pass after Ogust in hearts: already at a playable level",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R4: Post-Ogust responder rebid (spades) ──────────────────
  "weak-two:post-ogust-game-spades": {
    explanationId: "weakTwo.r4.postOgustGame.spades",
    meaningId: "weak-two:post-ogust-game-spades",
    templateKey: "weakTwo.r4.postOgustGame.spades.semantic",
    displayText: "Bid game in spades after Ogust: opener showed enough strength or quality",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:post-ogust-signoff-spades": {
    explanationId: "weakTwo.r4.postOgustSignoff.spades",
    meaningId: "weak-two:post-ogust-signoff-spades",
    templateKey: "weakTwo.r4.postOgustSignoff.spades.semantic",
    displayText: "Sign off in spades after Ogust: opener is too weak for game",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:post-ogust-pass-spades": {
    explanationId: "weakTwo.r4.postOgustPass.spades",
    meaningId: "weak-two:post-ogust-pass-spades",
    templateKey: "weakTwo.r4.postOgustPass.spades.semantic",
    displayText: "Pass after Ogust in spades: already at a playable level",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },

  // ── R4: Post-Ogust responder rebid (diamonds) ────────────────
  "weak-two:post-ogust-game-diamonds": {
    explanationId: "weakTwo.r4.postOgustGame.diamonds",
    meaningId: "weak-two:post-ogust-game-diamonds",
    templateKey: "weakTwo.r4.postOgustGame.diamonds.semantic",
    displayText: "Bid game in diamonds (5D) after Ogust: opener showed enough strength or quality",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:post-ogust-3nt-diamonds": {
    explanationId: "weakTwo.r4.postOgust3nt.diamonds",
    meaningId: "weak-two:post-ogust-3nt-diamonds",
    templateKey: "weakTwo.r4.postOgust3nt.diamonds.semantic",
    displayText: "Bid 3NT after Ogust over 2D: prefer notrump game with strong hand",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:post-ogust-signoff-diamonds": {
    explanationId: "weakTwo.r4.postOgustSignoff.diamonds",
    meaningId: "weak-two:post-ogust-signoff-diamonds",
    templateKey: "weakTwo.r4.postOgustSignoff.diamonds.semantic",
    displayText: "Sign off in diamonds after Ogust: opener is too weak for game",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  "weak-two:post-ogust-pass-diamonds": {
    explanationId: "weakTwo.r4.postOgustPass.diamonds",
    meaningId: "weak-two:post-ogust-pass-diamonds",
    templateKey: "weakTwo.r4.postOgustPass.diamonds.semantic",
    displayText: "Pass after Ogust in diamonds: already at a playable level",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
};

// ── Exported flat array (consumed by index.ts and catalog builder) ──

export const WEAK_TWO_ENTRIES: readonly ExplanationEntry[] = [
  ...Object.values(FACT_EXPLANATIONS),
  ...Object.values(MEANING_EXPLANATIONS),
];
