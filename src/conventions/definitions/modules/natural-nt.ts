import type { BidMeaning } from "../../../core/contracts/meaning";
import type { ExplanationEntry } from "../../../core/contracts/explanation-catalog";
import type { LocalFsm, StateEntry } from "../../core/rule-module";

import { BidSuit } from "../../../engine/types";
import { BRIDGE_SEMANTIC_CLASSES } from "../../../core/contracts/meaning";
import type { SystemConfig } from "../../../core/contracts/system-config";
import {
  SYSTEM_RESPONDER_INVITE_VALUES,
  SYSTEM_RESPONDER_GAME_VALUES,
  SYSTEM_RESPONDER_SLAM_VALUES,
} from "../../../core/contracts/system-fact-vocabulary";

import { bid } from "../../core/surface-helpers";
import { createSurface } from "../../core/surface-builder";
import type { ModuleContext } from "../../core/surface-builder";
import {
  SAME_FAMILY,
  STRONGER_THAN,
  FALLBACK_OF,
} from "../teaching-vocabulary";
import {
  SCOPE_NATURAL_NT_R1,
  SCOPE_NATURAL_NT_R1_STRENGTH,
  SCOPE_R1_MAJOR_FIT_FALLBACK,
} from "../pedagogical-scope-vocabulary";

// ─── Module context ──────────────────────────────────────────

const NATURAL_NT_CTX: ModuleContext = { moduleId: "natural-nt" };

// ─── R1 surfaces ─────────────────────────────────────────────

export function createNtR1Surfaces(sys: SystemConfig): readonly BidMeaning[] {
  return [
    createSurface({
      meaningId: "bridge:nt-invite",
      semanticClassId: BRIDGE_SEMANTIC_CLASSES.NT_INVITE,
      encoding: bid(2, BidSuit.NoTrump),
      clauses: [
        {
          factId: SYSTEM_RESPONDER_INVITE_VALUES,
          operator: "boolean",
          value: true,
          description: `Invite values opposite 1NT (${sys.responderThresholds.inviteMin}-${sys.responderThresholds.inviteMax} HCP)`,
        },
        {
          factId: "bridge.hasFourCardMajor",
          operator: "boolean",
          value: false,
        },
        {
          factId: "bridge.hasFiveCardMajor",
          operator: "boolean",
          value: false,
        },
      ],
      band: "may",
      declarationOrder: 0,
      sourceIntent: { type: "NTInvite", params: {} },
      teachingLabel: "NT invite",
      teachingTags: [
        { tag: SAME_FAMILY, scope: SCOPE_NATURAL_NT_R1 },
        { tag: STRONGER_THAN, scope: SCOPE_NATURAL_NT_R1_STRENGTH, ordinal: 1 },
        { tag: FALLBACK_OF, scope: SCOPE_R1_MAJOR_FIT_FALLBACK, role: "a" },
      ],
    }, NATURAL_NT_CTX),

    createSurface({
      meaningId: "bridge:to-3nt",
      semanticClassId: BRIDGE_SEMANTIC_CLASSES.NT_GAME,
      encoding: bid(3, BidSuit.NoTrump),
      clauses: [
        {
          factId: SYSTEM_RESPONDER_GAME_VALUES,
          operator: "boolean",
          value: true,
          description: `Game values opposite 1NT (${sys.responderThresholds.gameMin}+ HCP)`,
        },
        {
          factId: "bridge.hasFourCardMajor",
          operator: "boolean",
          value: false,
        },
        {
          factId: "bridge.hasFiveCardMajor",
          operator: "boolean",
          value: false,
        },
      ],
      band: "may",
      declarationOrder: 1,
      sourceIntent: { type: "NTGame", params: {} },
      teachingLabel: "3NT game",
      teachingTags: [
        { tag: SAME_FAMILY, scope: SCOPE_NATURAL_NT_R1 },
        { tag: STRONGER_THAN, scope: SCOPE_NATURAL_NT_R1_STRENGTH, ordinal: 0 },
        { tag: FALLBACK_OF, scope: SCOPE_R1_MAJOR_FIT_FALLBACK, role: "a" },
      ],
    }, NATURAL_NT_CTX),
  ];
}

// ─── Opener 1NT surface (used as surface group for idle state) ───
// Declares the 1NT opening promise (HCP range, balanced) so that the
// commitment extractor produces public constraints for the posterior sampler.

export function createOpener1NtSurface(sys: SystemConfig): readonly BidMeaning[] {
  return [
    createSurface({
      meaningId: "bridge:1nt-opening",
      semanticClassId: BRIDGE_SEMANTIC_CLASSES.NT_OPENING,
      encoding: bid(1, BidSuit.NoTrump),
      clauses: [
        {
          factId: "hand.hcp",
          operator: "gte",
          value: sys.ntOpening.minHcp,
          description: `${sys.ntOpening.minHcp}+ HCP for 1NT opening`,
        },
        {
          factId: "hand.hcp",
          operator: "lte",
          value: sys.ntOpening.maxHcp,
          description: `At most ${sys.ntOpening.maxHcp} HCP for 1NT opening`,
        },
        {
          factId: "hand.isBalanced",
          operator: "boolean",
          value: true,
        },
      ],
      band: "must",
      declarationOrder: 0,
      sourceIntent: { type: "NTOpening", params: {} },
      teachingLabel: `${sys.ntOpening.minHcp} to ${sys.ntOpening.maxHcp}`,
    }, NATURAL_NT_CTX),
  ];
}

// ─── Explanation entries ─────────────────────────────────────

const NT_EXPLANATION_ENTRIES: readonly ExplanationEntry[] = [
  {
    explanationId: "nt.hcp.invite",
    factId: SYSTEM_RESPONDER_INVITE_VALUES,
    templateKey: "nt.hcp.invite.supporting",
    displayText: "Enough HCP to invite game",
    contrastiveTemplateKey: "nt.hcp.invite.whyNot",
    contrastiveDisplayText: "Not enough HCP to invite game",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "nt.hcp.game",
    factId: SYSTEM_RESPONDER_GAME_VALUES,
    templateKey: "nt.hcp.game.supporting",
    displayText: "Enough HCP for game",
    contrastiveTemplateKey: "nt.hcp.game.whyNot",
    contrastiveDisplayText: "Not enough HCP for game",
    preferredLevel: "semantic",
    roles: ["supporting", "blocking"],
  },
  {
    explanationId: "nt.hcp.slam",
    factId: SYSTEM_RESPONDER_SLAM_VALUES,
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
    displayText: "Has a 5-card major",
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
    factId: "module.stayman.nsHaveEightCardFitLikely",
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
    factId: "module.stayman.openerStillBalancedLikely",
    templateKey: "nt.posterior.openerStillBalanced",
    displayText: "Opener likely still has balanced shape",
    preferredLevel: "semantic",
    roles: ["inferential"],
  },
  {
    explanationId: "nt.posterior.openerHasSecondMajor",
    factId: "module.stayman.openerHasSecondMajorLikely",
    templateKey: "nt.posterior.openerHasSecondMajor",
    displayText: "Opener may have a second 4-card major",
    preferredLevel: "semantic",
    roles: ["inferential"],
  },
];

// ─── Local FSM + States ──────────────────────────────────────

type NaturalNtPhase = "idle" | "opened" | "responded";

export const naturalNtLocal: LocalFsm<NaturalNtPhase> = {
  initial: "idle",
  transitions: [
    { from: "idle", to: "opened", on: { act: "open", strain: "notrump" } },
    { from: "opened", to: "responded", on: { act: "inquire" } },
    { from: "opened", to: "responded", on: { act: "transfer" } },
    { from: "opened", to: "responded", on: { act: "raise" } },
    { from: "opened", to: "responded", on: { act: "place" } },
    { from: "opened", to: "responded", on: { act: "signoff" } },
    { from: "opened", to: "responded", on: { act: "show" } },
  ],
};

export function createNaturalNtStates(sys: SystemConfig): readonly StateEntry<NaturalNtPhase>[] {
  return [
    { phase: "idle", turn: "opener" as const, surfaces: createOpener1NtSurface(sys) },
    { phase: "opened", turn: "responder" as const, surfaces: createNtR1Surfaces(sys) },
  ];
}

// ─── Module declarations ─────────────────────────────────────

/** Factory: creates natural-nt declaration parts (facts + explanations).
 *  Full ConventionModule assembly happens in module-registry.ts. */
export function createNaturalNtDeclarations(_sys: SystemConfig) {
  return {
    facts: { definitions: [], evaluators: new Map() } as const,
    explanationEntries: NT_EXPLANATION_ENTRIES,
  };
}

