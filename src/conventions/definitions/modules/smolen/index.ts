import type { LocalFsm, StateEntry, RouteExpr } from "../../../core/rule-module";
import type { ConventionModule } from "../../../core/convention-module";
import type { NegotiationDelta } from "../../../core/committed-step";
import type { SystemConfig } from "../../system-config";
import { moduleDescription, modulePurpose, teachingTradeoff, teachingPrinciple, teachingItem } from "../../../core/authored-text";

import { createSmolenEntrySurfaces, createSmolenR3Surfaces, OPENER_SMOLEN_HEARTS_SURFACES, OPENER_SMOLEN_SPADES_SURFACES, RESPONDER_SMOLEN_COMPLETE_SPADES_SURFACES } from "./meaning-surfaces";
import { createSmolenFacts } from "./facts";
import { SMOLEN_EXPLANATION_ENTRIES } from "./explanation-catalog";

// Re-export everything external consumers need
export { createSmolenFacts } from "./facts";

// ─── Local FSM + States ──────────────────────────────────────

type SmolenPhase = "idle" | "post-r1" | "placing-hearts" | "placing-spades" | "accepted-spades" | "done";

const SMOLEN_ENTRY_DELTA: NegotiationDelta = { forcing: "one-round", captain: "responder" };
const SMOLEN_3H_DELTA: NegotiationDelta = { forcing: "game", captain: "opener", fitAgreed: { strain: "spades", confidence: "tentative" } };
const SMOLEN_3S_DELTA: NegotiationDelta = { forcing: "game", captain: "opener", fitAgreed: { strain: "hearts", confidence: "tentative" } };
const SMOLEN_ACCEPT_SPADES_DELTA: NegotiationDelta = { forcing: "game", fitAgreed: { strain: "spades", confidence: "final" } };

const AFTER_STAYMAN_DENIAL: RouteExpr = {
  kind: "subseq",
  steps: [
    { act: "inquire", feature: "majorSuit" },
    { act: "deny", feature: "majorSuit" },
  ],
};

const smolenLocal: LocalFsm<SmolenPhase> = {
  initial: "idle",
  transitions: [
    { from: "idle", to: "post-r1", on: { act: "inquire" } },
    { from: "idle", to: "post-r1", on: { act: "transfer" } },
    { from: "idle", to: "post-r1", on: { act: "raise" } },
    { from: "idle", to: "post-r1", on: { act: "place" } },
    { from: "idle", to: "post-r1", on: { act: "signoff" } },
    { from: "idle", to: "post-r1", on: { act: "show" } },
    { from: "post-r1", to: "placing-hearts", on: { act: "show", feature: "shortMajor", suit: "hearts" } },
    { from: "post-r1", to: "placing-spades", on: { act: "show", feature: "shortMajor", suit: "spades" } },
    { from: "placing-hearts", to: "done", on: { act: "place" } },
    { from: "placing-spades", to: "accepted-spades", on: { act: "accept", feature: "heldSuit", suit: "spades" } },
    { from: "placing-spades", to: "done", on: { act: "place" } },
    { from: "accepted-spades", to: "done", on: { act: "place" } },
  ],
};

// Smolen R3: per-surface deltas (3H → spade fit, 3S → heart fit)

function createSmolenStates(sys: SystemConfig): readonly StateEntry<SmolenPhase>[] {
  const smolenEntrySurfaces = createSmolenEntrySurfaces(sys);
  const smolenR3Surfaces = createSmolenR3Surfaces(sys);
  const smolenR3Hearts = smolenR3Surfaces.filter(s => s.meaningId === "smolen:bid-short-hearts");
  const smolenR3Spades = smolenR3Surfaces.filter(s => s.meaningId === "smolen:bid-short-spades");

  return [
    { phase: "idle", turn: "responder" as const, negotiationDelta: SMOLEN_ENTRY_DELTA, surfaces: smolenEntrySurfaces },
    // R3 Smolen 3H (short hearts → 5 spades): game-forcing, spade fit
    ...(smolenR3Hearts.length > 0 ? [{
      phase: "post-r1" as const, turn: "responder" as const,
      route: AFTER_STAYMAN_DENIAL, negotiationDelta: SMOLEN_3H_DELTA, surfaces: smolenR3Hearts,
    }] : []),
    // R3 Smolen 3S (short spades → 5 hearts): game-forcing, heart fit
    ...(smolenR3Spades.length > 0 ? [{
      phase: "post-r1" as const, turn: "responder" as const,
      route: AFTER_STAYMAN_DENIAL, negotiationDelta: SMOLEN_3S_DELTA, surfaces: smolenR3Spades,
    }] : []),
    { phase: "placing-hearts", turn: "opener" as const, surfaces: OPENER_SMOLEN_HEARTS_SURFACES },
    { phase: "placing-spades", turn: "opener" as const, negotiationDelta: SMOLEN_ACCEPT_SPADES_DELTA, surfaces: OPENER_SMOLEN_SPADES_SURFACES },
    { phase: "accepted-spades", turn: "responder" as const, surfaces: RESPONDER_SMOLEN_COMPLETE_SPADES_SURFACES },
  ];
}

// ─── Module declarations ─────────────────────────────────────

/** Factory: creates Smolen declaration parts (facts + explanations).
 *  Full ConventionModule assembly happens in module-registry.ts. */
export function createSmolenDeclarations(_sys: SystemConfig) {
  return {
    facts: createSmolenFacts(_sys),
    explanationEntries: SMOLEN_EXPLANATION_ENTRIES,
  };
}

/** Self-contained factory producing a complete ConventionModule. */
export const moduleFactory = (sys: SystemConfig): ConventionModule => ({
  moduleId: "smolen",
  description: moduleDescription("Jump to 3H/3S after Stayman denial to show 5-4 in majors, game-forcing"),
  purpose: modulePurpose("Handle the 5-4 major hand with game values after Stayman gets a 2D denial — let opener choose the fit while keeping the strong hand as declarer"),
  teaching: {
    tradeoff: teachingTradeoff("Smolen uses jump bids (3H/3S) that could otherwise be used as natural invitational bids."),
    principle: teachingPrinciple("Bid the shorter major at the 3-level — this tells opener about both majors and lets the strong hand declare."),
    commonMistakes: [
      teachingItem("Smolen bids show the SHORT major — 3H shows 4 hearts and 5 spades, not the other way around"),
      teachingItem("Only use Smolen with game-forcing values — with invitational hands, use a different approach after Stayman denial"),
    ],
  },
  ...createSmolenDeclarations(sys),
  local: smolenLocal,
  states: createSmolenStates(sys),
});
