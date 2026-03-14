import { BidSuit, Seat } from "../../../../engine/types";
import type { ConversationMachine, MachineState } from "../machine-types";
import type { MeaningSurface } from "../../../../core/contracts/meaning-surface";

/** Helper: create a minimal machine with states from an array. */
export function buildMachine(
  states: MachineState[],
  initialStateId: string,
): ConversationMachine {
  const stateMap = new Map<string, MachineState>();
  for (const s of states) {
    stateMap.set(s.stateId, s);
  }
  return {
    machineId: "test-machine",
    states: stateMap,
    initialStateId,
    seatRole: (_auction, seat, callSeat) => {
      if (seat === callSeat) return "self";
      const samePartnership =
        (seat === Seat.North || seat === Seat.South) ===
        (callSeat === Seat.North || callSeat === Seat.South);
      return samePartnership ? "partner" : "opponent";
    },
  };
}

export function makeSurface(meaningId: string, moduleId: string): MeaningSurface {
  return {
    meaningId,
    moduleId,
    encoding: { defaultCall: { type: "bid", level: 2, strain: BidSuit.Clubs } },
    clauses: [],
    ranking: {
      recommendationBand: "should",
      specificity: 1,
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    sourceIntent: { type: "TestIntent", params: {} },
  };
}
