import { BidSuit } from "../../../engine/types";
import type {
  ConversationMachine,
  MachineState,
} from "../../core/runtime/machine-types";
import { buildConversationMachine } from "../../core/runtime/machine-types";

/**
 * Create the DONT (Disturb Opponents' No Trump) Conversation Machine.
 *
 * State hierarchy (hierarchical — uses parent state for inherited transitions):
 *
 *   idle → overcaller-r1  (on 1NT — system profile restricts to opponent's 1NT)
 *
 *   dont-active (ABSTRACT PARENT — provides inherited interference transitions):
 *     └─ All child states inherit:
 *        • opponent double → dont-contested
 *        • opponent bid    → dont-contested
 *
 *   Overcaller R1 — DONT action selection (South overcalls opponent's 1NT):
 *     overcaller-r1 → wait-advancer-{2h,2d,2c,2s}  (natural or two-suited overcall)
 *                   → wait-advancer-double            (one-suited hand via double)
 *                   → terminal                        (pass — no DONT action)
 *
 *   Wait states — opponent (West) passes through:
 *     wait-advancer-{suit}   → advancer-after-{suit}
 *     wait-advancer-double   → advancer-after-double
 *
 *   Advancer responses (North):
 *     advancer-after-2h     → terminal               (accept hearts / prefer spades / escape)
 *     advancer-after-2d     → wait-2d-relay           (2H relay asks for major)
 *                           → terminal
 *     advancer-after-2c     → wait-2c-relay           (2D relay asks for higher suit)
 *                           → terminal
 *     advancer-after-2s     → terminal               (accept spades / escape)
 *     advancer-after-double → wait-reveal             (2C relay — mandatory)
 *                           → terminal               (own suit escape)
 *
 *   Relay resolution — overcaller reveals:
 *     wait-reveal       → overcaller-reveal
 *     wait-2d-relay     → overcaller-2d-relay
 *     wait-2c-relay     → overcaller-2c-relay
 *
 *     overcaller-reveal     → terminal  (pass = clubs, or bid actual suit)
 *     overcaller-2d-relay   → terminal  (pass = hearts at 2H level, 2S = spades)
 *     overcaller-2c-relay   → terminal  (pass = diamonds at 2D level, 2H/2S = that major)
 *
 *   terminal / dont-contested (end states)
 *
 * 21 states total. First convention to use:
 *   - Hierarchical parent/child states with inherited transitions
 *   - Predicate transitions (for matching doubles on overcaller-r1)
 *   - Multi-stage relay (overcaller → advancer → overcaller reveal)
 */
export function createDontConversationMachine(): ConversationMachine {
  const states: MachineState[] = [
    // ─── idle ────────────────────────────────────────────────────
    {
      stateId: "idle",
      parentId: null,
      transitions: [
        {
          transitionId: "idle-to-overcaller-r1",
          match: { kind: "call", level: 1, strain: BidSuit.NoTrump },
          target: "overcaller-r1",
        },
      ],
    },

    // ─── dont-active: abstract parent with inherited interference ─
    // All child states inherit these opponent-interference transitions.
    // No surfaceGroupId — this is an abstract container for inheritance only.
    {
      stateId: "dont-active",
      parentId: null,
      transitions: [
        {
          transitionId: "opp-double",
          match: { kind: "opponent-action", callType: "double" },
          target: "dont-contested",
        },
        {
          transitionId: "opp-bid",
          match: { kind: "opponent-action", callType: "bid" },
          target: "dont-contested",
        },
      ],
    },

    // ─── Overcaller R1: DONT action selection ────────────────────
    {
      stateId: "overcaller-r1",
      parentId: "dont-active",
      surfaceGroupId: "overcaller-r1",
      entryEffects: {
        setCompetitionMode: "Contested",
      },
      transitions: [
        {
          transitionId: "r1-2h",
          match: { kind: "call", level: 2, strain: BidSuit.Hearts },
          target: "wait-advancer-2h",
        },
        {
          transitionId: "r1-2d",
          match: { kind: "call", level: 2, strain: BidSuit.Diamonds },
          target: "wait-advancer-2d",
        },
        {
          transitionId: "r1-2c",
          match: { kind: "call", level: 2, strain: BidSuit.Clubs },
          target: "wait-advancer-2c",
        },
        {
          transitionId: "r1-2s",
          match: { kind: "call", level: 2, strain: BidSuit.Spades },
          target: "wait-advancer-2s",
        },
        {
          transitionId: "r1-double",
          match: {
            kind: "predicate",
            test: (call, _seat, _snapshot) => call.type === "double",
          },
          target: "wait-advancer-double",
        },
        {
          transitionId: "r1-pass",
          match: { kind: "pass" },
          target: "terminal",
        },
      ],
    },

    // ─── Wait states: opponent (West) passes through ─────────────
    {
      stateId: "wait-advancer-2h",
      parentId: "dont-active",
      transitions: [
        {
          transitionId: "wait-2h-pass",
          match: { kind: "pass" },
          target: "advancer-after-2h",
        },
      ],
    },
    {
      stateId: "wait-advancer-2d",
      parentId: "dont-active",
      transitions: [
        {
          transitionId: "wait-2d-pass",
          match: { kind: "pass" },
          target: "advancer-after-2d",
        },
      ],
    },
    {
      stateId: "wait-advancer-2c",
      parentId: "dont-active",
      transitions: [
        {
          transitionId: "wait-2c-pass",
          match: { kind: "pass" },
          target: "advancer-after-2c",
        },
      ],
    },
    {
      stateId: "wait-advancer-2s",
      parentId: "dont-active",
      transitions: [
        {
          transitionId: "wait-2s-pass",
          match: { kind: "pass" },
          target: "advancer-after-2s",
        },
      ],
    },
    {
      stateId: "wait-advancer-double",
      parentId: "dont-active",
      transitions: [
        {
          transitionId: "wait-dbl-pass",
          match: { kind: "pass" },
          target: "advancer-after-double",
        },
      ],
    },

    // ─── Advancer responses (North) ──────────────────────────────
    {
      stateId: "advancer-after-2h",
      parentId: "dont-active",
      surfaceGroupId: "advancer-after-2h",
      entryEffects: {
        setCaptain: "responder",
      },
      transitions: [
        {
          transitionId: "adv-2h-pass",
          match: { kind: "pass" },
          target: "terminal",
        },
        {
          transitionId: "adv-2h-2s",
          match: { kind: "call", level: 2, strain: BidSuit.Spades },
          target: "terminal",
        },
        {
          transitionId: "adv-2h-2nt",
          match: { kind: "call", level: 2, strain: BidSuit.NoTrump },
          target: "terminal",
        },
        {
          transitionId: "adv-2h-3c",
          match: { kind: "call", level: 3, strain: BidSuit.Clubs },
          target: "terminal",
        },
        {
          transitionId: "adv-2h-3d",
          match: { kind: "call", level: 3, strain: BidSuit.Diamonds },
          target: "terminal",
        },
        {
          transitionId: "adv-2h-any",
          match: { kind: "any-bid" },
          target: "terminal",
        },
      ],
    },
    {
      stateId: "advancer-after-2d",
      parentId: "dont-active",
      surfaceGroupId: "advancer-after-2d",
      entryEffects: {
        setCaptain: "responder",
      },
      transitions: [
        {
          transitionId: "adv-2d-pass",
          match: { kind: "pass" },
          target: "terminal",
        },
        {
          transitionId: "adv-2d-2h-relay",
          match: { kind: "call", level: 2, strain: BidSuit.Hearts },
          target: "wait-2d-relay",
        },
        {
          transitionId: "adv-2d-any",
          match: { kind: "any-bid" },
          target: "terminal",
        },
      ],
    },
    {
      stateId: "advancer-after-2c",
      parentId: "dont-active",
      surfaceGroupId: "advancer-after-2c",
      entryEffects: {
        setCaptain: "responder",
      },
      transitions: [
        {
          transitionId: "adv-2c-pass",
          match: { kind: "pass" },
          target: "terminal",
        },
        {
          transitionId: "adv-2c-2d-relay",
          match: { kind: "call", level: 2, strain: BidSuit.Diamonds },
          target: "wait-2c-relay",
        },
        {
          transitionId: "adv-2c-any",
          match: { kind: "any-bid" },
          target: "terminal",
        },
      ],
    },
    {
      stateId: "advancer-after-2s",
      parentId: "dont-active",
      surfaceGroupId: "advancer-after-2s",
      entryEffects: {
        setCaptain: "responder",
      },
      transitions: [
        {
          transitionId: "adv-2s-pass",
          match: { kind: "pass" },
          target: "terminal",
        },
        {
          transitionId: "adv-2s-any",
          match: { kind: "any-bid" },
          target: "terminal",
        },
      ],
    },
    {
      stateId: "advancer-after-double",
      parentId: "dont-active",
      surfaceGroupId: "advancer-after-double",
      entryEffects: {
        setCaptain: "responder",
      },
      transitions: [
        {
          transitionId: "adv-dbl-2c-relay",
          match: { kind: "call", level: 2, strain: BidSuit.Clubs },
          target: "wait-reveal",
        },
        {
          transitionId: "adv-dbl-pass",
          match: { kind: "pass" },
          target: "terminal",
        },
        {
          transitionId: "adv-dbl-any",
          match: { kind: "any-bid" },
          target: "terminal",
        },
      ],
    },

    // ─── Relay wait states (East passes through) ─────────────────
    {
      stateId: "wait-reveal",
      parentId: "dont-active",
      transitions: [
        {
          transitionId: "wait-reveal-pass",
          match: { kind: "pass" },
          target: "overcaller-reveal",
        },
      ],
    },
    {
      stateId: "wait-2d-relay",
      parentId: "dont-active",
      transitions: [
        {
          transitionId: "wait-2d-relay-pass",
          match: { kind: "pass" },
          target: "overcaller-2d-relay",
        },
      ],
    },
    {
      stateId: "wait-2c-relay",
      parentId: "dont-active",
      transitions: [
        {
          transitionId: "wait-2c-relay-pass",
          match: { kind: "pass" },
          target: "overcaller-2c-relay",
        },
      ],
    },

    // ─── Overcaller reveal / relay response ──────────────────────
    {
      stateId: "overcaller-reveal",
      parentId: "dont-active",
      surfaceGroupId: "overcaller-reveal",
      entryEffects: {
        setCaptain: "opener",
      },
      transitions: [
        {
          transitionId: "reveal-pass",
          match: { kind: "pass" },
          target: "terminal",
        },
        {
          transitionId: "reveal-any",
          match: { kind: "any-bid" },
          target: "terminal",
        },
      ],
    },
    {
      stateId: "overcaller-2d-relay",
      parentId: "dont-active",
      surfaceGroupId: "overcaller-2d-relay",
      entryEffects: {
        setCaptain: "opener",
      },
      transitions: [
        {
          transitionId: "2d-relay-pass",
          match: { kind: "pass" },
          target: "terminal",
        },
        {
          transitionId: "2d-relay-2s",
          match: { kind: "call", level: 2, strain: BidSuit.Spades },
          target: "terminal",
        },
        {
          transitionId: "2d-relay-any",
          match: { kind: "any-bid" },
          target: "terminal",
        },
      ],
    },
    {
      stateId: "overcaller-2c-relay",
      parentId: "dont-active",
      surfaceGroupId: "overcaller-2c-relay",
      entryEffects: {
        setCaptain: "opener",
      },
      transitions: [
        {
          transitionId: "2c-relay-pass",
          match: { kind: "pass" },
          target: "terminal",
        },
        {
          transitionId: "2c-relay-2h",
          match: { kind: "call", level: 2, strain: BidSuit.Hearts },
          target: "terminal",
        },
        {
          transitionId: "2c-relay-2s",
          match: { kind: "call", level: 2, strain: BidSuit.Spades },
          target: "terminal",
        },
        {
          transitionId: "2c-relay-any",
          match: { kind: "any-bid" },
          target: "terminal",
        },
      ],
    },

    // ─── End states ─────────────────────────────────────────────
    {
      stateId: "terminal",
      parentId: null,
      transitions: [],
    },
    {
      stateId: "dont-contested",
      parentId: null,
      transitions: [],
      entryEffects: {
        setCompetitionMode: "Doubled",
      },
    },
  ];

  return buildConversationMachine("dont-conversation", states, "idle");
}
