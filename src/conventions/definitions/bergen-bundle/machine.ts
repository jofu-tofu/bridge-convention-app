import { BidSuit, Seat } from "../../../engine/types";
import type { Auction } from "../../../engine/types";
import type {
  ConversationMachine,
  MachineState,
} from "../../core/runtime/machine-types";
import { areSamePartnership } from "../../core/dialogue/helpers";

/**
 * Create the Bergen Raises Conversation Machine.
 *
 * State hierarchy (flat — no parent states):
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
 *     opener-after-constructive-hearts/spades → responder-after-opener-rebid (on bid)
 *                                             → terminal (on pass)
 *     opener-after-limit-hearts/spades → responder-after-opener-rebid (on bid)
 *                                      → terminal (on pass = signoff at 3M)
 *     opener-after-preemptive-hearts/spades → terminal (all paths)
 *
 *   R3 — responder continuation:
 *     responder-after-opener-rebid-hearts/spades → terminal (all paths)
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

    // ─── major-opened: waiting for opponent pass or interference ─
    {
      stateId: "major-opened-hearts",
      parentId: null,
      transitions: [
        {
          transitionId: "hearts-opponent-double",
          match: { kind: "opponent-action", callType: "double" },
          target: "bergen-contested",
        },
        {
          transitionId: "hearts-opponent-bid",
          match: { kind: "opponent-action", callType: "bid" },
          target: "bergen-contested",
        },
        {
          transitionId: "hearts-pass-to-responder",
          match: { kind: "pass" },
          target: "responder-r1-hearts",
        },
      ],
    },
    {
      stateId: "major-opened-spades",
      parentId: null,
      transitions: [
        {
          transitionId: "spades-opponent-double",
          match: { kind: "opponent-action", callType: "double" },
          target: "bergen-contested",
        },
        {
          transitionId: "spades-opponent-bid",
          match: { kind: "opponent-action", callType: "bid" },
          target: "bergen-contested",
        },
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
      parentId: null,
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
      parentId: null,
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
      parentId: null,
      transitions: [
        {
          transitionId: "constructive-hearts-pass",
          match: { kind: "pass" },
          target: "opener-after-constructive-hearts", // stay — waiting for opener through opponent pass
        },
        {
          transitionId: "constructive-hearts-any-bid",
          match: { kind: "any-bid" },
          target: "responder-after-opener-rebid-hearts",
        },
      ],
      surfaceGroupId: "opener-after-constructive-hearts",
      entryEffects: {
        setCaptain: "opener",
      },
    },
    {
      stateId: "opener-after-constructive-spades",
      parentId: null,
      transitions: [
        {
          transitionId: "constructive-spades-pass",
          match: { kind: "pass" },
          target: "opener-after-constructive-spades", // stay — waiting for opener
        },
        {
          transitionId: "constructive-spades-any-bid",
          match: { kind: "any-bid" },
          target: "responder-after-opener-rebid-spades",
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
      parentId: null,
      transitions: [
        {
          transitionId: "limit-hearts-pass",
          match: { kind: "pass" },
          target: "opener-after-limit-hearts", // stay — waiting for opener
        },
        {
          transitionId: "limit-hearts-any-bid",
          match: { kind: "any-bid" },
          target: "responder-after-opener-rebid-hearts",
        },
      ],
      surfaceGroupId: "opener-after-limit-hearts",
      entryEffects: {
        setCaptain: "opener",
      },
    },
    {
      stateId: "opener-after-limit-spades",
      parentId: null,
      transitions: [
        {
          transitionId: "limit-spades-pass",
          match: { kind: "pass" },
          target: "opener-after-limit-spades", // stay — waiting for opener
        },
        {
          transitionId: "limit-spades-any-bid",
          match: { kind: "any-bid" },
          target: "responder-after-opener-rebid-spades",
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
      parentId: null,
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
      parentId: null,
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
    {
      stateId: "responder-after-opener-rebid-hearts",
      parentId: null,
      transitions: [
        {
          transitionId: "resp-rebid-hearts-any-bid",
          match: { kind: "any-bid" },
          target: "terminal",
        },
        {
          transitionId: "resp-rebid-hearts-pass",
          match: { kind: "pass" },
          target: "terminal",
        },
      ],
      surfaceGroupId: "responder-after-opener-rebid-hearts",
      entryEffects: {
        setCaptain: "responder",
      },
    },
    {
      stateId: "responder-after-opener-rebid-spades",
      parentId: null,
      transitions: [
        {
          transitionId: "resp-rebid-spades-any-bid",
          match: { kind: "any-bid" },
          target: "terminal",
        },
        {
          transitionId: "resp-rebid-spades-pass",
          match: { kind: "pass" },
          target: "terminal",
        },
      ],
      surfaceGroupId: "responder-after-opener-rebid-spades",
      entryEffects: {
        setCaptain: "responder",
      },
    },

    // ─── End states ─────────────────────────────────────────────
    {
      stateId: "terminal",
      parentId: null,
      transitions: [],
    },
    {
      stateId: "bergen-contested",
      parentId: null,
      transitions: [],
      entryEffects: {
        setCompetitionMode: "Contested",
      },
    },
  ];

  const stateMap = new Map<string, MachineState>();
  for (const s of states) {
    stateMap.set(s.stateId, s);
  }

  return {
    machineId: "bergen-conversation",
    states: stateMap,
    initialStateId: "idle",
    seatRole: (
      _auction: Auction,
      seat: Seat,
      callSeat: Seat,
    ): "self" | "partner" | "opponent" => {
      if (seat === callSeat) return "self";
      return areSamePartnership(seat, callSeat) ? "partner" : "opponent";
    },
  };
}
