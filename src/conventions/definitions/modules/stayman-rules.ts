/**
 * Stayman — rule definitions for rule-based surface selection.
 *
 * Phases: "idle" | "asked" | "shown-hearts" | "shown-spades" | "denied" | "inactive"
 * - idle: before any R1 bid (Stayman entry available)
 * - asked: after 2C Stayman ask (opener response surfaces)
 * - shown-hearts: after opener shows hearts (R3 surfaces)
 * - shown-spades: after opener shows spades (R3 surfaces)
 * - denied: after opener denies major (R3 surfaces)
 * - inactive: after a non-Stayman R1 bid was made (transfer, NT invite, etc.)
 */

import type { LocalFsm, Rule } from "../../core/rule-module";
import type { NegotiationDelta } from "../../../core/contracts/committed-step";
import type { SystemConfig } from "../../../core/contracts/system-config";
import {
  createStaymanR1Surface,
  OPENER_STAYMAN_SURFACES,
  STAYMAN_R3_AFTER_2H_SURFACES,
  STAYMAN_R3_AFTER_2S_SURFACES,
  STAYMAN_R3_AFTER_2D_SURFACES,
} from "./stayman";

type Phase = "idle" | "asked" | "shown-hearts" | "shown-spades" | "denied" | "inactive";

// ── Kernel deltas (derived from old FSM entryEffects) ───────────────

/** 2C Stayman ask: forcing one round, responder is captain. */
const STAYMAN_ASK_DELTA: NegotiationDelta = { forcing: "one-round", captain: "responder" };

/** Opener responds to Stayman: forcing resolved (one-round obligation fulfilled). */
const STAYMAN_RESPONSE_DELTA: NegotiationDelta = { forcing: "none" };

export const staymanLocal: LocalFsm<Phase> = {
  initial: "idle",
  transitions: [
    // idle → asked when Stayman inquiry is observed
    { from: "idle", to: "asked", on: { act: "inquire", feature: "majorSuit" } },
    // idle → inactive on any non-Stayman R1 action
    { from: "idle", to: "inactive", on: { act: "transfer" } },
    { from: "idle", to: "inactive", on: { act: "raise" } },
    { from: "idle", to: "inactive", on: { act: "place" } },
    { from: "idle", to: "inactive", on: { act: "signoff" } },
    // asked → shown/denied based on opener response
    { from: "asked", to: "shown-hearts", on: { act: "show", feature: "heldSuit", suit: "hearts" } },
    { from: "asked", to: "shown-spades", on: { act: "show", feature: "heldSuit", suit: "spades" } },
    { from: "asked", to: "denied", on: { act: "deny", feature: "majorSuit" } },
  ],
};

/** Factory: creates Stayman rules parameterized by system config. */
export function createStaymanRuleDefs(sys: SystemConfig): readonly Rule<Phase>[] {
  const staymanR1Surface = createStaymanR1Surface(sys);

  return [
    // R1: Stayman entry (only at idle — before any R1 bid)
    {
      match: { local: "idle" as const, turn: "responder" as const },
      claims: [{ surface: staymanR1Surface, negotiationDelta: STAYMAN_ASK_DELTA }],
    },
    // Opener response surfaces — forcing resolved on all responses
    {
      match: { local: "asked" as const, turn: "opener" as const },
      claims: OPENER_STAYMAN_SURFACES.map((s) => ({
        surface: s,
        negotiationDelta: STAYMAN_RESPONSE_DELTA,
      })),
    },
    // R3 after hearts shown (terminal decisions — no kernel change)
    {
      match: { local: "shown-hearts" as const, turn: "responder" as const },
      claims: STAYMAN_R3_AFTER_2H_SURFACES.map((s) => ({ surface: s })),
    },
    // R3 after spades shown
    {
      match: { local: "shown-spades" as const, turn: "responder" as const },
      claims: STAYMAN_R3_AFTER_2S_SURFACES.map((s) => ({ surface: s })),
    },
    // R3 after denial
    {
      match: { local: "denied" as const, turn: "responder" as const },
      claims: STAYMAN_R3_AFTER_2D_SURFACES.map((s) => ({ surface: s })),
    },
  ];
}
