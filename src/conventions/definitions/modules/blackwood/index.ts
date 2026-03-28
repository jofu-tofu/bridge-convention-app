import type { LocalFsm, StateEntry } from "../../../core/rule-module";
import type { ConventionModule } from "../../../core/convention-module";
import type { NegotiationDelta } from "../../../core/committed-step";
import type { SystemConfig } from "../../system-config";
import { moduleDescription, modulePurpose, teachingTradeoff, teachingPrinciple, teachingItem } from "../../../core/authored-text";

import {
  createBlackwood4NTSurface,
  ACE_RESPONSE_SURFACES,
  createBlackwoodR3Surfaces,
  KING_RESPONSE_SURFACES,
  createBlackwoodR5Surfaces,
} from "./meaning-surfaces";
import { createBlackwoodFacts } from "./facts";
import { BLACKWOOD_EXPLANATION_ENTRIES } from "./explanation-catalog";

// ─── Local FSM + States ──────────────────────────────────────

type BlackwoodPhase = "idle" | "asked" | "responded" | "king-ask" | "king-responded" | "done";

const BLACKWOOD_ASK_DELTA: NegotiationDelta = { forcing: "one-round" };
const BLACKWOOD_RESPONSE_DELTA: NegotiationDelta = { forcing: "none" };

const blackwoodLocal: LocalFsm<BlackwoodPhase> = {
  initial: "idle",
  transitions: [
    { from: "idle", to: "asked", on: { act: "inquire", feature: "keyCards" } },
    { from: "asked", to: "responded", on: { act: "show", feature: "keyCards" } },
    { from: "responded", to: "king-ask", on: { act: "inquire", feature: "control" } },
    { from: "responded", to: "done", on: { act: "signoff" } },
    { from: "king-ask", to: "king-responded", on: { act: "show", feature: "control" } },
    { from: "king-responded", to: "done", on: { act: "signoff" } },
  ],
};

function createBlackwoodStates(sys: SystemConfig): readonly StateEntry<BlackwoodPhase>[] {
  return [
    {
      phase: "idle",
      turn: "responder" as const,
      kernel: { kind: "fit" },
      negotiationDelta: BLACKWOOD_ASK_DELTA,
      surfaces: [createBlackwood4NTSurface(sys)],
    },
    {
      phase: "asked",
      turn: "opener" as const,
      negotiationDelta: BLACKWOOD_RESPONSE_DELTA,
      surfaces: ACE_RESPONSE_SURFACES,
    },
    {
      phase: "responded",
      turn: "responder" as const,
      surfaces: createBlackwoodR3Surfaces(sys),
    },
    {
      phase: "king-ask",
      turn: "opener" as const,
      negotiationDelta: BLACKWOOD_RESPONSE_DELTA,
      surfaces: KING_RESPONSE_SURFACES,
    },
    {
      phase: "king-responded",
      turn: "responder" as const,
      surfaces: createBlackwoodR5Surfaces(sys),
    },
  ];
}

// ─── Module declarations ─────────────────────────────────────

/** Factory: creates Blackwood declaration parts (facts + explanations). */
function createBlackwoodDeclarations(sys: SystemConfig) {
  return {
    facts: createBlackwoodFacts(sys),
    explanationEntries: BLACKWOOD_EXPLANATION_ENTRIES,
  };
}

/** Self-contained factory producing a complete ConventionModule. */
export const moduleFactory = (sys: SystemConfig): ConventionModule => ({
  moduleId: "blackwood",
  description: moduleDescription("Use 4NT to ask for aces when considering slam"),
  purpose: modulePurpose("Determine whether the partnership has enough aces to bid slam safely"),
  teaching: {
    tradeoff: teachingTradeoff("Using 4NT as Blackwood means you can't use it as a natural quantitative raise to slam."),
    principle: teachingPrinciple("Before bidding slam, check for aces — missing two aces means the opponents can cash two tricks immediately."),
    commonMistakes: [
      teachingItem("Don't bid Blackwood without an agreed trump fit — you need a fit before asking for aces"),
      teachingItem("5NT king ask guarantees all four aces are accounted for — never bid 5NT missing an ace"),
    ],
  },
  ...createBlackwoodDeclarations(sys),
  local: blackwoodLocal,
  states: createBlackwoodStates(sys),
});
