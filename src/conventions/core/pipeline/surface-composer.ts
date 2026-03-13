import type { CandidateTransform } from "../../../core/contracts/meaning";
import type { MeaningSurface } from "../../../core/contracts/meaning-surface";
import type {
  ArbitrationResult,
  SurfaceEvaluationResult,
  TransformApplication,
  SurfaceCompositionDiagnostic,
} from "../../../core/contracts/module-surface";
import type { TransformTraceEntry, DecisionProvenance } from "../../../core/contracts/provenance";

/**
 * Compose surfaces by applying transforms upstream of the pipeline.
 * Currently handles `suppress` transforms; `inject` with surfaces is deferred.
 * Unrecognized transform kinds emit a diagnostic.
 */
export function composeSurfaces(
  surfaces: readonly MeaningSurface[],
  transforms?: readonly CandidateTransform[],
): SurfaceEvaluationResult {
  if (!transforms || transforms.length === 0) {
    return { composedSurfaces: surfaces, appliedTransforms: [], diagnostics: [] };
  }

  const appliedTransforms: TransformApplication[] = [];
  const diagnostics: SurfaceCompositionDiagnostic[] = [];

  // Build suppress-ID set
  const suppressIds = new Set<string>();
  const suppressTransforms: CandidateTransform[] = [];

  for (const t of transforms) {
    if (t.kind === "suppress") {
      suppressIds.add(t.targetId);
      suppressTransforms.push(t);
    } else {
      // inject, remap, etc. — not handled at surface level yet
      diagnostics.push({
        level: "info",
        message: `Transform kind "${t.kind}" (${t.transformId}) not handled by surface composer — passed through`,
      });
    }
  }

  // Filter surfaces and track which meaningIds were affected per transform
  const composedSurfaces: MeaningSurface[] = [];
  const affectedByTarget = new Map<string, string[]>(); // targetId → meaningId[]

  for (const surface of surfaces) {
    const matchedTarget = findMatchingSuppress(surface, suppressIds);
    if (matchedTarget !== null) {
      const affected = affectedByTarget.get(matchedTarget) ?? [];
      affected.push(surface.meaningId);
      affectedByTarget.set(matchedTarget, affected);
    } else {
      composedSurfaces.push(surface);
    }
  }

  // Build appliedTransforms and detect unmatched suppress targets
  for (const t of suppressTransforms) {
    const affected = affectedByTarget.get(t.targetId);
    if (affected && affected.length > 0) {
      appliedTransforms.push({
        transformId: t.transformId,
        kind: "suppress",
        targetId: t.targetId,
        sourceModuleId: t.sourceModuleId,
        reason: t.reason,
        affectedMeaningIds: affected,
      });
      diagnostics.push({
        level: "info",
        message: `Suppressed surface "${t.targetId}" via transform "${t.transformId}" from module "${t.sourceModuleId}" (affected: ${affected.join(", ")})`,
      });
    } else {
      diagnostics.push({
        level: "warn",
        message: `Suppress transform "${t.transformId}" targets "${t.targetId}" but no matching surface found`,
      });
    }
  }

  return { composedSurfaces, appliedTransforms, diagnostics };
}

/** Check if a surface matches any suppress target (by meaningId or semanticClassId). */
function findMatchingSuppress(
  surface: MeaningSurface,
  suppressIds: Set<string>,
): string | null {
  if (suppressIds.has(surface.meaningId)) return surface.meaningId;
  if (surface.semanticClassId && suppressIds.has(surface.semanticClassId)) return surface.semanticClassId;
  return null;
}

/**
 * Graft upstream transform provenance into an ArbitrationResult.
 * Keeps provenance grafting co-located with the composer that produces the data.
 */
export function mergeUpstreamProvenance(
  result: ArbitrationResult,
  appliedTransforms: readonly TransformApplication[],
  diagnostics?: readonly SurfaceCompositionDiagnostic[],
): ArbitrationResult {
  if (appliedTransforms.length === 0 && !diagnostics?.length && result.provenance?.surfaceDiagnostics) return result;

  const transformTraces: TransformTraceEntry[] = appliedTransforms.map((t) => ({
    transformId: t.transformId,
    kind: t.kind,
    targetId: t.targetId,
    sourceModuleId: t.sourceModuleId,
    reason: t.reason,
    affectedCandidateIds: t.affectedMeaningIds,
  }));

  const baseProv = result.provenance;
  const provenance: DecisionProvenance = {
    applicability: baseProv?.applicability ?? { factDependencies: [], evaluatedConditions: [] },
    activation: baseProv?.activation ?? [],
    transforms: [...(baseProv?.transforms ?? []), ...transformTraces],
    encoding: baseProv?.encoding ?? [],
    legality: baseProv?.legality ?? [],
    arbitration: baseProv?.arbitration ?? [],
    eliminations: baseProv?.eliminations ?? [],
    handoffs: baseProv?.handoffs ?? [],
    surfaceDiagnostics: [...(baseProv?.surfaceDiagnostics ?? []), ...(diagnostics ?? [])],
  };

  return { ...result, provenance };
}
