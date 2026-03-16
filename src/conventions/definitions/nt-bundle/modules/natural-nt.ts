import type { MeaningSurface } from "../../../../core/contracts/meaning";
import type { MachineTransition } from "../../../core/runtime/machine-types";
import type {
  FactCatalogExtension,
  FactDefinition,
  FactEvaluatorFn,
} from "../../../../core/contracts/fact-catalog";
import { num, fv } from "../../../../core/contracts/fact-catalog";
import type { ExplanationEntry } from "../../../../core/contracts/explanation-catalog";
import type { PedagogicalRelation } from "../../../../core/contracts/teaching-projection";
import { BidSuit } from "../../../../engine/types";
import { BRIDGE_SEMANTIC_CLASSES } from "../../../../core/contracts/meaning";
import type { ConventionModule } from "../../../core/composition/module-types";
import { bid } from "../../../core/surface-helpers";

// ─── R1 surfaces ─────────────────────────────────────────────

const NT_R1_SURFACES: readonly MeaningSurface[] = [
  {
    meaningId: "bridge:nt-invite",
    semanticClassId: BRIDGE_SEMANTIC_CLASSES.NT_INVITE,
    moduleId: "natural-nt",
    encoding: { defaultCall: bid(2, BidSuit.NoTrump) },
    clauses: [
      {
        clauseId: "invite-values",
        factId: "module.ntResponse.inviteValues",
        operator: "boolean",
        value: true,
        description: "Invite values opposite 1NT (8-9 HCP)",
      },
      {
        clauseId: "no-four-card-major",
        factId: "bridge.hasFourCardMajor",
        operator: "boolean",
        value: false,
        description: "No 4-card major",
      },
      {
        clauseId: "no-five-card-major",
        factId: "bridge.hasFiveCardMajor",
        operator: "boolean",
        value: false,
        description: "No 5-card major",
      },
    ],
    ranking: {
      recommendationBand: "may",
      specificity: 1,
      modulePrecedence: 2,
      intraModuleOrder: 0,
    },
    priorityClass: "neutralCorrect",
    sourceIntent: { type: "NTInvite", params: {} },
    teachingLabel: "NT invite",
  },

  {
    meaningId: "bridge:to-3nt",
    semanticClassId: BRIDGE_SEMANTIC_CLASSES.NT_GAME,
    moduleId: "natural-nt",
    encoding: { defaultCall: bid(3, BidSuit.NoTrump) },
    clauses: [
      {
        clauseId: "game-values",
        factId: "module.ntResponse.gameValues",
        operator: "boolean",
        value: true,
        description: "Game values opposite 1NT (10+ HCP)",
      },
      {
        clauseId: "no-four-card-major",
        factId: "bridge.hasFourCardMajor",
        operator: "boolean",
        value: false,
        description: "No 4-card major",
      },
      {
        clauseId: "no-five-card-major",
        factId: "bridge.hasFiveCardMajor",
        operator: "boolean",
        value: false,
        description: "No 5-card major",
      },
    ],
    ranking: {
      recommendationBand: "may",
      specificity: 1,
      modulePrecedence: 2,
      intraModuleOrder: 1,
    },
    priorityClass: "neutralCorrect",
    sourceIntent: { type: "NTGame", params: {} },
    teachingLabel: "3NT game",
  },
];

// ─── Opener 1NT surface (used as surface group for idle state) ───
// Declares the 1NT opening promise (15-17 HCP, balanced) so that the
// commitment extractor produces public constraints for the posterior sampler.

export const OPENER_1NT_SURFACE: readonly MeaningSurface[] = [
  {
    meaningId: "bridge:1nt-opening",
    semanticClassId: BRIDGE_SEMANTIC_CLASSES.NT_OPENING,
    moduleId: "natural-nt",
    encoding: { defaultCall: bid(1, BidSuit.NoTrump) },
    clauses: [
      {
        clauseId: "hcp-15-plus",
        factId: "hand.hcp",
        operator: "gte",
        value: 15,
        description: "15+ HCP for 1NT opening",
      },
      {
        clauseId: "hcp-17-max",
        factId: "hand.hcp",
        operator: "lte",
        value: 17,
        description: "At most 17 HCP for 1NT opening",
      },
      {
        clauseId: "balanced",
        factId: "hand.isBalanced",
        operator: "boolean",
        value: true,
        description: "Balanced hand shape",
      },
    ],
    ranking: {
      recommendationBand: "must",
      specificity: 3,
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    priorityClass: "neutralCorrect",
    sourceIntent: { type: "NTOpening", params: {} },
    teachingLabel: "15 to 17",
  },
];

// ─── R1 transitions ──────────────────────────────────────────

const NT_R1_TRANSITIONS: readonly MachineTransition[] = [
  {
    transitionId: "r1-3nt",
    match: { kind: "call", level: 3, strain: BidSuit.NoTrump },
    target: "terminal",
  },
  {
    transitionId: "r1-pass",
    match: { kind: "pass" },
    target: "terminal",
  },
  {
    transitionId: "r1-2nt",
    match: { kind: "call", level: 2, strain: BidSuit.NoTrump },
    target: "terminal",
  },
];

// ─── Facts ───────────────────────────────────────────────────

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

// ─── Explanation entries ─────────────────────────────────────

const NT_EXPLANATION_ENTRIES: readonly ExplanationEntry[] = [
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
  {
    explanationId: "nt.hcp.base",
    factId: "hand.hcp",
    templateKey: "nt.hcp.base.mechanical",
    displayText: "High card points",
    preferredLevel: "mechanical",
    roles: ["supporting"],
  },
  {
    explanationId: "nt.suit.majorPattern",
    factId: "bridge.majorPattern",
    templateKey: "nt.suit.majorPattern.supporting",
    displayText: "Major suit distribution",
    preferredLevel: "mechanical",
    roles: ["supporting", "inferential"],
  },
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
    explanationId: "nt.posterior.partnerHas4Diamonds",
    factId: "bridge.partnerHas4DiamondsLikely",
    templateKey: "nt.posterior.partnerHas4Diamonds",
    displayText: "Partner likely has 4+ diamonds",
    preferredLevel: "semantic",
    roles: ["inferential"],
  },
  {
    explanationId: "nt.posterior.partnerHas4Clubs",
    factId: "bridge.partnerHas4ClubsLikely",
    templateKey: "nt.posterior.partnerHas4Clubs",
    displayText: "Partner likely has 4+ clubs",
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
];

// ─── Pedagogical relations ───────────────────────────────────

const NT_PEDAGOGICAL_RELATIONS: readonly PedagogicalRelation[] = [
  {
    kind: "same-family",
    a: "bridge:nt-invite",
    b: "bridge:to-3nt",
  },
  {
    kind: "stronger-than",
    a: "bridge:to-3nt",
    b: "bridge:nt-invite",
  },
];

// ─── Terminal pass surface (auction settled — intentional pass) ───

const TERMINAL_PASS_SURFACE: readonly MeaningSurface[] = [
  {
    meaningId: "bridge:terminal-pass",
    semanticClassId: "bridge:terminal-pass",
    moduleId: "natural-nt",
    encoding: { defaultCall: { type: "pass" } },
    clauses: [],
    ranking: {
      recommendationBand: "must",
      specificity: 0,
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    priorityClass: "neutralCorrect",
    sourceIntent: { type: "TerminalPass", params: {} },
    teachingLabel: "Pass (auction complete)",
  },
];

// ─── Module assembly ─────────────────────────────────────────

export const naturalNtModule: ConventionModule = {
  moduleId: "natural-nt",

  entrySurfaces: NT_R1_SURFACES,

  surfaceGroups: [
    { groupId: "opener-1nt", surfaces: OPENER_1NT_SURFACE },
    { groupId: "terminal-pass", surfaces: TERMINAL_PASS_SURFACE },
  ],

  entryTransitions: NT_R1_TRANSITIONS,

  machineStates: [],

  facts: ntResponseFacts,

  explanationEntries: NT_EXPLANATION_ENTRIES,

  pedagogicalRelations: NT_PEDAGOGICAL_RELATIONS,
};
