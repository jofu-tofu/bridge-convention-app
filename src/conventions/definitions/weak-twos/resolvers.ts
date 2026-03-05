// Weak Twos intent resolvers — maps semantic intents to concrete calls.

import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import { SemanticIntentType } from "../../core/intent/semantic-intent";
import type { IntentResolverFn, IntentResolverMap } from "../../core/intent/intent-resolver";
import { STRAIN_TO_BIDSUIT } from "../shared-helpers";

const preemptiveOpen: IntentResolverFn = (intent) => {
  const suit = intent.params["suit"] as string;
  const strain = STRAIN_TO_BIDSUIT[suit];
  if (!strain) return { status: "declined" };
  return {
    status: "resolved",
    calls: [{ call: { type: "bid", level: 2, strain } as Call }],
  };
};

const showHandQuality: IntentResolverFn = (intent) => {
  const strength = intent.params["strength"] as string;
  const quality = intent.params["suitQuality"] as string;

  // Ogust response matrix:
  // solid → 3NT
  // min + bad → 3C, min + good → 3D
  // max + bad → 3H, max + good → 3S
  if (quality === "solid") {
    return { status: "resolved", calls: [{ call: { type: "bid", level: 3, strain: BidSuit.NoTrump } as Call }] };
  }
  if (strength === "min" && quality === "bad") {
    return { status: "resolved", calls: [{ call: { type: "bid", level: 3, strain: BidSuit.Clubs } as Call }] };
  }
  if (strength === "min" && quality === "good") {
    return { status: "resolved", calls: [{ call: { type: "bid", level: 3, strain: BidSuit.Diamonds } as Call }] };
  }
  if (strength === "max" && quality === "bad") {
    return { status: "resolved", calls: [{ call: { type: "bid", level: 3, strain: BidSuit.Hearts } as Call }] };
  }
  if (strength === "max" && quality === "good") {
    return { status: "resolved", calls: [{ call: { type: "bid", level: 3, strain: BidSuit.Spades } as Call }] };
  }
  return { status: "declined" };
};

const raiseToGame: IntentResolverFn = (_intent, state) => {
  const strain = state.conventionData["openingSuit"] as BidSuit | undefined;
  if (!strain) return { status: "declined" };
  return {
    status: "resolved",
    calls: [{ call: { type: "bid", level: 4, strain } as Call }],
  };
};

const askHandQuality: IntentResolverFn = () => {
  return {
    status: "resolved",
    calls: [{ call: { type: "bid", level: 2, strain: BidSuit.NoTrump } as Call }],
  };
};

const inviteGame: IntentResolverFn = (_intent, state) => {
  const strain = state.conventionData["openingSuit"] as BidSuit | undefined;
  if (!strain) return { status: "declined" };
  return {
    status: "resolved",
    calls: [{ call: { type: "bid", level: 3, strain } as Call }],
  };
};

export const weakTwoResolvers: IntentResolverMap = new Map<string, IntentResolverFn>([
  [SemanticIntentType.PreemptiveOpen, preemptiveOpen],
  [SemanticIntentType.ShowHandQuality, showHandQuality],
  [SemanticIntentType.RaiseToGame, raiseToGame],
  [SemanticIntentType.AskHandQuality, askHandQuality],
  [SemanticIntentType.InviteGame, inviteGame],
]);
