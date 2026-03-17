import { BidSuit } from "../../../engine/types";
import type {
  ConversationMachine,
  MachineState,
} from "../../core/runtime/machine-types";
import { buildConversationMachine } from "../../core/runtime/machine-types";

/**
 * Create the Bergen Raises Conversation Machine.
 *
 * State hierarchy (hierarchical — uses bergen-active parent for inherited transitions):
 *   idle → major-opened-hearts / major-opened-spades (on partner 1H or 1S)
 *
 *   major-opened-hearts/spades → responder-r1 (on pass)
 *                               → bergen-contested (on opponent double/overcall)
 *
 *   R1 — responder bids Bergen raise:
 *     responder-r1-hearts/spades → opener-after-constructive (on 3C/3C)
 *                                → opener-after-limit (on 3D/3D)
 *                                → opener-after-preemptive (on 3H for hearts / 3S for spades)
 *                                → terminal (on splinter, game raise, or pass)
 *
 *   R2 — opener rebids:
 *     opener-after-constructive-hearts/spades → responder-after-game (on 4M)
 *                                             → responder-after-signoff (on 3M)
 *                                             → responder-after-game-try (on other bid)
 *     opener-after-limit-hearts/spades → responder-after-game (on 4M)
 *                                      → responder-after-signoff (on 3M)
 *                                      → responder-after-game-try (on other bid)
 *     opener-after-preemptive-hearts/spades → terminal (all paths)
 *
 *   R3 — responder continuation:
 *     responder-after-game → terminal (pass through opponent, then done)
 *     responder-after-signoff → terminal (pass through opponent, then done)
 *     responder-after-game-try-hearts/spades → opener-r4-accept (on bid)
 *
 *   R4 — opener accepts:
 *     opener-r4-accept → terminal (all paths)
 *
 *   terminal / bergen-contested (end states)
 */
export function createBergenConversationMachine(): ConversationMachine {
  const states: MachineState[] = [
    // ─── idle ────────────────────────────────────────────────────
    {
      stateId: "idle",
      parentId: null,
      transitions: [
        {
          transitionId: "idle-to-major-opened-hearts",
          match: { kind: "call", level: 1, strain: BidSuit.Hearts },
          target: "major-opened-hearts",
        },
        {
          transitionId: "idle-to-major-opened-spades",
          match: { kind: "call", level: 1, strain: BidSuit.Spades },
          target: "major-opened-spades",
        },
      ],
    },

    // ─── bergen-active: abstract parent with inherited interference ─
    // All child states inherit these opponent-interference transitions.
    // No surfaceGroupId — this is an abstract container for inheritance only.
    {
      stateId: "bergen-active",
      parentId: null,
      transitions: [
        {
          transitionId: "bergen-opponent-double",
          match: { kind: "opponent-action", callType: "double" },
          target: "bergen-contested",
        },
        {
          transitionId: "bergen-opponent-bid",
          match: { kind: "opponent-action", callType: "bid" },
          target: "bergen-contested",
        },
      ],
    },

    // ─── major-opened: waiting for opponent pass or interference ─
    {
      stateId: "major-opened-hearts",
      parentId: "bergen-active",
      allowedParentTransitions: ["bergen-opponent-double", "bergen-opponent-bid"],
      transitions: [
        {
          transitionId: "hearts-pass-to-responder",
          match: { kind: "pass" },
          target: "responder-r1-hearts",
        },
      ],
    },
    {
      stateId: "major-opened-spades",
      parentId: "bergen-active",
      allowedParentTransitions: ["bergen-opponent-double", "bergen-opponent-bid"],
      transitions: [
        {
          transitionId: "spades-pass-to-responder",
          match: { kind: "pass" },
          target: "responder-r1-spades",
        },
      ],
    },

    // ─── R1: responder bids Bergen raise ────────────────────────
    // Hearts: 3C=constructive, 3D=limit, 3H=preemptive, 3S=splinter, 4H=game
    {
      stateId: "responder-r1-hearts",
      parentId: "bergen-active",
      allowedParentTransitions: ["bergen-opponent-double", "bergen-opponent-bid"],
      transitions: [
        {
          transitionId: "r1-hearts-constructive",
          match: { kind: "call", level: 3, strain: BidSuit.Clubs },
          target: "opener-after-constructive-hearts",
        },
        {
          transitionId: "r1-hearts-limit",
          match: { kind: "call", level: 3, strain: BidSuit.Diamonds },
          target: "opener-after-limit-hearts",
        },
        {
          transitionId: "r1-hearts-preemptive",
          match: { kind: "call", level: 3, strain: BidSuit.Hearts },
          target: "opener-after-preemptive-hearts",
        },
        {
          transitionId: "r1-hearts-splinter",
          match: { kind: "call", level: 3, strain: BidSuit.Spades },
          target: "terminal",
        },
        {
          transitionId: "r1-hearts-game",
          match: { kind: "call", level: 4, strain: BidSuit.Hearts },
          target: "terminal",
        },
        {
          transitionId: "r1-hearts-pass",
          match: { kind: "pass" },
          target: "terminal",
        },
      ],
      surfaceGroupId: "responder-r1-hearts",
      entryEffects: {
        setCaptain: "responder",
      },
    },
    // Spades: 3C=constructive, 3D=limit, 3S=preemptive, 3H=splinter, 4S=game
    {
      stateId: "responder-r1-spades",
      parentId: "bergen-active",
      allowedParentTransitions: ["bergen-opponent-double", "bergen-opponent-bid"],
      transitions: [
        {
          transitionId: "r1-spades-constructive",
          match: { kind: "call", level: 3, strain: BidSuit.Clubs },
          target: "opener-after-constructive-spades",
        },
        {
          transitionId: "r1-spades-limit",
          match: { kind: "call", level: 3, strain: BidSuit.Diamonds },
          target: "opener-after-limit-spades",
        },
        {
          transitionId: "r1-spades-preemptive",
          match: { kind: "call", level: 3, strain: BidSuit.Spades },
          target: "opener-after-preemptive-spades",
        },
        {
          transitionId: "r1-spades-splinter",
          match: { kind: "call", level: 3, strain: BidSuit.Hearts },
          target: "terminal",
        },
        {
          transitionId: "r1-spades-game",
          match: { kind: "call", level: 4, strain: BidSuit.Spades },
          target: "terminal",
        },
        {
          transitionId: "r1-spades-pass",
          match: { kind: "pass" },
          target: "terminal",
        },
      ],
      surfaceGroupId: "responder-r1-spades",
      entryEffects: {
        setCaptain: "responder",
      },
    },

    // ─── R2: opener rebids ──────────────────────────────────────

    // After constructive (3C): opener decides game/try/signoff
    {
      stateId: "opener-after-constructive-hearts",
      parentId: "bergen-active",
      allowedParentTransitions: ["bergen-opponent-double", "bergen-opponent-bid"],
      transitions: [
        {
          transitionId: "constructive-hearts-pass",
          match: { kind: "pass" },
          target: "opener-after-constructive-hearts", // stay — waiting for opener through opponent pass
        },
        {
          transitionId: "constructive-hearts-game",
          match: { kind: "call", level: 4, strain: BidSuit.Hearts },
          target: "responder-after-game",
        },
        {
          transitionId: "constructive-hearts-signoff",
          match: { kind: "call", level: 3, strain: BidSuit.Hearts },
          target: "responder-after-signoff",
        },
        {
          transitionId: "constructive-hearts-game-try",
          match: { kind: "any-bid" },
          target: "responder-after-game-try-hearts",
        },
      ],
      surfaceGroupId: "opener-after-constructive-hearts",
      entryEffects: {
        setCaptain: "opener",
      },
    },
    {
      stateId: "opener-after-constructive-spades",
      parentId: "bergen-active",
      allowedParentTransitions: ["bergen-opponent-double", "bergen-opponent-bid"],
      transitions: [
        {
          transitionId: "constructive-spades-pass",
          match: { kind: "pass" },
          target: "opener-after-constructive-spades", // stay — waiting for opener
        },
        {
          transitionId: "constructive-spades-game",
          match: { kind: "call", level: 4, strain: BidSuit.Spades },
          target: "responder-after-game",
        },
        {
          transitionId: "constructive-spades-signoff",
          match: { kind: "call", level: 3, strain: BidSuit.Spades },
          target: "responder-after-signoff",
        },
        {
          transitionId: "constructive-spades-game-try",
          match: { kind: "any-bid" },
          target: "responder-after-game-try-spades",
        },
      ],
      surfaceGroupId: "opener-after-constructive-spades",
      entryEffects: {
        setCaptain: "opener",
      },
    },

    // After limit (3D): opener accepts (game) or declines (signoff at 3M)
    {
      stateId: "opener-after-limit-hearts",
      parentId: "bergen-active",
      allowedParentTransitions: ["bergen-opponent-double", "bergen-opponent-bid"],
      transitions: [
        {
          transitionId: "limit-hearts-pass",
          match: { kind: "pass" },
          target: "opener-after-limit-hearts", // stay — waiting for opener
        },
        {
          transitionId: "limit-hearts-game",
          match: { kind: "call", level: 4, strain: BidSuit.Hearts },
          target: "responder-after-game",
        },
        {
          transitionId: "limit-hearts-signoff",
          match: { kind: "call", level: 3, strain: BidSuit.Hearts },
          target: "responder-after-signoff",
        },
        {
          transitionId: "limit-hearts-game-try",
          match: { kind: "any-bid" },
          target: "responder-after-game-try-hearts",
        },
      ],
      surfaceGroupId: "opener-after-limit-hearts",
      entryEffects: {
        setCaptain: "opener",
      },
    },
    {
      stateId: "opener-after-limit-spades",
      parentId: "bergen-active",
      allowedParentTransitions: ["bergen-opponent-double", "bergen-opponent-bid"],
      transitions: [
        {
          transitionId: "limit-spades-pass",
          match: { kind: "pass" },
          target: "opener-after-limit-spades", // stay — waiting for opener
        },
        {
          transitionId: "limit-spades-game",
          match: { kind: "call", level: 4, strain: BidSuit.Spades },
          target: "responder-after-game",
        },
        {
          transitionId: "limit-spades-signoff",
          match: { kind: "call", level: 3, strain: BidSuit.Spades },
          target: "responder-after-signoff",
        },
        {
          transitionId: "limit-spades-game-try",
          match: { kind: "any-bid" },
          target: "responder-after-game-try-spades",
        },
      ],
      surfaceGroupId: "opener-after-limit-spades",
      entryEffects: {
        setCaptain: "opener",
      },
    },

    // After preemptive (3H for hearts / 3S for spades): opener passes or bids game → terminal
    {
      stateId: "opener-after-preemptive-hearts",
      parentId: "bergen-active",
      allowedParentTransitions: ["bergen-opponent-double", "bergen-opponent-bid"],
      transitions: [
        {
          transitionId: "preemptive-hearts-pass",
          match: { kind: "pass" },
          target: "opener-after-preemptive-hearts", // stay — waiting for opener
        },
        {
          transitionId: "preemptive-hearts-any-bid",
          match: { kind: "any-bid" },
          target: "terminal",
        },
      ],
      surfaceGroupId: "opener-after-preemptive-hearts",
      entryEffects: {
        setCaptain: "opener",
      },
    },
    {
      stateId: "opener-after-preemptive-spades",
      parentId: "bergen-active",
      allowedParentTransitions: ["bergen-opponent-double", "bergen-opponent-bid"],
      transitions: [
        {
          transitionId: "preemptive-spades-pass",
          match: { kind: "pass" },
          target: "opener-after-preemptive-spades", // stay — waiting for opener
        },
        {
          transitionId: "preemptive-spades-any-bid",
          match: { kind: "any-bid" },
          target: "terminal",
        },
      ],
      surfaceGroupId: "opener-after-preemptive-spades",
      entryEffects: {
        setCaptain: "opener",
      },
    },

    // ─── R3: responder continuation after opener rebid ──────────

    // R3: after opener bids game (4M) — responder just passes
    {
      stateId: "responder-after-game",
      parentId: "bergen-active",
      allowedParentTransitions: ["bergen-opponent-double", "bergen-opponent-bid"],
      transitions: [
        {
          transitionId: "after-game-pass",
          match: { kind: "pass" },
          target: "responder-after-game",
        },
        {
          transitionId: "after-game-any",
          match: { kind: "any-bid" },
          target: "terminal",
        },
      ],
      surfaceGroupId: "responder-after-game",
      entryEffects: {
        setCaptain: "responder",
      },
    },
    // R3: after opener signs off (3M) — responder just passes
    {
      stateId: "responder-after-signoff",
      parentId: "bergen-active",
      allowedParentTransitions: ["bergen-opponent-double", "bergen-opponent-bid"],
      transitions: [
        {
          transitionId: "after-signoff-pass",
          match: { kind: "pass" },
          target: "responder-after-signoff",
        },
        {
          transitionId: "after-signoff-any",
          match: { kind: "any-bid" },
          target: "terminal",
        },
      ],
      surfaceGroupId: "responder-after-signoff",
      entryEffects: {
        setCaptain: "responder",
      },
    },
    // R3: after opener makes game try — responder decides based on HCP (hearts)
    {
      stateId: "responder-after-game-try-hearts",
      parentId: "bergen-active",
      allowedParentTransitions: ["bergen-opponent-double", "bergen-opponent-bid"],
      transitions: [
        {
          transitionId: "game-try-hearts-pass",
          match: { kind: "pass" },
          target: "responder-after-game-try-hearts",
        },
        {
          transitionId: "game-try-hearts-bid",
          match: { kind: "any-bid" },
          target: "opener-r4-accept",
        },
      ],
      surfaceGroupId: "responder-after-game-try-hearts",
      entryEffects: {
        setCaptain: "responder",
      },
    },
    // R3: after opener makes game try — responder decides based on HCP (spades)
    {
      stateId: "responder-after-game-try-spades",
      parentId: "bergen-active",
      allowedParentTransitions: ["bergen-opponent-double", "bergen-opponent-bid"],
      transitions: [
        {
          transitionId: "game-try-spades-pass",
          match: { kind: "pass" },
          target: "responder-after-game-try-spades",
        },
        {
          transitionId: "game-try-spades-bid",
          match: { kind: "any-bid" },
          target: "opener-r4-accept",
        },
      ],
      surfaceGroupId: "responder-after-game-try-spades",
      entryEffects: {
        setCaptain: "responder",
      },
    },

    // ─── R4: opener accepts responder's game-try decision ───────
    {
      stateId: "opener-r4-accept",
      parentId: "bergen-active",
      allowedParentTransitions: ["bergen-opponent-double", "bergen-opponent-bid"],
      transitions: [
        {
          transitionId: "r4-accept-pass",
          match: { kind: "pass" },
          target: "opener-r4-accept",
        },
        {
          transitionId: "r4-accept-any",
          match: { kind: "any-bid" },
          target: "terminal",
        },
      ],
      surfaceGroupId: "opener-r4-accept",
      entryEffects: {
        setCaptain: "opener",
      },
    },

    // ─── End states ─────────────────────────────────────────────
    {
      stateId: "terminal",
      parentId: "bergen-active",
      allowedParentTransitions: ["bergen-opponent-double", "bergen-opponent-bid"],
      transitions: [],
    },
    {
      stateId: "bergen-contested",
      parentId: "bergen-active",
      allowedParentTransitions: ["bergen-opponent-double", "bergen-opponent-bid"],
      surfaceGroupId: "bergen-interrupted",
      transitions: [
        {
          transitionId: "bergen-contested-absorb",
          match: { kind: "pass" },
          target: "bergen-contested",
        },
      ],
      entryEffects: {
        setCompetitionMode: "Contested",
      },
    },
  ];

  return buildConversationMachine("bergen-conversation", states);
}
