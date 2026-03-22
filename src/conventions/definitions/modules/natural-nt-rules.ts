/**
 * Natural NT — rule definitions for rule-based surface selection.
 *
 * Phases: "idle" | "opened" | "responded"
 * - idle: before 1NT opening (opener surfaces)
 * - opened: after 1NT opening, before any responder action (R1 surfaces)
 * - responded: after responder makes any bid (no more natural NT surfaces)
 */

import type { LocalFsm, Rule } from "../../core/rule-module";
import type { SystemConfig } from "../../../core/contracts/system-config";
import {
  createOpener1NtSurface,
  NT_R1_SURFACES,
} from "./natural-nt";

type Phase = "idle" | "opened" | "responded";

export const naturalNtLocal: LocalFsm<Phase> = {
  initial: "idle",
  transitions: [
    { from: "idle", to: "opened", on: { act: "open", strain: "notrump" } },
    // Any responder action moves us past R1 — these are the possible R1 acts
    { from: "opened", to: "responded", on: { act: "inquire" } },
    { from: "opened", to: "responded", on: { act: "transfer" } },
    { from: "opened", to: "responded", on: { act: "raise" } },
    { from: "opened", to: "responded", on: { act: "place" } },
    { from: "opened", to: "responded", on: { act: "signoff" } },
    { from: "opened", to: "responded", on: { act: "show" } },
  ],
};

/** Factory: creates natural-nt rules parameterized by system config. */
export function createNaturalNtRuleDefs(sys: SystemConfig): readonly Rule<Phase>[] {
  const opener1NtSurface = createOpener1NtSurface(sys);
  return [
    // Opener 1NT surface
    {
      match: { local: "idle" as const, turn: "opener" as const },
      claims: opener1NtSurface.map((s) => ({ surface: s })),
    },
    // R1 responder surfaces (only while in "opened" — before any responder bid)
    {
      match: { local: "opened" as const, turn: "responder" as const },
      claims: NT_R1_SURFACES.map((s) => ({ surface: s })),
    },
  ];
}
