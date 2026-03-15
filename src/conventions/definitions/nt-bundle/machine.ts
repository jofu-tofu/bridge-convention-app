import { BidSuit } from "../../../engine/types";
import { ForcingState } from "../../../core/contracts/bidding";
import type {
  ConversationMachine,
  MachineState,
} from "../../core/runtime/machine-types";
import { buildConversationMachine } from "../../core/runtime/machine-types";

/**
 * Create the 1NT Conversation Machine.
 *
 * State hierarchy:
 *   idle → nt-opened (on partner 1NT)
 *   nt-opened (root for interference handling)
 *     responder-r1 → opener-stayman / opener-transfer-hearts / opener-transfer-spades / terminal
 *     opener-stayman → responder-r3-stayman-2h / 2s / 2d
 *     opener-transfer-hearts → responder-r3-transfer-hearts
 *     opener-transfer-spades → responder-r3-transfer-spades
 *     smolen-invoke-hearts → [submachine: smolen-continuation] → terminal
 *     smolen-invoke-spades → [submachine: smolen-continuation] → terminal
 *     nt-contested (on opponent double)
 *     terminal (auction done)
 */
export function createNtConversationMachine(): ConversationMachine {
  const states: MachineState[] = [
    // idle: waiting for 1NT opening
    {
      stateId: "idle",
      parentId: null,
      transitions: [
        {
          transitionId: "idle-to-nt-opened",
          match: { kind: "call", level: 1, strain: BidSuit.NoTrump },
          target: "nt-opened",
        },
      ],
    },

    // nt-opened: 1NT has been bid, handles interference at this level
    {
      stateId: "nt-opened",
      parentId: null,
      transitions: [
        {
          transitionId: "nt-opened-opponent-double",
          match: { kind: "opponent-action", callType: "double" },
          target: "nt-contested",
        },
        {
          transitionId: "nt-opened-pass",
          match: { kind: "pass" },
          target: "responder-r1",
        },
      ],
    },

    // responder-r1: responder's first response to 1NT
    {
      stateId: "responder-r1",
      parentId: "nt-opened",
      transitions: [
        {
          transitionId: "r1-stayman",
          match: { kind: "call", level: 2, strain: BidSuit.Clubs },
          target: "opener-stayman",
        },
        {
          transitionId: "r1-transfer-hearts",
          match: { kind: "call", level: 2, strain: BidSuit.Diamonds },
          target: "opener-transfer-hearts",
        },
        {
          transitionId: "r1-transfer-spades",
          match: { kind: "call", level: 2, strain: BidSuit.Hearts },
          target: "opener-transfer-spades",
        },
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
      ],
      surfaceGroupId: "responder-r1",
      entryEffects: {
        setCaptain: "responder",
      },
    },

    // opener-stayman: opener responds to Stayman 2C
    {
      stateId: "opener-stayman",
      parentId: "nt-opened",
      transitions: [
        {
          transitionId: "stayman-pass",
          match: { kind: "pass" },
          target: "opener-stayman", // stay — waiting for opener's response
        },
        {
          transitionId: "stayman-2h",
          match: { kind: "call", level: 2, strain: BidSuit.Hearts },
          target: "responder-r3-stayman-2h",
        },
        {
          transitionId: "stayman-2s",
          match: { kind: "call", level: 2, strain: BidSuit.Spades },
          target: "responder-r3-stayman-2s",
        },
        {
          transitionId: "stayman-2d",
          match: { kind: "call", level: 2, strain: BidSuit.Diamonds },
          target: "responder-r3-stayman-2d",
        },
      ],
      surfaceGroupId: "opener-stayman-response",
      entryEffects: {
        setObligation: { kind: "ShowMajor", obligatedSide: "opener" },
      },
    },

    // opener-transfer-hearts: opener accepts heart transfer
    {
      stateId: "opener-transfer-hearts",
      parentId: "nt-opened",
      transitions: [
        {
          transitionId: "transfer-h-pass",
          match: { kind: "pass" },
          target: "opener-transfer-hearts", // stay — waiting for opener
        },
        {
          transitionId: "transfer-h-accept",
          match: { kind: "call", level: 2, strain: BidSuit.Hearts },
          target: "responder-r3-transfer-hearts",
        },
      ],
      surfaceGroupId: "opener-transfer-accept",
      entryEffects: {
        setAgreedStrain: {
          type: "suit",
          suit: "hearts",
          confidence: "tentative",
        },
      },
    },

    // opener-transfer-spades: opener accepts spade transfer
    {
      stateId: "opener-transfer-spades",
      parentId: "nt-opened",
      transitions: [
        {
          transitionId: "transfer-s-pass",
          match: { kind: "pass" },
          target: "opener-transfer-spades", // stay — waiting for opener
        },
        {
          transitionId: "transfer-s-accept",
          match: { kind: "call", level: 2, strain: BidSuit.Spades },
          target: "responder-r3-transfer-spades",
        },
      ],
      surfaceGroupId: "opener-transfer-accept-spades",
      entryEffects: {
        setAgreedStrain: {
          type: "suit",
          suit: "spades",
          confidence: "tentative",
        },
      },
    },

    // R3 states — responder's continuation after opener's response
    {
      stateId: "responder-r3-stayman-2h",
      parentId: "nt-opened",
      transitions: [],
      surfaceGroupId: "responder-r3-after-stayman-2h",
    },
    {
      stateId: "responder-r3-stayman-2s",
      parentId: "nt-opened",
      transitions: [],
      surfaceGroupId: "responder-r3-after-stayman-2s",
    },
    {
      stateId: "responder-r3-stayman-2d",
      parentId: "nt-opened",
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
        {
          transitionId: "r3-3nt-after-denial",
          match: { kind: "call", level: 3, strain: BidSuit.NoTrump },
          target: "terminal",
        },
        {
          transitionId: "r3-2nt-after-denial",
          match: { kind: "call", level: 2, strain: BidSuit.NoTrump },
          target: "terminal",
        },
        {
          transitionId: "r3-pass-wait",
          match: { kind: "pass" },
          target: "responder-r3-stayman-2d", // self-loop: consume opponent pass before responder acts
        },
      ],
      surfaceGroupId: "responder-r3-after-stayman-2d",
    },
    {
      stateId: "responder-r3-transfer-hearts",
      parentId: "nt-opened",
      transitions: [],
      surfaceGroupId: "responder-r3-after-transfer-hearts",
    },
    {
      stateId: "responder-r3-transfer-spades",
      parentId: "nt-opened",
      transitions: [],
      surfaceGroupId: "responder-r3-after-transfer-spades",
    },

    // Smolen invocation: 3H = 4S + 5H → invoke submachine with hearts agreed
    {
      stateId: "smolen-invoke-hearts",
      parentId: "nt-opened",
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

    // Smolen invocation: 3S = 5S + 4H → invoke submachine with spades agreed
    {
      stateId: "smolen-invoke-spades",
      parentId: "nt-opened",
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

    // terminal: auction is done for this convention
    {
      stateId: "terminal",
      parentId: "nt-opened",
      transitions: [],
    },

    // nt-contested: opponent doubled/interfered
    {
      stateId: "nt-contested",
      parentId: "nt-opened",
      transitions: [],
      entryEffects: {
        setCompetitionMode: "Doubled",
      },
    },
  ];

  return buildConversationMachine("nt-conversation", states);
}

/**
 * Smolen continuation submachine.
 *
 * Invoked after responder bids 3H or 3S Smolen.
 * The parent sets agreedStrain via entry effects before invocation.
 * Uses guard functions to route to the correct opener placement surfaces
 * based on the agreed strain in the registers.
 *
 * State flow:
 *   smolen-wait → (opponent pass) → opener-place-hearts OR opener-place-spades
 *   smolen-wait → (opponent interference) → smolen-contested
 *   opener-place-* → (any bid/pass) → smolen-done (terminal, auto-returns)
 */
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
          target: "opener-place-hearts", // self-loop for opponent pass
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
          target: "opener-place-spades", // self-loop for opponent pass
        },
      ],
      entryEffects: {
        setCaptain: "opener",
      },
    },
    {
      stateId: "smolen-done",
      parentId: null,
      transitions: [], // terminal — triggers submachine return
    },
    {
      stateId: "smolen-contested",
      parentId: null,
      transitions: [],
      entryEffects: {
        setCompetitionMode: "Contested",
      },
    },
  ];

  return buildConversationMachine("smolen-continuation", states, "smolen-wait");
}
