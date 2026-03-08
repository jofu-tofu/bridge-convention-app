import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import type { TransitionRule } from "../../core/dialogue/dialogue-transitions";
import type { DialogueState } from "../../core/dialogue/dialogue-state";
import { CompetitionMode, ForcingState } from "../../core/dialogue/dialogue-state";
import { isOpenerSeat, partnerOfOpener } from "../../core/dialogue/helpers";
import { topFrame } from "./helpers";

function is2NT(call: Call): boolean {
  return call.type === "bid" && call.level === 2 && call.strain === BidSuit.NoTrump;
}

function is3C(call: Call): boolean {
  return call.type === "bid" && call.level === 3 && call.strain === BidSuit.Clubs;
}

function isThreeLevelSuitBid(call: Call): boolean {
  return call.type === "bid" && call.level === 3 && call.strain !== BidSuit.NoTrump;
}

function hasRelayOrPlaceContractFrame(state: DialogueState): boolean {
  const frame = topFrame(state);
  return frame?.kind === "relay" || frame?.kind === "place-contract";
}

export const lebensohlTransitionRules: readonly TransitionRule[] = [
  {
    id: "lebensohl-relay-request",
    matchDescriptor: { familyId: "1nt", callType: "bid", level: 2, strain: BidSuit.NoTrump, actorRelation: "partner-of-opener" },
    matches(state: DialogueState, entry) {
      const { call, seat } = entry;
      return (
        state.familyId === "1nt" &&
        state.competitionMode === CompetitionMode.Overcalled &&
        is2NT(call) &&
        partnerOfOpener(state, seat)
      );
    },
    effects(_state: DialogueState, _entry, _auction, entryIndex) {
      return {
        pushFrame: {
          kind: "relay",
          owner: "opener",
          targetStrain: BidSuit.Clubs,
          targetLevel: 3,
          pushedAt: entryIndex,
        },
        setForcingState: ForcingState.ForcingOneRound,
      };
    },
  },
  {
    id: "lebensohl-relay-complete",
    matchDescriptor: { familyId: "1nt", callType: "bid", level: 3, strain: BidSuit.Clubs, actorRelation: "opener" },
    matches(state: DialogueState, entry) {
      const { call, seat } = entry;
      const frame = topFrame(state);
      return (
        is3C(call) &&
        frame?.kind === "relay" &&
        frame.owner === "opener" &&
        isOpenerSeat(state, seat)
      );
    },
    effects(_state: DialogueState, _entry, _auction, entryIndex) {
      return {
        popFrame: true,
        pushFrame: {
          kind: "place-contract",
          owner: "responder",
          pushedAt: entryIndex,
        },
        setForcingState: ForcingState.Nonforcing,
      };
    },
  },
  {
    id: "lebensohl-place-contract",
    matchDescriptor: { familyId: "1nt", callType: "bid", actorRelation: "partner-of-opener" },
    matches(state: DialogueState, entry) {
      const { call, seat } = entry;
      const frame = topFrame(state);
      return (
        call.type === "bid" &&
        frame?.kind === "place-contract" &&
        frame.owner === "responder" &&
        partnerOfOpener(state, seat)
      );
    },
    effects() {
      return {
        popFrame: true,
        setForcingState: ForcingState.Nonforcing,
      };
    },
  },
  {
    id: "lebensohl-direct-gf",
    matchDescriptor: { familyId: "1nt", callType: "bid", level: 3, actorRelation: "partner-of-opener" },
    matches(state: DialogueState, entry) {
      const { call, seat } = entry;
      return (
        state.familyId === "1nt" &&
        state.competitionMode === CompetitionMode.Overcalled &&
        isThreeLevelSuitBid(call) &&
        !hasRelayOrPlaceContractFrame(state) &&
        partnerOfOpener(state, seat)
      );
    },
    effects() {
      return {
        setForcingState: ForcingState.GameForcing,
      };
    },
  },
];
