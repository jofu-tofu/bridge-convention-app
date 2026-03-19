// ── Surface Stack Composition Engine ─────────────────────────────────
//
// Composes layered surface fragments (from base track + active protocols)
// into a single effective decision surface. Replaces the old
// suppress/inject/remap transform model with declarative fragment
// relations: augment, compete, shadow.

import type { Call, Seat } from "../../../engine/types";
import { callKey } from "../../../engine/call-helpers";
import type { MeaningSurface, ConstraintDimension } from "../../../core/contracts/meaning";
import type {
  SurfaceFragment,
  SurfaceRelation,
  RuntimeSnapshot,
  ConventionSpec,
  ActionResolution,
  FrameStateSpec,
} from "./types";
import { getBaseModules, getProtocolModules } from "./types";

// ── Types ───────────────────────────────────────────────────────────

/** An entry in the surface stack — one fragment with ownership metadata. */
export interface SurfaceStackEntry {
  readonly fragment: SurfaceFragment;
  readonly ownerType: "baseTrack" | "protocol";
  readonly ownerId: string;
  readonly stateId: string;
  readonly instanceKey?: string;
}

/** The composed output of the surface stack. */
export interface ComposedSurface {
  /** All visible MeaningSurface rules after composition. */
  readonly visibleSurfaces: readonly MeaningSurface[];
  /** Per-action resolution for teaching/explanation. */
  readonly actionResolutions: readonly ActionResolution[];
  /** Which fact evaluator IDs are needed. */
  readonly requiredFactEvaluatorIds: readonly string[];
  /** Trace of how composition was performed. */
  readonly compositionTrace: readonly CompositionTraceEntry[];
  /** Maps meaningId → inherited constraint dimensions from the containing fragment.
   *  Used by the pipeline to pass inherited dimensions to deriveSpecificity(). */
  readonly inheritedDimsLookup: ReadonlyMap<string, readonly ConstraintDimension[]>;
}

/** Trace entry for a single fragment's participation in the composition. */
export interface CompositionTraceEntry {
  readonly surfaceId: string;
  readonly ownerType: "baseTrack" | "protocol";
  readonly ownerId: string;
  readonly relation: SurfaceRelation;
  readonly layerPriority: number;
  /** Surfaces from this fragment that were shadowed by higher layers. */
  readonly shadowedBy?: string;
}

// ── Call Key Helpers ─────────────────────────────────────────────────

/** Per-action tracking entry used during surface composition. */
interface ActionMapEntry {
  call: Call;
  controllingEntry: SurfaceStackEntry;
  supportingEntries: { entry: SurfaceStackEntry; ruleId: string }[];
  blockedBy: { ownerId: string; surfaceId: string; reason: "shadow" | "ban" }[];
  status: "recommended" | "available" | "blocked" | "shadowed";
  meaning: string;
}

/** Check whether a specific call is covered by an actionCoverage spec. */
function isCovered(call: Call, coverage: "all" | readonly Call[]): boolean {
  if (coverage === "all") return true;
  const key = callKey(call);
  return coverage.some((c) => callKey(c) === key);
}

// ── composeSurfaceStack ─────────────────────────────────────────────

/**
 * Compose an ordered list of surface fragments into a single effective
 * decision surface.
 *
 * Algorithm:
 * 1. Sort fragments by layerPriority descending (highest first)
 * 2. Build a set of "covered actions" — actions that higher shadow-layers
 *    have claimed
 * 3. For each fragment (highest to lowest):
 *    - shadow: mark actionCoverage as covered, add surfaces, apply legalMask
 *    - compete: add surfaces (even if covered — ranking decides)
 *    - augment: add surfaces only for uncovered actions
 * 4. Build ActionResolution[] showing per-action status
 */
export function composeSurfaceStack(
  fragments: readonly SurfaceStackEntry[],
): ComposedSurface {
  if (fragments.length === 0) {
    return {
      visibleSurfaces: [],
      actionResolutions: [],
      requiredFactEvaluatorIds: [],
      compositionTrace: [],
      inheritedDimsLookup: new Map(),
    };
  }

  // Sort by layerPriority descending (highest first).
  // Stable sort: preserve input order for equal priorities.
  const sorted = [...fragments].sort(
    (a, b) => b.fragment.layerPriority - a.fragment.layerPriority,
  );

  // Track which action keys are covered by shadow layers.
  const coveredActions = new Set<string>();
  // When a shadow fragment covers "all", everything is covered.
  let allCovered = false;

  const visibleSurfaces: MeaningSurface[] = [];
  const compositionTrace: CompositionTraceEntry[] = [];
  const requiredFactIds = new Set<string>();
  const inheritedDimsLookup = new Map<string, readonly ConstraintDimension[]>();

  const actionMap = new Map<string, ActionMapEntry>();

  // Track which fragments shadowed which other fragments.
  // Maps lower-fragment surfaceId → shadowing fragment surfaceId.
  const shadowedByMap = new Map<string, string>();

  // Identify the topmost shadow fragment for attribution.
  let topShadowId: string | undefined;
  for (const entry of sorted) {
    if (entry.fragment.relation === "shadow") {
      topShadowId = entry.fragment.id;
      break;
    }
  }

  for (const entry of sorted) {
    const { fragment } = entry;
    const traceEntry: CompositionTraceEntry = {
      surfaceId: fragment.id,
      ownerType: entry.ownerType,
      ownerId: entry.ownerId,
      relation: fragment.relation,
      layerPriority: fragment.layerPriority,
      shadowedBy: shadowedByMap.get(fragment.id),
    };
    compositionTrace.push(traceEntry);

    // Collect fact evaluator IDs.
    if (fragment.factEvaluatorIds) {
      for (const id of fragment.factEvaluatorIds) {
        requiredFactIds.add(id);
      }
    }

    if (fragment.relation === "shadow") {
      // Shadow: mark coverage, add surfaces, apply legalMask.
      if (fragment.actionCoverage === "all") {
        allCovered = true;
        // Mark all lower fragments as shadowed by this one.
        for (const other of sorted) {
          if (
            other.fragment.id !== fragment.id &&
            other.fragment.layerPriority < fragment.layerPriority
          ) {
            shadowedByMap.set(other.fragment.id, fragment.id);
          }
        }
      } else {
        for (const call of fragment.actionCoverage) {
          coveredActions.add(callKey(call));
        }
      }

      // Add all surfaces from the shadow fragment.
      addSurfaces(fragment, entry, visibleSurfaces, actionMap, requiredFactIds, inheritedDimsLookup);

      // Apply legalMask bans.
      applyLegalMask(fragment, entry, actionMap);
    } else if (fragment.relation === "compete") {
      // Compete: add surfaces regardless of coverage — ranking decides.
      addSurfaces(fragment, entry, visibleSurfaces, actionMap, requiredFactIds, inheritedDimsLookup);
      applyLegalMask(fragment, entry, actionMap);
    } else {
      // Augment: add surfaces only for uncovered actions.
      if (allCovered) {
        // All actions are covered by a shadow layer — this fragment is fully shadowed.
        // Update the trace entry.
        const idx = compositionTrace.indexOf(traceEntry);
        if (idx >= 0 && topShadowId) {
          compositionTrace[idx] = { ...traceEntry, shadowedBy: topShadowId };
        }
        continue;
      }

      // Add only surfaces whose default call is not covered.
      for (const surface of fragment.surfaces) {
        const key = callKey(surface.encoding.defaultCall);
        if (!coveredActions.has(key)) {
          visibleSurfaces.push(surface);
          trackAction(surface, entry, actionMap);
          if (fragment.inheritedDimensions && fragment.inheritedDimensions.length > 0) {
            inheritedDimsLookup.set(surface.meaningId, fragment.inheritedDimensions);
          }
        }
      }

      // Legal mask still applies for uncovered actions.
      applyLegalMask(fragment, entry, actionMap);
    }
  }

  // Build action resolutions.
  const actionResolutions: ActionResolution[] = [];
  for (const [, info] of actionMap) {
    actionResolutions.push({
      call: info.call,
      status: info.status,
      effectiveMeaning: info.meaning,
      controllingLayer: {
        ownerType: info.controllingEntry.ownerType,
        ownerId: info.controllingEntry.ownerId,
        surfaceId: info.controllingEntry.fragment.id,
      },
      supportingRules: info.supportingEntries.map((s) => ({
        ownerType: s.entry.ownerType,
        ownerId: s.entry.ownerId,
        surfaceId: s.entry.fragment.id,
        ruleId: s.ruleId,
      })),
      blockedBy:
        info.blockedBy.length > 0 ? info.blockedBy : undefined,
    });
  }

  // Update composition trace with final shadow info.
  const finalTrace = compositionTrace.map((t) => ({
    ...t,
    shadowedBy: t.shadowedBy ?? shadowedByMap.get(t.surfaceId),
  }));

  return {
    visibleSurfaces,
    actionResolutions,
    requiredFactEvaluatorIds: [...requiredFactIds],
    compositionTrace: finalTrace,
    inheritedDimsLookup,
  };
}

// ── Internal helpers ────────────────────────────────────────────────

function addSurfaces(
  fragment: SurfaceFragment,
  entry: SurfaceStackEntry,
  visibleSurfaces: MeaningSurface[],
  actionMap: Map<string, ActionMapEntry>,
  requiredFactIds: Set<string>,
  inheritedDimsLookup?: Map<string, readonly ConstraintDimension[]>,
): void {
  for (const surface of fragment.surfaces) {
    visibleSurfaces.push(surface);
    trackAction(surface, entry, actionMap);
    if (inheritedDimsLookup && fragment.inheritedDimensions && fragment.inheritedDimensions.length > 0) {
      inheritedDimsLookup.set(surface.meaningId, fragment.inheritedDimensions);
    }
  }
}

function trackAction(
  surface: MeaningSurface,
  entry: SurfaceStackEntry,
  actionMap: Map<string, ActionMapEntry>,
): void {
  const key = callKey(surface.encoding.defaultCall);
  const existing = actionMap.get(key);

  if (existing) {
    // Higher-priority layer already controls this action — add as supporting.
    existing.supportingEntries.push({
      entry,
      ruleId: surface.meaningId,
    });
  } else {
    actionMap.set(key, {
      call: surface.encoding.defaultCall,
      controllingEntry: entry,
      supportingEntries: [{ entry, ruleId: surface.meaningId }],
      blockedBy: [],
      status: "available",
      meaning: surface.teachingLabel,
    });
  }
}

function applyLegalMask(
  fragment: SurfaceFragment,
  entry: SurfaceStackEntry,
  actionMap: Map<string, ActionMapEntry>,
): void {
  if (!fragment.legalMask) return;

  for (const [actionKey, mask] of Object.entries(fragment.legalMask)) {
    if (mask === "ban") {
      const existing = actionMap.get(actionKey);
      if (existing) {
        existing.status = "blocked";
        existing.blockedBy.push({
          ownerId: entry.ownerId,
          surfaceId: fragment.id,
          reason: "ban",
        });
      } else {
        // Record the ban even if no surface exists for the action yet.
        // Use a synthetic entry.
        actionMap.set(actionKey, {
          call: { type: "pass" }, // placeholder — overwritten if surface appears
          controllingEntry: entry,
          supportingEntries: [],
          blockedBy: [
            {
              ownerId: entry.ownerId,
              surfaceId: fragment.id,
              reason: "ban",
            },
          ],
          status: "blocked",
          meaning: "(banned)",
        });
      }
    }
  }
}

// ── buildSurfaceStack ───────────────────────────────────────────────

/**
 * Given the current runtime snapshot and convention spec, determine which
 * surface fragments are active and build the ordered stack.
 *
 * Logic:
 * 1. If base track is active and its current state has a surface, add it.
 * 2. For each active protocol instance:
 *    - Look up the protocol's state spec.
 *    - If exclusive mode and inheritBaseSurface === "none", exclude base.
 *    - Add protocol state's surface fragment.
 * 3. Return ordered list.
 */
export function buildSurfaceStack(
  snapshot: RuntimeSnapshot,
  spec: ConventionSpec,
): SurfaceStackEntry[] {
  const entries: SurfaceStackEntry[] = [];
  let excludeBase = false;

  // Check protocols first to detect exclusive mode suppression of base.
  for (const instance of snapshot.protocols) {
    const protocolSpec = getProtocolModules(spec).find((p) => p.id === instance.protocolId);
    if (!protocolSpec) continue;

    const stateSpec = protocolSpec.states[instance.stateId] as
      | FrameStateSpec
      | undefined;
    if (!stateSpec) continue;

    // Check surfaceWhen — if specified, evaluate it.
    // For now, we treat surfaceWhen as always true if present
    // (the full BoolExpr evaluator is in the replay engine).
    // The caller should pre-filter protocols or we evaluate here.
    if (protocolSpec.surfaceWhen) {
      if (!evaluateSurfaceWhen(protocolSpec.surfaceWhen, snapshot)) {
        continue;
      }
    }

    // If exclusive mode and inheritBaseSurface === "none", skip base.
    if (stateSpec.mode === "exclusive" && stateSpec.inheritBaseSurface === "none") {
      excludeBase = true;
    }

    // Add protocol surface if the state has one.
    if (stateSpec.surface) {
      const fragment = spec.surfaces[stateSpec.surface];
      if (fragment) {
        entries.push({
          fragment,
          ownerType: "protocol",
          ownerId: instance.protocolId,
          stateId: instance.stateId,
          instanceKey: instance.instanceKey,
        });
      }
    }
  }

  // Add base track surface (unless suppressed by exclusive protocol).
  if (!excludeBase && snapshot.base) {
    const baseTrack = getBaseModules(spec).find((t) => t.id === snapshot.base!.trackId);
    if (baseTrack) {
      const baseState = baseTrack.states[snapshot.base.stateId];
      if (baseState?.surface) {
        const fragment = spec.surfaces[baseState.surface];
        if (fragment) {
          entries.push({
            fragment,
            ownerType: "baseTrack",
            ownerId: baseTrack.id,
            stateId: snapshot.base.stateId,
          });
        }
      }
    }
  }

  return entries;
}

// ── BoolExpr evaluator (minimal, for surfaceWhen) ───────────────────

/**
 * Minimal evaluator for BoolExpr — supports the subset needed for
 * surfaceWhen guards. Full evaluation is in the replay engine.
 */
function evaluateSurfaceWhen(
  expr: import("./types").BoolExpr,
  snapshot: RuntimeSnapshot,
): boolean {
  switch (expr.op) {
    case "true":
      return true;
    case "false":
      return false;
    case "activeTag":
      return snapshot.activeTags.has(expr.tag);
    case "exists": {
      if (expr.ref.kind === "reg") {
        return expr.ref.path in snapshot.registers;
      }
      if (expr.ref.kind === "tag") {
        return snapshot.activeTags.has(expr.ref.tag);
      }
      return false;
    }
    case "eq": {
      if (expr.ref.kind === "reg") {
        const reg = snapshot.registers[expr.ref.path];
        return reg !== undefined && reg.value === expr.value;
      }
      if (expr.ref.kind === "tag") {
        return snapshot.activeTags.has(expr.ref.tag) === (expr.value === true);
      }
      return false;
    }
    case "neq": {
      if (expr.ref.kind === "reg") {
        const reg = snapshot.registers[expr.ref.path];
        return reg === undefined || reg.value !== expr.value;
      }
      return true;
    }
    case "and":
      return expr.args.every((a) => evaluateSurfaceWhen(a, snapshot));
    case "or":
      return expr.args.some((a) => evaluateSurfaceWhen(a, snapshot));
    case "not":
      return !evaluateSurfaceWhen(expr.arg, snapshot);
    case "in": {
      if (expr.ref.kind === "reg") {
        const reg = snapshot.registers[expr.ref.path];
        if (reg === undefined) return false;
        return (expr.values as readonly unknown[]).includes(reg.value);
      }
      return false;
    }
    case "lt": {
      if (expr.ref.kind === "reg") {
        const reg = snapshot.registers[expr.ref.path];
        return reg !== undefined && typeof reg.value === "number" && reg.value < expr.value;
      }
      return false;
    }
    case "gt": {
      if (expr.ref.kind === "reg") {
        const reg = snapshot.registers[expr.ref.path];
        return reg !== undefined && typeof reg.value === "number" && reg.value > expr.value;
      }
      return false;
    }
    default:
      return true;
  }
}
