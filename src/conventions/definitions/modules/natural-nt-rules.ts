/**
 * Natural NT — RuleModule for rule-based surface selection.
 *
 * Phases: "idle" | "opened" | "responded"
 * - idle: before 1NT opening (opener surfaces)
 * - opened: after 1NT opening, before any responder action (R1 surfaces)
 * - responded: after responder makes any bid (no more natural NT surfaces)
 */

import type { RuleModule } from "../../core/rule-module";
import {
  naturalNtModule,
  NT_R1_SURFACES,
  OPENER_1NT_SURFACE,
} from "./natural-nt";

type Phase = "idle" | "opened" | "responded";

const r1Surfaces = NT_R1_SURFACES;

export const naturalNtRules: RuleModule<Phase> = {
  id: "natural-nt",
  local: {
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
  },
  rules: [
    // Opener 1NT surface
    {
      match: { local: "idle", turn: "opener" },
      claims: OPENER_1NT_SURFACE.map((s) => ({ surface: s })),
    },
    // R1 responder surfaces (only while in "opened" — before any responder bid)
    {
      match: { local: "opened", turn: "responder" },
      claims: r1Surfaces.map((s) => ({ surface: s })),
    },
  ],
  facts: naturalNtModule.facts,
};
