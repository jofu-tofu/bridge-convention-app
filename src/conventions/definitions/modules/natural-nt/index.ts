import type { SystemConfig } from "../../system-config";
import type { ConventionModule } from "../../../core/convention-module";
import type { LocalFsm, StateEntry } from "../../../core/rule-module";

import { createOpener1NtSurface, createNtR1Surfaces } from "./meaning-surfaces";
import { NT_EXPLANATION_ENTRIES } from "./explanation-catalog";

// Re-export surface factories for external consumers
export { createNtR1Surfaces, createOpener1NtSurface } from "./meaning-surfaces";

// ─── Local FSM + States ──────────────────────────────────────

type NaturalNtPhase = "idle" | "opened" | "responded";

export const naturalNtLocal: LocalFsm<NaturalNtPhase> = {
  initial: "idle",
  transitions: [
    { from: "idle", to: "opened", on: { act: "open", strain: "notrump" } },
    { from: "opened", to: "responded", on: { act: "inquire" } },
    { from: "opened", to: "responded", on: { act: "transfer" } },
    { from: "opened", to: "responded", on: { act: "raise" } },
    { from: "opened", to: "responded", on: { act: "place" } },
    { from: "opened", to: "responded", on: { act: "signoff" } },
    { from: "opened", to: "responded", on: { act: "show" } },
  ],
};

export function createNaturalNtStates(sys: SystemConfig): readonly StateEntry<NaturalNtPhase>[] {
  return [
    { phase: "idle", turn: "opener" as const, surfaces: createOpener1NtSurface(sys) },
    { phase: "opened", turn: "responder" as const, surfaces: createNtR1Surfaces(sys) },
  ];
}

// ─── Module declarations ─────────────────────────────────────

/** Factory: creates natural-nt declaration parts (facts + explanations).
 *  Full ConventionModule assembly happens in module-registry.ts. */
export function createNaturalNtDeclarations(_sys: SystemConfig) {
  return {
    facts: { definitions: [], evaluators: new Map() } as const,
    explanationEntries: NT_EXPLANATION_ENTRIES,
  };
}

/** Self-contained factory producing a complete ConventionModule. */
export const moduleFactory = (sys: SystemConfig): ConventionModule => ({
  moduleId: "natural-nt",
  description: "Natural NT responses — raise to 2NT (invite) or 3NT (game) with no major fit",
  purpose: "Place the notrump contract at the right level when no major-suit fit is worth exploring",
  teaching: {
    principle: "When no major fit exists, raise notrump to the level your combined HCP supports — 25 total for game.",
    commonMistakes: [
      "Don't jump to 3NT with a worthless doubleton — consider if a suit contract might be safer",
      "With a flat 8-9 HCP hand, 2NT (invite) is correct — don't stretch to game with marginal values",
    ],
  },
  ...createNaturalNtDeclarations(sys),
  local: naturalNtLocal,
  states: createNaturalNtStates(sys),
});
