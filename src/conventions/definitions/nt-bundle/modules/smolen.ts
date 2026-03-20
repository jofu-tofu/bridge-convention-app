import type { MeaningSurface } from "../../../../core/contracts/meaning";
import type {
  MachineState,
  MachineTransition,
  ConversationMachine,
} from "../../../core/runtime/machine-types";
import { buildConversationMachine } from "../../../core/runtime/machine-types";
import type {
  FactCatalogExtension,
  FactDefinition,
  FactEvaluatorFn,
} from "../../../../core/contracts/fact-catalog";
import { num, fv } from "../../../../core/contracts/fact-catalog";
import { ForcingState } from "../../../../core/contracts/bidding";
import type { ExplanationEntry } from "../../../../core/contracts/explanation-catalog";
import type { PedagogicalRelation } from "../../../../core/contracts/teaching-projection";
import { BidSuit } from "../../../../engine/types";

import { bid } from "../../../core/surface-helpers";
import { staymanModule } from "./stayman";

// ─── Semantic classes ────────────────────────────────────────

/** Smolen semantic class IDs — Stayman R3 continuation for 5-4 major hands. */
export const SMOLEN_CLASSES = {
  BID_SHORT_HEARTS: "smolen:bid-short-hearts",
  BID_SHORT_SPADES: "smolen:bid-short-spades",
  PLACE_FOUR_HEARTS: "smolen:place-four-hearts",
  PLACE_FOUR_SPADES: "smolen:place-four-spades",
  PLACE_THREE_NT: "smolen:place-three-nt",
} as const;

// ─── Entry surfaces (Stayman for Smolen) ─────────────────────

/** 
 * Smolen entry: bid 2C (Stayman) with 5-4 in majors and game values.
 * These override the Jacoby Transfer entry for Smolen-eligible hands.
 * After opener's 2D denial, responder follows up with 3H/3S (Smolen).
 */
const SMOLEN_ENTRY_SURFACES: readonly MeaningSurface[] = [
  {
    meaningId: "smolen:stayman-entry-5h4s",
    semanticClassId: "smolen:stayman-entry",
    moduleId: "smolen",
    encoding: { defaultCall: bid(2, BidSuit.Clubs) },
    clauses: [
      {
        clauseId: "game-values",
        factId: "module.ntResponse.gameValues",
        operator: "boolean",
        value: true,
        description: "Game values opposite 1NT (10+ HCP)",
      },
      {
        clauseId: "five-hearts",
        factId: "module.smolen.hasFiveHearts",
        operator: "boolean",
        value: true,
        description: "5+ hearts",
      },
      {
        clauseId: "four-spades",
        factId: "module.smolen.hasFourSpades",
        operator: "boolean",
        value: true,
        description: "Exactly 4 spades",
      },
    ],
    ranking: {
      recommendationBand: "must",
      modulePrecedence: 2,
      intraModuleOrder: 0,
    },
    sourceIntent: { type: "StaymanAsk", params: { reason: "smolen" } },
    teachingLabel: "Stayman 2♣ (planning Smolen)",
  },

  {
    meaningId: "smolen:stayman-entry-5s4h",
    semanticClassId: "smolen:stayman-entry",
    moduleId: "smolen",
    encoding: { defaultCall: bid(2, BidSuit.Clubs) },
    clauses: [
      {
        clauseId: "game-values",
        factId: "module.ntResponse.gameValues",
        operator: "boolean",
        value: true,
        description: "Game values opposite 1NT (10+ HCP)",
      },
      {
        clauseId: "five-spades",
        factId: "module.smolen.hasFiveSpades",
        operator: "boolean",
        value: true,
        description: "5+ spades",
      },
      {
        clauseId: "four-hearts",
        factId: "module.smolen.hasFourHearts",
        operator: "boolean",
        value: true,
        description: "Exactly 4 hearts",
      },
    ],
    ranking: {
      recommendationBand: "must",
      modulePrecedence: 2,
      intraModuleOrder: 1,
    },
    sourceIntent: { type: "StaymanAsk", params: { reason: "smolen" } },
    teachingLabel: "Stayman 2♣ (planning Smolen)",
  },
];

// ─── R3 Smolen surfaces (contributed to responder-r3-after-stayman-2d) ───

const SMOLEN_R3_SURFACES: readonly MeaningSurface[] = [
  {
    meaningId: "smolen:bid-short-hearts",
    semanticClassId: SMOLEN_CLASSES.BID_SHORT_HEARTS,
    moduleId: "smolen",
    encoding: { defaultCall: bid(3, BidSuit.Hearts) },
    clauses: [
      {
        clauseId: "game-values",
        factId: "module.ntResponse.gameValues",
        operator: "boolean",
        value: true,
        description: "Game values opposite 1NT (10+ HCP)",
      },
      {
        clauseId: "five-hearts",
        factId: "module.smolen.hasFiveHearts",
        operator: "boolean",
        value: true,
        description: "5+ hearts",
      },
      {
        clauseId: "four-spades",
        factId: "module.smolen.hasFourSpades",
        operator: "boolean",
        value: true,
        description: "Exactly 4 spades",
      },
    ],
    ranking: {
      recommendationBand: "must",
      modulePrecedence: 1,
      intraModuleOrder: 0,
    },
    sourceIntent: { type: "Smolen", params: { longMajor: "hearts" } },
    teachingLabel: "Smolen 3H (5H + 4S, game force)",
  },

  {
    meaningId: "smolen:bid-short-spades",
    semanticClassId: SMOLEN_CLASSES.BID_SHORT_SPADES,
    moduleId: "smolen",
    encoding: { defaultCall: bid(3, BidSuit.Spades) },
    clauses: [
      {
        clauseId: "game-values",
        factId: "module.ntResponse.gameValues",
        operator: "boolean",
        value: true,
        description: "Game values opposite 1NT (10+ HCP)",
      },
      {
        clauseId: "five-spades",
        factId: "module.smolen.hasFiveSpades",
        operator: "boolean",
        value: true,
        description: "5+ spades",
      },
      {
        clauseId: "four-hearts",
        factId: "module.smolen.hasFourHearts",
        operator: "boolean",
        value: true,
        description: "Exactly 4 hearts",
      },
    ],
    ranking: {
      recommendationBand: "must",
      modulePrecedence: 1,
      intraModuleOrder: 1,
    },
    sourceIntent: { type: "Smolen", params: { longMajor: "spades" } },
    teachingLabel: "Smolen 3S (5S + 4H, game force)",
  },
];

// ─── Opener Smolen placement surfaces ────────────────────────

export const OPENER_SMOLEN_HEARTS_SURFACES: readonly MeaningSurface[] = [
  {
    meaningId: "smolen:place-four-hearts",
    semanticClassId: SMOLEN_CLASSES.PLACE_FOUR_HEARTS,
    moduleId: "smolen",
    encoding: { defaultCall: bid(4, BidSuit.Hearts) },
    clauses: [
      {
        clauseId: "heart-fit",
        factId: "module.smolen.openerHasHeartFit",
        operator: "boolean",
        value: true,
        description: "Opener has 3+ hearts (fit with responder's 5)",
      },
    ],
    ranking: {
      recommendationBand: "must",
      modulePrecedence: 1,
      intraModuleOrder: 0,
    },
    sourceIntent: { type: "SmolenPlacement", params: { suit: "hearts" } },
    teachingLabel: "4H (heart fit found)",
  },
  {
    meaningId: "smolen:place-three-nt-no-heart-fit",
    semanticClassId: SMOLEN_CLASSES.PLACE_THREE_NT,
    moduleId: "smolen",
    encoding: { defaultCall: bid(3, BidSuit.NoTrump) },
    clauses: [
      {
        clauseId: "no-heart-fit",
        factId: "module.smolen.openerHasHeartFit",
        operator: "boolean",
        value: false,
        description: "Opener has fewer than 3 hearts (no fit)",
      },
    ],
    ranking: {
      recommendationBand: "must",
      modulePrecedence: 1,
      intraModuleOrder: 1,
    },
    sourceIntent: { type: "SmolenPlacement", params: { suit: "notrump" } },
    teachingLabel: "3NT (no heart fit)",
  },
];

export const OPENER_SMOLEN_SPADES_SURFACES: readonly MeaningSurface[] = [
  {
    meaningId: "smolen:place-four-spades",
    semanticClassId: SMOLEN_CLASSES.PLACE_FOUR_SPADES,
    moduleId: "smolen",
    encoding: { defaultCall: bid(4, BidSuit.Spades) },
    clauses: [
      {
        clauseId: "spade-fit",
        factId: "module.smolen.openerHasSpadesFit",
        operator: "boolean",
        value: true,
        description: "Opener has 3+ spades (fit with responder's 5)",
      },
    ],
    ranking: {
      recommendationBand: "must",
      modulePrecedence: 1,
      intraModuleOrder: 0,
    },
    sourceIntent: { type: "SmolenPlacement", params: { suit: "spades" } },
    teachingLabel: "4S (spade fit found)",
  },
  {
    meaningId: "smolen:place-three-nt-no-spade-fit",
    semanticClassId: SMOLEN_CLASSES.PLACE_THREE_NT,
    moduleId: "smolen",
    encoding: { defaultCall: bid(3, BidSuit.NoTrump) },
    clauses: [
      {
        clauseId: "no-spade-fit",
        factId: "module.smolen.openerHasSpadesFit",
        operator: "boolean",
        value: false,
        description: "Opener has fewer than 3 spades (no fit)",
      },
    ],
    ranking: {
      recommendationBand: "must",
      modulePrecedence: 1,
      intraModuleOrder: 1,
    },
    sourceIntent: { type: "SmolenPlacement", params: { suit: "notrump" } },
    teachingLabel: "3NT (no spade fit)",
  },
];

// ─── Hook transitions (into Stayman's responder-r3-stayman-2d) ───

const SMOLEN_HOOK_TRANSITIONS: readonly {
  readonly targetStateId: string;
  readonly transitions: readonly MachineTransition[];
}[] = [
  {
    targetStateId: staymanModule.exposedStates!.afterOpener2D!,
    transitions: [
      {
        transitionId: "r3-smolen-hearts",
        match: { kind: "call", level: 3, strain: BidSuit.Hearts },
        target: "smolen-invoke-hearts",
      },
      {
        transitionId: "r3-smolen-spades",
        match: { kind: "call", level: 3, strain: BidSuit.Spades },
        target: "smolen-invoke-spades",
      },
    ],
  },
];

// ─── Machine states ──────────────────────────────────────────

const SMOLEN_MACHINE_STATES: readonly MachineState[] = [
  {
    stateId: "smolen-scope",
    parentId: "nt-opened",
    transitions: [
      {
        transitionId: "smolen-opponent-interrupt",
        match: { kind: "opponent-action" },
        target: "smolen-interrupted",
      },
    ],
    allowedParentTransitions: ["nt-opened-opponent-interrupt", "nt-opened-pass"],
  },
  {
    stateId: "smolen-interrupted",
    parentId: "smolen-scope",
    transitions: [
      {
        transitionId: "smolen-interrupted-absorb",
        match: { kind: "pass" },
        target: "smolen-interrupted",
      },
    ],
    surfaceGroupId: "smolen-interrupted",
    entryEffects: { setCompetitionMode: "Contested" },
    allowedParentTransitions: ["smolen-opponent-interrupt", "nt-opened-opponent-interrupt"],
  },
  {
    stateId: "smolen-invoke-hearts",
    parentId: "smolen-scope",
    allowedParentTransitions: ["smolen-opponent-interrupt", "nt-opened-opponent-interrupt", "nt-opened-pass"],
    transitions: [],
    submachineRef: {
      machineId: "smolen-continuation",
      returnTarget: "terminal",
    },
    entryEffects: {
      setAgreedStrain: { type: "suit", suit: "hearts", confidence: "tentative" },
      setForcingState: ForcingState.GameForcing,
    },
  },
  {
    stateId: "smolen-invoke-spades",
    parentId: "smolen-scope",
    allowedParentTransitions: ["smolen-opponent-interrupt", "nt-opened-opponent-interrupt", "nt-opened-pass"],
    transitions: [],
    submachineRef: {
      machineId: "smolen-continuation",
      returnTarget: "terminal",
    },
    entryEffects: {
      setAgreedStrain: { type: "suit", suit: "spades", confidence: "tentative" },
      setForcingState: ForcingState.GameForcing,
    },
  },
];

// ─── Submachine ──────────────────────────────────────────────

export function createSmolenSubmachine(): ConversationMachine {
  const states: MachineState[] = [
    {
      stateId: "smolen-wait",
      parentId: null,
      transitions: [
        {
          transitionId: "smolen-wait-pass-hearts",
          match: { kind: "pass" },
          target: "opener-place-hearts",
          guard: (snapshot) => snapshot.agreedStrain.suit === "hearts",
        },
        {
          transitionId: "smolen-wait-pass-spades",
          match: { kind: "pass" },
          target: "opener-place-spades",
          guard: (snapshot) => snapshot.agreedStrain.suit === "spades",
        },
        {
          transitionId: "smolen-wait-interference",
          match: { kind: "opponent-action" },
          target: "smolen-contested",
        },
      ],
    },
    {
      stateId: "opener-place-hearts",
      parentId: null,
      surfaceGroupId: "opener-smolen-hearts",
      transitions: [
        {
          transitionId: "place-hearts-bid",
          match: { kind: "any-bid" },
          target: "smolen-done",
        },
        {
          transitionId: "place-hearts-pass",
          match: { kind: "pass" },
          target: "opener-place-hearts",
        },
      ],
      entryEffects: {
        setCaptain: "opener",
      },
    },
    {
      stateId: "opener-place-spades",
      parentId: null,
      surfaceGroupId: "opener-smolen-spades",
      transitions: [
        {
          transitionId: "place-spades-bid",
          match: { kind: "any-bid" },
          target: "smolen-done",
        },
        {
          transitionId: "place-spades-pass",
          match: { kind: "pass" },
          target: "opener-place-spades",
        },
      ],
      entryEffects: {
        setCaptain: "opener",
      },
    },
    {
      stateId: "smolen-done",
      parentId: null,
      transitions: [],
    },
    {
      stateId: "smolen-contested",
      parentId: null,
      transitions: [],
      surfaceGroupId: "smolen-contested",
      entryEffects: {
        setCompetitionMode: "Contested",
      },
    },
  ];

  return buildConversationMachine("smolen-continuation", states, "smolen-wait");
}

// ─── Facts ───────────────────────────────────────────────────

const SMOLEN_FACTS: readonly FactDefinition[] = [
  {
    id: "module.smolen.hasFiveHearts",
    layer: "module-derived",
    world: "acting-hand",
    description: "Hand has 5+ hearts (for 3H Smolen showing 5H)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.hearts"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.smolen.hasFiveSpades",
    layer: "module-derived",
    world: "acting-hand",
    description: "Hand has 5+ spades (for 3S Smolen showing 5S)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.smolen.hasFourSpades",
    layer: "module-derived",
    world: "acting-hand",
    description: "Hand has exactly 4 spades (needed for 3H Smolen: 4S+5H)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.smolen.hasFourHearts",
    layer: "module-derived",
    world: "acting-hand",
    description: "Hand has exactly 4 hearts (needed for 3S Smolen: 5S+4H)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.hearts"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.smolen.openerHasHeartFit",
    layer: "module-derived",
    world: "acting-hand",
    description: "Opener has 3+ hearts (heart fit for Smolen placement)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.hearts"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
  },
  {
    id: "module.smolen.openerHasSpadesFit",
    layer: "module-derived",
    world: "acting-hand",
    description: "Opener has 3+ spades (spade fit for Smolen placement)",
    valueType: "boolean",
    derivesFrom: ["hand.suitLength.spades"],
    constrainsDimensions: ["suitIdentity", "suitLength"],
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

// ─── Explanation entries ─────────────────────────────────────

const SMOLEN_EXPLANATION_ENTRIES: readonly ExplanationEntry[] = [
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
  {
    explanationId: "nt.smolen.staymanEntry5h4s",
    meaningId: "smolen:stayman-entry-5h4s",
    templateKey: "nt.smolen.staymanEntry5h4s.semantic",
    displayText: "Stayman 2♣ with 5 hearts + 4 spades, planning Smolen",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
  {
    explanationId: "nt.smolen.staymanEntry5s4h",
    meaningId: "smolen:stayman-entry-5s4h",
    templateKey: "nt.smolen.staymanEntry5s4h.semantic",
    displayText: "Stayman 2♣ with 5 spades + 4 hearts, planning Smolen",
    preferredLevel: "semantic",
    roles: ["pedagogical"],
  },
];

// ─── Pedagogical relations ───────────────────────────────────

const SMOLEN_PEDAGOGICAL_RELATIONS: readonly PedagogicalRelation[] = [
  {
    kind: "same-family",
    a: "smolen:bid-short-hearts",
    b: "smolen:bid-short-spades",
  },
  {
    kind: "same-family",
    a: "smolen:stayman-entry-5h4s",
    b: "smolen:stayman-entry-5s4h",
  },
];

// ─── Module assembly ─────────────────────────────────────────

const smolenSub = createSmolenSubmachine();

export const smolenModule = {
  moduleId: "smolen",

  entrySurfaces: SMOLEN_ENTRY_SURFACES,

  surfaceGroups: [
    { groupId: "responder-r3-after-stayman-2d", surfaces: SMOLEN_R3_SURFACES },
    { groupId: "opener-smolen-hearts", surfaces: OPENER_SMOLEN_HEARTS_SURFACES },
    { groupId: "opener-smolen-spades", surfaces: OPENER_SMOLEN_SPADES_SURFACES },
  ],

  entryTransitions: [],

  machineStates: SMOLEN_MACHINE_STATES,

  hookTransitions: SMOLEN_HOOK_TRANSITIONS,

  submachines: new Map([["smolen-continuation", smolenSub]]),

  facts: smolenFacts,

  explanationEntries: SMOLEN_EXPLANATION_ENTRIES,

  pedagogicalRelations: SMOLEN_PEDAGOGICAL_RELATIONS,
};
