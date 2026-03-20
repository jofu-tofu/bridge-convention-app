/**
 * Generic module composition — assembles ConventionModule[] into a
 * BaseModuleSpec + SurfaceFragment map + merged bundle content.
 *
 * This replaces per-bundle hand-authored base-track.ts files. Each bundle
 * provides a BundleSkeleton (opening patterns + scaffold states) and this
 * function handles everything else:
 * - Positional precedence assignment
 * - Surface group merging (including cross-module contributions)
 * - Fact catalog merging
 * - Explanation entry merging
 * - MachineState → FrameStateSpec conversion
 * - Entry transition injection into skeleton
 * - Hook transition wiring
 */

import type { ConventionModule } from "../../../core/contracts/convention-module";
import type { MeaningSurface } from "../../../core/contracts/meaning";
import type {
  BaseModuleSpec,
  FrameStateSpec,
  SurfaceFragment,
  OpeningPatternSpec,
  TransitionSpec,
} from "../protocol/types";
import type { FactCatalogExtension } from "../../../core/contracts/fact-catalog";
import type { ExplanationEntry } from "../../../core/contracts/explanation-catalog";
import type { MachineTransition } from "../runtime/machine-types";
import { machineStatesToFrameStates, matchToEventPattern } from "./machine-to-frame";
import { createSurface } from "../surface-builder";

// ── Public types ────────────────────────────────────────────────────

/**
 * Bundle-specific scaffolding — the only hand-authored part per bundle.
 * Defines opening patterns and the skeleton FSM states that modules
 * plug into (idle → opened → entry → terminal + interrupt states).
 */
export interface BundleSkeleton {
  /** Opening patterns — what bid(s) start this convention. */
  readonly openingPatterns: readonly OpeningPatternSpec[];
  /** Opening surface fragment ID (e.g., "sf:opener-1nt"). */
  readonly openingSurface?: string;
  /** Skeleton state definitions: bundle-specific scaffolding. */
  readonly skeletonStates: readonly FrameStateSpec[];
  /** Which skeleton state receives module entry transitions. */
  readonly entryStateId: string;
  /** Initial state ID for the BaseModuleSpec. */
  readonly initialStateId: string;
}

/**
 * Result of composing modules into a bundle.
 */
export interface CompositionResult {
  /** The assembled BaseModuleSpec for the protocol frame. */
  readonly baseTrack: BaseModuleSpec;
  /** Surface fragments keyed by fragment ID. */
  readonly surfaceFragments: Readonly<Record<string, SurfaceFragment>>;
  /** Merged fact extensions from all modules. */
  readonly mergedFacts: FactCatalogExtension;
  /** Merged explanation entries from all modules. */
  readonly mergedExplanations: readonly ExplanationEntry[];
  /** All meaning surfaces organized by groupId (for ConventionBundle). */
  readonly meaningSurfaceGroups: readonly {
    readonly groupId: string;
    readonly surfaces: readonly MeaningSurface[];
  }[];
}

// ── Internals ───────────────────────────────────────────────────────

const BASE_LAYER_PRIORITY = 100;

function fragment(
  id: string,
  surfaces: readonly MeaningSurface[],
): SurfaceFragment {
  return {
    id,
    relation: "compete",
    layerPriority: BASE_LAYER_PRIORITY,
    actionCoverage: "all",
    surfaces,
  };
}

/**
 * Stamp positional precedence on a surface's ranking metadata.
 * Returns a new surface with the precedence value set.
 */
function stampPrecedence(surface: MeaningSurface, precedence: number): MeaningSurface {
  return {
    ...surface,
    ranking: {
      ...surface.ranking,
      modulePrecedence: precedence,
    },
  };
}

/**
 * Convert a MachineTransition to a TransitionSpec for injection into skeleton states.
 */
function machineTransitionToSpec(t: MachineTransition): TransitionSpec {
  return {
    transitionId: t.transitionId,
    when: matchToEventPattern(t.match),
    goto: t.target,
  };
}

// ── Main composition function ───────────────────────────────────────

/**
 * Compose ConventionModule[] into a BaseModuleSpec + supporting data.
 *
 * @param modules The convention modules to compose (order = positional precedence)
 * @param skeleton Bundle-specific scaffolding
 * @param bundleId Bundle identifier for the BaseModuleSpec
 * @param bundleName Human-readable bundle name
 * @param additionalFacts Extra fact extensions not owned by any module (e.g., system facts)
 */
export function composeModules(
  modules: readonly ConventionModule[],
  skeleton: BundleSkeleton,
  bundleId: string,
  bundleName: string,
  additionalFacts?: readonly FactCatalogExtension[],
): CompositionResult {
  // 1. Assign positional precedence and collect all surfaces
  const allEntrySurfaces: MeaningSurface[] = [];
  const surfaceGroupMap = new Map<string, MeaningSurface[]>();
  const allFacts: FactCatalogExtension[] = [];
  const allExplanations: ExplanationEntry[] = [];

  for (let i = 0; i < modules.length; i++) {
    const mod = modules[i]!;
    const precedence = i;

    // Stamp precedence on entry surfaces
    for (const surface of mod.entrySurfaces) {
      allEntrySurfaces.push(stampPrecedence(surface, precedence));
    }

    // Stamp precedence on surface groups and merge by groupId
    for (const group of mod.surfaceGroups) {
      const existing = surfaceGroupMap.get(group.groupId) ?? [];
      for (const surface of group.surfaces) {
        existing.push(stampPrecedence(surface, precedence));
      }
      surfaceGroupMap.set(group.groupId, existing);
    }

    // Collect facts and explanations
    allFacts.push(mod.facts);
    allExplanations.push(...mod.explanationEntries);
  }

  if (additionalFacts) {
    allFacts.push(...additionalFacts);
  }

  // 2. Build surface fragments
  const surfaceFragments: Record<string, SurfaceFragment> = {};

  // Entry surfaces fragment (for the entry state)
  const entryFragmentId = `sf:${skeleton.entryStateId}`;
  surfaceFragments[entryFragmentId] = fragment(entryFragmentId, allEntrySurfaces);

  // Per-group fragments
  for (const [groupId, surfaces] of surfaceGroupMap) {
    const fragId = `sf:${groupId}`;
    surfaceFragments[fragId] = fragment(fragId, surfaces);
  }

  // 3. Compose FSM states
  // a. Convert module machine states to frame states
  const allMachineStates = modules.flatMap((m) => m.machineStates);

  // b. Apply hook transitions: prepend to target states
  const hookMap = new Map<string, MachineTransition[]>();
  for (const mod of modules) {
    if (!mod.hookTransitions) continue;
    for (const hook of mod.hookTransitions) {
      const existing = hookMap.get(hook.targetStateId) ?? [];
      existing.push(...hook.transitions);
      hookMap.set(hook.targetStateId, existing);
    }
  }

  // Apply hooks by mutating machine states before conversion
  const statesWithHooks = allMachineStates.map((state) => {
    const hooks = hookMap.get(state.stateId);
    if (!hooks) return state;
    return {
      ...state,
      transitions: [...hooks, ...state.transitions],
    };
  });

  // c. Convert to FrameStateSpec
  const convertedStates = machineStatesToFrameStates(statesWithHooks);

  // d. Build the entry state with injected module entry transitions
  const entryTransitions: TransitionSpec[] = [];
  for (const mod of modules) {
    for (const t of mod.entryTransitions) {
      entryTransitions.push(machineTransitionToSpec(t));
    }
  }

  // e. Inject entry transitions into the skeleton's entry state
  const modifiedSkeletonStates = skeleton.skeletonStates.map((state) => {
    if (state.id !== skeleton.entryStateId) return state;
    return {
      ...state,
      eventTransitions: [...entryTransitions, ...state.eventTransitions],
    };
  });

  // f. Merge all states into a Record
  const allStates: Record<string, FrameStateSpec> = {};
  for (const state of modifiedSkeletonStates) {
    allStates[state.id] = state;
  }
  for (const state of convertedStates) {
    allStates[state.id] = state;
  }

  // 4. Merge fact catalogs
  const mergedDefinitions = allFacts.flatMap((f) => f.definitions);
  const mergedEvaluators = new Map<string, unknown>();
  const mergedPosteriorEvaluators = new Map<string, unknown>();
  for (const f of allFacts) {
    for (const [k, v] of f.evaluators) {
      mergedEvaluators.set(k, v);
    }
    if (f.posteriorEvaluators) {
      for (const [k, v] of f.posteriorEvaluators) {
        mergedPosteriorEvaluators.set(k, v);
      }
    }
  }

  const mergedFacts: FactCatalogExtension = {
    definitions: mergedDefinitions,
    evaluators: mergedEvaluators as FactCatalogExtension["evaluators"],
    ...(mergedPosteriorEvaluators.size > 0
      ? { posteriorEvaluators: mergedPosteriorEvaluators as FactCatalogExtension["posteriorEvaluators"] }
      : {}),
  };

  // 5. Build BaseModuleSpec
  const baseTrack: BaseModuleSpec = {
    role: "base",
    id: bundleId,
    name: bundleName,
    openingPatterns: skeleton.openingPatterns,
    openingSurface: skeleton.openingSurface,
    initialStateId: skeleton.initialStateId,
    states: allStates,
    facts: mergedFacts,
    explanationEntries: allExplanations,
  };

  // 6. Build meaningSurfaceGroups for ConventionBundle
  const meaningSurfaceGroups = [
    { groupId: skeleton.entryStateId, surfaces: allEntrySurfaces },
    ...Array.from(surfaceGroupMap.entries()).map(([groupId, surfaces]) => ({
      groupId,
      surfaces,
    })),
  ];

  return {
    baseTrack,
    surfaceFragments,
    mergedFacts,
    mergedExplanations: allExplanations,
    meaningSurfaceGroups,
  };
}
