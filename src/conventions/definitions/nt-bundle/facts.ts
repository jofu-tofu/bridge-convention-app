import type {
  FactCatalogExtension,
  FactDefinition,
  FactEvaluatorFn,
} from "../../../core/contracts/fact-catalog";
import { num, bool, fv } from "../../../core/contracts/fact-catalog";
import { createPosteriorFactEvaluators } from "../../../inference/posterior";

// ─── NT-specific posterior facts ─────────────────────────────
// These posterior facts are 1NT/Stayman-specific (they reference opener context
// and N/S partnership assumptions). They live here because they fail the
// shared promotion rule: cannot be named without a convention name.

const NT_POSTERIOR_FACTS: readonly FactDefinition[] = [
  {
    id: "bridge.nsHaveEightCardFitLikely",
    layer: "module-derived",
    world: "acting-hand",
    description: "Posterior probability that N/S have an 8+ card major fit",
    valueType: "number",
    metadata: { inferable: true, explainable: true },
  },
  {
    id: "bridge.openerStillBalancedLikely",
    layer: "module-derived",
    world: "acting-hand",
    description: "Posterior probability that opener has balanced shape",
    valueType: "number",
    metadata: { inferable: true, explainable: true },
  },
  {
    id: "bridge.openerHasSecondMajorLikely",
    layer: "module-derived",
    world: "acting-hand",
    description: "Posterior probability that opener has a second 4-card major",
    valueType: "number",
    metadata: { inferable: true, explainable: true },
  },
];

// ─── Stayman module facts ────────────────────────────────────

const STAYMAN_FACTS: readonly FactDefinition[] = [
  {
    id: "module.stayman.eligible",
    layer: "module-derived",
    world: "acting-hand",
    description: "Eligible for Stayman (4+ card major AND 8+ HCP)",
    valueType: "boolean",
    derivesFrom: ["bridge.hasFourCardMajor", "hand.hcp"],
  },
  {
    id: "module.stayman.preferred",
    layer: "module-derived",
    world: "acting-hand",
    description: "Stayman preferred (eligible AND no 5-card major)",
    valueType: "boolean",
    derivesFrom: ["module.stayman.eligible", "bridge.hasFiveCardMajor"],
  },
];

const STAYMAN_EVALUATORS = new Map<string, FactEvaluatorFn>([
  ["module.stayman.eligible", (_h, _ev, m) =>
    fv("module.stayman.eligible", bool(m, "bridge.hasFourCardMajor") && num(m, "hand.hcp") >= 8)],
  ["module.stayman.preferred", (_h, _ev, m) =>
    fv("module.stayman.preferred", bool(m, "module.stayman.eligible") && !bool(m, "bridge.hasFiveCardMajor"))],
]);

export const staymanFacts: FactCatalogExtension = {
  definitions: [...STAYMAN_FACTS, ...NT_POSTERIOR_FACTS],
  evaluators: STAYMAN_EVALUATORS,
  posteriorEvaluators: createPosteriorFactEvaluators([
    "bridge.partnerHas4CardMajorLikely",
    "bridge.combinedHcpInRangeLikely",
    "bridge.nsHaveEightCardFitLikely",
    "bridge.openerStillBalancedLikely",
    "bridge.openerHasSecondMajorLikely",
  ]),
};

// ─── Transfer module facts ───────────────────────────────────

const TRANSFER_FACTS: readonly FactDefinition[] = [
  {
    id: "module.transfer.targetSuit",
    layer: "module-derived",
    world: "acting-hand",
    description: "Transfer target suit (hearts, spades, or none)",
    valueType: "string",
    derivesFrom: ["hand.suitLength.hearts", "hand.suitLength.spades"],
  },
  {
    id: "module.transfer.eligible",
    layer: "module-derived",
    world: "acting-hand",
    description: "Eligible for Jacoby transfer (5+ card major)",
    valueType: "boolean",
    derivesFrom: ["bridge.hasFiveCardMajor"],
  },
  {
    id: "module.transfer.preferred",
    layer: "module-derived",
    world: "acting-hand",
    description: "Transfer preferred (eligible with 5+ card suit)",
    valueType: "boolean",
    derivesFrom: ["module.transfer.eligible"],
  },
];

const TRANSFER_EVALUATORS = new Map<string, FactEvaluatorFn>([
  ["module.transfer.targetSuit", (_h, _ev, m) => {
    const spades = num(m, "hand.suitLength.spades");
    const hearts = num(m, "hand.suitLength.hearts");
    if (spades >= 5 && hearts >= 5) return fv("module.transfer.targetSuit", "spades");
    if (spades >= 5) return fv("module.transfer.targetSuit", "spades");
    if (hearts >= 5) return fv("module.transfer.targetSuit", "hearts");
    return fv("module.transfer.targetSuit", "none");
  }],
  ["module.transfer.eligible", (_h, _ev, m) =>
    fv("module.transfer.eligible", bool(m, "bridge.hasFiveCardMajor"))],
  ["module.transfer.preferred", (_h, _ev, m) =>
    fv("module.transfer.preferred", bool(m, "module.transfer.eligible"))],
]);

export const transferFacts: FactCatalogExtension = {
  definitions: TRANSFER_FACTS,
  evaluators: TRANSFER_EVALUATORS,
};

// ─── Smolen module facts ─────────────────────────────────────

const SMOLEN_FACTS: readonly FactDefinition[] = [
  {
    id: "module.smolen.hasFiveHearts",
    layer: "module-derived",
    world: "acting-hand",
    description: "Hand has 5+ hearts (for 3H Smolen showing 5H)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.hearts"],
  },
  {
    id: "module.smolen.hasFiveSpades",
    layer: "module-derived",
    world: "acting-hand",
    description: "Hand has 5+ spades (for 3S Smolen showing 5S)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades"],
  },
  {
    id: "module.smolen.hasFourSpades",
    layer: "module-derived",
    world: "acting-hand",
    description: "Hand has exactly 4 spades (needed for 3H Smolen: 4S+5H)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades"],
  },
  {
    id: "module.smolen.hasFourHearts",
    layer: "module-derived",
    world: "acting-hand",
    description: "Hand has exactly 4 hearts (needed for 3S Smolen: 5S+4H)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.hearts"],
  },
  {
    id: "module.smolen.openerHasHeartFit",
    layer: "module-derived",
    world: "acting-hand",
    description: "Opener has 3+ hearts (heart fit for Smolen placement)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.hearts"],
  },
  {
    id: "module.smolen.openerHasSpadesFit",
    layer: "module-derived",
    world: "acting-hand",
    description: "Opener has 3+ spades (spade fit for Smolen placement)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades"],
  },
];

const SMOLEN_EVALUATORS = new Map<string, FactEvaluatorFn>([
  ["module.smolen.hasFiveHearts", (_h, _ev, m) =>
    fv("module.smolen.hasFiveHearts", num(m, "hand.suitLength.hearts") >= 5)],
  ["module.smolen.hasFiveSpades", (_h, _ev, m) =>
    fv("module.smolen.hasFiveSpades", num(m, "hand.suitLength.spades") >= 5)],
  ["module.smolen.hasFourSpades", (_h, _ev, m) =>
    fv("module.smolen.hasFourSpades", num(m, "hand.suitLength.spades") === 4)],
  ["module.smolen.hasFourHearts", (_h, _ev, m) =>
    fv("module.smolen.hasFourHearts", num(m, "hand.suitLength.hearts") === 4)],
  ["module.smolen.openerHasHeartFit", (_h, _ev, m) =>
    fv("module.smolen.openerHasHeartFit", num(m, "hand.suitLength.hearts") >= 3)],
  ["module.smolen.openerHasSpadesFit", (_h, _ev, m) =>
    fv("module.smolen.openerHasSpadesFit", num(m, "hand.suitLength.spades") >= 3)],
]);

export const smolenFacts: FactCatalogExtension = {
  definitions: SMOLEN_FACTS,
  evaluators: SMOLEN_EVALUATORS,
};

// ─── NT response value facts ────────────────────────────────
// HCP thresholds for responder opposite a 1NT opening.
// These are 1NT-specific (they fail the promotion rule: cannot be
// named without "1NT") so they live here as module-derived facts,
// not in the shared bridge-derived catalog.
// Standard 1NT (15-17) thresholds: invite 8-9, game 10+, slam 15+.

const NT_RESPONSE_FACTS: readonly FactDefinition[] = [
  {
    id: "module.ntResponse.inviteValues",
    layer: "module-derived",
    world: "acting-hand",
    description: "Invite-range HCP opposite 1NT (8-9)",
    valueType: "boolean",
    derivesFrom: ["hand.hcp"],
  },
  {
    id: "module.ntResponse.gameValues",
    layer: "module-derived",
    world: "acting-hand",
    description: "Game-range HCP opposite 1NT (10+)",
    valueType: "boolean",
    derivesFrom: ["hand.hcp"],
  },
  {
    id: "module.ntResponse.slamValues",
    layer: "module-derived",
    world: "acting-hand",
    description: "Slam-range HCP opposite 1NT (15+)",
    valueType: "boolean",
    derivesFrom: ["hand.hcp"],
  },
];

const NT_RESPONSE_EVALUATORS = new Map<string, FactEvaluatorFn>([
  ["module.ntResponse.inviteValues", (_h, _ev, m) => {
    const hcp = num(m, "hand.hcp");
    return fv("module.ntResponse.inviteValues", hcp >= 8 && hcp <= 9);
  }],
  ["module.ntResponse.gameValues", (_h, _ev, m) =>
    fv("module.ntResponse.gameValues", num(m, "hand.hcp") >= 10)],
  ["module.ntResponse.slamValues", (_h, _ev, m) =>
    fv("module.ntResponse.slamValues", num(m, "hand.hcp") >= 15)],
]);

export const ntResponseFacts: FactCatalogExtension = {
  definitions: NT_RESPONSE_FACTS,
  evaluators: NT_RESPONSE_EVALUATORS,
};
