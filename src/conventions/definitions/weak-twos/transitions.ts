// Weak Twos dialogue transition rules.
// Composed with baseline rules in config:
//   transitionRules: [...weakTwoTransitionRules, ...baselineTransitionRules]

import type { TransitionRule } from "../../core/dialogue/dialogue-transitions";
import { ObligationKind, SystemMode } from "../../core/dialogue/dialogue-state";
import type { DialogueState } from "../../core/dialogue/dialogue-state";
import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import { partnerOfOpener, isOpenerSeat } from "../../core/dialogue/helpers";

function isWeakTwoOpening(call: Call): boolean {
  return (
    call.type === "bid" &&
    call.level === 2 &&
    (call.strain === BidSuit.Hearts || call.strain === BidSuit.Spades || call.strain === BidSuit.Diamonds)
  );
}

function is2NT(call: Call): boolean {
  return call.type === "bid" && call.level === 2 && call.strain === BidSuit.NoTrump;
}

/** Ogust response classification: maps 3-level response to ogustResponse value. */
const OGUST_RESPONSE_MAP: Record<string, string> = {
  [BidSuit.Clubs]: "min-bad",
  [BidSuit.Diamonds]: "min-good",
  [BidSuit.Hearts]: "max-bad",
  [BidSuit.Spades]: "max-good",
};

function isOgustResponse(call: Call): boolean {
  return (
    call.type === "bid" &&
    ((call.level === 3 && call.strain !== undefined) ||
      (call.level === 3 && call.strain === BidSuit.NoTrump))
  );
}

function isDirectRaise(call: Call, openingSuit: unknown): boolean {
  if (call.type !== "bid" || openingSuit === null || openingSuit === undefined) return false;
  const isMinor = openingSuit === BidSuit.Clubs || openingSuit === BidSuit.Diamonds;
  const gameLevel = isMinor ? 5 : 4;
  return call.level === gameLevel && call.strain === openingSuit;
}

function isInviteRaise(call: Call, openingSuit: unknown): boolean {
  if (call.type !== "bid" || openingSuit === null || openingSuit === undefined) return false;
  return call.level === 3 && call.strain === openingSuit;
}

export const weakTwoTransitionRules: readonly TransitionRule[] = [
  // Detect weak two opening — sets familyId, stores opening suit and openerSeat
  {
    id: "weak-two-opening",
    matchDescriptor: { familyId: null, callType: "bid", level: 2 },
    matches(state: DialogueState, entry) {
      const { call } = entry;
      return state.familyId === null && isWeakTwoOpening(call);
    },
    effects(_state: DialogueState, entry) {
      const { call, seat } = entry;
      const strain = call.type === "bid" ? call.strain : null;
      return {
        setFamilyId: "weak-two",
        setSystemMode: SystemMode.On,
        mergeConventionData: { openingSuit: strain, openerSeat: seat },
      };
    },
  },

  // Ogust 2NT ask after weak two — sets pending action (partner of opener only)
  {
    id: "weak-two-ogust-ask",
    matchDescriptor: { familyId: "weak-two", callType: "bid", level: 2, strain: BidSuit.NoTrump, actorRelation: "partner-of-opener" },
    matches(state: DialogueState, entry) {
      const { call, seat } = entry;
      return state.familyId === "weak-two" && is2NT(call) && partnerOfOpener(state, seat);
    },
    effects() {
      return {
        setObligation: { kind: ObligationKind.ShowSuit, obligatedSide: "opener" as const },
      };
    },
  },

  // Ogust response classification — opener responds to 2NT ask with hand quality
  {
    id: "weak-two-ogust-response",
    matchDescriptor: { familyId: "weak-two", obligationKind: ObligationKind.ShowSuit, callType: "bid", level: 3, actorRelation: "opener" },
    matches(state: DialogueState, entry) {
      const { call, seat } = entry;
      return (
        state.familyId === "weak-two" &&
        state.obligation.kind === ObligationKind.ShowSuit &&
        isOpenerSeat(state, seat) &&
        isOgustResponse(call)
      );
    },
    effects(_state: DialogueState, entry) {
      const { call } = entry;
      if (call.type !== "bid") return {};
      // 3NT = solid, otherwise use OGUST_RESPONSE_MAP
      const ogustResponse =
        call.strain === BidSuit.NoTrump ? "solid" : OGUST_RESPONSE_MAP[call.strain] ?? null;
      return {
        setObligation: { kind: ObligationKind.None, obligatedSide: "opener" as const },
        ...(ogustResponse ? { mergeConventionData: { ogustResponse } } : {}),
      };
    },
  },

  // Direct raise tracking — partner raises opener's suit directly to game
  {
    id: "weak-two-direct-raise",
    matchDescriptor: { familyId: "weak-two", callType: "bid", actorRelation: "partner-of-opener" },
    matches(state: DialogueState, entry) {
      const { call, seat } = entry;
      return (
        state.familyId === "weak-two" &&
        partnerOfOpener(state, seat) &&
        isDirectRaise(call, state.conventionData["openingSuit"])
      );
    },
    effects() {
      return {
        mergeConventionData: { directRaise: true },
      };
    },
  },

  // Invite tracking — partner raises opener's suit to the 3-level (invitational)
  {
    id: "weak-two-invite",
    matchDescriptor: { familyId: "weak-two", callType: "bid", level: 3, actorRelation: "partner-of-opener" },
    matches(state: DialogueState, entry) {
      const { call, seat } = entry;
      return (
        state.familyId === "weak-two" &&
        partnerOfOpener(state, seat) &&
        isInviteRaise(call, state.conventionData["openingSuit"])
      );
    },
    effects() {
      return {
        mergeConventionData: { inviteMade: true },
      };
    },
  },
];
