import type { LocalFsm, StateEntry } from "../../../core/rule-module";
import type { ConventionModule } from "../../../core/convention-module";
import type { NegotiationDelta } from "../../../core/committed-step";
import type { SystemConfig } from "../../system-config";

import {
  createStaymanR1Surface,
  OPENER_STAYMAN_SURFACES,
  createStaymanR3After2HSurfaces,
  createStaymanR3After2SSurfaces,
  createStaymanR3After2DSurfaces,
} from "./meaning-surfaces";
import { createStaymanFacts } from "./facts";
import { STAYMAN_EXPLANATION_ENTRIES } from "./explanation-catalog";

// ── Re-exports ────────────────────────────────────────────────────

export { STAYMAN_CLASSES, STAYMAN_R3_CLASSES } from "./semantic-classes";
export {
  createStaymanR1Surface,
  OPENER_STAYMAN_SURFACES,
  createStaymanR3After2HSurfaces,
  createStaymanR3After2SSurfaces,
  createStaymanR3After2DSurfaces,
} from "./meaning-surfaces";
export { createStaymanFacts } from "./facts";

// ─── Local FSM + States ──────────────────────────────────────

type StaymanPhase = "idle" | "asked" | "shown-hearts" | "shown-spades" | "denied" | "inactive";

const STAYMAN_ASK_DELTA: NegotiationDelta = { forcing: "one-round", captain: "responder" };
const STAYMAN_RESPONSE_DELTA: NegotiationDelta = { forcing: "none" };

export const staymanLocal: LocalFsm<StaymanPhase> = {
  initial: "idle",
  transitions: [
    { from: "idle", to: "asked", on: { act: "inquire", feature: "majorSuit" } },
    { from: "idle", to: "inactive", on: { act: "transfer" } },
    { from: "idle", to: "inactive", on: { act: "raise" } },
    { from: "idle", to: "inactive", on: { act: "place" } },
    { from: "idle", to: "inactive", on: { act: "signoff" } },
    { from: "asked", to: "shown-hearts", on: { act: "show", feature: "heldSuit", suit: "hearts" } },
    { from: "asked", to: "shown-spades", on: { act: "show", feature: "heldSuit", suit: "spades" } },
    { from: "asked", to: "denied", on: { act: "deny", feature: "majorSuit" } },
  ],
};

export function createStaymanStates(sys: SystemConfig): readonly StateEntry<StaymanPhase>[] {
  return [
    { phase: "idle", turn: "responder" as const, negotiationDelta: STAYMAN_ASK_DELTA, surfaces: [createStaymanR1Surface(sys)] },
    { phase: "asked", turn: "opener" as const, negotiationDelta: STAYMAN_RESPONSE_DELTA, surfaces: OPENER_STAYMAN_SURFACES },
    { phase: "shown-hearts", turn: "responder" as const, surfaces: createStaymanR3After2HSurfaces(sys) },
    { phase: "shown-spades", turn: "responder" as const, surfaces: createStaymanR3After2SSurfaces(sys) },
    { phase: "denied", turn: "responder" as const, surfaces: createStaymanR3After2DSurfaces(sys) },
  ];
}

// ─── Module declarations ─────────────────────────────────────

/** Factory: creates Stayman declaration parts (facts + explanations).
 *  Full ConventionModule assembly happens in module-registry.ts. */
export function createStaymanDeclarations(sys: SystemConfig) {
  return {
    facts: createStaymanFacts(sys),
    explanationEntries: STAYMAN_EXPLANATION_ENTRIES,
  };
}

/** Self-contained factory producing a complete ConventionModule. */
export const moduleFactory = (sys: SystemConfig): ConventionModule => ({
  moduleId: "stayman",
  description: "Stayman — bid 2C over 1NT to find a 4-4 major-suit fit",
  purpose: "Discover whether opener holds a 4-card major so the partnership can play in an 8-card major fit instead of notrump",
  ...createStaymanDeclarations(sys),
  local: staymanLocal,
  states: createStaymanStates(sys),
});
