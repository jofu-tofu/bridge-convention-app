// ── ConventionSpec Assembler ─────────────────────────────────────────
//
// Merges modules (base + protocol) into a fully assembled ConventionSpec.
// Validates surface fragment uniqueness and compiles the boot router
// from base-role modules' opening patterns.

import type {
  BaseModuleSpec,
  ProtocolModuleSpec,
  ModuleSpec,
  ConventionSpec,
  PublicSemanticSchema,
  SurfaceFragment,
} from "./types";
import { getBaseModules } from "./types";
import { BRIDGE_SEMANTIC_SCHEMA } from "./bridge-schema";
import { compileBootRouter } from "./boot-router";

/**
 * A module paired with its surface fragment map.
 *
 * Modules reference surface fragment IDs in their states, but the
 * actual SurfaceFragment objects are exported separately (e.g.
 * NT_SURFACE_FRAGMENTS). This pairing lets the assembler collect and
 * validate all fragments at composition time.
 */
export interface ModuleWithSurfaces {
  readonly module: ModuleSpec;
  readonly surfaces: Readonly<Record<string, SurfaceFragment>>;
}

/**
 * Assembles a ConventionSpec from modules (base + protocol).
 *
 * 1. Merges all surface fragments from every module into one record.
 * 2. Validates that no two modules contribute fragments with the same ID.
 * 3. Compiles the boot router from base-role modules' opening patterns.
 * 4. Uses the provided schema or defaults to BRIDGE_SEMANTIC_SCHEMA.
 *
 * @throws Error if surface fragment IDs collide between modules.
 */
export function assembleConventionSpec(options: {
  id: string;
  name: string;
  modules: (ModuleSpec | ModuleWithSurfaces)[];
  schema?: PublicSemanticSchema;
}): ConventionSpec {
  const {
    id,
    name,
    schema = BRIDGE_SEMANTIC_SCHEMA,
  } = options;

  const moduleEntries = [...options.modules];

  // Normalize inputs: separate modules from their surface companions.
  const allModules: ModuleSpec[] = [];
  const allSurfaces: Record<string, SurfaceFragment> = {};
  const surfaceOwnership = new Map<string, string>();

  for (const entry of moduleEntries) {
    const isWithSurfaces = "module" in entry && "surfaces" in entry;
    const mod: ModuleSpec = isWithSurfaces
      ? (entry as ModuleWithSurfaces).module
      : (entry as ModuleSpec);
    const surfaceFragments: Readonly<Record<string, SurfaceFragment>> =
      isWithSurfaces ? (entry as ModuleWithSurfaces).surfaces : {};

    allModules.push(mod);

    // Merge surfaces with collision detection.
    for (const [fragmentId, fragment] of Object.entries(surfaceFragments)) {
      const existingOwner = surfaceOwnership.get(fragmentId);
      if (existingOwner !== undefined) {
        throw new Error(
          `Surface fragment ID collision: "${fragmentId}" is contributed by ` +
            `both "${existingOwner}" and "${mod.id}"`,
        );
      }
      surfaceOwnership.set(fragmentId, mod.id);
      allSurfaces[fragmentId] = fragment;
    }
  }

  // Compile the boot router from base-role modules' opening patterns.
  const baseModules = getBaseModules({ modules: allModules } as ConventionSpec);
  compileBootRouter(baseModules);

  return {
    id,
    name,
    schema,
    modules: allModules,
    surfaces: allSurfaces,
  };
}
