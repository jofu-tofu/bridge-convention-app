/**
 * Profile compiler — assembles ModulePackages into a ComposedBundle
 * using profile declarations and machine assembly.
 *
 * This is the new composition path that replaces BundleSkeleton + composeModules()
 * for ModulePackage-based bundles. The output is a ComposedBundle (same as before)
 * so the downstream createBundle() factory works unchanged.
 */
import type { MeaningSurface } from "../../../core/contracts/meaning";
import type { Auction, Seat } from "../../../engine/types";
import type { FactCatalogExtension } from "../../../core/contracts/fact-catalog";
import {
  createExplanationCatalog,
} from "../../../core/contracts/explanation-catalog";
import type { PedagogicalRelation } from "../../../core/contracts/teaching-projection";
import type { SystemProfileIR } from "../../../core/contracts/agreement-module";
import type { MachineState } from "../runtime/machine-types";
import { evaluateMachine } from "../runtime/machine-evaluator";
import type { ModulePackage } from "./module-package";
import type { HandoffSpec } from "./handoff";
import type { ComposedBundle } from "./compose";
import { assembleMachine } from "./machine-assembler";

// ── Compile options ──────────────────────────────────────────────────

export interface CompileFromPackagesOptions {
  /** Machine ID for the assembled conversation machine. */
  readonly machineId: string;
  /** Infrastructure skeleton states (idle, opened, dispatch, terminal, contested).
   *  These are included in the assembled machine before module fragments. */
  readonly skeletonStates?: readonly MachineState[];
  /** The state ID where module entry transitions are injected.
   *  Defaults to "idle". */
  readonly dispatchStateId?: string;
  /** Surface group ID for the dispatch state's entry surfaces.
   *  Module entry surfaces (from fragments with entryTransitions) are
   *  collected into a group with this ID. */
  readonly entrySurfaceGroupId: string;
  /** Cross-module pedagogical relations. */
  readonly crossModuleRelations?: readonly PedagogicalRelation[];
}

// ── Compiler ─────────────────────────────────────────────────────────

/**
 * Compile ModulePackages into a ComposedBundle using profile-driven composition.
 *
 * This function:
 * 1. Merges surface contributions from all packages
 * 2. Collects entry surfaces from packages whose fragments have entryTransitions
 * 3. Assembles the conversation machine from fragments + handoffs
 * 4. Merges fact extensions, explanation entries, pedagogical relations
 * 5. Builds a surface router from the assembled machine
 *
 * The output ComposedBundle is compatible with createBundle().
 */
export function compileProfileFromPackages(
  _profile: SystemProfileIR,
  packages: readonly ModulePackage[],
  options: CompileFromPackagesOptions,
): ComposedBundle {
  // 1. Collect entry surfaces from all packages
  //    Entry surfaces are surfaces contributed to the dispatch/entry group
  const entrySurfaces: MeaningSurface[] = [];
  const surfaceGroupMap = new Map<string, MeaningSurface[]>();

  for (const pkg of packages) {
    if (pkg.exports.surfaces) {
      for (const contribution of pkg.exports.surfaces) {
        if (contribution.groupId === options.entrySurfaceGroupId) {
          // Entry surfaces go into the entry group
          entrySurfaces.push(...contribution.surfaces);
        } else {
          // Non-entry surfaces go into their respective groups
          const existing = surfaceGroupMap.get(contribution.groupId);
          if (existing) {
            existing.push(...contribution.surfaces);
          } else {
            surfaceGroupMap.set(contribution.groupId, [...contribution.surfaces]);
          }
        }
      }
    }
  }

  const surfaceGroups = Array.from(surfaceGroupMap.entries()).map(
    ([groupId, surfaces]) => ({ groupId, surfaces: surfaces as readonly MeaningSurface[] }),
  );

  // 2. Collect machine fragments and handoffs
  const fragments = packages
    .filter((pkg) => pkg.runtime.machineFragment)
    .map((pkg) => pkg.runtime.machineFragment!);

  const handoffs: HandoffSpec[] = [];
  for (const pkg of packages) {
    if (pkg.runtime.handoffs) {
      handoffs.push(...pkg.runtime.handoffs);
    }
  }

  // 3. Assemble the conversation machine
  const { machine: conversationMachine, submachines } = assembleMachine(
    fragments,
    handoffs,
    {
      machineId: options.machineId,
      skeletonStates: options.skeletonStates,
      dispatchStateId: options.dispatchStateId,
    },
  );

  // 4. Collect fact extensions
  const factExtensions: FactCatalogExtension[] = [];
  for (const pkg of packages) {
    if (pkg.exports.facts) {
      factExtensions.push(pkg.exports.facts);
    }
  }

  // 5. Build explanation catalog
  const allEntries = packages.flatMap((pkg) => pkg.exports.explanationEntries ?? []);
  const explanationCatalog = createExplanationCatalog(allEntries);

  // 6. Merge pedagogical relations
  const pedagogicalRelations = [
    ...packages.flatMap((pkg) => pkg.exports.pedagogicalRelations ?? []),
    ...(options.crossModuleRelations ?? []),
  ];

  // 7. Build surface router
  const allRoutedGroups = [
    { groupId: options.entrySurfaceGroupId, surfaces: entrySurfaces as readonly MeaningSurface[] },
    ...surfaceGroups,
  ];
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
    entrySurfaceGroupId: options.entrySurfaceGroupId,
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
