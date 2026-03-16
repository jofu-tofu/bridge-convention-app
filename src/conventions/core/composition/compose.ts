/**
 * Generic bottom-up module composition for convention bundles.
 *
 * Takes a BundleSkeleton (the shared FSM infrastructure) and an array of
 * ConventionModules, then assembles them into the fields a ConventionBundle needs.
 *
 * The skeleton provides:
 *  - Infrastructure states (idle, opened, contested, terminal, etc.)
 *  - The entry/dispatch state where modules plug in their transitions
 *  - Any pre-entry transitions (e.g., idle → opened → dispatch)
 *
 * Each module provides:
 *  - Entry surfaces and transitions for the dispatch state
 *  - Post-entry FSM states and surface groups
 *  - Facts, explanations, pedagogical relations
 *  - hookTransitions to inject into other modules' states
 */
import type { MeaningSurface } from "../../../core/contracts/meaning";
import type { Auction, Seat } from "../../../engine/types";
import type {
  ConversationMachine,
  MachineState,
} from "../runtime/machine-types";
import { buildConversationMachine } from "../runtime/machine-types";
import type { FactCatalogExtension } from "../../../core/contracts/fact-catalog";
import {
  createExplanationCatalog,
  type ExplanationCatalogIR,
} from "../../../core/contracts/explanation-catalog";
import type { PedagogicalRelation } from "../../../core/contracts/teaching-projection";
import { evaluateMachine } from "../runtime/machine-evaluator";
import type { ConventionModule } from "./module-types";

// ── Bundle skeleton ─────────────────────────────────────────────

/**
 * The shared FSM infrastructure that modules plug into.
 *
 * A skeleton defines the "scaffolding" states that exist regardless of which
 * modules are active: idle, opened, contested, terminal, and the entry/dispatch
 * state where modules contribute their transitions.
 *
 * Examples:
 * - NT: idle → nt-opened → responder-r1 (dispatch) → terminal / nt-contested
 * - Bergen: idle → major-opened-{suit} → responder-r1-{suit} (dispatch) → terminal / contested
 * - DONT: idle → overcaller-r1 (dispatch) → terminal / contested
 */
export interface BundleSkeleton {
  /** Machine ID for the composed conversation machine. */
  readonly machineId: string;

  /** Infrastructure states provided by the skeleton.
   *  Must include exactly one state whose stateId matches `dispatchStateId`. */
  readonly states: readonly MachineState[];

  /** The state ID where modules plug in their entry transitions.
   *  This state's transitions array will be populated from module entryTransitions.
   *  The skeleton should provide this state with an empty or minimal transitions array. */
  readonly dispatchStateId: string;

  /** Surface group ID for the dispatch state's entry surfaces.
   *  Module entrySurfaces are merged into a group with this ID. */
  readonly entrySurfaceGroupId: string;
}

// ── Composition result ──────────────────────────────────────────

export interface ComposedBundle {
  /** Group ID for the dispatch state's entry surfaces (from the skeleton). */
  readonly entrySurfaceGroupId: string;
  readonly entrySurfaces: readonly MeaningSurface[];
  readonly surfaceGroups: readonly {
    readonly groupId: string;
    readonly surfaces: readonly MeaningSurface[];
  }[];
  readonly conversationMachine: ConversationMachine;
  readonly submachines: ReadonlyMap<string, ConversationMachine>;
  readonly factExtensions: readonly FactCatalogExtension[];
  readonly explanationCatalog: ExplanationCatalogIR;
  readonly pedagogicalRelations: readonly PedagogicalRelation[];
  readonly surfaceRouter: (auction: Auction, seat: Seat) => readonly MeaningSurface[];
}

/**
 * Compose ConventionModules bottom-up into a unified bundle.
 *
 * @param skeleton - Shared FSM infrastructure (idle, dispatch, terminal, etc.)
 * @param modules - Convention modules to compose (order determines entry transition priority)
 * @param crossModuleRelations - Pedagogical relations that span module boundaries
 */
export function composeModules(
  skeleton: BundleSkeleton,
  modules: readonly ConventionModule[],
  crossModuleRelations: readonly PedagogicalRelation[] = [],
): ComposedBundle {
  // 1. Merge entry surfaces from all modules
  const entrySurfaces: MeaningSurface[] = [];
  for (const mod of modules) {
    entrySurfaces.push(...mod.entrySurfaces);
  }

  // 2. Merge surface groups — same groupId across modules get concatenated
  const groupMap = new Map<string, MeaningSurface[]>();
  for (const mod of modules) {
    for (const group of mod.surfaceGroups) {
      const existing = groupMap.get(group.groupId);
      if (existing) {
        existing.push(...group.surfaces);
      } else {
        groupMap.set(group.groupId, [...group.surfaces]);
      }
    }
  }
  const surfaceGroups = Array.from(groupMap.entries()).map(
    ([groupId, surfaces]) => ({ groupId, surfaces: surfaces as readonly MeaningSurface[] }),
  );

  // 3. Merge entry transitions (module order = priority)
  const entryTransitions = modules.flatMap((mod) => mod.entryTransitions);

  // 4. Collect all module machine states
  const moduleStates: MachineState[] = [];
  for (const mod of modules) {
    moduleStates.push(...mod.machineStates);
  }

  // 5. Apply hookTransitions: prepend hook transitions to target states
  const stateMap = new Map<string, MachineState>();
  for (const state of moduleStates) {
    stateMap.set(state.stateId, state);
  }
  for (const mod of modules) {
    if (!mod.hookTransitions) continue;
    for (const hook of mod.hookTransitions) {
      const target = stateMap.get(hook.targetStateId);
      if (target) {
        stateMap.set(hook.targetStateId, {
          ...target,
          transitions: [...hook.transitions, ...target.transitions],
        });
      }
    }
  }

  // 6. Build the composed FSM: skeleton states + module states
  //    Inject entry transitions into the skeleton's dispatch state.
  const skeletonStates = skeleton.states.map((state) => {
    if (state.stateId === skeleton.dispatchStateId) {
      return {
        ...state,
        transitions: [...entryTransitions, ...state.transitions],
      };
    }
    return state;
  });
  const allStates = [...skeletonStates, ...stateMap.values()];
  const conversationMachine = buildConversationMachine(skeleton.machineId, allStates);

  // 7. Collect submachines
  const submachines = new Map<string, ConversationMachine>();
  for (const mod of modules) {
    if (mod.submachines) {
      for (const [id, machine] of mod.submachines) {
        submachines.set(id, machine);
      }
    }
  }

  // 8. Collect fact extensions
  const factExtensions = modules.map((mod) => mod.facts);

  // 9. Build explanation catalog from all module entries
  const allEntries = modules.flatMap((mod) => mod.explanationEntries);
  const explanationCatalog = createExplanationCatalog(allEntries);

  // 10. Merge pedagogical relations: intra-module + cross-module
  const pedagogicalRelations = [
    ...modules.flatMap((mod) => mod.pedagogicalRelations),
    ...crossModuleRelations,
  ];

  // 11. Build the surface router
  //     Collect all routed surface groups: entry surfaces + module groups
  const allRoutedGroups = [
    { groupId: skeleton.entrySurfaceGroupId, surfaces: entrySurfaces as readonly MeaningSurface[] },
    ...surfaceGroups,
  ];
  // Also include skeleton states that have surfaceGroupIds not covered by modules
  // (e.g., idle's "opener-1nt" group is provided by a module's surfaceGroups, not entry)
  const groupLookup = new Map<string, readonly MeaningSurface[]>();
  for (const group of allRoutedGroups) {
    groupLookup.set(group.groupId, group.surfaces);
  }

  const surfaceRouter = (auction: Auction, seat: Seat): readonly MeaningSurface[] => {
    const result = evaluateMachine(conversationMachine, auction, seat, submachines);
    const activeSurfaces: MeaningSurface[] = [];
    for (const groupId of result.activeSurfaceGroupIds) {
      const surfaces = groupLookup.get(groupId);
      if (surfaces) {
        activeSurfaces.push(...surfaces);
      }
    }
    return activeSurfaces;
  };

  return {
    entrySurfaceGroupId: skeleton.entrySurfaceGroupId,
    entrySurfaces,
    surfaceGroups,
    conversationMachine,
    submachines,
    factExtensions,
    explanationCatalog,
    pedagogicalRelations,
    surfaceRouter,
  };
}
