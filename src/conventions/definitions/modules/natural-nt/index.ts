import type { SystemConfig } from "../../system-config";
import type { ConventionModule } from "../../../core/convention-module";
import type { LocalFsm, StateEntry } from "../../../core/rule-module";

import { createOpener1NtSurface, createNtR1Surfaces, createSuitOpeningSurfaces } from "./meaning-surfaces";
import { NT_EXPLANATION_ENTRIES } from "./explanation-catalog";

// ─── Local FSM + States ──────────────────────────────────────

type NaturalBidsPhase = "idle" | "opened-nt" | "opened-suit" | "responded";

const naturalBidsLocal: LocalFsm<NaturalBidsPhase> = {
  initial: "idle",
  transitions: [
    { from: "idle", to: "opened-nt", on: { act: "open", strain: "notrump" } },
    { from: "idle", to: "opened-suit", on: { act: "open" } },
    { from: "opened-nt", to: "responded", on: { act: "inquire" } },
    { from: "opened-nt", to: "responded", on: { act: "transfer" } },
    { from: "opened-nt", to: "responded", on: { act: "raise" } },
    { from: "opened-nt", to: "responded", on: { act: "place" } },
    { from: "opened-nt", to: "responded", on: { act: "signoff" } },
    { from: "opened-nt", to: "responded", on: { act: "show" } },
    // opened-suit has no transitions yet — Phase 2 adds response surfaces
  ],
};

function createNaturalBidsStates(sys: SystemConfig): readonly StateEntry<NaturalBidsPhase>[] {
  return [
    { phase: "idle", turn: "opener" as const, surfaces: [...createOpener1NtSurface(sys), ...createSuitOpeningSurfaces(sys)] },
    { phase: "opened-nt", turn: "responder" as const, surfaces: createNtR1Surfaces(sys) },
  ];
}

// ─── Module declarations ─────────────────────────────────────

/** Factory: creates natural-bids declaration parts (facts + explanations).
 *  Full ConventionModule assembly happens in module-registry.ts. */
export function createNaturalBidsDeclarations(_sys: SystemConfig) {
  return {
    facts: { definitions: [], evaluators: new Map() } as const,
    explanationEntries: NT_EXPLANATION_ENTRIES,
  };
}

/** Self-contained factory producing a complete ConventionModule. */
export const moduleFactory = (sys: SystemConfig): ConventionModule => ({
  moduleId: "natural-bids",
  description: "Standard non-alertable bids: natural openings, notrump responses, and common natural sequences",
  purpose: "Provide the universal base layer of natural bids so every convention has standard entry points and fallback bidding",
  teaching: {
    principle: "When no major fit exists, raise notrump to the level your combined HCP supports — 25 total for game.",
    commonMistakes: [
      "Don't jump to 3NT with a worthless doubleton — consider if a suit contract might be safer",
      "With a flat 8-9 HCP hand, 2NT (invite) is correct — don't stretch to game with marginal values",
    ],
  },
  ...createNaturalBidsDeclarations(sys),
  local: naturalBidsLocal,
  states: createNaturalBidsStates(sys),
});
