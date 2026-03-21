/**
 * Weak Two Bids — RuleModule for rule-based surface selection.
 *
 * Phases (suit-specific):
 * - idle: before weak two opening
 * - opened-hearts / opened-spades / opened-diamonds: after 2H/2S/2D (R1 responder)
 * - ogust-asked-H/S/D: after 2NT Ogust (opener responds with quality)
 * - post-ogust-H/S/D: after Ogust response (responder decides)
 * - done: terminal
 *
 * Weak Two openings are the opening surface. Unlike NT, the opener IS the
 * convention module (no separate opening module needed).
 */

import type { RuleModule } from "../../../core/rule-module";
import type { KernelDelta } from "../../../../core/contracts/committed-step";
import {
  WEAK_TWO_R1_SURFACES,
  WEAK_TWO_R2_HEARTS_SURFACES,
  WEAK_TWO_R2_SPADES_SURFACES,
  WEAK_TWO_R2_DIAMONDS_SURFACES,
  WEAK_TWO_OGUST_HEARTS_SURFACES,
  WEAK_TWO_OGUST_SPADES_SURFACES,
  WEAK_TWO_OGUST_DIAMONDS_SURFACES,
  POST_OGUST_HEARTS_SURFACES,
  POST_OGUST_SPADES_SURFACES,
  POST_OGUST_DIAMONDS_SURFACES,
} from "./meaning-surfaces";
import { weakTwoFacts } from "./facts";
import { WEAK_TWO_ENTRIES } from "./explanation-catalog";

type Phase =
  | "idle"
  | "opened-hearts"
  | "opened-spades"
  | "opened-diamonds"
  | "ogust-asked-hearts"
  | "ogust-asked-spades"
  | "ogust-asked-diamonds"
  | "post-ogust-hearts"
  | "post-ogust-spades"
  | "post-ogust-diamonds"
  | "done";

// ── Kernel deltas ─────────────────────────────────────────────────

/** Ogust ask: forcing one round (opener must respond). */
const OGUST_ASK_DELTA: KernelDelta = { forcing: "one-round" };

/** Ogust response: forcing resolved. */
const OGUST_RESPONSE_DELTA: KernelDelta = { forcing: "none" };

export const weakTwosRules: RuleModule<Phase> = {
  id: "weak-twos",
  local: {
    initial: "idle",
    transitions: [
      // Opening observations
      { from: "idle", to: "opened-hearts", on: { act: "open", strain: "hearts" } },
      { from: "idle", to: "opened-spades", on: { act: "open", strain: "spades" } },
      { from: "idle", to: "opened-diamonds", on: { act: "open", strain: "diamonds" } },

      // Ogust ask (2NT inquiry)
      { from: "opened-hearts", to: "ogust-asked-hearts", on: { act: "inquire", feature: "suitQuality" } },
      { from: "opened-spades", to: "ogust-asked-spades", on: { act: "inquire", feature: "suitQuality" } },
      { from: "opened-diamonds", to: "ogust-asked-diamonds", on: { act: "inquire", feature: "suitQuality" } },

      // Raise, invite, pass → terminal
      { from: "opened-hearts", to: "done", on: { act: "raise" } },
      { from: "opened-hearts", to: "done", on: { act: "pass" } },
      { from: "opened-spades", to: "done", on: { act: "raise" } },
      { from: "opened-spades", to: "done", on: { act: "pass" } },
      { from: "opened-diamonds", to: "done", on: { act: "raise" } },
      { from: "opened-diamonds", to: "done", on: { act: "pass" } },

      // Ogust response → post-Ogust
      { from: "ogust-asked-hearts", to: "post-ogust-hearts", on: { act: "show", feature: "suitQuality" } },
      { from: "ogust-asked-hearts", to: "post-ogust-hearts", on: { act: "show", feature: "strength" } },
      { from: "ogust-asked-spades", to: "post-ogust-spades", on: { act: "show", feature: "suitQuality" } },
      { from: "ogust-asked-spades", to: "post-ogust-spades", on: { act: "show", feature: "strength" } },
      { from: "ogust-asked-diamonds", to: "post-ogust-diamonds", on: { act: "show", feature: "suitQuality" } },
      { from: "ogust-asked-diamonds", to: "post-ogust-diamonds", on: { act: "show", feature: "strength" } },

      // Post-Ogust → terminal
      { from: "post-ogust-hearts", to: "done", on: { act: "raise" } },
      { from: "post-ogust-hearts", to: "done", on: { act: "signoff" } },
      { from: "post-ogust-hearts", to: "done", on: { act: "pass" } },
      { from: "post-ogust-spades", to: "done", on: { act: "raise" } },
      { from: "post-ogust-spades", to: "done", on: { act: "signoff" } },
      { from: "post-ogust-spades", to: "done", on: { act: "pass" } },
      { from: "post-ogust-diamonds", to: "done", on: { act: "raise" } },
      { from: "post-ogust-diamonds", to: "done", on: { act: "signoff" } },
      { from: "post-ogust-diamonds", to: "done", on: { act: "pass" } },
    ],
  },
  rules: [
    // R0: Weak Two opening (opener bids 2H/2S/2D)
    {
      match: { local: "idle", turn: "opener" },
      claims: WEAK_TWO_R1_SURFACES.map((s) => ({ surface: s })),
    },

    // R1: Responder after hearts opening
    {
      match: { local: "opened-hearts", turn: "responder" },
      claims: WEAK_TWO_R2_HEARTS_SURFACES.map((s) => {
        // Ogust 2NT ask is forcing one round
        if (s.sourceIntent.type === "OgustAsk") {
          return { surface: s, kernelDelta: OGUST_ASK_DELTA };
        }
        return { surface: s };
      }),
    },
    {
      match: { local: "opened-spades", turn: "responder" },
      claims: WEAK_TWO_R2_SPADES_SURFACES.map((s) => {
        if (s.sourceIntent.type === "OgustAsk") {
          return { surface: s, kernelDelta: OGUST_ASK_DELTA };
        }
        return { surface: s };
      }),
    },
    {
      match: { local: "opened-diamonds", turn: "responder" },
      claims: WEAK_TWO_R2_DIAMONDS_SURFACES.map((s) => {
        if (s.sourceIntent.type === "OgustAsk") {
          return { surface: s, kernelDelta: OGUST_ASK_DELTA };
        }
        return { surface: s };
      }),
    },

    // Ogust response: opener shows hand quality
    {
      match: { local: "ogust-asked-hearts", turn: "opener" },
      claims: WEAK_TWO_OGUST_HEARTS_SURFACES.map((s) => ({
        surface: s,
        kernelDelta: OGUST_RESPONSE_DELTA,
      })),
    },
    {
      match: { local: "ogust-asked-spades", turn: "opener" },
      claims: WEAK_TWO_OGUST_SPADES_SURFACES.map((s) => ({
        surface: s,
        kernelDelta: OGUST_RESPONSE_DELTA,
      })),
    },
    {
      match: { local: "ogust-asked-diamonds", turn: "opener" },
      claims: WEAK_TWO_OGUST_DIAMONDS_SURFACES.map((s) => ({
        surface: s,
        kernelDelta: OGUST_RESPONSE_DELTA,
      })),
    },

    // Post-Ogust: responder decides (terminal)
    {
      match: { local: "post-ogust-hearts", turn: "responder" },
      claims: POST_OGUST_HEARTS_SURFACES.map((s) => ({ surface: s })),
    },
    {
      match: { local: "post-ogust-spades", turn: "responder" },
      claims: POST_OGUST_SPADES_SURFACES.map((s) => ({ surface: s })),
    },
    {
      match: { local: "post-ogust-diamonds", turn: "responder" },
      claims: POST_OGUST_DIAMONDS_SURFACES.map((s) => ({ surface: s })),
    },
  ],
  facts: weakTwoFacts,
  explanationEntries: WEAK_TWO_ENTRIES,
};
