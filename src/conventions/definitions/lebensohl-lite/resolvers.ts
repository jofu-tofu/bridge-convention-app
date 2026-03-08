// Lebensohl Lite intent resolvers.
// Only AcceptTransfer and Signoff need resolvers because they depend on
// DialogueState (frame kind/owner). The remaining intent types used in
// the tree — PenaltyDouble, ForceGame, ArtificialRelay, CompetitivePass —
// are fully deterministic via defaultCall and need no resolver.

import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";
import { SemanticIntentType } from "../../core/intent/semantic-intent";
import type { IntentResolverFn, IntentResolverMap } from "../../core/intent/intent-resolver";
import { STRAIN_TO_BIDSUIT } from "../shared-helpers";
import { topFrame } from "./helpers";

const acceptTransfer: IntentResolverFn = (_intent, state) => {
  const frame = topFrame(state);
  if (frame?.kind !== "relay" || frame.owner !== "opener") {
    return { status: "declined" };
  }
  return {
    status: "resolved",
    calls: [{ call: { type: "bid", level: 3, strain: BidSuit.Clubs } as Call }],
  };
};

const signoff: IntentResolverFn = (intent, state) => {
  const frame = topFrame(state);
  if (frame?.kind !== "place-contract" || frame.owner !== "responder") {
    return { status: "declined" };
  }

  const strain = intent.params["strain"] as string;
  const bidsuit = STRAIN_TO_BIDSUIT[strain];
  if (!bidsuit || bidsuit === BidSuit.NoTrump) return { status: "declined" };

  const level = (intent.params["level"] as number | undefined) ?? 3;
  return {
    status: "resolved",
    calls: [
      {
        call: {
          type: "bid",
          level: level as 1 | 2 | 3 | 4 | 5 | 6 | 7,
          strain: bidsuit,
        },
      },
    ],
  };
};

export const lebensohlResolvers: IntentResolverMap = new Map<string, IntentResolverFn>([
  [SemanticIntentType.AcceptTransfer, acceptTransfer],
  [SemanticIntentType.Signoff, signoff],
]);
