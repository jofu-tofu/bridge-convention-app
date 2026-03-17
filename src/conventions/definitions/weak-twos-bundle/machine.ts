import { BidSuit } from "../../../engine/types";
import type {
  ConversationMachine,
  MachineState,
} from "../../core/runtime/machine-types";
import { buildConversationMachine } from "../../core/runtime/machine-types";

/**
 * Create the Weak Two Bids Conversation Machine.
 *
 * State hierarchy (scoped interrupt pattern):
 *   idle → weak-two-opened-{h,s,d} (on 2H / 2S / 2D)
 *
 *   weak-two-active (abstract scope parent — opponent-action inherited by all children)
 *     ├─ weak-two-opened-{suit} → responder-r2-{suit} (on opponent pass)
 *     ├─ responder-r2-{suit} → terminal (on game raise / invite / pass)
 *     │                      → ogust-response-{suit} (on 2NT Ogust ask)
 *     ├─ ogust-response-{suit} → terminal (on any Ogust response bid)
 *     └─ weak-two-contested (end state for interference)
 *
 *   terminal (end state, no parent — exempt from coverage)
 *
 * 13 states total.
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

    // ─── Scope parent: opponent-action inherited by all active children ─
    {
      stateId: "weak-two-active",
      parentId: null,
      transitions: [
        {
          transitionId: "weak-two-opponent-double",
          match: { kind: "opponent-action", callType: "double" },
          target: "weak-two-contested",
        },
        {
          transitionId: "weak-two-opponent-bid",
          match: { kind: "opponent-action", callType: "bid" },
          target: "weak-two-contested",
        },
      ],
    },

    // ─── weak-two-opened: waiting for opponent pass or interference ─
    {
      stateId: "weak-two-opened-h",
      parentId: "weak-two-active",
      allowedParentTransitions: ["weak-two-opponent-double", "weak-two-opponent-bid"],
      transitions: [
        {
          transitionId: "opened-h-pass-to-responder",
          match: { kind: "pass" },
          target: "responder-r2-h",
        },
      ],
    },
    {
      stateId: "weak-two-opened-s",
      parentId: "weak-two-active",
      allowedParentTransitions: ["weak-two-opponent-double", "weak-two-opponent-bid"],
      transitions: [
        {
          transitionId: "opened-s-pass-to-responder",
          match: { kind: "pass" },
          target: "responder-r2-s",
        },
      ],
    },
    {
      stateId: "weak-two-opened-d",
      parentId: "weak-two-active",
      allowedParentTransitions: ["weak-two-opponent-double", "weak-two-opponent-bid"],
      transitions: [
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
      parentId: "weak-two-active",
      allowedParentTransitions: ["weak-two-opponent-double", "weak-two-opponent-bid"],
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
      parentId: "weak-two-active",
      allowedParentTransitions: ["weak-two-opponent-double", "weak-two-opponent-bid"],
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
      parentId: "weak-two-active",
      allowedParentTransitions: ["weak-two-opponent-double", "weak-two-opponent-bid"],
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
      parentId: "weak-two-active",
      allowedParentTransitions: ["weak-two-opponent-double", "weak-two-opponent-bid"],
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
      parentId: "weak-two-active",
      allowedParentTransitions: ["weak-two-opponent-double", "weak-two-opponent-bid"],
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
      parentId: "weak-two-active",
      allowedParentTransitions: ["weak-two-opponent-double", "weak-two-opponent-bid"],
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
      parentId: "weak-two-active",
      allowedParentTransitions: ["weak-two-opponent-double", "weak-two-opponent-bid"],
      transitions: [
        {
          transitionId: "weak-two-contested-absorb",
          match: { kind: "pass" },
          target: "weak-two-contested",
        },
      ],
      surfaceGroupId: "weak-two-interrupted",
      entryEffects: {
        setCompetitionMode: "Contested",
      },
    },
  ];

  return buildConversationMachine("weak-two-conversation", states);
}
