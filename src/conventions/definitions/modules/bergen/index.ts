/**
 * Bergen Raises convention module.
 *
 * Self-contained module exporting declaration parts, LocalFsm, and StateEntry factory.
 * Full ConventionModule assembly happens in module-registry.ts.
 */

import type { SystemConfig } from "../../../../core/contracts/system-config";
import type { FactCatalogExtension } from "../../../../core/contracts/fact-catalog";
import type { ExplanationEntry } from "../../../../core/contracts/explanation-catalog";
import type { ConventionModule } from "../../../core/convention-module";
import type { LocalFsm, StateEntry } from "../../../core/rule-module";
import type { NegotiationDelta } from "../../../../core/contracts/committed-step";
import type { BidMeaning } from "../../../../core/contracts/meaning";
import { BidSuit } from "../../../../engine/types";
import { bid } from "../../../core/surface-helpers";
import { createSurface } from "../../../core/surface-builder";
import type { ModuleContext } from "../../../core/surface-builder";
import { bergenFacts } from "./facts";
import { BERGEN_EXPLANATION_ENTRIES } from "./explanation-catalog";
import {
  BERGEN_R1_HEARTS_SURFACES,
  BERGEN_R1_SPADES_SURFACES,
  BERGEN_NATURAL_1NT_HEARTS_SURFACES,
  BERGEN_NATURAL_1NT_SPADES_SURFACES,
  BERGEN_R2_AFTER_CONSTRUCTIVE_HEARTS_SURFACES,
  BERGEN_R2_AFTER_CONSTRUCTIVE_SPADES_SURFACES,
  BERGEN_R2_AFTER_LIMIT_HEARTS_SURFACES,
  BERGEN_R2_AFTER_LIMIT_SPADES_SURFACES,
  BERGEN_R2_AFTER_PREEMPTIVE_HEARTS_SURFACES,
  BERGEN_R2_AFTER_PREEMPTIVE_SPADES_SURFACES,
  BERGEN_R3_AFTER_GAME_SURFACES,
  BERGEN_R3_AFTER_SIGNOFF_SURFACES,
  BERGEN_R3_AFTER_GAME_TRY_HEARTS_SURFACES,
  BERGEN_R3_AFTER_GAME_TRY_SPADES_SURFACES,
  BERGEN_R4_SURFACES,
} from "./meaning-surfaces";

// ── Stub opening surfaces ─────────────────────────────────────────
// Bergen needs 1H/1S opening observations for phase transitions.
// These minimal surfaces produce open(hearts)/open(spades) observations
// via normalizeIntent("MajorOpen"). They encode as 1H/1S and have no
// clauses (the opening is pre-filled, not evaluated by Bergen).

const BERGEN_CTX: ModuleContext = { moduleId: "bergen" };

const OPENER_1H_SURFACE: BidMeaning = createSurface({
  meaningId: "bergen:opener-1h",
  semanticClassId: "bergen:major-open",
  encoding: bid(1, BidSuit.Hearts),
  clauses: [],
  band: "must",
  declarationOrder: 0,
  sourceIntent: { type: "MajorOpen", params: { suit: "hearts" } },
  teachingLabel: "1\u2665 opening",
  disclosure: "natural",
}, BERGEN_CTX);

const OPENER_1S_SURFACE: BidMeaning = createSurface({
  meaningId: "bergen:opener-1s",
  semanticClassId: "bergen:major-open",
  encoding: bid(1, BidSuit.Spades),
  clauses: [],
  band: "must",
  declarationOrder: 0,
  sourceIntent: { type: "MajorOpen", params: { suit: "spades" } },
  teachingLabel: "1\u2660 opening",
  disclosure: "natural",
}, BERGEN_CTX);

// ── Phase type ────────────────────────────────────────────────────

type Phase =
  | "idle"
  | "opened-hearts"
  | "opened-spades"
  | "after-constructive-hearts"
  | "after-constructive-spades"
  | "after-limit-hearts"
  | "after-limit-spades"
  | "after-preemptive-hearts"
  | "after-preemptive-spades"
  | "after-game"
  | "after-signoff"
  | "after-game-try-hearts"
  | "after-game-try-spades"
  | "r4"
  | "done";

// ── Kernel deltas ─────────────────────────────────────────────────

/** R1 responder: captain is responder, fit tentatively agreed. */
const R1_HEARTS_DELTA: NegotiationDelta = {
  captain: "responder",
  fitAgreed: { strain: "hearts", confidence: "tentative" },
};
const R1_SPADES_DELTA: NegotiationDelta = {
  captain: "responder",
  fitAgreed: { strain: "spades", confidence: "tentative" },
};

/** R2 opener: captain transfers to opener. */
const R2_OPENER_DELTA: NegotiationDelta = { captain: "opener" };

/** R3 responder: captain back to responder. */
const R3_RESPONDER_DELTA: NegotiationDelta = { captain: "responder" };

/** R4 opener: captain back to opener. */
const R4_OPENER_DELTA: NegotiationDelta = { captain: "opener" };

// ── Local FSM ─────────────────────────────────────────────────────

export const bergenLocal: LocalFsm<Phase> = {
  initial: "idle",
  transitions: [
    // Opening observations advance to suit-specific opened phase
    { from: "idle", to: "opened-hearts", on: { act: "open", strain: "hearts" } },
    { from: "idle", to: "opened-spades", on: { act: "open", strain: "spades" } },

    // R1 raise observations → suit-specific R2 phases
    { from: "opened-hearts", to: "after-constructive-hearts", on: { act: "raise", strain: "hearts", strength: "constructive" } },
    { from: "opened-hearts", to: "after-limit-hearts", on: { act: "raise", strain: "hearts", strength: "limit" } },
    { from: "opened-hearts", to: "after-preemptive-hearts", on: { act: "raise", strain: "hearts", strength: "preemptive" } },
    { from: "opened-hearts", to: "done", on: { act: "raise", strain: "hearts", strength: "game" } },
    { from: "opened-hearts", to: "done", on: { act: "show", feature: "shortage" } },

    // Natural 1NT response terminates Bergen (no further raise conversation)
    { from: "opened-hearts", to: "done", on: { act: "place", strain: "notrump" } },

    { from: "opened-spades", to: "after-constructive-spades", on: { act: "raise", strain: "spades", strength: "constructive" } },
    { from: "opened-spades", to: "after-limit-spades", on: { act: "raise", strain: "spades", strength: "limit" } },
    { from: "opened-spades", to: "after-preemptive-spades", on: { act: "raise", strain: "spades", strength: "preemptive" } },
    { from: "opened-spades", to: "done", on: { act: "raise", strain: "spades", strength: "game" } },
    { from: "opened-spades", to: "done", on: { act: "show", feature: "shortage" } },

    // Natural 1NT response terminates Bergen (no further raise conversation)
    { from: "opened-spades", to: "done", on: { act: "place", strain: "notrump" } },

    // R2 opener → R3 phases
    { from: "after-constructive-hearts", to: "after-game", on: { act: "raise", strength: "game" } },
    { from: "after-constructive-hearts", to: "after-signoff", on: { act: "decline" } },
    { from: "after-constructive-hearts", to: "after-game-try-hearts", on: { act: "accept", strength: "invitational" } },
    { from: "after-constructive-spades", to: "after-game", on: { act: "raise", strength: "game" } },
    { from: "after-constructive-spades", to: "after-signoff", on: { act: "decline" } },
    { from: "after-constructive-spades", to: "after-game-try-spades", on: { act: "accept", strength: "invitational" } },

    { from: "after-limit-hearts", to: "after-game", on: { act: "raise", strength: "game" } },
    { from: "after-limit-hearts", to: "after-signoff", on: { act: "decline" } },
    { from: "after-limit-hearts", to: "after-game-try-hearts", on: { act: "accept", strength: "invitational" } },
    { from: "after-limit-spades", to: "after-game", on: { act: "raise", strength: "game" } },
    { from: "after-limit-spades", to: "after-signoff", on: { act: "decline" } },
    { from: "after-limit-spades", to: "after-game-try-spades", on: { act: "accept", strength: "invitational" } },

    // Preemptive: opener just passes or bids game
    { from: "after-preemptive-hearts", to: "done", on: { act: "raise", strength: "game" } },
    { from: "after-preemptive-hearts", to: "done", on: { act: "pass" } },
    { from: "after-preemptive-spades", to: "done", on: { act: "raise", strength: "game" } },
    { from: "after-preemptive-spades", to: "done", on: { act: "pass" } },

    // R3 responder → R4 or terminal
    { from: "after-game", to: "done", on: { act: "pass" } },
    { from: "after-signoff", to: "done", on: { act: "raise", strength: "game" } },
    { from: "after-signoff", to: "done", on: { act: "pass" } },
    { from: "after-game-try-hearts", to: "r4", on: { act: "accept" } },
    { from: "after-game-try-hearts", to: "r4", on: { act: "decline" } },
    { from: "after-game-try-spades", to: "r4", on: { act: "accept" } },
    { from: "after-game-try-spades", to: "r4", on: { act: "decline" } },

    // R4 → terminal
    { from: "r4", to: "done", on: { act: "pass" } },
  ],
};

// ── State entries ─────────────────────────────────────────────────

/** Factory: creates Bergen state entries. */
export function createBergenStates(_sys: SystemConfig): readonly StateEntry<Phase>[] {
  return [
    // Opening stubs (idle, opener turn)
    {
      phase: "idle",
      turn: "opener" as const,
      surfaces: [OPENER_1H_SURFACE, OPENER_1S_SURFACE],
    },

    // R1: responder raises (hearts) — Bergen surfaces with delta
    {
      phase: "opened-hearts",
      turn: "responder" as const,
      negotiationDelta: R1_HEARTS_DELTA,
      surfaces: BERGEN_R1_HEARTS_SURFACES,
    },
    // R1: responder (hearts) — natural 1NT surfaces without delta
    {
      phase: "opened-hearts",
      turn: "responder" as const,
      surfaces: BERGEN_NATURAL_1NT_HEARTS_SURFACES,
    },

    // R1: responder raises (spades) — Bergen surfaces with delta
    {
      phase: "opened-spades",
      turn: "responder" as const,
      negotiationDelta: R1_SPADES_DELTA,
      surfaces: BERGEN_R1_SPADES_SURFACES,
    },
    // R1: responder (spades) — natural 1NT surfaces without delta
    {
      phase: "opened-spades",
      turn: "responder" as const,
      surfaces: BERGEN_NATURAL_1NT_SPADES_SURFACES,
    },

    // R2: opener after constructive (hearts/spades)
    {
      phase: "after-constructive-hearts",
      turn: "opener" as const,
      negotiationDelta: R2_OPENER_DELTA,
      surfaces: BERGEN_R2_AFTER_CONSTRUCTIVE_HEARTS_SURFACES,
    },
    {
      phase: "after-constructive-spades",
      turn: "opener" as const,
      negotiationDelta: R2_OPENER_DELTA,
      surfaces: BERGEN_R2_AFTER_CONSTRUCTIVE_SPADES_SURFACES,
    },

    // R2: opener after limit (hearts/spades)
    {
      phase: "after-limit-hearts",
      turn: "opener" as const,
      negotiationDelta: R2_OPENER_DELTA,
      surfaces: BERGEN_R2_AFTER_LIMIT_HEARTS_SURFACES,
    },
    {
      phase: "after-limit-spades",
      turn: "opener" as const,
      negotiationDelta: R2_OPENER_DELTA,
      surfaces: BERGEN_R2_AFTER_LIMIT_SPADES_SURFACES,
    },

    // R2: opener after preemptive (hearts/spades)
    {
      phase: "after-preemptive-hearts",
      turn: "opener" as const,
      negotiationDelta: R2_OPENER_DELTA,
      surfaces: BERGEN_R2_AFTER_PREEMPTIVE_HEARTS_SURFACES,
    },
    {
      phase: "after-preemptive-spades",
      turn: "opener" as const,
      negotiationDelta: R2_OPENER_DELTA,
      surfaces: BERGEN_R2_AFTER_PREEMPTIVE_SPADES_SURFACES,
    },

    // R3: responder after game bid
    {
      phase: "after-game",
      turn: "responder" as const,
      negotiationDelta: R3_RESPONDER_DELTA,
      surfaces: BERGEN_R3_AFTER_GAME_SURFACES,
    },

    // R3: responder after signoff
    {
      phase: "after-signoff",
      turn: "responder" as const,
      negotiationDelta: R3_RESPONDER_DELTA,
      surfaces: BERGEN_R3_AFTER_SIGNOFF_SURFACES,
    },

    // R3: responder after game try (hearts)
    {
      phase: "after-game-try-hearts",
      turn: "responder" as const,
      negotiationDelta: R3_RESPONDER_DELTA,
      surfaces: BERGEN_R3_AFTER_GAME_TRY_HEARTS_SURFACES,
    },

    // R3: responder after game try (spades)
    {
      phase: "after-game-try-spades",
      turn: "responder" as const,
      negotiationDelta: R3_RESPONDER_DELTA,
      surfaces: BERGEN_R3_AFTER_GAME_TRY_SPADES_SURFACES,
    },

    // R4: opener final acceptance
    {
      phase: "r4",
      turn: "opener" as const,
      negotiationDelta: R4_OPENER_DELTA,
      surfaces: BERGEN_R4_SURFACES,
    },
  ];
}

// ── Module declarations ───────────────────────────────────────────

/** Module parts returned by createBergenModule (declaration-only — no local/rules). */
export interface BergenModuleParts {
  readonly facts: FactCatalogExtension;
  readonly explanationEntries: readonly ExplanationEntry[];
}

/**
 * Create Bergen module declaration parts for the given system config.
 *
 * Returns facts and explanations only. Full ConventionModule assembly
 * (adding local FSM + states) happens in module-registry.ts.
 */
export function createBergenModule(_sys: SystemConfig): BergenModuleParts {
  return {
    facts: bergenFacts,
    explanationEntries: BERGEN_EXPLANATION_ENTRIES,
  };
}

/** Self-contained factory producing a complete ConventionModule. */
export const moduleFactory = (sys: SystemConfig): ConventionModule => ({
  moduleId: "bergen",
  description: "Bergen Raises — use 3C/3D as artificial raises after 1M to show different strength levels",
  ...createBergenModule(sys),
  local: bergenLocal,
  states: createBergenStates(sys),
});
