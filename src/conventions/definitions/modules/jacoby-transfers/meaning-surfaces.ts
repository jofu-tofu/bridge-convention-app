import type { BidMeaning } from "../../../../core/contracts/meaning";
import type { SystemConfig } from "../../../../core/contracts/system-config";
import {
  SYSTEM_RESPONDER_WEAK_HAND,
  SYSTEM_RESPONDER_INVITE_VALUES,
  SYSTEM_RESPONDER_GAME_VALUES,
  SYSTEM_OPENER_NOT_MINIMUM,
} from "../../../../core/contracts/system-fact-vocabulary";
import { BidSuit } from "../../../../engine/types";
import { bid } from "../../../core/surface-helpers";
import { createSurface } from "../../../core/surface-builder";
import type { ModuleContext } from "../../../core/surface-builder";
import { TRANSFER_CLASSES, TRANSFER_R3_CLASSES, OPENER_PLACE_CLASSES } from "./semantic-classes";

// ─── Module context ──────────────────────────────────────────

const TRANSFER_CTX: ModuleContext = { moduleId: "jacoby-transfers" };

// ─── R1 surfaces ─────────────────────────────────────────────

export const TRANSFER_R1_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: "transfer:to-hearts",
    semanticClassId: TRANSFER_CLASSES.TO_HEARTS,
    encoding: bid(2, BidSuit.Diamonds),
    clauses: [
      {
        factId: "hand.suitLength.hearts",
        operator: "gte",
        value: 5,
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 1,
    sourceIntent: { type: "TransferToHearts", params: {} },
    disclosure: "announcement",
    teachingLabel: "Transfer to hearts",
  }, TRANSFER_CTX),

  createSurface({
    meaningId: "transfer:to-spades",
    semanticClassId: TRANSFER_CLASSES.TO_SPADES,
    encoding: bid(2, BidSuit.Hearts),
    clauses: [
      {
        factId: "hand.suitLength.spades",
        operator: "gte",
        value: 5,
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 0,
    sourceIntent: { type: "TransferToSpades", params: {} },
    disclosure: "announcement",
    teachingLabel: "Transfer to spades",
  }, TRANSFER_CTX),
];

// ─── Opener transfer accept surfaces ─────────────────────────

export const OPENER_TRANSFER_HEARTS_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: "transfer:accept",
    semanticClassId: TRANSFER_CLASSES.ACCEPT,
    encoding: bid(2, BidSuit.Hearts),
    clauses: [],
    band: "must",
    declarationOrder: 0,
    sourceIntent: { type: "AcceptTransfer", params: { suit: "hearts" } },
    disclosure: "standard",
    teachingLabel: "Accept transfer to hearts",
  }, TRANSFER_CTX),
];

export const OPENER_TRANSFER_SPADES_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: "transfer:accept-spades",
    semanticClassId: TRANSFER_CLASSES.ACCEPT_SPADES,
    encoding: bid(2, BidSuit.Spades),
    clauses: [],
    band: "must",
    declarationOrder: 0,
    sourceIntent: { type: "AcceptTransfer", params: { suit: "spades" } },
    disclosure: "standard",
    teachingLabel: "Accept transfer to spades",
  }, TRANSFER_CTX),
];

// ─── Transfer R3 surfaces ────────────────────────────────────

export function createTransferR3HeartsSurfaces(sys: SystemConfig): readonly BidMeaning[] {
  return [
  createSurface({
    meaningId: "transfer:signoff-hearts",
    semanticClassId: TRANSFER_R3_CLASSES.SIGNOFF,
    encoding: { type: "pass" },
    clauses: [
      {
        factId: SYSTEM_RESPONDER_WEAK_HAND,
        operator: "boolean",
        value: true,
        description: "Below invite threshold (weak hand, signoff)",
        isPublic: true,
      },
    ],
    band: "must",
    declarationOrder: 0,
    sourceIntent: { type: "Signoff", params: { suit: "hearts" } },
    disclosure: "natural",
    teachingLabel: "Pass (signoff in hearts)",
  }, TRANSFER_CTX),

  createSurface({
    meaningId: "transfer:game-hearts",
    semanticClassId: TRANSFER_R3_CLASSES.GAME_IN_MAJOR,
    encoding: bid(4, BidSuit.Hearts),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        description: `Game values opposite 1NT (${sys.responderThresholds.gameMin}+ HCP)`,
        isPublic: true,
      },
      {
        factId: "hand.suitLength.hearts",
        operator: "gte",
        value: 6,
        description: "6+ hearts (game in major with guaranteed fit)",
        isPublic: true,
      },
    ],
    band: "must",
    declarationOrder: 1,
    sourceIntent: { type: "GameInMajor", params: { suit: "hearts" } },
    disclosure: "alert",
    teachingLabel: "4H game",
  }, TRANSFER_CTX),

  createSurface({
    meaningId: "transfer:nt-game-hearts",
    semanticClassId: TRANSFER_R3_CLASSES.NT_GAME,
    encoding: bid(3, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        description: `Game values opposite 1NT (${sys.responderThresholds.gameMin}+ HCP)`,
        isPublic: true,
      },
      {
        factId: "hand.suitLength.hearts",
        operator: "eq",
        value: 5,
        description: "Exactly 5 hearts (offer 3NT as alternative to 4H)",
        isPublic: true,
      },
      {
        factId: "bridge.hasShortage",
        operator: "boolean",
        value: false,
        description: "No singleton or void (balanced enough for NT)",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 2,
    sourceIntent: { type: "TransferNTGame", params: { suit: "hearts" } },
    disclosure: "alert",
    teachingLabel: "3NT (5 hearts, let opener choose)",
  }, TRANSFER_CTX),

  createSurface({
    meaningId: "transfer:invite-raise-hearts",
    semanticClassId: TRANSFER_R3_CLASSES.INVITE_RAISE,
    encoding: bid(3, BidSuit.Hearts),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_INVITE_VALUES,
        operator: "boolean",
        value: true,
        description: `Invite values opposite 1NT (${sys.responderThresholds.inviteMin}-${sys.responderThresholds.inviteMax} HCP)`,
        isPublic: true,
      },
      {
        factId: "hand.suitLength.hearts",
        operator: "gte",
        value: 6,
        description: "6+ hearts (invite in major with long suit)",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 3,
    sourceIntent: { type: "InviteRaise", params: { suit: "hearts" } },
    disclosure: "alert",
    teachingLabel: "3H invite (6+ hearts)",
  }, TRANSFER_CTX),

  createSurface({
    meaningId: "transfer:invite-hearts",
    semanticClassId: TRANSFER_R3_CLASSES.INVITE,
    encoding: bid(2, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_INVITE_VALUES,
        operator: "boolean",
        value: true,
        description: `Invite values opposite 1NT (${sys.responderThresholds.inviteMin}-${sys.responderThresholds.inviteMax} HCP)`,
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 4,
    sourceIntent: { type: "Invite", params: { suit: "hearts" } },
    disclosure: "alert",
    teachingLabel: "2NT invite",
  }, TRANSFER_CTX),
  ];
}

export function createTransferR3SpadesSurfaces(sys: SystemConfig): readonly BidMeaning[] {
  return [
  createSurface({
    meaningId: "transfer:signoff-spades",
    semanticClassId: TRANSFER_R3_CLASSES.SIGNOFF,
    encoding: { type: "pass" },
    clauses: [
      {
        factId: SYSTEM_RESPONDER_WEAK_HAND,
        operator: "boolean",
        value: true,
        description: "Below invite threshold (weak hand, signoff)",
        isPublic: true,
      },
    ],
    band: "must",
    declarationOrder: 0,
    sourceIntent: { type: "Signoff", params: { suit: "spades" } },
    disclosure: "natural",
    teachingLabel: "Pass (signoff in spades)",
  }, TRANSFER_CTX),

  createSurface({
    meaningId: "transfer:game-spades",
    semanticClassId: TRANSFER_R3_CLASSES.GAME_IN_MAJOR,
    encoding: bid(4, BidSuit.Spades),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        description: `Game values opposite 1NT (${sys.responderThresholds.gameMin}+ HCP)`,
        isPublic: true,
      },
      {
        factId: "hand.suitLength.spades",
        operator: "gte",
        value: 6,
        description: "6+ spades (game in major with guaranteed fit)",
        isPublic: true,
      },
    ],
    band: "must",
    declarationOrder: 1,
    sourceIntent: { type: "GameInMajor", params: { suit: "spades" } },
    disclosure: "alert",
    teachingLabel: "4S game",
  }, TRANSFER_CTX),

  createSurface({
    meaningId: "transfer:nt-game-spades",
    semanticClassId: TRANSFER_R3_CLASSES.NT_GAME,
    encoding: bid(3, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_GAME_VALUES,
        operator: "boolean",
        value: true,
        description: `Game values opposite 1NT (${sys.responderThresholds.gameMin}+ HCP)`,
        isPublic: true,
      },
      {
        factId: "hand.suitLength.spades",
        operator: "eq",
        value: 5,
        description: "Exactly 5 spades (offer 3NT as alternative to 4S)",
        isPublic: true,
      },
      {
        factId: "bridge.hasShortage",
        operator: "boolean",
        value: false,
        description: "No singleton or void (balanced enough for NT)",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 2,
    sourceIntent: { type: "TransferNTGame", params: { suit: "spades" } },
    disclosure: "alert",
    teachingLabel: "3NT (5 spades, let opener choose)",
  }, TRANSFER_CTX),

  createSurface({
    meaningId: "transfer:invite-raise-spades",
    semanticClassId: TRANSFER_R3_CLASSES.INVITE_RAISE,
    encoding: bid(3, BidSuit.Spades),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_INVITE_VALUES,
        operator: "boolean",
        value: true,
        description: `Invite values opposite 1NT (${sys.responderThresholds.inviteMin}-${sys.responderThresholds.inviteMax} HCP)`,
        isPublic: true,
      },
      {
        factId: "hand.suitLength.spades",
        operator: "gte",
        value: 6,
        description: "6+ spades (invite in major with long suit)",
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 3,
    sourceIntent: { type: "InviteRaise", params: { suit: "spades" } },
    disclosure: "alert",
    teachingLabel: "3S invite (6+ spades)",
  }, TRANSFER_CTX),

  createSurface({
    meaningId: "transfer:invite-spades",
    semanticClassId: TRANSFER_R3_CLASSES.INVITE,
    encoding: bid(2, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_RESPONDER_INVITE_VALUES,
        operator: "boolean",
        value: true,
        description: `Invite values opposite 1NT (${sys.responderThresholds.inviteMin}-${sys.responderThresholds.inviteMax} HCP)`,
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 4,
    sourceIntent: { type: "Invite", params: { suit: "spades" } },
    disclosure: "alert",
    teachingLabel: "2NT invite",
  }, TRANSFER_CTX),
  ];
}

// ─── Opener placement surfaces (after responder's 3NT "let opener choose") ──

export const OPENER_PLACE_HEARTS_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: "transfer:correct-to-4h",
    semanticClassId: OPENER_PLACE_CLASSES.CORRECT_TO_MAJOR,
    encoding: bid(4, BidSuit.Hearts),
    clauses: [
      {
        factId: "module.transfer.openerHasHeartFit",
        operator: "boolean",
        value: true,
        description: "Opener has 3+ hearts (fit with responder's 5)",
        isPublic: true,
      },
    ],
    band: "must",
    declarationOrder: 0,
    sourceIntent: { type: "PlacementCorrection", params: { suit: "hearts" } },
    disclosure: "alert",
    teachingLabel: "4H (heart fit found)",
  }, TRANSFER_CTX),
  createSurface({
    meaningId: "transfer:pass-3nt-hearts",
    semanticClassId: OPENER_PLACE_CLASSES.PASS_3NT,
    encoding: { type: "pass" },
    clauses: [
      {
        factId: "module.transfer.openerHasHeartFit",
        operator: "boolean",
        value: false,
        description: "Opener has fewer than 3 hearts (no fit)",
        isPublic: true,
      },
    ],
    band: "must",
    declarationOrder: 1,
    sourceIntent: { type: "PlacementPass", params: { suit: "hearts" } },
    disclosure: "alert",
    teachingLabel: "Pass (stay in 3NT, no heart fit)",
  }, TRANSFER_CTX),
];

export const OPENER_PLACE_SPADES_SURFACES: readonly BidMeaning[] = [
  createSurface({
    meaningId: "transfer:correct-to-4s",
    semanticClassId: OPENER_PLACE_CLASSES.CORRECT_TO_MAJOR,
    encoding: bid(4, BidSuit.Spades),
    clauses: [
      {
        factId: "module.transfer.openerHasSpadesFit",
        operator: "boolean",
        value: true,
        description: "Opener has 3+ spades (fit with responder's 5)",
        isPublic: true,
      },
    ],
    band: "must",
    declarationOrder: 0,
    sourceIntent: { type: "PlacementCorrection", params: { suit: "spades" } },
    disclosure: "alert",
    teachingLabel: "4S (spade fit found)",
  }, TRANSFER_CTX),
  createSurface({
    meaningId: "transfer:pass-3nt-spades",
    semanticClassId: OPENER_PLACE_CLASSES.PASS_3NT,
    encoding: { type: "pass" },
    clauses: [
      {
        factId: "module.transfer.openerHasSpadesFit",
        operator: "boolean",
        value: false,
        description: "Opener has fewer than 3 spades (no fit)",
        isPublic: true,
      },
    ],
    band: "must",
    declarationOrder: 1,
    sourceIntent: { type: "PlacementPass", params: { suit: "spades" } },
    disclosure: "alert",
    teachingLabel: "Pass (stay in 3NT, no spade fit)",
  }, TRANSFER_CTX),
];

// ─── Opener invite acceptance surfaces (after responder's 2NT invite) ──

export function createOpenerAcceptInviteHeartsSurfaces(sys: SystemConfig): readonly BidMeaning[] {
  return [
  createSurface({
    meaningId: "transfer:accept-invite-hearts",
    semanticClassId: OPENER_PLACE_CLASSES.ACCEPT_INVITE,
    encoding: bid(3, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: true,
        description: `Opener has ${sys.openerRebid.notMinimum}-${sys.ntOpening.maxHcp} HCP (not minimum)`,
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 0,
    sourceIntent: { type: "AcceptInvite", params: {} },
    disclosure: "alert",
    teachingLabel: "3NT (accept invite)",
  }, TRANSFER_CTX),
  createSurface({
    meaningId: "transfer:decline-invite-hearts",
    semanticClassId: OPENER_PLACE_CLASSES.DECLINE_INVITE,
    encoding: { type: "pass" },
    clauses: [
      {
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: false,
        description: `Opener has ${sys.ntOpening.minHcp} HCP (minimum)`,
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 1,
    sourceIntent: { type: "DeclineInvite", params: {} },
    disclosure: "alert",
    teachingLabel: "Pass (decline invite, minimum)",
  }, TRANSFER_CTX),
  ];
}

export function createOpenerAcceptInviteSpadesSurfaces(sys: SystemConfig): readonly BidMeaning[] {
  return [
  createSurface({
    meaningId: "transfer:accept-invite-spades",
    semanticClassId: OPENER_PLACE_CLASSES.ACCEPT_INVITE,
    encoding: bid(3, BidSuit.NoTrump),
    clauses: [
      {
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: true,
        description: `Opener has ${sys.openerRebid.notMinimum}-${sys.ntOpening.maxHcp} HCP (not minimum)`,
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 0,
    sourceIntent: { type: "AcceptInvite", params: {} },
    disclosure: "alert",
    teachingLabel: "3NT (accept invite)",
  }, TRANSFER_CTX),
  createSurface({
    meaningId: "transfer:decline-invite-spades",
    semanticClassId: OPENER_PLACE_CLASSES.DECLINE_INVITE,
    encoding: { type: "pass" },
    clauses: [
      {
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: false,
        description: `Opener has ${sys.ntOpening.minHcp} HCP (minimum)`,
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 1,
    sourceIntent: { type: "DeclineInvite", params: {} },
    disclosure: "alert",
    teachingLabel: "Pass (decline invite, minimum)",
  }, TRANSFER_CTX),
  ];
}

// ─── Opener invite-raise acceptance surfaces (after responder's 3M invite raise) ──
// After 3H/3S (6+ cards, invitational), opener knows there's a guaranteed
// major fit (opener has 2-3+ in the suit from 1NT balanced). Accept = 4M, decline = Pass.

export function createOpenerAcceptInviteRaiseHeartsSurfaces(sys: SystemConfig): readonly BidMeaning[] {
  return [
  createSurface({
    meaningId: "transfer:accept-invite-raise-hearts",
    semanticClassId: OPENER_PLACE_CLASSES.ACCEPT_INVITE,
    encoding: bid(4, BidSuit.Hearts),
    clauses: [
      {
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: true,
        description: `Opener has ${sys.openerRebid.notMinimum}-${sys.ntOpening.maxHcp} HCP (not minimum)`,
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 0,
    sourceIntent: { type: "AcceptInvite", params: { suit: "hearts" } },
    disclosure: "alert",
    teachingLabel: "4H (accept invite, heart fit guaranteed)",
  }, TRANSFER_CTX),
  createSurface({
    meaningId: "transfer:decline-invite-raise-hearts",
    semanticClassId: OPENER_PLACE_CLASSES.DECLINE_INVITE,
    encoding: { type: "pass" },
    clauses: [
      {
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: false,
        description: `Opener has ${sys.ntOpening.minHcp} HCP (minimum)`,
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 1,
    sourceIntent: { type: "DeclineInvite", params: {} },
    disclosure: "alert",
    teachingLabel: "Pass (decline invite, minimum)",
  }, TRANSFER_CTX),
  ];
}

export function createOpenerAcceptInviteRaiseSpadesSurfaces(sys: SystemConfig): readonly BidMeaning[] {
  return [
  createSurface({
    meaningId: "transfer:accept-invite-raise-spades",
    semanticClassId: OPENER_PLACE_CLASSES.ACCEPT_INVITE,
    encoding: bid(4, BidSuit.Spades),
    clauses: [
      {
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: true,
        description: `Opener has ${sys.openerRebid.notMinimum}-${sys.ntOpening.maxHcp} HCP (not minimum)`,
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 0,
    sourceIntent: { type: "AcceptInvite", params: { suit: "spades" } },
    disclosure: "alert",
    teachingLabel: "4S (accept invite, spade fit guaranteed)",
  }, TRANSFER_CTX),
  createSurface({
    meaningId: "transfer:decline-invite-raise-spades",
    semanticClassId: OPENER_PLACE_CLASSES.DECLINE_INVITE,
    encoding: { type: "pass" },
    clauses: [
      {
        factId: SYSTEM_OPENER_NOT_MINIMUM,
        operator: "boolean",
        value: false,
        description: `Opener has ${sys.ntOpening.minHcp} HCP (minimum)`,
        isPublic: true,
      },
    ],
    band: "should",
    declarationOrder: 1,
    sourceIntent: { type: "DeclineInvite", params: {} },
    disclosure: "alert",
    teachingLabel: "Pass (decline invite, minimum)",
  }, TRANSFER_CTX),
  ];
}
