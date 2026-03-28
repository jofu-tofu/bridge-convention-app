/**
 * DONT (Disturbing Opponents' Notrump) convention module.
 *
 * Self-contained module exporting declarations, LocalFsm, and StateEntry[].
 *
 * **No turn matching** — DONT omits turn matching because `deriveTurnRole()` classifies
 * the overcaller as "opponent" (the 1NT opener is "opener"). Phase + route scoping
 * is sufficient because DONT's observations are seat-distinctive.
 *
 * Phases:
 * - idle: before opponent 1NT
 * - r1: after 1NT (overcaller bids)
 * - after-2h/2d/2c/2s/double: advancer responses
 * - wait-reveal/wait-2d-relay/wait-2c-relay: relay phases
 * - done: terminal
 */

import type { SystemConfig } from "../../system-config";
import type { BidMeaning } from "../../../pipeline/evaluation/meaning";
import type { ConventionModule } from "../../../core/convention-module";
import type { LocalFsm, StateEntry } from "../../../core/rule-module";
import { BidSuit } from "../../../../engine/types";
import { bid } from "../../../core/surface-helpers";
import { createSurface } from "../../../core/surface-builder";
import type { ModuleContext } from "../../../core/surface-builder";
import { dontFacts } from "./facts";
import { DONT_ENTRIES } from "./explanation-catalog";
import { DONT_MEANING_IDS } from "./ids";
import {
  DONT_R1_SURFACES,
  DONT_ADVANCER_2H_SURFACES,
  DONT_ADVANCER_2D_SURFACES,
  DONT_ADVANCER_2C_SURFACES,
  DONT_ADVANCER_2S_SURFACES,
  DONT_ADVANCER_DOUBLE_SURFACES,
  DONT_REVEAL_SURFACES,
  DONT_2C_RELAY_SURFACES,
  DONT_2D_RELAY_SURFACES,
} from "./meaning-surfaces";

// ── Stub 1NT opening surface ──────────────────────────────────────

const DONT_CTX: ModuleContext = { moduleId: "dont" };

const OPPONENT_1NT_SURFACE: BidMeaning = createSurface({
  meaningId: DONT_MEANING_IDS.OPPONENT_1NT,
  semanticClassId: "dont:opponent-open",
  encoding: bid(1, BidSuit.NoTrump),
  clauses: [],
  band: "must",
  declarationOrder: 0,
  sourceIntent: { type: "NTOpening", params: {} },
  teachingLabel: "Opponent's 1NT",
  disclosure: "natural",
}, DONT_CTX);

// ── Phase type ────────────────────────────────────────────────────

type Phase =
  | "idle"
  | "r1"
  | "after-2h"
  | "after-2d"
  | "after-2c"
  | "after-2s"
  | "after-double"
  | "wait-reveal"
  | "wait-2d-relay"
  | "wait-2c-relay"
  | "done";

// ── Local FSM ─────────────────────────────────────────────────────

const dontLocal: LocalFsm<Phase> = {
  initial: "idle",
  transitions: [
      { from: "idle", to: "r1", on: { act: "open", strain: "notrump" } },
      { from: "r1", to: "after-2h", on: { act: "show", feature: "heldSuit", suit: "spades" } },
      { from: "r1", to: "after-2d", on: { act: "show", feature: "heldSuit", suit: "diamonds" } },
      { from: "r1", to: "after-2c", on: { act: "show", feature: "heldSuit", suit: "clubs" } },
      { from: "r1", to: "after-2s", on: { act: "overcall", feature: "heldSuit", suit: "spades" } },
      { from: "r1", to: "after-double", on: { act: "overcall", feature: "heldSuit" } },
      { from: "r1", to: "done", on: { act: "pass" } },
      { from: "after-2h", to: "done", on: { act: "accept" } },
      { from: "after-2h", to: "done", on: { act: "show" } },
      { from: "after-2d", to: "done", on: { act: "accept" } },
      { from: "after-2d", to: "done", on: { act: "show" } },
      { from: "after-2d", to: "wait-2d-relay", on: { act: "inquire", feature: "majorSuit" } },
      { from: "after-2c", to: "done", on: { act: "accept" } },
      { from: "after-2c", to: "done", on: { act: "show" } },
      { from: "after-2c", to: "wait-2c-relay", on: { act: "inquire", feature: "heldSuit" } },
      { from: "after-2s", to: "done", on: { act: "accept" } },
      { from: "after-2s", to: "done", on: { act: "show" } },
      { from: "after-double", to: "done", on: { act: "accept" } },
      { from: "after-double", to: "done", on: { act: "show" } },
      { from: "after-double", to: "wait-reveal", on: { act: "relay" } },
      { from: "wait-reveal", to: "done", on: { act: "show" } },
      { from: "wait-2d-relay", to: "done", on: { act: "show" } },
      { from: "wait-2c-relay", to: "done", on: { act: "show" } },
  ],
};

// ── State entries ─────────────────────────────────────────────────

/** Creates DONT state entries. No turn matching (see module doc). No negotiationDelta. */
function createDontStates(): readonly StateEntry<Phase>[] {
  return [
    { phase: "idle", surfaces: [OPPONENT_1NT_SURFACE] },
    { phase: "r1", surfaces: DONT_R1_SURFACES },
    { phase: "after-2h", surfaces: DONT_ADVANCER_2H_SURFACES },
    { phase: "after-2d", surfaces: DONT_ADVANCER_2D_SURFACES },
    { phase: "after-2c", surfaces: DONT_ADVANCER_2C_SURFACES },
    { phase: "after-2s", surfaces: DONT_ADVANCER_2S_SURFACES },
    { phase: "after-double", surfaces: DONT_ADVANCER_DOUBLE_SURFACES },
    { phase: "wait-reveal", surfaces: DONT_REVEAL_SURFACES },
    { phase: "wait-2c-relay", surfaces: DONT_2C_RELAY_SURFACES },
    { phase: "wait-2d-relay", surfaces: DONT_2D_RELAY_SURFACES },
  ];
}

// ── Module declarations ───────────────────────────────────────────

function createDontModule(_sys: SystemConfig) {
  return {
    facts: dontFacts,
    explanationEntries: DONT_ENTRIES,
  };
}

/** Self-contained factory producing a complete ConventionModule. */
export const moduleFactory = (sys: SystemConfig): ConventionModule => ({
  moduleId: "dont",
  description: "Disturb Opponents' No Trump with 2-level overcalls showing specific suit patterns",
  purpose: "Compete against an opponent's 1NT opening by describing your distribution cheaply, letting partner judge fit and level",
  teaching: {
    tradeoff: "DONT overcalls commit to the 2-level immediately — if partner has a misfit, you may go down.",
    principle: "Against a strong 1NT, disrupting their communication is more valuable than finding your own perfect contract.",
    commonMistakes: [
      "Double shows a single long suit (not penalty) — advancer must relay to 2C to discover which suit",
      "2H shows hearts AND a higher suit (spades) — it's not a single-suited overcall",
    ],
  },
  ...createDontModule(sys),
  local: dontLocal,
  states: createDontStates(),
});
