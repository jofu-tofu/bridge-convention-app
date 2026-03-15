import { BidSuit } from "../../../engine/types";
import type {
  ConversationMachine,
  MachineState,
} from "../../core/runtime/machine-types";
import { buildConversationMachine } from "../../core/runtime/machine-types";

/**
 * Create the Weak Two Bids Conversation Machine.
 *
 * State hierarchy (flat — no parent states):
 *   idle → weak-two-opened-{h,s,d} (on 2H / 2S / 2D)
 *
 *   weak-two-opened-{suit} → responder-r2-{suit} (on opponent pass)
 *                           → weak-two-contested (on opponent double/overcall)
 *
 *   R2 — responder actions:
 *     responder-r2-{suit} → terminal (on game raise / invite / pass)
 *                         → ogust-response-{suit} (on 2NT Ogust ask)
 *
 *   R3 — opener Ogust response:
 *     ogust-response-{suit} → ogust-response-{suit} (pass self-loop)
 *                            → terminal (on any Ogust response bid)
 *
 *   terminal / weak-two-contested (end states)
 *
 * 12 states total.
 */
export function createWeakTwoConversationMachine(): ConversationMachine {
  const states: MachineState[] = [
    // ─── idle ────────────────────────────────────────────────────
    {
      stateId: "idle",
      parentId: null,
      transitions: [
        {
          transitionId: "idle-to-weak-two-opened-h",
          match: { kind: "call", level: 2, strain: BidSuit.Hearts },
          target: "weak-two-opened-h",
        },
        {
          transitionId: "idle-to-weak-two-opened-s",
          match: { kind: "call", level: 2, strain: BidSuit.Spades },
          target: "weak-two-opened-s",
        },
        {
          transitionId: "idle-to-weak-two-opened-d",
          match: { kind: "call", level: 2, strain: BidSuit.Diamonds },
          target: "weak-two-opened-d",
        },
      ],
      surfaceGroupId: "opener-r1",
    },

    // ─── weak-two-opened: waiting for opponent pass or interference ─
    {
      stateId: "weak-two-opened-h",
      parentId: null,
      transitions: [
        {
          transitionId: "opened-h-opponent-double",
          match: { kind: "opponent-action", callType: "double" },
          target: "weak-two-contested",
        },
        {
          transitionId: "opened-h-opponent-bid",
          match: { kind: "opponent-action", callType: "bid" },
          target: "weak-two-contested",
        },
        {
          transitionId: "opened-h-pass-to-responder",
          match: { kind: "pass" },
          target: "responder-r2-h",
        },
      ],
    },
    {
      stateId: "weak-two-opened-s",
      parentId: null,
      transitions: [
        {
          transitionId: "opened-s-opponent-double",
          match: { kind: "opponent-action", callType: "double" },
          target: "weak-two-contested",
        },
        {
          transitionId: "opened-s-opponent-bid",
          match: { kind: "opponent-action", callType: "bid" },
          target: "weak-two-contested",
        },
        {
          transitionId: "opened-s-pass-to-responder",
          match: { kind: "pass" },
          target: "responder-r2-s",
        },
      ],
    },
    {
      stateId: "weak-two-opened-d",
      parentId: null,
      transitions: [
        {
          transitionId: "opened-d-opponent-double",
          match: { kind: "opponent-action", callType: "double" },
          target: "weak-two-contested",
        },
        {
          transitionId: "opened-d-opponent-bid",
          match: { kind: "opponent-action", callType: "bid" },
          target: "weak-two-contested",
        },
        {
          transitionId: "opened-d-pass-to-responder",
          match: { kind: "pass" },
          target: "responder-r2-d",
        },
      ],
    },

    // ─── R2: responder actions ──────────────────────────────────
    {
      stateId: "responder-r2-h",
      parentId: null,
      transitions: [
        {
          transitionId: "r2-h-game-raise",
          match: { kind: "call", level: 4, strain: BidSuit.Hearts },
          target: "terminal",
        },
        {
          transitionId: "r2-h-ogust-ask",
          match: { kind: "call", level: 2, strain: BidSuit.NoTrump },
          target: "ogust-response-h",
        },
        {
          transitionId: "r2-h-invite-raise",
          match: { kind: "call", level: 3, strain: BidSuit.Hearts },
          target: "terminal",
        },
        {
          transitionId: "r2-h-pass",
          match: { kind: "pass" },
          target: "terminal",
        },
      ],
      surfaceGroupId: "responder-r2-hearts",
      entryEffects: {
        setCaptain: "responder",
      },
    },
    {
      stateId: "responder-r2-s",
      parentId: null,
      transitions: [
        {
          transitionId: "r2-s-game-raise",
          match: { kind: "call", level: 4, strain: BidSuit.Spades },
          target: "terminal",
        },
        {
          transitionId: "r2-s-ogust-ask",
          match: { kind: "call", level: 2, strain: BidSuit.NoTrump },
          target: "ogust-response-s",
        },
        {
          transitionId: "r2-s-invite-raise",
          match: { kind: "call", level: 3, strain: BidSuit.Spades },
          target: "terminal",
        },
        {
          transitionId: "r2-s-pass",
          match: { kind: "pass" },
          target: "terminal",
        },
      ],
      surfaceGroupId: "responder-r2-spades",
      entryEffects: {
        setCaptain: "responder",
      },
    },
    {
      stateId: "responder-r2-d",
      parentId: null,
      transitions: [
        {
          transitionId: "r2-d-game-raise",
          match: { kind: "call", level: 5, strain: BidSuit.Diamonds },
          target: "terminal",
        },
        {
          transitionId: "r2-d-ogust-ask",
          match: { kind: "call", level: 2, strain: BidSuit.NoTrump },
          target: "ogust-response-d",
        },
        {
          transitionId: "r2-d-invite-raise",
          match: { kind: "call", level: 3, strain: BidSuit.Diamonds },
          target: "terminal",
        },
        {
          transitionId: "r2-d-pass",
          match: { kind: "pass" },
          target: "terminal",
        },
      ],
      surfaceGroupId: "responder-r2-diamonds",
      entryEffects: {
        setCaptain: "responder",
      },
    },

    // ─── Ogust response: opener describes hand ──────────────────
    {
      stateId: "ogust-response-h",
      parentId: null,
      transitions: [
        {
          transitionId: "ogust-h-pass",
          match: { kind: "pass" },
          target: "ogust-response-h", // self-loop for opponent/partner pass
        },
        {
          transitionId: "ogust-h-any-bid",
          match: { kind: "any-bid" },
          target: "terminal",
        },
      ],
      surfaceGroupId: "ogust-response-hearts",
      entryEffects: {
        setCaptain: "opener",
      },
    },
    {
      stateId: "ogust-response-s",
      parentId: null,
      transitions: [
        {
          transitionId: "ogust-s-pass",
          match: { kind: "pass" },
          target: "ogust-response-s",
        },
        {
          transitionId: "ogust-s-any-bid",
          match: { kind: "any-bid" },
          target: "terminal",
        },
      ],
      surfaceGroupId: "ogust-response-spades",
      entryEffects: {
        setCaptain: "opener",
      },
    },
    {
      stateId: "ogust-response-d",
      parentId: null,
      transitions: [
        {
          transitionId: "ogust-d-pass",
          match: { kind: "pass" },
          target: "ogust-response-d",
        },
        {
          transitionId: "ogust-d-any-bid",
          match: { kind: "any-bid" },
          target: "terminal",
        },
      ],
      surfaceGroupId: "ogust-response-diamonds",
      entryEffects: {
        setCaptain: "opener",
      },
    },

    // ─── End states ─────────────────────────────────────────────
    {
      stateId: "terminal",
      parentId: null,
      transitions: [],
    },
    {
      stateId: "weak-two-contested",
      parentId: null,
      transitions: [],
      entryEffects: {
        setCompetitionMode: "Contested",
      },
    },
  ];

  return buildConversationMachine("weak-two-conversation", states);
}
