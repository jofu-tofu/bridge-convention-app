import type { DealConstraints } from "../../../engine/types";
import type { ConventionBundle } from "../bundle/bundle-types";
import type { ModulePackage, MeaningSurfaceContribution } from "./module-package";
import type { MachineFragment } from "./machine-fragment";
import type { MachineState } from "../runtime/machine-types";
import { createExplanationCatalog } from "../../../core/contracts/explanation-catalog";
import type { FactCatalogExtension } from "../../../core/contracts/fact-catalog";
import type { AttachmentIR } from "../../../core/contracts/agreement-module";

/**
 * Convert a ConventionBundle to ModulePackage[].
 *
 * A bundle is a flat container; this maps it to the structured ModulePackage
 * format. The bundle itself becomes a single package (or one per member if
 * the bundle has memberIds and a systemProfile with per-module attachments).
 */
export function conventionBundleToPackages(bundle: ConventionBundle): ModulePackage[] {
  // Collect surface contributions from meaningSurfaces groups
  const surfaceContributions: MeaningSurfaceContribution[] =
    (bundle.meaningSurfaces ?? []).map(group => ({
      surfaceGroupId: group.groupId,
      surfaces: group.surfaces,
    }));

  // Collect all semantic class IDs from surfaces
  const semanticClasses = collectSemanticClasses(surfaceContributions);

  // Build machine fragment from conversationMachine
  const machineFragment = buildMachineFragment(bundle);

  // Collect activation attachments from systemProfile
  const activation = collectActivation(bundle);

  // Merge all fact extensions into one (bundles can have multiple)
  const mergedFacts = mergeFacts(bundle.factExtensions);

  // Collect explanation entries
  const explanationEntries = bundle.explanationCatalog?.entries
    ? [...bundle.explanationCatalog.entries]
    : undefined;

  // Collect pedagogical relations
  const pedagogicalRelations = bundle.pedagogicalRelations
    ? [...bundle.pedagogicalRelations]
    : undefined;

  // Build the primary package for the bundle
  const pkg: ModulePackage = {
    moduleId: bundle.id,
    meta: {
      description: bundle.description,
    },
    exports: {
      facts: mergedFacts,
      surfaces: surfaceContributions.length > 0 ? surfaceContributions : undefined,
      explanationEntries,
      pedagogicalRelations,
      semanticClasses: semanticClasses.length > 0 ? semanticClasses : undefined,
    },
    runtime: {
      activation: activation.length > 0 ? activation : undefined,
      machineFragment,
    },
  };

  return [pkg];
}

/** Metadata required to reconstruct a ConventionBundle from packages. */
export interface BundleReconstructionMeta {
  readonly id: string;
  readonly name: string;
  readonly dealConstraints: DealConstraints;
  readonly memberIds?: readonly string[];
  readonly category?: ConventionBundle["category"];
  readonly description?: string;
}

/**
 * Convert ModulePackage[] back to a ConventionBundle (for backward compat).
 *
 * This is the inverse of conventionBundleToPackages. It collects surfaces,
 * facts, explanations, and relations from all packages and reassembles
 * them into a ConventionBundle.
 */
export function packagesToConventionBundle(
  packages: readonly ModulePackage[],
  meta: BundleReconstructionMeta,
): ConventionBundle {
  // Collect all surface contributions
  const meaningSurfaces = packages
    .flatMap(pkg => pkg.exports.surfaces ?? [])
    .map(contrib => ({
      groupId: contrib.surfaceGroupId,
      surfaces: contrib.surfaces,
    }));

  // Collect all fact extensions
  const factExtensions = packages
    .filter(pkg => pkg.exports.facts !== undefined)
    .map(pkg => pkg.exports.facts!);

  // Collect all explanation entries
  const allExplanations = packages
    .flatMap(pkg => pkg.exports.explanationEntries ?? []);

  // Collect all pedagogical relations
  const allRelations = packages
    .flatMap(pkg => pkg.exports.pedagogicalRelations ?? []);

  return {
    id: meta.id,
    name: meta.name,
    memberIds: meta.memberIds ?? packages.map(p => p.moduleId),
    dealConstraints: meta.dealConstraints,
    category: meta.category,
    description: meta.description,
    meaningSurfaces: meaningSurfaces.length > 0 ? meaningSurfaces : undefined,
    factExtensions: factExtensions.length > 0 ? factExtensions : undefined,
    explanationCatalog: allExplanations.length > 0
      ? createExplanationCatalog([...allExplanations])
      : undefined,
    pedagogicalRelations: allRelations.length > 0 ? allRelations : undefined,
  };
}

// ── Internal helpers ────────────────────────────────────────────

function collectSemanticClasses(
  contributions: readonly MeaningSurfaceContribution[],
): string[] {
  const classes = new Set<string>();
  for (const contrib of contributions) {
    for (const surface of contrib.surfaces) {
      if (surface.semanticClassId) {
        classes.add(surface.semanticClassId);
      }
    }
  }
  return [...classes];
}

function buildMachineFragment(
  bundle: ConventionBundle,
): MachineFragment | undefined {
  if (!bundle.conversationMachine) return undefined;

  const machine = bundle.conversationMachine;
  const allStates: MachineState[] = [...machine.states.values()];

  // Entry transitions come from the initial state
  const initialState = machine.states.get(machine.initialStateId);
  const entryTransitions = initialState?.transitions
    ? [...initialState.transitions]
    : [];

  return {
    states: allStates,
    entryTransitions,
  };
}

function collectActivation(bundle: ConventionBundle): AttachmentIR[] {
  if (!bundle.systemProfile) return [];

  return bundle.systemProfile.modules.flatMap(mod => [...mod.attachments]);
}

function mergeFacts(
  extensions: readonly FactCatalogExtension[] | undefined,
): FactCatalogExtension | undefined {
  if (!extensions || extensions.length === 0) return undefined;
  if (extensions.length === 1) return extensions[0];

  // Merge multiple extensions into one
  const mergedDefs = extensions.flatMap(ext => [...ext.definitions]);
  const mergedEvaluators = new Map(
    extensions.flatMap(ext => [...ext.evaluators]),
  );

  return {
    definitions: mergedDefs,
    evaluators: mergedEvaluators,
  };
}
