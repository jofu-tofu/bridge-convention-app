// ── Protocol Coverage Enumeration ────────────────────────────────────
//
// Coverage enumeration for the protocol frame architecture.
//
// In the old system, coverage = { (stateId, surfaceId) } pairs from a
// single FSM. In the new system, the coverage universe expands to include:
//
// - Base track states and their surface fragments
// - Protocol states and their surface fragments (reachable via register conditions)
// - The composed surface at each (base_state, protocol_state_set) combination
//
// Since protocols activate dynamically based on registers, we can't enumerate
// all possible (base, protocol*) combinations statically. Instead we:
//
// 1. Enumerate base track states via BFS (same as before)
// 2. At each base state, compute which registers/tags would be set
// 3. Determine which protocols would attach at that point
// 4. For attached protocols, enumerate their reachable states
// 5. Build coverage atoms from the composed surface at each configuration

import type { Call } from "../../../engine/types";
import type {
  ConventionSpec,
  BaseModuleSpec,
  ProtocolModuleSpec,
  FrameStateSpec,
  TransitionSpec,
  EffectSpec,
  SurfaceFragment,
  RuntimeSnapshot,
  EventPattern,
} from "./types";
import { getBaseModules, getProtocolModules } from "./types";
import type { MeaningSurface } from "../../../core/contracts/meaning";

// ── Types ───────────────────────────────────────────────────────────

/** A coverage atom in the protocol architecture. */
export interface ProtocolCoverageAtom {
  /** Base track state ID. */
  readonly baseStateId: string;
  /** Active protocol instances at this point (may be empty). */
  readonly activeProtocols: readonly {
    readonly protocolId: string;
    readonly stateId: string;
  }[];
  /** The surface fragment being exercised. */
  readonly surfaceId: string;
  /** The specific meaning surface within the fragment. */
  readonly meaningId: string;
  readonly meaningLabel: string;
  /** Whether this atom involves a protocol (vs pure base track). */
  readonly involvesProtocol: boolean;
}

/** Path to reach a specific base track state. */
export interface BaseTrackPath {
  readonly stateIds: readonly string[];
  readonly transitions: readonly {
    readonly transitionId: string;
    readonly fromStateId: string;
    readonly toStateId: string;
    readonly call: Call | null;
  }[];
  readonly targetStateId: string;
}

/** Coverage manifest for a ConventionSpec. */
export interface ProtocolCoverageManifest {
  readonly specId: string;
  readonly specName: string;
  /** Total base track states across all tracks. */
  readonly totalBaseStates: number;
  /** Total protocol states across all protocols. */
  readonly totalProtocolStates: number;
  /** Total coverage atoms. */
  readonly totalAtoms: number;
  /** Base-track-only atoms (no protocols involved). */
  readonly baseAtoms: readonly ProtocolCoverageAtom[];
  /** Protocol-involved atoms. */
  readonly protocolAtoms: readonly ProtocolCoverageAtom[];
  /** States that couldn't be reached. */
  readonly unreachable: readonly { readonly stateId: string; readonly reason: string }[];
}

// ── Base Track Enumeration ──────────────────────────────────────────

/**
 * Enumerate reachable states in a base track via BFS.
 * Returns a map of stateId → path from the initial state.
 */
export function enumerateBaseTrackStates(
  track: BaseModuleSpec,
): Map<string, BaseTrackPath> {
  const paths = new Map<string, BaseTrackPath>();
  const visited = new Set<string>();
  const queue: { stateId: string; path: BaseTrackPath }[] = [];

  const initialPath: BaseTrackPath = {
    stateIds: [track.initialStateId],
    transitions: [],
    targetStateId: track.initialStateId,
  };
  queue.push({ stateId: track.initialStateId, path: initialPath });
  visited.add(track.initialStateId);
  paths.set(track.initialStateId, initialPath);

  while (queue.length > 0) {
    const { stateId, path } = queue.shift()!;
    const state = track.states[stateId];
    if (!state) continue;

    for (const transition of state.eventTransitions) {
      const target = transition.goto;
      if (typeof target !== "string" || target === "STAY" || target === "POP") continue;
      if (visited.has(target)) continue;

      visited.add(target);
      const call = eventPatternToCall(transition.when);
      const newPath: BaseTrackPath = {
        stateIds: [...path.stateIds, target],
        transitions: [
          ...path.transitions,
          {
            transitionId: transition.transitionId,
            fromStateId: stateId,
            toStateId: target,
            call,
          },
        ],
        targetStateId: target,
      };
      paths.set(target, newPath);
      queue.push({ stateId: target, path: newPath });
    }
  }

  return paths;
}

/**
 * Enumerate coverage atoms for a base track (no protocols).
 */
export function enumerateBaseTrackAtoms(
  track: BaseModuleSpec,
  surfaces: Readonly<Record<string, SurfaceFragment>>,
): ProtocolCoverageAtom[] {
  const paths = enumerateBaseTrackStates(track);
  const atoms: ProtocolCoverageAtom[] = [];

  for (const [stateId] of paths) {
    const state = track.states[stateId];
    if (!state?.surface) continue;

    const fragment = surfaces[state.surface];
    if (!fragment) continue;

    for (const surface of fragment.surfaces) {
      atoms.push({
        baseStateId: stateId,
        activeProtocols: [],
        surfaceId: state.surface,
        meaningId: surface.meaningId,
        meaningLabel: surface.teachingLabel,
        involvesProtocol: false,
      });
    }
  }

  return atoms;
}

/**
 * Enumerate coverage atoms for protocols at a given base state.
 *
 * This is approximate — we simulate which registers/tags would be set
 * at the base state based on the onEnter effects along the path, then
 * check which protocols would attach.
 */
export function enumerateProtocolAtomsAtBaseState(
  baseStateId: string,
  path: BaseTrackPath,
  track: BaseModuleSpec,
  protocols: readonly ProtocolModuleSpec[],
  surfaces: Readonly<Record<string, SurfaceFragment>>,
): ProtocolCoverageAtom[] {
  // Simulate register/tag state at this base state
  const simulatedTags = new Set<string>();
  const simulatedRegisters = new Map<string, unknown>();

  for (const stateId of path.stateIds) {
    const state = track.states[stateId];
    if (!state) continue;

    // Collect tags from state exports
    if (state.exportTags) {
      for (const tag of state.exportTags) {
        simulatedTags.add(tag);
      }
    }

    // Collect register writes from onEnter effects
    if (state.onEnter) {
      for (const effect of state.onEnter) {
        if (effect.op === "setReg" && typeof effect.value !== "object") {
          simulatedRegisters.set(effect.path, effect.value);
        }
        if (effect.op === "exportTag") {
          simulatedTags.add(effect.tag);
        }
      }
    }
  }

  // Check which protocols would attach
  const atoms: ProtocolCoverageAtom[] = [];

  for (const protocol of protocols) {
    // Simple check: does the attachWhen reference any registers/tags that are set?
    // This is an approximation — full BoolExpr evaluation would need a real context
    if (!wouldProtocolLikelyAttach(protocol, simulatedRegisters, simulatedTags)) {
      continue;
    }

    // Enumerate the protocol's states
    for (const [protocolStateId, protocolState] of Object.entries(protocol.states)) {
      if (!protocolState.surface) continue;

      const fragment = surfaces[protocolState.surface];
      if (!fragment) continue;

      for (const surface of fragment.surfaces) {
        atoms.push({
          baseStateId,
          activeProtocols: [{ protocolId: protocol.id, stateId: protocolStateId }],
          surfaceId: protocolState.surface,
          meaningId: surface.meaningId,
          meaningLabel: surface.teachingLabel,
          involvesProtocol: true,
        });
      }
    }
  }

  return atoms;
}

// ── Full Manifest Generation ────────────────────────────────────────

/**
 * Generate a complete coverage manifest for a ConventionSpec.
 */
export function generateProtocolCoverageManifest(
  spec: ConventionSpec,
): ProtocolCoverageManifest {
  const baseAtoms: ProtocolCoverageAtom[] = [];
  const protocolAtoms: ProtocolCoverageAtom[] = [];
  const unreachable: { stateId: string; reason: string }[] = [];

  let totalBaseStates = 0;
  let totalProtocolStates = 0;

  for (const track of getBaseModules(spec)) {
    const paths = enumerateBaseTrackStates(track);
    totalBaseStates += paths.size;

    // Base track atoms
    const trackAtoms = enumerateBaseTrackAtoms(track, spec.surfaces);
    baseAtoms.push(...trackAtoms);

    // Protocol atoms at each base state
    for (const [stateId, path] of paths) {
      const pAtoms = enumerateProtocolAtomsAtBaseState(
        stateId, path, track, getProtocolModules(spec), spec.surfaces,
      );
      protocolAtoms.push(...pAtoms);
    }

    // Check for unreachable states
    for (const stateId of Object.keys(track.states)) {
      if (!paths.has(stateId)) {
        unreachable.push({ stateId: `${track.id}:${stateId}`, reason: "No BFS path found" });
      }
    }
  }

  for (const protocol of getProtocolModules(spec)) {
    totalProtocolStates += Object.keys(protocol.states).length;
  }

  return {
    specId: spec.id,
    specName: spec.name,
    totalBaseStates,
    totalProtocolStates,
    totalAtoms: baseAtoms.length + protocolAtoms.length,
    baseAtoms,
    protocolAtoms,
    unreachable,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Convert an EventPattern to a concrete Call (if possible). */
function eventPatternToCall(pattern: EventPattern): Call | null {
  if (pattern.call) return pattern.call;
  if (pattern.callType === "pass") return { type: "pass" };
  if (pattern.callType === "double") return { type: "double" };
  if (pattern.callType === "redouble") return { type: "redouble" };
  return null;
}

/**
 * Approximate check for whether a protocol would attach given simulated state.
 * This is a heuristic — it checks the top-level BoolExpr for common patterns.
 */
function wouldProtocolLikelyAttach(
  protocol: ProtocolModuleSpec,
  registers: Map<string, unknown>,
  tags: Set<string>,
): boolean {
  return evaluateSimpleBoolExpr(protocol.attachWhen, registers, tags);
}

/**
 * Simple BoolExpr evaluator for coverage estimation.
 * Handles common patterns without needing a full ExpressionContext.
 */
function evaluateSimpleBoolExpr(
  expr: import("./types").BoolExpr,
  registers: Map<string, unknown>,
  tags: Set<string>,
): boolean {
  switch (expr.op) {
    case "true": return true;
    case "false": return false;
    case "activeTag": return tags.has(expr.tag);
    case "exists":
      if (expr.ref.kind === "reg") return registers.has(expr.ref.path);
      if (expr.ref.kind === "tag") return tags.has(expr.ref.tag);
      return false;
    case "eq":
      if (expr.ref.kind === "reg") return registers.get(expr.ref.path) === expr.value;
      return false;
    case "neq":
      if (expr.ref.kind === "reg") return registers.get(expr.ref.path) !== expr.value;
      return true;
    case "and":
      return expr.args.every((a) => evaluateSimpleBoolExpr(a, registers, tags));
    case "or":
      return expr.args.some((a) => evaluateSimpleBoolExpr(a, registers, tags));
    case "not":
      return !evaluateSimpleBoolExpr(expr.arg, registers, tags);
    default:
      return false; // Conservative: unknown expressions don't match
  }
}
