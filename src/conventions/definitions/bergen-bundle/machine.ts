import { BidSuit, Seat } from "../../../engine/types";
import type { Auction } from "../../../engine/types";
import type {
  ConversationMachine,
  MachineState,
} from "../../core/runtime/machine-types";

function areSamePartnership(a: Seat, b: Seat): boolean {
  return (
    (a === Seat.North || a === Seat.South) ===
    (b === Seat.North || b === Seat.South)
  );
}

/**
 * Create the Bergen Raises Conversation Machine.
 *
 * State hierarchy:
 *   idle -> major-opened (on partner 1H or 1S)
 *   major-opened -> responder-r1-hearts / responder-r1-spades (on pass)
 *   responder-r1-hearts / responder-r1-spades -> terminal
 *   terminal (end state)
 */
export function createBergenConversationMachine(): ConversationMachine {
  const states: MachineState[] = [
    // idle: waiting for 1H or 1S opening
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

    // major-opened-hearts: 1H has been bid, waiting for opponent pass
    {
      stateId: "major-opened-hearts",
      parentId: null,
      transitions: [
        {
          transitionId: "hearts-pass-to-responder",
          match: { kind: "pass" },
          target: "responder-r1-hearts",
        },
      ],
    },

    // major-opened-spades: 1S has been bid, waiting for opponent pass
    {
      stateId: "major-opened-spades",
      parentId: null,
      transitions: [
        {
          transitionId: "spades-pass-to-responder",
          match: { kind: "pass" },
          target: "responder-r1-spades",
        },
      ],
    },

    // responder-r1-hearts: responder's first response to 1H-P
    {
      stateId: "responder-r1-hearts",
      parentId: null,
      transitions: [
        {
          transitionId: "r1-hearts-any-bid",
          match: { kind: "any-bid" },
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

    // responder-r1-spades: responder's first response to 1S-P
    {
      stateId: "responder-r1-spades",
      parentId: null,
      transitions: [
        {
          transitionId: "r1-spades-any-bid",
          match: { kind: "any-bid" },
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

    // terminal: auction done for this convention
    {
      stateId: "terminal",
      parentId: null,
      transitions: [],
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
