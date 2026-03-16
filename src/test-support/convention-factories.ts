/**
 * Shared test factories for convention system types.
 *
 * Consolidates duplicated makeSurface/makeArbitrationInput/buildMachine/makeRanking
 * from pipeline-test-helpers, runtime-test-helpers, and strategy-test-helpers.
 */

import { BidSuit, Seat } from "../engine/types";
import type { Call } from "../engine/types";
import type { MeaningSurface } from "../core/contracts/meaning";
import type { RankingMetadata } from "../core/contracts/meaning";
import type { ConversationMachine, MachineState } from "../conventions/core/runtime/machine-types";

/** Create a minimal MeaningSurface with override support. */
export function makeSurface(overrides: Partial<MeaningSurface> & { meaningId?: string; moduleId?: string } = {}): MeaningSurface {
  return {
    meaningId: "test:meaning",
    semanticClassId: "test:class",
    moduleId: "test",
    encoding: { defaultCall: { type: "bid", level: 2, strain: BidSuit.Clubs } },
    clauses: [],
    ranking: makeRanking(),
    sourceIntent: { type: "TestIntent", params: {} },
    teachingLabel: "Test meaning",
    ...overrides,
  } as MeaningSurface;
}

/** Create a default RankingMetadata with override support. */
export function makeRanking(overrides?: Partial<RankingMetadata>): RankingMetadata {
  return {
    recommendationBand: "should",
    specificity: 1,
    modulePrecedence: 0,
    intraModuleOrder: 0,
    ...overrides,
  };
}

/** Create a minimal ConversationMachine from an array of states. */
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

/** Create a Call for a contract bid. */
export function makeCall(level: 1 | 2 | 3 | 4 | 5 | 6 | 7 = 1, strain: BidSuit = BidSuit.Clubs): Call {
  return { type: "bid", level, strain };
}

/** Create a pass Call. */
export function makePass(): Call {
  return { type: "pass" };
}
