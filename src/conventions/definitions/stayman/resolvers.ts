// Stayman intent resolvers — maps semantic intents to concrete calls.
// Uses DialogueState to produce different calls under interference.

import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import { SystemMode, getSystemModeFor } from "../../core/dialogue/dialogue-state";
import type { DialogueState } from "../../core/dialogue/dialogue-state";
import { SemanticIntentType } from "../../core/intent/semantic-intent";
import type { IntentResolverFn, IntentResolverMap } from "../../core/intent/intent-resolver";
import { STAYMAN_CAPABILITY } from "./constants";
import { STRAIN_TO_BIDSUIT } from "../shared-helpers";

/** Stayman bid level: 2 after 1NT, 3 after 2NT. Defaults to 2 (common case). */
function staymanLevel(state: DialogueState): 2 | 3 {
  return state.familyId === "2nt" ? 3 : 2;
}

const askForMajor: IntentResolverFn = (_intent, state) => {
  // System off → intent invalid, exclude candidate entirely
  if (getSystemModeFor(state, STAYMAN_CAPABILITY) === SystemMode.Off) return { status: "declined" };
  const level = staymanLevel(state);
  return {
    status: "resolved",
    calls: [{ call: { type: "bid", level, strain: BidSuit.Clubs } }],
  };
};

const showHeldSuit: IntentResolverFn = (intent, state) => {
  if (getSystemModeFor(state, STAYMAN_CAPABILITY) === SystemMode.Off) return { status: "declined" };
  const suit = intent.params["suit"] as string;
  const strain = STRAIN_TO_BIDSUIT[suit];
  if (!strain) return { status: "declined" };
  const level = staymanLevel(state);
  return {
    status: "resolved",
    calls: [{ call: { type: "bid", level, strain } as Call }],
  };
};

const denyHeldSuit: IntentResolverFn = (_intent, state) => {
  if (getSystemModeFor(state, STAYMAN_CAPABILITY) === SystemMode.Off) return { status: "declined" };
  const level = staymanLevel(state);
  return {
    status: "resolved",
    calls: [{ call: { type: "bid", level, strain: BidSuit.Diamonds } as Call }],
  };
};

const forceGame: IntentResolverFn = (intent) => {
  const strain = intent.params["strain"] as string;
  const fit = intent.params["fit"] as boolean | undefined;
  const bidsuit = STRAIN_TO_BIDSUIT[strain];
  if (!bidsuit) return { status: "declined" };

  // Game level for fit majors, 3-level for forcing bids
  const level = fit ? 4 : 3;
  return {
    status: "resolved",
    calls: [{ call: { type: "bid", level: level as 1 | 2 | 3 | 4 | 5 | 6 | 7, strain: bidsuit } }],
  };
};

const inviteGame: IntentResolverFn = (intent) => {
  const strain = intent.params["strain"] as string;
  const fit = intent.params["fit"] as boolean | undefined;
  const bidsuit = STRAIN_TO_BIDSUIT[strain];
  if (!bidsuit) return { status: "declined" };

  // 3-level for fit invites, 2-level for non-fit
  const level = fit ? 3 : 2;
  return {
    status: "resolved",
    calls: [{ call: { type: "bid", level: level as 1 | 2 | 3 | 4 | 5 | 6 | 7, strain: bidsuit } }],
  };
};

const signoff: IntentResolverFn = (intent) => {
  const strain = intent.params["strain"] as string;
  const level = intent.params["level"] as number;
  const bidsuit = STRAIN_TO_BIDSUIT[strain];
  if (!bidsuit) return { status: "declined" };

  return {
    status: "resolved",
    calls: [{ call: { type: "bid", level: level as 1 | 2 | 3 | 4 | 5 | 6 | 7, strain: bidsuit } }],
  };
};

// ─── Interference resolvers ──────────────────────────────────

const penaltyRedouble: IntentResolverFn = () => {
  return { status: "resolved", calls: [{ call: { type: "redouble" } as Call }] };
};

const escapeRescue: IntentResolverFn = (intent) => {
  const suit = intent.params["suit"] as string;
  const strain = STRAIN_TO_BIDSUIT[suit];
  if (!strain) return { status: "declined" };
  return {
    status: "resolved",
    calls: [{ call: { type: "bid", level: 2, strain } as Call }],
  };
};

const competitivePass: IntentResolverFn = () => {
  return { status: "resolved", calls: [{ call: { type: "pass" } as Call }] };
};

export const staymanResolvers: IntentResolverMap = new Map<string, IntentResolverFn>([
  [SemanticIntentType.AskForMajor, askForMajor],
  [SemanticIntentType.ShowHeldSuit, showHeldSuit],
  [SemanticIntentType.DenyHeldSuit, denyHeldSuit],
  [SemanticIntentType.ForceGame, forceGame],
  [SemanticIntentType.InviteGame, inviteGame],
  [SemanticIntentType.Signoff, signoff],
  [SemanticIntentType.PenaltyRedouble, penaltyRedouble],
  [SemanticIntentType.EscapeRescue, escapeRescue],
  [SemanticIntentType.CompetitivePass, competitivePass],
]);
