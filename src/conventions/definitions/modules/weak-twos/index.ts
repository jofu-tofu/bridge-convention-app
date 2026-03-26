/**
 * Weak Twos convention module.
 *
 * Self-contained module exporting a ConventionModule object.
 * LocalFsm and StateEntry[] define the declarative surface selection.
 */

import type { SystemConfig } from "../../system-config";
import type { FactCatalogExtension } from "../../../core/fact-catalog";
import type { ExplanationEntry } from "../../../core/explanation-catalog";
import type { ConventionModule } from "../../../core/convention-module";
import type { LocalFsm, StateEntry } from "../../../core/rule-module";
import type { NegotiationDelta } from "../../../core/committed-step";
import { weakTwoFacts } from "./facts";
import { WEAK_TWO_ENTRIES } from "./explanation-catalog";
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

// ── Phase type ──────────────────────────────────────────────────

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

// ── Kernel deltas ───────────────────────────────────────────────

/** Ogust ask: forcing one round (opener must respond). */
const OGUST_ASK_DELTA: NegotiationDelta = { forcing: "one-round" };

/** Ogust response: forcing resolved. */
const OGUST_RESPONSE_DELTA: NegotiationDelta = { forcing: "none" };

// ── Local FSM ───────────────────────────────────────────────────

const weakTwosLocal: LocalFsm<Phase> = {
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

    // Raise, invite, pass -> terminal
    { from: "opened-hearts", to: "done", on: { act: "raise" } },
    { from: "opened-hearts", to: "done", on: { act: "pass" } },
    { from: "opened-spades", to: "done", on: { act: "raise" } },
    { from: "opened-spades", to: "done", on: { act: "pass" } },
    { from: "opened-diamonds", to: "done", on: { act: "raise" } },
    { from: "opened-diamonds", to: "done", on: { act: "pass" } },

    // Ogust response -> post-Ogust
    { from: "ogust-asked-hearts", to: "post-ogust-hearts", on: { act: "show", feature: "suitQuality" } },
    { from: "ogust-asked-hearts", to: "post-ogust-hearts", on: { act: "show", feature: "strength" } },
    { from: "ogust-asked-spades", to: "post-ogust-spades", on: { act: "show", feature: "suitQuality" } },
    { from: "ogust-asked-spades", to: "post-ogust-spades", on: { act: "show", feature: "strength" } },
    { from: "ogust-asked-diamonds", to: "post-ogust-diamonds", on: { act: "show", feature: "suitQuality" } },
    { from: "ogust-asked-diamonds", to: "post-ogust-diamonds", on: { act: "show", feature: "strength" } },

    // Post-Ogust -> terminal
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
};

// ── State entries ───────────────────────────────────────────────

/** Creates Weak Twos state entries (declarative surface selection). */
function createWeakTwosStates(): readonly StateEntry<Phase>[] {
  return [
    // R0: Weak Two opening (opener bids 2H/2S/2D)
    {
      phase: "idle",
      turn: "opener" as const,
      surfaces: WEAK_TWO_R1_SURFACES,
    },

    // R1: Responder after hearts opening — Ogust surfaces (with forcing delta)
    {
      phase: "opened-hearts",
      turn: "responder" as const,
      negotiationDelta: OGUST_ASK_DELTA,
      surfaces: WEAK_TWO_R2_HEARTS_SURFACES.filter((s) => s.sourceIntent.type === "OgustAsk"),
    },
    // R1: Responder after hearts opening — non-Ogust surfaces (no delta)
    {
      phase: "opened-hearts",
      turn: "responder" as const,
      surfaces: WEAK_TWO_R2_HEARTS_SURFACES.filter((s) => s.sourceIntent.type !== "OgustAsk"),
    },

    // R1: Responder after spades opening — Ogust surfaces (with forcing delta)
    {
      phase: "opened-spades",
      turn: "responder" as const,
      negotiationDelta: OGUST_ASK_DELTA,
      surfaces: WEAK_TWO_R2_SPADES_SURFACES.filter((s) => s.sourceIntent.type === "OgustAsk"),
    },
    // R1: Responder after spades opening — non-Ogust surfaces (no delta)
    {
      phase: "opened-spades",
      turn: "responder" as const,
      surfaces: WEAK_TWO_R2_SPADES_SURFACES.filter((s) => s.sourceIntent.type !== "OgustAsk"),
    },

    // R1: Responder after diamonds opening — Ogust surfaces (with forcing delta)
    {
      phase: "opened-diamonds",
      turn: "responder" as const,
      negotiationDelta: OGUST_ASK_DELTA,
      surfaces: WEAK_TWO_R2_DIAMONDS_SURFACES.filter((s) => s.sourceIntent.type === "OgustAsk"),
    },
    // R1: Responder after diamonds opening — non-Ogust surfaces (no delta)
    {
      phase: "opened-diamonds",
      turn: "responder" as const,
      surfaces: WEAK_TWO_R2_DIAMONDS_SURFACES.filter((s) => s.sourceIntent.type !== "OgustAsk"),
    },

    // Ogust response: opener shows hand quality
    {
      phase: "ogust-asked-hearts",
      turn: "opener" as const,
      negotiationDelta: OGUST_RESPONSE_DELTA,
      surfaces: WEAK_TWO_OGUST_HEARTS_SURFACES,
    },
    {
      phase: "ogust-asked-spades",
      turn: "opener" as const,
      negotiationDelta: OGUST_RESPONSE_DELTA,
      surfaces: WEAK_TWO_OGUST_SPADES_SURFACES,
    },
    {
      phase: "ogust-asked-diamonds",
      turn: "opener" as const,
      negotiationDelta: OGUST_RESPONSE_DELTA,
      surfaces: WEAK_TWO_OGUST_DIAMONDS_SURFACES,
    },

    // Post-Ogust: responder decides (terminal)
    {
      phase: "post-ogust-hearts",
      turn: "responder" as const,
      surfaces: POST_OGUST_HEARTS_SURFACES,
    },
    {
      phase: "post-ogust-spades",
      turn: "responder" as const,
      surfaces: POST_OGUST_SPADES_SURFACES,
    },
    {
      phase: "post-ogust-diamonds",
      turn: "responder" as const,
      surfaces: POST_OGUST_DIAMONDS_SURFACES,
    },
  ];
}

// ── Module declarations ─────────────────────────────────────────

/** Module parts returned by createWeakTwosModule (declaration-only — no local/rules). */
interface WeakTwosModuleParts {
  readonly facts: FactCatalogExtension;
  readonly explanationEntries: readonly ExplanationEntry[];
}

/**
 * Create Weak Twos module declaration parts for the given system config.
 *
 * Returns facts and explanations only. Full ConventionModule assembly
 * (adding local FSM + rules/states) happens in module-registry.ts.
 */
function createWeakTwosModule(_sys: SystemConfig): WeakTwosModuleParts {
  return {
    facts: weakTwoFacts,
    explanationEntries: WEAK_TWO_ENTRIES,
  };
}

/** Self-contained factory producing a complete ConventionModule. */
export const moduleFactory = (sys: SystemConfig): ConventionModule => ({
  moduleId: "weak-twos",
  description: "Weak Twos — open 2D/2H/2S with 6+ cards and 5-11 HCP, responses include Ogust",
  purpose: "Preempt opponents with a descriptive opening while giving partner enough information to judge game prospects via Ogust",
  teaching: {
    tradeoff: "Using 2D/2H/2S as weak openings means you can't use them for strong two-bids.",
    principle: "Preemption works by consuming bidding space — make opponents guess at a high level with incomplete information.",
    commonMistakes: [
      "Don't open a weak two with a void or a strong 4-card side suit — your hand may play better in the other suit",
      "Ogust 2NT asks opener to describe hand quality — memorize the step responses (3C=weak/weak through 3S=strong/strong)",
    ],
  },
  ...createWeakTwosModule(sys),
  local: weakTwosLocal,
  states: createWeakTwosStates(),
});
