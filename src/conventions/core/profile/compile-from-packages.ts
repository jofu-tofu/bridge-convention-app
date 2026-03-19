/**
 * Profile compiler: assembles a CompiledProfile from SystemProfileIR + ModulePackage[].
 *
 * This is the new path that bypasses BundleSkeleton. Convention authors export
 * ModulePackage[], and this compiler assembles them into a fully resolved profile.
 */

import type { SystemProfileIR } from "../../../core/contracts/agreement-module";
import { defaultPriorityClassMapping, defaultObligationMapping } from "../../../core/contracts/agreement-module";
import type { ModulePackage } from "../modules";
import type {
  CompiledProfile,
  CompileOptions,
  ResolvedModuleEntry,
  ActivationIndex,
  CapabilityIndex,
} from "./types";
import { assembleMachine } from "./machine-assembler";
import {
  mergeFactCatalogs,
  mergeExplanationEntries,
  mergePedagogicalRelations,
  mergeAlternativeGroups,
} from "./registry-merger";

/**
 * Build activation index from the profile's module entries.
 * Maps moduleId to its attachments for runtime activation lookup.
 */
export function buildActivationIndex(
  profile: SystemProfileIR,
): ActivationIndex {
  const moduleAttachments = new Map<
    string,
    SystemProfileIR["modules"][number]["attachments"]
  >();
  for (const entry of profile.modules) {
    moduleAttachments.set(entry.moduleId, entry.attachments);
  }
  return { moduleAttachments };
}

/**
 * Build capability index from packages' declared capabilities.
 * Maps moduleId to its capabilities for activation resolution.
 */
export function buildCapabilityIndex(
  packages: readonly ModulePackage[],
): CapabilityIndex {
  const moduleCapabilities = new Map<string, readonly string[]>();
  for (const pkg of packages) {
    moduleCapabilities.set(pkg.moduleId, pkg.exports.capabilities ?? []);
  }
  return { moduleCapabilities };
}

/**
 * Compile a full CompiledProfile from a SystemProfileIR and ModulePackage[].
 *
 * Steps:
 * a. Merge surfaces → ResolvedModuleEntry[]
 * b. Merge facts → FactCatalog
 * c. Merge explanations → ExplanationCatalogIR
 * d. Merge pedagogical relations
 * e. Build activation index from profile
 * f. Build capability index from packages
 * g. Assemble machine from MachineFragment[]
 * h. Resolve policy from profile's priorityClassMapping
 */
export function compileProfileFromPackages(
  profile: SystemProfileIR,
  packages: readonly ModulePackage[],
  options?: CompileOptions,
): CompiledProfile {
  // a. Merge surfaces: each package becomes a ResolvedModuleEntry
  const resolvedModules: ResolvedModuleEntry[] = packages.map((pkg) => ({
    moduleId: pkg.moduleId,
    surfaceGroups: (pkg.exports.surfaces ?? []).map((s) => ({
      groupId: s.surfaceGroupId,
      surfaces: s.surfaces,
    })),
  }));

  // b. Merge facts from all packages
  const factExtensions = packages
    .map((pkg) => pkg.exports.facts)
    .filter((f): f is NonNullable<typeof f> => f !== undefined);
  const facts = mergeFactCatalogs(factExtensions);

  // c. Merge explanations from all packages
  const allExplanations = packages.flatMap(
    (pkg) => pkg.exports.explanationEntries ?? [],
  );
  const explanations = mergeExplanationEntries(allExplanations);

  // d. Merge pedagogical relations
  const pedagogicalRelations = mergePedagogicalRelations(packages);

  // e. Merge alternative groups (currently empty)
  const alternativeGroups = mergeAlternativeGroups(packages);

  // f. Build activation index from profile
  const activation = buildActivationIndex(profile);

  // g. Build capability index from packages
  const capabilities = buildCapabilityIndex(packages);

  // h. Assemble conversation machine from fragments + handoffs
  const machineId = options?.machineId ?? profile.profileId;
  const fragments = packages
    .map((pkg) => pkg.runtime.machineFragment)
    .filter((f): f is NonNullable<typeof f> => f !== undefined);
  const handoffs = packages.flatMap((pkg) => pkg.runtime.handoffs ?? []);
  const machine = assembleMachine(machineId, fragments, handoffs);

  // i. Resolve policy
  const obligationMapping =
    profile.obligationMapping ?? defaultObligationMapping();
  const priorityClassMapping =
    profile.priorityClassMapping ?? defaultPriorityClassMapping();

  return {
    profileId: profile.profileId,
    profile,
    resolvedModules,
    registries: { facts, explanations },
    pedagogicalRelations,
    alternativeGroups,
    indexes: {
      activation,
      capabilities,
    },
    machine,
    policy: { obligationMapping, priorityClassMapping },
  };
}
