/**
 * 1NT BaseTrackSpec — protocol-frame representation of the 1NT response system.
 *
 * Converts the old skeleton + module composition (BundleSkeleton / ConventionModule)
 * into a single, flat BaseTrackSpec for the protocol frame architecture.
 *
 * This file is additive — it does NOT replace the existing module system.
 */

import type {
  BaseModuleSpec,
  FrameStateSpec,
  SurfaceFragment,
} from "../../core/protocol/types";
import type { FactCatalogExtension } from "../../../core/contracts/fact-catalog";
import type { MeaningSurface } from "../../../core/contracts/meaning";
import { BidSuit } from "../../../engine/types";
import type { SystemConfig } from "../../../core/contracts/system-config";
import { SAYC_SYSTEM_CONFIG } from "../../../core/contracts/system-config";
import { createSystemFactCatalog } from "../../core/pipeline/system-fact-catalog";

// ── Module surface and fact imports ──────────────────────────────────

import {
  OPENER_1NT_SURFACE,
  ntResponseFacts,
  createNtResponseFacts,
  naturalNtModule,
  createNaturalNtModule,
} from "../modules/natural-nt";
import {
  OPENER_STAYMAN_SURFACES,
  STAYMAN_R3_AFTER_2H_SURFACES,
  STAYMAN_R3_AFTER_2S_SURFACES,
  INTERFERENCE_REDOUBLE_SURFACE,
  staymanFacts,
  createStaymanFacts,
  staymanModule,
  createStaymanModule,
} from "../modules/stayman";
import {
  OPENER_TRANSFER_HEARTS_SURFACES,
  OPENER_TRANSFER_SPADES_SURFACES,
  TRANSFER_R3_HEARTS_SURFACES,
  TRANSFER_R3_SPADES_SURFACES,
  OPENER_PLACE_HEARTS_SURFACES,
  OPENER_PLACE_SPADES_SURFACES,
  OPENER_ACCEPT_INVITE_HEARTS_SURFACES,
  OPENER_ACCEPT_INVITE_SPADES_SURFACES,
  transferFacts,
  createTransferFacts,
  jacobyTransfersModule,
  createJacobyTransfersModule,
} from "../modules/jacoby-transfers";
import {
  OPENER_SMOLEN_HEARTS_SURFACES,
  OPENER_SMOLEN_SPADES_SURFACES,
  smolenFacts,
  smolenModule,
  createSmolenModule,
} from "../modules/smolen";
import {
  RESPONDER_SURFACES,
  STAYMAN_R3_AFTER_2D_SURFACES,
} from "./composed-surfaces";
import { NT_PEDAGOGICAL_RELATIONS } from "./pedagogical-relations";

// ── Surface Fragments ────────────────────────────────────────────────

const BASE_LAYER_PRIORITY = 100;

function fragment(
  id: string,
  surfaces: readonly MeaningSurface[],
): SurfaceFragment {
  return {
    id,
    relation: "compete",
    layerPriority: BASE_LAYER_PRIORITY,
    actionCoverage: "all",
    surfaces,
  };
}

const terminalPassSurfaces: readonly MeaningSurface[] =
  naturalNtModule.surfaceGroups.find((g) => g.groupId === "terminal-pass")
    ?.surfaces ?? [];

/** All surface fragments contributed by the 1NT base track. */
export const NT_SURFACE_FRAGMENTS: Readonly<Record<string, SurfaceFragment>> = {
  "sf:opener-1nt": fragment("sf:opener-1nt", OPENER_1NT_SURFACE),
  "sf:responder-r1": fragment("sf:responder-r1", RESPONDER_SURFACES),
  "sf:opener-stayman-response": fragment(
    "sf:opener-stayman-response",
    OPENER_STAYMAN_SURFACES,
  ),
  "sf:responder-r3-after-stayman-2h": fragment(
    "sf:responder-r3-after-stayman-2h",
    STAYMAN_R3_AFTER_2H_SURFACES,
  ),
  "sf:responder-r3-after-stayman-2s": fragment(
    "sf:responder-r3-after-stayman-2s",
    STAYMAN_R3_AFTER_2S_SURFACES,
  ),
  "sf:responder-r3-after-stayman-2d": fragment(
    "sf:responder-r3-after-stayman-2d",
    STAYMAN_R3_AFTER_2D_SURFACES,
  ),
  "sf:opener-transfer-accept": fragment(
    "sf:opener-transfer-accept",
    OPENER_TRANSFER_HEARTS_SURFACES,
  ),
  "sf:opener-transfer-accept-spades": fragment(
    "sf:opener-transfer-accept-spades",
    OPENER_TRANSFER_SPADES_SURFACES,
  ),
  "sf:responder-r3-after-transfer-hearts": fragment(
    "sf:responder-r3-after-transfer-hearts",
    TRANSFER_R3_HEARTS_SURFACES,
  ),
  "sf:responder-r3-after-transfer-spades": fragment(
    "sf:responder-r3-after-transfer-spades",
    TRANSFER_R3_SPADES_SURFACES,
  ),
  "sf:opener-smolen-hearts": fragment(
    "sf:opener-smolen-hearts",
    OPENER_SMOLEN_HEARTS_SURFACES,
  ),
  "sf:opener-smolen-spades": fragment(
    "sf:opener-smolen-spades",
    OPENER_SMOLEN_SPADES_SURFACES,
  ),
  "sf:terminal-pass": fragment("sf:terminal-pass", terminalPassSurfaces),
  "sf:opener-place-after-transfer-hearts": fragment(
    "sf:opener-place-after-transfer-hearts",
    OPENER_PLACE_HEARTS_SURFACES,
  ),
  "sf:opener-place-after-transfer-spades": fragment(
    "sf:opener-place-after-transfer-spades",
    OPENER_PLACE_SPADES_SURFACES,
  ),
  "sf:opener-accept-invite-hearts": fragment(
    "sf:opener-accept-invite-hearts",
    OPENER_ACCEPT_INVITE_HEARTS_SURFACES,
  ),
  "sf:opener-accept-invite-spades": fragment(
    "sf:opener-accept-invite-spades",
    OPENER_ACCEPT_INVITE_SPADES_SURFACES,
  ),
  "sf:nt-interrupted": fragment("sf:nt-interrupted", [
    INTERFERENCE_REDOUBLE_SURFACE,
  ]),
};

// ── Merged Facts ─────────────────────────────────────────────────────

const systemFacts = createSystemFactCatalog(SAYC_SYSTEM_CONFIG);

const mergedFacts: FactCatalogExtension = {
  definitions: [
    ...systemFacts.definitions,
    ...ntResponseFacts.definitions,
    ...staymanFacts.definitions,
    ...transferFacts.definitions,
    ...smolenFacts.definitions,
  ],
  evaluators: new Map([
    ...systemFacts.evaluators,
    ...ntResponseFacts.evaluators,
    ...staymanFacts.evaluators,
    ...transferFacts.evaluators,
    ...smolenFacts.evaluators,
  ]),
  posteriorEvaluators: staymanFacts.posteriorEvaluators,
};

/** Factory: creates merged facts parameterized by system config. */
export function createMergedFacts(sys: SystemConfig): FactCatalogExtension {
  const sysFacts = createSystemFactCatalog(sys);
  const ntFacts = createNtResponseFacts(sys);
  const stFacts = createStaymanFacts(sys);
  const trFacts = createTransferFacts(sys);
  return {
    definitions: [
      ...sysFacts.definitions,
      ...ntFacts.definitions,
      ...stFacts.definitions,
      ...trFacts.definitions,
      ...smolenFacts.definitions,
    ],
    evaluators: new Map([
      ...sysFacts.evaluators,
      ...ntFacts.evaluators,
      ...stFacts.evaluators,
      ...trFacts.evaluators,
      ...smolenFacts.evaluators,
    ]),
    posteriorEvaluators: stFacts.posteriorEvaluators,
  };
}

// ── Merged Explanation Entries ────────────────────────────────────────

const mergedExplanationEntries = [
  ...naturalNtModule.explanationEntries,
  ...staymanModule.explanationEntries,
  ...jacobyTransfersModule.explanationEntries,
  ...smolenModule.explanationEntries,
];

// ── State Definitions ────────────────────────────────────────────────
//
// Flat FSM — the old hierarchical scope states (stayman-scope, etc.)
// are removed; their opponent-interrupt transitions are distributed
// directly to each child state.

const states: Readonly<Record<string, FrameStateSpec>> = {

  // ─── Core skeleton states ──────────────────────────────────

  "nt-opened": {
    id: "nt-opened",
    eventTransitions: [
      {
        transitionId: "nt-opened-pass",
        when: { callType: "pass" },
        goto: "responder-r1",
      },
      {
        transitionId: "nt-opened-opponent-interrupt",
        when: { actor: "opponent" },
        goto: "nt-contested",
      },
    ],
  },

  "responder-r1": {
    id: "responder-r1",
    surface: "sf:responder-r1",
    exportTags: ["agreement.pending"],
    onEnter: [
      { op: "setReg", path: "captain.side", value: "responder" },
    ],
    eventTransitions: [
      // Stayman
      {
        transitionId: "r1-stayman",
        when: { call: { type: "bid", level: 2, strain: BidSuit.Clubs } },
        goto: "opener-stayman",
      },
      // Jacoby transfer to hearts (bid 2D)
      {
        transitionId: "r1-transfer-hearts",
        when: { call: { type: "bid", level: 2, strain: BidSuit.Diamonds } },
        goto: "opener-transfer-hearts",
      },
      // Jacoby transfer to spades (bid 2H)
      {
        transitionId: "r1-transfer-spades",
        when: { call: { type: "bid", level: 2, strain: BidSuit.Hearts } },
        goto: "opener-transfer-spades",
      },
      // Natural 3NT
      {
        transitionId: "r1-3nt",
        when: { call: { type: "bid", level: 3, strain: BidSuit.NoTrump } },
        goto: "terminal",
      },
      // Natural 2NT invite
      {
        transitionId: "r1-2nt",
        when: { call: { type: "bid", level: 2, strain: BidSuit.NoTrump } },
        goto: "terminal",
      },
      // Pass (sign off)
      {
        transitionId: "r1-pass",
        when: { callType: "pass" },
        goto: "terminal",
      },
      // Opponent interference (inherited from nt-opened parent)
      {
        transitionId: "r1-opponent-interrupt",
        when: { actor: "opponent" },
        goto: "nt-contested",
      },
    ],
  },

  "terminal": {
    id: "terminal",
    surface: "sf:terminal-pass",
    eventTransitions: [
      {
        transitionId: "terminal-absorb",
        when: { callType: "pass" },
        goto: "STAY",
      },
    ],
  },

  "nt-contested": {
    id: "nt-contested",
    surface: "sf:nt-interrupted",
    onEnter: [
      { op: "setReg", path: "competition.mode", value: "doubled" },
    ],
    eventTransitions: [
      {
        transitionId: "contested-absorb",
        when: { callType: "pass" },
        goto: "STAY",
      },
    ],
  },

  // ─── Stayman states ────────────────────────────────────────

  "opener-stayman": {
    id: "opener-stayman",
    surface: "sf:opener-stayman-response",
    exportTags: ["agreement.pending"],
    onEnter: [
      { op: "setReg", path: "obligation.kind", value: "ShowMajor" },
      { op: "setReg", path: "obligation.side", value: "opener" },
    ],
    eventTransitions: [
      {
        transitionId: "stayman-2h",
        when: { call: { type: "bid", level: 2, strain: BidSuit.Hearts } },
        goto: "responder-r3-stayman-2h",
      },
      {
        transitionId: "stayman-2s",
        when: { call: { type: "bid", level: 2, strain: BidSuit.Spades } },
        goto: "responder-r3-stayman-2s",
      },
      {
        transitionId: "stayman-2d",
        when: { call: { type: "bid", level: 2, strain: BidSuit.Diamonds } },
        goto: "responder-r3-stayman-2d",
      },
      {
        transitionId: "stayman-pass",
        when: { callType: "pass" },
        goto: "STAY",
      },
      {
        transitionId: "stayman-opponent-interrupt",
        when: { actor: "opponent" },
        goto: "stayman-interrupted",
      },
    ],
  },

  "responder-r3-stayman-2h": {
    id: "responder-r3-stayman-2h",
    surface: "sf:responder-r3-after-stayman-2h",
    exportTags: ["agreement.pending"],
    eventTransitions: [
      {
        transitionId: "r3-4h-game",
        when: { call: { type: "bid", level: 4, strain: BidSuit.Hearts } },
        goto: "terminal",
      },
      {
        transitionId: "r3-3h-invite",
        when: { call: { type: "bid", level: 3, strain: BidSuit.Hearts } },
        goto: "terminal",
      },
      {
        transitionId: "r3-3nt-no-fit",
        when: { call: { type: "bid", level: 3, strain: BidSuit.NoTrump } },
        goto: "terminal",
      },
      {
        transitionId: "r3-2nt-invite-no-fit",
        when: { call: { type: "bid", level: 2, strain: BidSuit.NoTrump } },
        goto: "terminal",
      },
      {
        transitionId: "r3-self-pass-2h",
        when: { actor: "self", callType: "pass" },
        goto: "terminal",
      },
      {
        transitionId: "r3-opp-pass-wait-2h",
        when: { actor: "opponent", callType: "pass" },
        goto: "STAY",
      },
      {
        transitionId: "r3-partner-pass-2h",
        when: { actor: "partner", callType: "pass" },
        goto: "terminal",
      },
      {
        transitionId: "r3-2h-opponent-interrupt",
        when: { actor: "opponent" },
        goto: "stayman-interrupted",
      },
    ],
  },

  "responder-r3-stayman-2s": {
    id: "responder-r3-stayman-2s",
    surface: "sf:responder-r3-after-stayman-2s",
    exportTags: ["agreement.pending"],
    eventTransitions: [
      {
        transitionId: "r3-4s-game",
        when: { call: { type: "bid", level: 4, strain: BidSuit.Spades } },
        goto: "terminal",
      },
      {
        transitionId: "r3-3s-invite",
        when: { call: { type: "bid", level: 3, strain: BidSuit.Spades } },
        goto: "terminal",
      },
      {
        transitionId: "r3-3nt-no-fit-s",
        when: { call: { type: "bid", level: 3, strain: BidSuit.NoTrump } },
        goto: "terminal",
      },
      {
        transitionId: "r3-2nt-invite-no-fit-s",
        when: { call: { type: "bid", level: 2, strain: BidSuit.NoTrump } },
        goto: "terminal",
      },
      {
        transitionId: "r3-self-pass-2s",
        when: { actor: "self", callType: "pass" },
        goto: "terminal",
      },
      {
        transitionId: "r3-opp-pass-wait-2s",
        when: { actor: "opponent", callType: "pass" },
        goto: "STAY",
      },
      {
        transitionId: "r3-partner-pass-2s",
        when: { actor: "partner", callType: "pass" },
        goto: "terminal",
      },
      {
        transitionId: "r3-2s-opponent-interrupt",
        when: { actor: "opponent" },
        goto: "stayman-interrupted",
      },
    ],
  },

  "responder-r3-stayman-2d": {
    id: "responder-r3-stayman-2d",
    surface: "sf:responder-r3-after-stayman-2d",
    exportTags: ["agreement.pending"],
    eventTransitions: [
      // Smolen hook transitions (3H/3S → Smolen invocation)
      {
        transitionId: "r3-smolen-hearts",
        when: { call: { type: "bid", level: 3, strain: BidSuit.Hearts } },
        goto: "smolen-invoke-hearts",
      },
      {
        transitionId: "r3-smolen-spades",
        when: { call: { type: "bid", level: 3, strain: BidSuit.Spades } },
        goto: "smolen-invoke-spades",
      },
      // Stayman denial continuations
      {
        transitionId: "r3-3nt-after-denial",
        when: { call: { type: "bid", level: 3, strain: BidSuit.NoTrump } },
        goto: "terminal",
      },
      {
        transitionId: "r3-2nt-after-denial",
        when: { call: { type: "bid", level: 2, strain: BidSuit.NoTrump } },
        goto: "terminal",
      },
      {
        transitionId: "r3-self-pass-2d",
        when: { actor: "self", callType: "pass" },
        goto: "terminal",
      },
      {
        transitionId: "r3-opp-pass-wait-2d",
        when: { actor: "opponent", callType: "pass" },
        goto: "STAY",
      },
      {
        transitionId: "r3-partner-pass-2d",
        when: { actor: "partner", callType: "pass" },
        goto: "terminal",
      },
      {
        transitionId: "r3-2d-opponent-interrupt",
        when: { actor: "opponent" },
        goto: "stayman-interrupted",
      },
    ],
  },

  "stayman-interrupted": {
    id: "stayman-interrupted",
    onEnter: [
      { op: "setReg", path: "competition.mode", value: "contested" },
    ],
    eventTransitions: [
      {
        transitionId: "stayman-interrupted-absorb",
        when: { callType: "pass" },
        goto: "STAY",
      },
    ],
  },

  // ─── Jacoby Transfer states ────────────────────────────────

  "opener-transfer-hearts": {
    id: "opener-transfer-hearts",
    surface: "sf:opener-transfer-accept",
    exportTags: ["agreement.tentative"],
    onEnter: [
      {
        op: "setReg",
        path: "agreement.strain",
        value: { type: "suit", suit: "hearts" },
      },
      { op: "setReg", path: "agreement.status", value: "tentative" },
    ],
    eventTransitions: [
      {
        transitionId: "transfer-h-accept",
        when: { call: { type: "bid", level: 2, strain: BidSuit.Hearts } },
        goto: "responder-r3-transfer-hearts",
      },
      {
        transitionId: "transfer-h-pass",
        when: { callType: "pass" },
        goto: "STAY",
      },
      {
        transitionId: "transfer-h-opponent-interrupt",
        when: { actor: "opponent" },
        goto: "transfers-interrupted",
      },
    ],
  },

  "opener-transfer-spades": {
    id: "opener-transfer-spades",
    surface: "sf:opener-transfer-accept-spades",
    exportTags: ["agreement.tentative"],
    onEnter: [
      {
        op: "setReg",
        path: "agreement.strain",
        value: { type: "suit", suit: "spades" },
      },
      { op: "setReg", path: "agreement.status", value: "tentative" },
    ],
    eventTransitions: [
      {
        transitionId: "transfer-s-accept",
        when: { call: { type: "bid", level: 2, strain: BidSuit.Spades } },
        goto: "responder-r3-transfer-spades",
      },
      {
        transitionId: "transfer-s-pass",
        when: { callType: "pass" },
        goto: "STAY",
      },
      {
        transitionId: "transfer-s-opponent-interrupt",
        when: { actor: "opponent" },
        goto: "transfers-interrupted",
      },
    ],
  },

  "responder-r3-transfer-hearts": {
    id: "responder-r3-transfer-hearts",
    surface: "sf:responder-r3-after-transfer-hearts",
    eventTransitions: [
      {
        transitionId: "r3-4h-game-t",
        when: { call: { type: "bid", level: 4, strain: BidSuit.Hearts } },
        goto: "terminal",
      },
      {
        transitionId: "r3-3nt-hearts",
        when: { call: { type: "bid", level: 3, strain: BidSuit.NoTrump } },
        goto: "opener-place-after-transfer-hearts",
      },
      {
        transitionId: "r3-2nt-invite-hearts",
        when: { call: { type: "bid", level: 2, strain: BidSuit.NoTrump } },
        goto: "opener-accept-invite-hearts",
      },
      {
        transitionId: "r3-self-pass-th",
        when: { actor: "self", callType: "pass" },
        goto: "terminal",
      },
      {
        transitionId: "r3-opp-pass-wait-th",
        when: { actor: "opponent", callType: "pass" },
        goto: "STAY",
      },
      {
        transitionId: "r3-partner-pass-th",
        when: { actor: "partner", callType: "pass" },
        goto: "terminal",
      },
      {
        transitionId: "r3-th-opponent-interrupt",
        when: { actor: "opponent" },
        goto: "transfers-interrupted",
      },
    ],
  },

  "responder-r3-transfer-spades": {
    id: "responder-r3-transfer-spades",
    surface: "sf:responder-r3-after-transfer-spades",
    eventTransitions: [
      {
        transitionId: "r3-4s-game-t",
        when: { call: { type: "bid", level: 4, strain: BidSuit.Spades } },
        goto: "terminal",
      },
      {
        transitionId: "r3-3nt-spades",
        when: { call: { type: "bid", level: 3, strain: BidSuit.NoTrump } },
        goto: "opener-place-after-transfer-spades",
      },
      {
        transitionId: "r3-2nt-invite-spades",
        when: { call: { type: "bid", level: 2, strain: BidSuit.NoTrump } },
        goto: "opener-accept-invite-spades",
      },
      {
        transitionId: "r3-self-pass-ts",
        when: { actor: "self", callType: "pass" },
        goto: "terminal",
      },
      {
        transitionId: "r3-opp-pass-wait-ts",
        when: { actor: "opponent", callType: "pass" },
        goto: "STAY",
      },
      {
        transitionId: "r3-partner-pass-ts",
        when: { actor: "partner", callType: "pass" },
        goto: "terminal",
      },
      {
        transitionId: "r3-ts-opponent-interrupt",
        when: { actor: "opponent" },
        goto: "transfers-interrupted",
      },
    ],
  },

  "transfers-interrupted": {
    id: "transfers-interrupted",
    onEnter: [
      { op: "setReg", path: "competition.mode", value: "contested" },
    ],
    eventTransitions: [
      {
        transitionId: "transfers-interrupted-absorb",
        when: { callType: "pass" },
        goto: "STAY",
      },
    ],
  },

  // ─── Opener placement after responder's 3NT ("let opener choose") ──

  "opener-place-after-transfer-hearts": {
    id: "opener-place-after-transfer-hearts",
    surface: "sf:opener-place-after-transfer-hearts",
    exportTags: ["agreement.final"],
    onEnter: [
      { op: "setReg", path: "captain.side", value: "opener" },
    ],
    eventTransitions: [
      {
        transitionId: "place-th-correct-4h",
        when: { call: { type: "bid", level: 4, strain: BidSuit.Hearts } },
        goto: "terminal",
      },
      {
        transitionId: "place-th-pass-3nt",
        when: { callType: "pass" },
        goto: "terminal",
      },
      {
        transitionId: "place-th-opponent-interrupt",
        when: { actor: "opponent" },
        goto: "transfers-interrupted",
      },
    ],
  },

  "opener-place-after-transfer-spades": {
    id: "opener-place-after-transfer-spades",
    surface: "sf:opener-place-after-transfer-spades",
    exportTags: ["agreement.final"],
    onEnter: [
      { op: "setReg", path: "captain.side", value: "opener" },
    ],
    eventTransitions: [
      {
        transitionId: "place-ts-correct-4s",
        when: { call: { type: "bid", level: 4, strain: BidSuit.Spades } },
        goto: "terminal",
      },
      {
        transitionId: "place-ts-pass-3nt",
        when: { callType: "pass" },
        goto: "terminal",
      },
      {
        transitionId: "place-ts-opponent-interrupt",
        when: { actor: "opponent" },
        goto: "transfers-interrupted",
      },
    ],
  },

  // ─── Opener invite acceptance after responder's 2NT ────────

  "opener-accept-invite-hearts": {
    id: "opener-accept-invite-hearts",
    surface: "sf:opener-accept-invite-hearts",
    exportTags: ["agreement.final"],
    onEnter: [
      { op: "setReg", path: "captain.side", value: "opener" },
    ],
    eventTransitions: [
      {
        transitionId: "accept-invite-h-3nt",
        when: { call: { type: "bid", level: 3, strain: BidSuit.NoTrump } },
        goto: "terminal",
      },
      {
        transitionId: "accept-invite-h-pass",
        when: { callType: "pass" },
        goto: "terminal",
      },
      {
        transitionId: "accept-invite-h-opponent-interrupt",
        when: { actor: "opponent" },
        goto: "transfers-interrupted",
      },
    ],
  },

  "opener-accept-invite-spades": {
    id: "opener-accept-invite-spades",
    surface: "sf:opener-accept-invite-spades",
    exportTags: ["agreement.final"],
    onEnter: [
      { op: "setReg", path: "captain.side", value: "opener" },
    ],
    eventTransitions: [
      {
        transitionId: "accept-invite-s-3nt",
        when: { call: { type: "bid", level: 3, strain: BidSuit.NoTrump } },
        goto: "terminal",
      },
      {
        transitionId: "accept-invite-s-pass",
        when: { callType: "pass" },
        goto: "terminal",
      },
      {
        transitionId: "accept-invite-s-opponent-interrupt",
        when: { actor: "opponent" },
        goto: "transfers-interrupted",
      },
    ],
  },

  // ─── Smolen states (inlined from submachine) ───────────────

  "smolen-invoke-hearts": {
    id: "smolen-invoke-hearts",
    exportTags: ["agreement.tentative"],
    onEnter: [
      {
        op: "setReg",
        path: "agreement.strain",
        value: { type: "suit", suit: "hearts" },
      },
      { op: "setReg", path: "agreement.status", value: "tentative" },
      { op: "setReg", path: "forcing.state", value: "game" },
    ],
    eventTransitions: [
      {
        transitionId: "smolen-h-pass",
        when: { callType: "pass" },
        goto: "opener-place-hearts",
      },
      {
        transitionId: "smolen-h-opponent-interrupt",
        when: { actor: "opponent" },
        goto: "smolen-interrupted",
      },
    ],
  },

  "smolen-invoke-spades": {
    id: "smolen-invoke-spades",
    exportTags: ["agreement.tentative"],
    onEnter: [
      {
        op: "setReg",
        path: "agreement.strain",
        value: { type: "suit", suit: "spades" },
      },
      { op: "setReg", path: "agreement.status", value: "tentative" },
      { op: "setReg", path: "forcing.state", value: "game" },
    ],
    eventTransitions: [
      {
        transitionId: "smolen-s-pass",
        when: { callType: "pass" },
        goto: "opener-place-spades",
      },
      {
        transitionId: "smolen-s-opponent-interrupt",
        when: { actor: "opponent" },
        goto: "smolen-interrupted",
      },
    ],
  },

  "opener-place-hearts": {
    id: "opener-place-hearts",
    surface: "sf:opener-smolen-hearts",
    exportTags: ["agreement.final"],
    onEnter: [
      { op: "setReg", path: "captain.side", value: "opener" },
    ],
    eventTransitions: [
      {
        transitionId: "place-hearts-bid",
        when: { callType: "bid" },
        goto: "terminal",
      },
      {
        transitionId: "place-hearts-pass",
        when: { callType: "pass" },
        goto: "STAY",
      },
      {
        transitionId: "place-hearts-opponent-interrupt",
        when: { actor: "opponent" },
        goto: "smolen-interrupted",
      },
    ],
  },

  "opener-place-spades": {
    id: "opener-place-spades",
    surface: "sf:opener-smolen-spades",
    exportTags: ["agreement.final"],
    onEnter: [
      { op: "setReg", path: "captain.side", value: "opener" },
    ],
    eventTransitions: [
      {
        transitionId: "place-spades-bid",
        when: { callType: "bid" },
        goto: "terminal",
      },
      {
        transitionId: "place-spades-pass",
        when: { callType: "pass" },
        goto: "STAY",
      },
      {
        transitionId: "place-spades-opponent-interrupt",
        when: { actor: "opponent" },
        goto: "smolen-interrupted",
      },
    ],
  },

  "smolen-interrupted": {
    id: "smolen-interrupted",
    onEnter: [
      { op: "setReg", path: "competition.mode", value: "contested" },
    ],
    eventTransitions: [
      {
        transitionId: "smolen-interrupted-absorb",
        when: { callType: "pass" },
        goto: "STAY",
      },
    ],
  },
};

// ── BaseTrackSpec Export ──────────────────────────────────────────────

/** The 1NT base track for the protocol frame architecture (SAYC defaults). */
export const ntBaseTrack: BaseModuleSpec = {
  role: "base" as const,
  id: "nt-1",
  name: "1NT Response System",

  openingPatterns: [
    {
      prefix: [{ call: { type: "bid", level: 1, strain: BidSuit.NoTrump } }],
      startState: "nt-opened",
    },
  ],

  openingSurface: "sf:opener-1nt",

  states,

  initialStateId: "nt-opened",

  facts: mergedFacts,

  explanationEntries: mergedExplanationEntries,

  pedagogicalRelations: NT_PEDAGOGICAL_RELATIONS,
};

/** Factory: creates the 1NT base track parameterized by system config. */
export function createNtBaseTrack(sys: SystemConfig): BaseModuleSpec {
  const configuredModules = {
    naturalNt: createNaturalNtModule(sys),
    stayman: createStaymanModule(sys),
    jacobyTransfers: createJacobyTransfersModule(sys),
    smolen: createSmolenModule(sys),
  };

  return {
    role: "base" as const,
    id: "nt-1",
    name: "1NT Response System",

    openingPatterns: [
      {
        prefix: [{ call: { type: "bid", level: 1, strain: BidSuit.NoTrump } }],
        startState: "nt-opened",
      },
    ],

    openingSurface: "sf:opener-1nt",

    states,

    initialStateId: "nt-opened",

    facts: createMergedFacts(sys),

    explanationEntries: [
      ...configuredModules.naturalNt.explanationEntries,
      ...configuredModules.stayman.explanationEntries,
      ...configuredModules.jacobyTransfers.explanationEntries,
      ...configuredModules.smolen.explanationEntries,
    ],

    pedagogicalRelations: NT_PEDAGOGICAL_RELATIONS,
  };
}
