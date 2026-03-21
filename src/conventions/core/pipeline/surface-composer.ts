import type { CandidateTransform } from "../../../core/contracts/meaning";
import type { BidMeaning } from "../../../core/contracts/meaning";
import type { Call } from "../../../engine/types";
import type {
  ArbitrationResult,
  CompositionResult,
  TransformApplication,
  CompositionDiagnostic,
} from "../../../core/contracts/module-surface";
import type { TransformTraceEntry, DecisionProvenance } from "../../../core/contracts/provenance";

/**
 * Compose surfaces by applying transforms upstream of the pipeline.
 * Handles `suppress`, `inject`, and `remap` transforms.
 * Unrecognized transform kinds emit a diagnostic.
 */
export function composeSurfaces(
  surfaces: readonly BidMeaning[],
  transforms?: readonly CandidateTransform[],
): CompositionResult {
  if (!transforms || transforms.length === 0) {
    return { composedMeanings: surfaces, appliedTransforms: [], diagnostics: [] };
  }

  const appliedTransforms: TransformApplication[] = [];
  const diagnostics: CompositionDiagnostic[] = [];

  // Partition transforms by kind
  const suppressTransforms: CandidateTransform[] = [];
  const injectTransforms: CandidateTransform[] = [];
  const remapTransforms: CandidateTransform[] = [];

  for (const t of transforms) {
    switch (t.kind) {
      case "suppress":
        suppressTransforms.push(t);
        break;
      case "inject":
        injectTransforms.push(t);
        break;
      case "remap":
        remapTransforms.push(t);
        break;
      default:
        diagnostics.push({
          level: "info",
          message: `Transform kind "${String(t.kind)}" (${t.transformId}) not handled by surface composer — passed through`,
        });
    }
  }

  // ── Phase 1: Suppress ───────────────────────────────────────
  const suppressIds = new Set<string>(suppressTransforms.map((t) => t.targetId));

  const afterSuppress: BidMeaning[] = [];
  const affectedByTarget = new Map<string, string[]>(); // targetId → meaningId[]

  for (const surface of surfaces) {
    const matchedTarget = findMatchingTarget(surface, suppressIds);
    if (matchedTarget !== null) {
      const affected = affectedByTarget.get(matchedTarget) ?? [];
      affected.push(surface.meaningId);
      affectedByTarget.set(matchedTarget, affected);
    } else {
      afterSuppress.push(surface);
    }
  }

  // Record suppress appliedTransforms and diagnostics
  for (const t of suppressTransforms) {
    const affected = affectedByTarget.get(t.targetId);
    if (affected && affected.length > 0) {
      appliedTransforms.push({
        transformId: t.transformId,
        kind: "suppress",
        targetId: t.targetId,
        sourceModuleId: t.sourceModuleId,
        reason: t.reason,
        affectedIds: affected,
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

  // ── Phase 2: Remap ─────────────────────────────────────────
  let composedMeanings = afterSuppress;

  for (const t of remapTransforms) {
    const remapCall = resolveRemapCall(t);
    const remapTargetIds = new Set<string>([t.targetId]);
    const affectedIds: string[] = [];

    composedMeanings = composedMeanings.map((surface) => {
      const matched = findMatchingTarget(surface, remapTargetIds);
      if (matched === null) return surface;
      affectedIds.push(surface.meaningId);

      // Apply encoding remap — create a new surface with updated encoding
      const newEncoding = remapCall
        ? { ...surface.encoding, defaultCall: remapCall }
        : surface.encoding;

      return { ...surface, encoding: newEncoding } as BidMeaning;
    });

    if (affectedIds.length > 0) {
      appliedTransforms.push({
        transformId: t.transformId,
        kind: "remap",
        targetId: t.targetId,
        sourceModuleId: t.sourceModuleId,
        reason: t.reason,
        affectedIds: affectedIds,
      });
      diagnostics.push({
        level: "info",
        message: `Remapped surface "${t.targetId}" via transform "${t.transformId}" from module "${t.sourceModuleId}" (affected: ${affectedIds.join(", ")})`,
      });
    } else {
      diagnostics.push({
        level: "warn",
        message: `Remap transform "${t.transformId}" targets "${t.targetId}" but no matching surface found`,
      });
    }
  }

  // ── Phase 3: Inject ─────────────────────────────────────────
  for (const t of injectTransforms) {
    if (!t.surface) {
      diagnostics.push({
        level: "warn",
        message: `Inject transform "${t.transformId}" missing required surface field — skipped`,
      });
      continue;
    }

    composedMeanings = [...composedMeanings, t.surface];
    appliedTransforms.push({
      transformId: t.transformId,
      kind: "inject",
      targetId: t.targetId,
      sourceModuleId: t.sourceModuleId,
      reason: t.reason,
      affectedIds: [t.surface.meaningId],
    });
    diagnostics.push({
      level: "info",
      message: `Injected surface "${t.surface.meaningId}" via transform "${t.transformId}" from module "${t.sourceModuleId}"`,
    });
  }

  return { composedMeanings, appliedTransforms, diagnostics };
}

/** Check if a surface matches a target (by meaningId or semanticClassId). */
function findMatchingTarget(
  surface: BidMeaning,
  targetIds: Set<string>,
): string | null {
  if (targetIds.has(surface.meaningId)) return surface.meaningId;
  if (surface.semanticClassId && targetIds.has(surface.semanticClassId)) return surface.semanticClassId;
  return null;
}

/** Resolve the effective Call for a remap transform (newCall takes precedence over remapTo.defaultCall). */
function resolveRemapCall(t: CandidateTransform): Call | undefined {
  if (t.newCall) return t.newCall;
  if (t.remapTo?.defaultCall) return t.remapTo.defaultCall;
  return undefined;
}

/**
 * Graft upstream transform provenance into an ArbitrationResult.
 * Keeps provenance grafting co-located with the composer that produces the data.
 */
export function mergeUpstreamProvenance(
  result: ArbitrationResult,
  appliedTransforms: readonly TransformApplication[],
  diagnostics?: readonly CompositionDiagnostic[],
): ArbitrationResult {
  if (appliedTransforms.length === 0 && !diagnostics?.length && result.provenance?.surfaceDiagnostics) return result;

  const transformTraces: TransformTraceEntry[] = appliedTransforms.map((t) => ({
    transformId: t.transformId,
    kind: t.kind,
    targetId: t.targetId,
    sourceModuleId: t.sourceModuleId,
    reason: t.reason,
    affectedIds: t.affectedIds,
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
