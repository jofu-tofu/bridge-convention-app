// Bergen Raises intent resolvers — maps semantic intents to concrete calls.

import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import { SemanticIntentType } from "../../core/intent/semantic-intent";
import type { IntentResolverFn, IntentResolverMap } from "../../core/intent/intent-resolver";
import type { DialogueState } from "../../core/dialogue/dialogue-state";

const pass: Call = { type: "pass" };

function openerMajor(state: DialogueState): BidSuit | null {
  const strain = state.conventionData["openerMajor"] as BidSuit | undefined;
  if (strain === BidSuit.Hearts || strain === BidSuit.Spades) return strain;
  return null;
}

const showSupport: IntentResolverFn = (intent, state) => {
  const strength = intent.params["strength"] as string;
  const major = openerMajor(state);

  switch (strength) {
    case "game":
      return major
        ? { status: "resolved", calls: [{ call: { type: "bid", level: 4, strain: major } as Call }] }
        : { status: "declined" };
    case "limit":
      return { status: "resolved", calls: [{ call: { type: "bid", level: 3, strain: BidSuit.Diamonds } as Call }] };
    case "constructive":
      return { status: "resolved", calls: [{ call: { type: "bid", level: 3, strain: BidSuit.Clubs } as Call }] };
    case "preemptive":
      return major
        ? { status: "resolved", calls: [{ call: { type: "bid", level: 3, strain: major } as Call }] }
        : { status: "declined" };
    default:
      return { status: "declined" };
  }
};

const acceptInvitation: IntentResolverFn = (_intent, state) => {
  const major = openerMajor(state);
  if (!major) return { status: "declined" };
  return { status: "resolved", calls: [{ call: { type: "bid", level: 4, strain: major } as Call }] };
};

const declineInvitation: IntentResolverFn = (_intent, state) => {
  const major = openerMajor(state);
  if (!major) return { status: "declined" };
  return { status: "resolved", calls: [{ call: { type: "bid", level: 3, strain: major } as Call }] };
};

const raiseToGame: IntentResolverFn = (_intent, state) => {
  const major = openerMajor(state);
  if (!major) return { status: "declined" };
  return { status: "resolved", calls: [{ call: { type: "bid", level: 4, strain: major } as Call }] };
};

const acceptPartnerDecision: IntentResolverFn = () => {
  return { status: "resolved", calls: [{ call: pass }] };
};

export const bergenResolvers: IntentResolverMap = new Map<string, IntentResolverFn>([
  [SemanticIntentType.ShowSupport, showSupport],
  [SemanticIntentType.AcceptInvitation, acceptInvitation],
  [SemanticIntentType.DeclineInvitation, declineInvitation],
  [SemanticIntentType.RaiseToGame, raiseToGame],
  [SemanticIntentType.AcceptPartnerDecision, acceptPartnerDecision],
  // ShowShortage, AskShortage, HelpSuitGameTry use dynamic defaultCall functions
  // that depend on BiddingContext (not DialogueState), so resolvers defer to defaultCall.
]);
