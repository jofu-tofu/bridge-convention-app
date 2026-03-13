import type { SystemProfileIR } from "../../../core/contracts/agreement-module";
import type { RuntimeDiagnostic } from "./types";

export interface ProfileDiagnostic extends RuntimeDiagnostic {
  readonly moduleId?: string;
}

/**
 * Validate a system profile for semantic collisions.
 *
 * If two modules assign different semanticClassIds to the same defaultCall,
 * a diagnostic error is emitted.
 *
 * @param profile - The system profile to validate
 * @param surfaceLookup - Optional function to look up surfaces by moduleId.
 *   Returns an array of objects with defaultCall and optional semanticClassId.
 * @returns Array of diagnostics (empty = valid)
 */
export function validateProfile(
  profile: SystemProfileIR,
  surfaceLookup?: (moduleId: string) => readonly { defaultCall: string; semanticClassId?: string }[],
): readonly ProfileDiagnostic[] {
  const diagnostics: ProfileDiagnostic[] = [];

  if (!surfaceLookup) {
    return diagnostics;
  }

  // Track call → { semanticClassId, moduleId } for collision detection
  const callMeanings = new Map<string, { semanticClassId: string; moduleId: string }>();

  for (const module of profile.modules) {
    const surfaces = surfaceLookup(module.moduleId);

    for (const surface of surfaces) {
      if (!surface.semanticClassId) continue;

      const existing = callMeanings.get(surface.defaultCall);
      if (existing) {
        if (existing.semanticClassId !== surface.semanticClassId) {
          diagnostics.push({
            level: "error",
            moduleId: module.moduleId,
            message:
              `Semantic collision on call "${surface.defaultCall}": ` +
              `module "${existing.moduleId}" assigns "${existing.semanticClassId}" ` +
              `but module "${module.moduleId}" assigns "${surface.semanticClassId}"`,
          });
        }
      } else {
        callMeanings.set(surface.defaultCall, {
          semanticClassId: surface.semanticClassId,
          moduleId: module.moduleId,
        });
      }
    }
  }

  // Second pass: detect same semanticClassId with different defaultCalls
  const semanticClassCalls = new Map<string, { defaultCall: string; moduleId: string }>();

  for (const module of profile.modules) {
    const surfaces = surfaceLookup(module.moduleId);

    for (const surface of surfaces) {
      if (!surface.semanticClassId) continue;

      const existing = semanticClassCalls.get(surface.semanticClassId);
      if (existing) {
        if (existing.defaultCall !== surface.defaultCall) {
          diagnostics.push({
            level: "error",
            moduleId: module.moduleId,
            message:
              `Semantic collision on semanticClassId "${surface.semanticClassId}": ` +
              `module "${existing.moduleId}" encodes as "${existing.defaultCall}" ` +
              `but module "${module.moduleId}" encodes as "${surface.defaultCall}"`,
          });
        }
      } else {
        semanticClassCalls.set(surface.semanticClassId, {
          defaultCall: surface.defaultCall,
          moduleId: module.moduleId,
        });
      }
    }
  }

  return diagnostics;
}
