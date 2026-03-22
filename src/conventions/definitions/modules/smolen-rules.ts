/**
 * Smolen — RuleModule for rule-based surface selection.
 *
 * The proof case for the rule interpreter: Smolen activates via a route
 * pattern (subseq of inquire + deny in the observation log), NOT via
 * hookTransitions into Stayman's FSM state ID.
 *
 * Phases: "idle" | "post-r1" | "placing-hearts" | "placing-spades" | "done"
 * - idle: before any responder bid (R1 entries available)
 * - post-r1: after any responder action (R3 Smolen bids available via route)
 * - placing-hearts: after responder bid 3H Smolen (opener places contract)
 * - placing-spades: after responder bid 3S Smolen (opener places contract)
 * - done: after opener places
 */

import type { RuleModule, RouteExpr } from "../../core/rule-module";
import type { NegotiationDelta } from "../../../core/contracts/committed-step";
import {
  smolenModule,
  smolenFacts,
  SMOLEN_ENTRY_SURFACES,
  SMOLEN_R3_SURFACES,
  OPENER_SMOLEN_HEARTS_SURFACES,
  OPENER_SMOLEN_SPADES_SURFACES,
} from "./smolen";

type Phase = "idle" | "post-r1" | "placing-hearts" | "placing-spades" | "done";

// Entry surfaces: Smolen Stayman entries (2C with 5-4 hand)
const smolenEntrySurfaces = SMOLEN_ENTRY_SURFACES;

// R3 surfaces: 3H/3S Smolen bids after Stayman denial
const smolenR3Surfaces = SMOLEN_R3_SURFACES;

// ── Kernel deltas (derived from old FSM entryEffects) ───────────────

/** Smolen entry (2C): same as Stayman ask — forcing one round, responder is captain. */
const SMOLEN_ENTRY_DELTA: NegotiationDelta = { forcing: "one-round", captain: "responder" };

/**
 * Smolen 3H (shows short hearts = 5 spades): game-forcing, tentative spade fit,
 * captain transfers to opener for final placement.
 * Derived from smolen-invoke-hearts entryEffects:
 *   setAgreedStrain: { suit: "spades", confidence: "tentative" },
 *   setForcingState: GameForcing
 */
const SMOLEN_3H_DELTA: NegotiationDelta = {
  forcing: "game",
  captain: "opener",
  fitAgreed: { strain: "spades", confidence: "tentative" },
};

/**
 * Smolen 3S (shows short spades = 5 hearts): game-forcing, tentative heart fit,
 * captain transfers to opener for final placement.
 */
const SMOLEN_3S_DELTA: NegotiationDelta = {
  forcing: "game",
  captain: "opener",
  fitAgreed: { strain: "hearts", confidence: "tentative" },
};

// Route: Stayman inquiry followed by denial — skips intervening passes
const AFTER_STAYMAN_DENIAL: RouteExpr = {
  kind: "subseq",
  steps: [
    { act: "inquire", feature: "majorSuit" },
    { act: "deny", feature: "majorSuit" },
  ],
};

export const smolenRules: RuleModule<Phase> = {
  id: "smolen",
  local: {
    initial: "idle",
    transitions: [
      // Any R1-level responder action moves past the entry phase
      { from: "idle", to: "post-r1", on: { act: "inquire" } },
      { from: "idle", to: "post-r1", on: { act: "transfer" } },
      { from: "idle", to: "post-r1", on: { act: "raise" } },
      { from: "idle", to: "post-r1", on: { act: "place" } },
      { from: "idle", to: "post-r1", on: { act: "signoff" } },
      { from: "idle", to: "post-r1", on: { act: "show" } },
      // post-r1 → placing when Smolen show(shortMajor) is observed
      { from: "post-r1", to: "placing-hearts", on: { act: "show", feature: "shortMajor", suit: "hearts" } },
      { from: "post-r1", to: "placing-spades", on: { act: "show", feature: "shortMajor", suit: "spades" } },
      // placing → done when opener places
      { from: "placing-hearts", to: "done", on: { act: "place" } },
      { from: "placing-spades", to: "done", on: { act: "place" } },
    ],
  },
  rules: [
    // Smolen R1 entries: 2C with game-forcing 5-4 hand (only at R1)
    {
      match: { local: "idle", turn: "responder" },
      claims: smolenEntrySurfaces.map((s) => ({
        surface: s,
        negotiationDelta: SMOLEN_ENTRY_DELTA,
      })),
    },
    // R3 Smolen bids: 3H/3S after Stayman denial
    // Route pattern replaces hookTransitions into Stayman's state ID
    // Per-surface deltas: 3H → spade fit, 3S → heart fit (bid shows SHORT major)
    {
      match: {
        local: "post-r1",
        turn: "responder",
        route: AFTER_STAYMAN_DENIAL,
      },
      claims: smolenR3Surfaces.map((s) => ({
        surface: s,
        negotiationDelta: s.meaningId === "smolen:bid-short-hearts"
          ? SMOLEN_3H_DELTA
          : SMOLEN_3S_DELTA,
      })),
    },
    // Opener placement after Smolen 3H (terminal)
    {
      match: { local: "placing-hearts", turn: "opener" },
      claims: OPENER_SMOLEN_HEARTS_SURFACES.map((s) => ({ surface: s })),
    },
    // Opener placement after Smolen 3S (terminal)
    {
      match: { local: "placing-spades", turn: "opener" },
      claims: OPENER_SMOLEN_SPADES_SURFACES.map((s) => ({ surface: s })),
    },
  ],
  facts: smolenFacts,
  explanationEntries: smolenModule.explanationEntries,
};
