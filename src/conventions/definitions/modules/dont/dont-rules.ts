/**
 * DONT (Disturbing Opponents' Notrump) — RuleModule.
 *
 * **No match.turn** — DONT omits turn matching because `deriveTurnRole()` classifies
 * the overcaller as "opponent" (the 1NT opener is "opener"). Phase + route scoping
 * is sufficient because DONT's observations are seat-distinctive.
 *
 * Phases:
 * - idle: before opponent 1NT
 * - r1: after 1NT (overcaller bids)
 * - after-2h: advancer responds to 2H (both majors)
 * - after-2d: advancer responds to 2D (diamonds + major)
 * - after-2c: advancer responds to 2C (clubs + higher)
 * - after-2s: advancer responds to 2S (natural spades)
 * - after-double: advancer responds to X (single-suited)
 * - wait-reveal: overcaller reveals suit after forced 2C relay
 * - wait-2d-relay: overcaller shows major after 2D relay
 * - wait-2c-relay: overcaller shows suit after 2C relay
 * - done: terminal
 *
 * Stub 1NT opening surface provides the open(notrump) observation for
 * phase transitions (like Bergen's stub major opening).
 */

import type { RuleModule } from "../../../core/rule-module";
import type { MeaningSurface } from "../../../../core/contracts/meaning";
import { BidSuit } from "../../../../engine/types";
import { bid } from "../../../core/surface-helpers";
import { createSurface } from "../../../core/surface-builder";
import type { ModuleContext } from "../../../core/surface-builder";
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
import { dontFacts } from "./facts";
import { DONT_ENTRIES } from "./explanation-catalog";

// ── Stub 1NT opening surface ──────────────────────────────────────

const DONT_CTX: ModuleContext = { moduleId: "dont" };

const OPPONENT_1NT_SURFACE: MeaningSurface = createSurface({
  meaningId: "dont:opponent-1nt",
  semanticClassId: "dont:opponent-open",
  encoding: bid(1, BidSuit.NoTrump),
  clauses: [],
  band: "must",
  intraModuleOrder: 0,
  sourceIntent: { type: "NTOpening", params: {} },
  teachingLabel: "Opponent's 1NT",
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

// ── Rule module ───────────────────────────────────────────────────

export const dontRules: RuleModule<Phase> = {
  id: "dont",
  local: {
    initial: "idle",
    transitions: [
      // 1NT opening → overcaller's turn
      { from: "idle", to: "r1", on: { act: "open", strain: "notrump" } },

      // R1: overcaller's action → advancer phase
      // Ordering matters: more specific patterns first (first-match semantics)

      // 2H (both majors): unique = show(heldSuit, spades) — only 2H shows spades at R1
      { from: "r1", to: "after-2h", on: { act: "show", feature: "heldSuit", suit: "spades" } },
      // 2D (diamonds + major): unique = show(heldSuit, diamonds) at R1
      { from: "r1", to: "after-2d", on: { act: "show", feature: "heldSuit", suit: "diamonds" } },
      // 2C (clubs + higher): unique = show(heldSuit, clubs) at R1
      { from: "r1", to: "after-2c", on: { act: "show", feature: "heldSuit", suit: "clubs" } },
      // 2S (natural spades): overcall(heldSuit, spades) — more specific, before generic overcall
      { from: "r1", to: "after-2s", on: { act: "overcall", feature: "heldSuit", suit: "spades" } },
      // X (single-suited): overcall(heldSuit) — generic, matches any overcall w/ feature
      { from: "r1", to: "after-double", on: { act: "overcall", feature: "heldSuit" } },
      // Pass
      { from: "r1", to: "done", on: { act: "pass" } },

      // Advancer responses → relay/terminal phases
      // After 2H: accept hearts, prefer spades, or escape
      { from: "after-2h", to: "done", on: { act: "accept" } },
      { from: "after-2h", to: "done", on: { act: "show" } },

      // After 2D: relay or accept
      { from: "after-2d", to: "done", on: { act: "accept" } },
      { from: "after-2d", to: "wait-2d-relay", on: { act: "inquire", feature: "majorSuit" } },

      // After 2C: relay or accept
      { from: "after-2c", to: "done", on: { act: "accept" } },
      { from: "after-2c", to: "wait-2c-relay", on: { act: "inquire", feature: "heldSuit" } },

      // After 2S: accept or escape
      { from: "after-2s", to: "done", on: { act: "accept" } },
      { from: "after-2s", to: "done", on: { act: "show" } },

      // After double: forced relay or accept
      { from: "after-double", to: "done", on: { act: "accept" } },
      { from: "after-double", to: "wait-reveal", on: { act: "relay" } },

      // Reveal/relay responses → terminal
      { from: "wait-reveal", to: "done", on: { act: "show" } },
      { from: "wait-2d-relay", to: "done", on: { act: "show" } },
      { from: "wait-2c-relay", to: "done", on: { act: "show" } },
    ],
  },
  rules: [
    // Stub: opponent 1NT opening (for phase transition)
    { match: { local: "idle" }, claims: [{ surface: OPPONENT_1NT_SURFACE }] },

    // R1: overcaller's action after 1NT
    { match: { local: "r1" }, claims: DONT_R1_SURFACES.map((s) => ({ surface: s })) },

    // Advancer responses (suit-specific)
    { match: { local: "after-2h" }, claims: DONT_ADVANCER_2H_SURFACES.map((s) => ({ surface: s })) },
    { match: { local: "after-2d" }, claims: DONT_ADVANCER_2D_SURFACES.map((s) => ({ surface: s })) },
    { match: { local: "after-2c" }, claims: DONT_ADVANCER_2C_SURFACES.map((s) => ({ surface: s })) },
    { match: { local: "after-2s" }, claims: DONT_ADVANCER_2S_SURFACES.map((s) => ({ surface: s })) },
    { match: { local: "after-double" }, claims: DONT_ADVANCER_DOUBLE_SURFACES.map((s) => ({ surface: s })) },

    // Overcaller reveal/relay (after advancer's forced 2C)
    { match: { local: "wait-reveal" }, claims: DONT_REVEAL_SURFACES.map((s) => ({ surface: s })) },
    { match: { local: "wait-2c-relay" }, claims: DONT_2C_RELAY_SURFACES.map((s) => ({ surface: s })) },
    { match: { local: "wait-2d-relay" }, claims: DONT_2D_RELAY_SURFACES.map((s) => ({ surface: s })) },
  ],
  facts: dontFacts,
  explanationEntries: DONT_ENTRIES,
};
