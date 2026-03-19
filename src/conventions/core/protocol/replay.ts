// ── Layered Replay Model ────────────────────────────────────────────
//
// Deterministic replay engine for the protocol frame architecture.
// Given a conversation history and convention spec, walks the events
// to produce the final RuntimeSnapshot (the sparse state vector).
//
// Determinism guarantee: given the same history + spec, always produces
// the same snapshot. This is critical for inference/posterior.

import type { Call, Seat, ContractBid } from "../../../engine/types";
import type {
  ConventionSpec,
  RuntimeSnapshot,
  BaseTrackInstance,
  ProtocolInstance,
  ProvenancedValue,
  EventPattern,
  TransitionSpec,
  ReactionSpec,
  EffectSpec,
  BoolExpr,
  FrameStateSpec,
  BootTrieNode,
} from "./types";
import { getBaseModules, getProtocolModules } from "./types";
import type { ComposedSurface } from "./surface-stack";
import { buildSurfaceStack, composeSurfaceStack } from "./surface-stack";

// ── Seat-relative actor resolution ──────────────────────────────────

/** Get the partner seat. */
function partnerOf(seat: Seat): Seat {
  const partners: Record<string, Seat> = {
    N: "S" as Seat,
    S: "N" as Seat,
    E: "W" as Seat,
    W: "E" as Seat,
  };
  return partners[seat]!;
}

/** Are two seats on the same team? */
function sameTeam(a: Seat, b: Seat): boolean {
  return a === b || partnerOf(a) === b;
}

/** Resolve an actor pattern relative to the observer seat. */
function matchesActor(
  pattern: EventPattern["actor"],
  eventSeat: Seat,
  observerSeat: Seat,
): boolean {
  if (!pattern || pattern === "any") return true;
  if (pattern === "self") return eventSeat === observerSeat;
  if (pattern === "partner") return eventSeat === partnerOf(observerSeat);
  if (pattern === "opponent") return !sameTeam(eventSeat, observerSeat);
  return false;
}

// ── Call serialization ──────────────────────────────────────────────

function callKey(call: Call): string {
  if (call.type === "pass") return "P";
  if (call.type === "double") return "X";
  if (call.type === "redouble") return "XX";
  const bid = call as ContractBid;
  return `${bid.level}${bid.strain}`;
}

// ── Event pattern matching ──────────────────────────────────────────

function matchesEventPattern(
  pattern: EventPattern,
  event: { call: Call; seat: Seat },
  observerSeat: Seat,
): boolean {
  // Actor check.
  if (!matchesActor(pattern.actor, event.seat, observerSeat)) return false;

  // Call type check.
  if (pattern.callType && event.call.type !== pattern.callType) return false;

  // Specific call check.
  if (pattern.call) {
    if (callKey(pattern.call) !== callKey(event.call)) return false;
  }

  return true;
}

// ── BoolExpr evaluator ──────────────────────────────────────────────

function evaluateBoolExpr(
  expr: BoolExpr,
  snapshot: RuntimeSnapshot,
  localState?: Readonly<Record<string, unknown>>,
): boolean {
  switch (expr.op) {
    case "true":
      return true;
    case "false":
      return false;
    case "activeTag":
      return snapshot.activeTags.has(expr.tag);
    case "exists":
      return resolveRefExists(expr.ref, snapshot, localState);
    case "eq":
      return resolveRefValue(expr.ref, snapshot, localState) === expr.value;
    case "neq":
      return resolveRefValue(expr.ref, snapshot, localState) !== expr.value;
    case "in": {
      const val = resolveRefValue(expr.ref, snapshot, localState);
      return (expr.values as readonly unknown[]).includes(val);
    }
    case "lt": {
      const val = resolveRefValue(expr.ref, snapshot, localState);
      return typeof val === "number" && val < expr.value;
    }
    case "gt": {
      const val = resolveRefValue(expr.ref, snapshot, localState);
      return typeof val === "number" && val > expr.value;
    }
    case "and":
      return expr.args.every((a) => evaluateBoolExpr(a, snapshot, localState));
    case "or":
      return expr.args.some((a) => evaluateBoolExpr(a, snapshot, localState));
    case "not":
      return !evaluateBoolExpr(expr.arg, snapshot, localState);
  }
}

function resolveRefExists(
  ref: import("./types").Ref,
  snapshot: RuntimeSnapshot,
  localState?: Readonly<Record<string, unknown>>,
): boolean {
  switch (ref.kind) {
    case "reg":
      return ref.path in snapshot.registers;
    case "tag":
      return snapshot.activeTags.has(ref.tag);
    case "local":
      return localState !== undefined && ref.path in localState;
    case "base":
      if (ref.path === "trackId") return snapshot.base !== undefined;
      if (ref.path === "stateId") return snapshot.base !== undefined;
      return false;
    case "protocol": {
      const inst = snapshot.protocols.find(
        (p) => p.protocolId === ref.protocolId,
      );
      return inst !== undefined;
    }
    default:
      return false;
  }
}

function resolveRefValue(
  ref: import("./types").Ref,
  snapshot: RuntimeSnapshot,
  localState?: Readonly<Record<string, unknown>>,
): unknown {
  switch (ref.kind) {
    case "reg":
      return snapshot.registers[ref.path]?.value;
    case "tag":
      return snapshot.activeTags.has(ref.tag);
    case "local":
      return localState?.[ref.path];
    case "base":
      if (!snapshot.base) return undefined;
      if (ref.path === "trackId") return snapshot.base.trackId;
      if (ref.path === "stateId") return snapshot.base.stateId;
      return undefined;
    case "protocol": {
      const inst = snapshot.protocols.find(
        (p) => p.protocolId === ref.protocolId,
      );
      if (!inst) return undefined;
      if (ref.path === "stateId") return inst.stateId;
      if (ref.path === "instanceKey") return inst.instanceKey;
      return undefined;
    }
    default:
      return undefined;
  }
}

// ── Effect application ──────────────────────────────────────────────

interface EffectContext {
  readonly ownerType: "boot" | "baseTrack" | "protocol";
  readonly ownerId: string;
  readonly stateId: string;
  readonly ply: number;
}

function applyEffects(
  snapshot: RuntimeSnapshot,
  effects: readonly EffectSpec[],
  ctx: EffectContext,
  localState?: Readonly<Record<string, unknown>>,
): { snapshot: RuntimeSnapshot; localState: Readonly<Record<string, unknown>> } {
  let current = snapshot;
  let local = localState ?? {};

  for (const effect of effects) {
    switch (effect.op) {
      case "setReg": {
        const value = resolveEffectValue(effect.value, current, local);
        const registers: Record<string, ProvenancedValue> = {
          ...current.registers,
          [effect.path]: {
            value,
            writtenAtPly: ctx.ply,
            writtenBy: {
              ownerType: ctx.ownerType,
              ownerId: ctx.ownerId,
              stateId: ctx.stateId,
            },
          },
        };
        current = { ...current, registers };
        break;
      }
      case "clearReg": {
        const { [effect.path]: _, ...rest } = current.registers;
        current = { ...current, registers: rest };
        break;
      }
      case "setLocal": {
        const value = resolveEffectValue(effect.value, current, local);
        local = { ...local, [effect.path]: value };
        break;
      }
      case "clearLocal": {
        const { [effect.path]: _, ...rest } = local;
        local = rest;
        break;
      }
      case "exportTag": {
        const tags = new Set(current.activeTags);
        tags.add(effect.tag);
        current = { ...current, activeTags: tags };
        break;
      }
      case "removeTag": {
        const tags = new Set(current.activeTags);
        tags.delete(effect.tag);
        current = { ...current, activeTags: tags };
        break;
      }
    }
  }

  return { snapshot: current, localState: local };
}

function resolveEffectValue(
  value: unknown,
  snapshot: RuntimeSnapshot,
  localState: Readonly<Record<string, unknown>>,
): unknown {
  // If the value is a Ref object, resolve it.
  if (
    value !== null &&
    typeof value === "object" &&
    "kind" in (value as Record<string, unknown>)
  ) {
    return resolveRefValue(
      value as import("./types").Ref,
      snapshot,
      localState,
    );
  }
  return value;
}

// ── Frame descriptor (unified base + protocol for replay ordering) ──

interface FrameDescriptor {
  readonly kind: "base" | "protocol";
  readonly id: string;
  readonly instanceKey?: string;
  readonly stateId: string;
  readonly transitions: readonly TransitionSpec[];
  readonly localState: Readonly<Record<string, unknown>>;
  /** Layer priority for ordering (higher = processed first). */
  readonly layerPriority: number;
  /** Is this an exclusive protocol frame? */
  readonly exclusive: boolean;
}

function buildFrameList(
  snapshot: RuntimeSnapshot,
  spec: ConventionSpec,
): FrameDescriptor[] {
  const frames: FrameDescriptor[] = [];

  // Protocol frames.
  for (const instance of snapshot.protocols) {
    const protocolSpec = getProtocolModules(spec).find(
      (p) => p.id === instance.protocolId,
    );
    if (!protocolSpec) continue;
    const stateSpec = protocolSpec.states[instance.stateId] as
      | FrameStateSpec
      | undefined;
    if (!stateSpec) continue;

    frames.push({
      kind: "protocol",
      id: instance.protocolId,
      instanceKey: instance.instanceKey,
      stateId: instance.stateId,
      transitions: stateSpec.eventTransitions,
      localState: instance.localState,
      layerPriority: instance.depth,
      exclusive: stateSpec.mode === "exclusive",
    });
  }

  // Sort protocol frames: exclusive first, then by depth descending.
  frames.sort((a, b) => {
    if (a.exclusive && !b.exclusive) return -1;
    if (!a.exclusive && b.exclusive) return 1;
    return b.layerPriority - a.layerPriority;
  });

  // Base track frame (always last).
  if (snapshot.base) {
    const baseTrack = getBaseModules(spec).find(
      (t) => t.id === snapshot.base!.trackId,
    );
    if (baseTrack) {
      const baseState = baseTrack.states[snapshot.base.stateId];
      if (baseState) {
        frames.push({
          kind: "base",
          id: baseTrack.id,
          stateId: snapshot.base.stateId,
          transitions: baseState.eventTransitions,
          localState: {},
          layerPriority: 0,
          exclusive: false,
        });
      }
    }
  }

  return frames;
}

// ── Protocol lifecycle (settle phase) ───────────────────────────────

/**
 * Settle phase: check for protocol attachment, reactions, and cleanup.
 * Run after each event is processed by all frames.
 */
function settleProtocolLifecycle(
  snapshot: RuntimeSnapshot,
  spec: ConventionSpec,
  observerSeat: Seat,
): RuntimeSnapshot {
  let current = snapshot;

  // 1. Check for new protocol attachments.
  for (const protocolSpec of getProtocolModules(spec)) {
    // Skip if already attached (by protocolId — for simplicity, single instance).
    const alreadyAttached = current.protocols.some(
      (p) => p.protocolId === protocolSpec.id,
    );
    if (alreadyAttached) continue;

    // Check done latch.
    const latchKey = `${protocolSpec.id}:${protocolSpec.scopeKey ?? protocolSpec.id}`;
    if (current.doneLatches.has(latchKey)) continue;

    // Evaluate attachWhen.
    if (!evaluateBoolExpr(protocolSpec.attachWhen, current)) continue;

    // Attach: create new protocol instance.
    const instanceKey =
      protocolSpec.scopeKey ?? `${protocolSpec.id}:${current.ply}`;
    const newInstance: ProtocolInstance = {
      protocolId: protocolSpec.id,
      instanceKey,
      stateId: protocolSpec.initialStateId,
      anchor: "base",
      depth: current.protocols.length + 1,
      attachedAtPly: current.ply,
      localState: {},
    };

    // Apply onEnter effects of initial state.
    const initialState = protocolSpec.states[protocolSpec.initialStateId];
    if (initialState?.onEnter) {
      const ctx: EffectContext = {
        ownerType: "protocol",
        ownerId: protocolSpec.id,
        stateId: protocolSpec.initialStateId,
        ply: current.ply,
      };
      const result = applyEffects(
        current,
        initialState.onEnter,
        ctx,
        newInstance.localState,
      );
      current = result.snapshot;
      const updatedInstance: ProtocolInstance = {
        ...newInstance,
        localState: result.localState,
      };
      current = {
        ...current,
        protocols: [...current.protocols, updatedInstance],
      };
    } else {
      current = {
        ...current,
        protocols: [...current.protocols, newInstance],
      };
    }

    // Export tags for the initial state.
    if (initialState?.exportTags) {
      const tags = new Set(current.activeTags);
      for (const tag of initialState.exportTags) {
        tags.add(tag);
      }
      current = { ...current, activeTags: tags };
    }
  }

  // 2. Check reactions on base track.
  if (current.base) {
    const baseTrack = getBaseModules(spec).find(
      (t) => t.id === current.base!.trackId,
    );
    if (baseTrack) {
      const baseState = baseTrack.states[current.base.stateId];
      if (baseState?.reactions) {
        current = processReactions(
          current,
          baseState.reactions,
          "baseTrack",
          baseTrack.id,
          current.base.stateId,
          spec,
          baseTrack,
        );
      }
    }
  }

  // 3. Check reactions on protocol instances.
  const updatedProtocols: ProtocolInstance[] = [];
  for (const instance of current.protocols) {
    const protocolSpec = getProtocolModules(spec).find(
      (p) => p.id === instance.protocolId,
    );
    if (!protocolSpec) {
      updatedProtocols.push(instance);
      continue;
    }
    const stateSpec = protocolSpec.states[instance.stateId];
    if (!stateSpec?.reactions) {
      updatedProtocols.push(instance);
      continue;
    }

    // Evaluate reactions for this protocol instance.
    let best: ReactionSpec | undefined;
    for (const reaction of stateSpec.reactions) {
      if (evaluateBoolExpr(reaction.when, current, instance.localState)) {
        if (!best || (reaction.priority ?? 0) > (best.priority ?? 0)) {
          best = reaction;
        }
      }
    }

    if (best) {
      if (best.goto === "POP") {
        // Protocol exits — apply effects then remove.
        if (best.effects) {
          const ctx: EffectContext = {
            ownerType: "protocol",
            ownerId: instance.protocolId,
            stateId: instance.stateId,
            ply: current.ply,
          };
          const result = applyEffects(
            current,
            best.effects,
            ctx,
            instance.localState,
          );
          current = result.snapshot;
        }

        // Apply onExit effects.
        if (stateSpec.onExit) {
          const ctx: EffectContext = {
            ownerType: "protocol",
            ownerId: instance.protocolId,
            stateId: instance.stateId,
            ply: current.ply,
          };
          const result = applyEffects(
            current,
            stateSpec.onExit,
            ctx,
            instance.localState,
          );
          current = result.snapshot;
        }

        // Set done latch.
        const latchKey = `${instance.protocolId}:${protocolSpec.scopeKey ?? instance.protocolId}`;
        const latches = new Set(current.doneLatches);
        latches.add(latchKey);
        current = { ...current, doneLatches: latches };

        // Don't add to updatedProtocols (removed).
        continue;
      } else if (best.goto !== "STAY") {
        // Transition to new state.
        if (stateSpec.onExit) {
          const ctx: EffectContext = {
            ownerType: "protocol",
            ownerId: instance.protocolId,
            stateId: instance.stateId,
            ply: current.ply,
          };
          const result = applyEffects(
            current,
            stateSpec.onExit,
            ctx,
            instance.localState,
          );
          current = result.snapshot;
        }

        let updatedLocal = instance.localState;
        if (best.effects) {
          const ctx: EffectContext = {
            ownerType: "protocol",
            ownerId: instance.protocolId,
            stateId: instance.stateId,
            ply: current.ply,
          };
          const result = applyEffects(
            current,
            best.effects,
            ctx,
            instance.localState,
          );
          current = result.snapshot;
          updatedLocal = result.localState;
        }

        const newState = protocolSpec.states[best.goto];
        if (newState?.onEnter) {
          const ctx: EffectContext = {
            ownerType: "protocol",
            ownerId: instance.protocolId,
            stateId: best.goto,
            ply: current.ply,
          };
          const result = applyEffects(
            current,
            newState.onEnter,
            ctx,
            updatedLocal,
          );
          current = result.snapshot;
          updatedLocal = result.localState;
        }

        updatedProtocols.push({
          ...instance,
          stateId: best.goto,
          localState: updatedLocal,
        });
      } else {
        // STAY — apply effects but keep state.
        if (best.effects) {
          const ctx: EffectContext = {
            ownerType: "protocol",
            ownerId: instance.protocolId,
            stateId: instance.stateId,
            ply: current.ply,
          };
          const result = applyEffects(
            current,
            best.effects,
            ctx,
            instance.localState,
          );
          current = result.snapshot;
          updatedProtocols.push({
            ...instance,
            localState: result.localState,
          });
        } else {
          updatedProtocols.push(instance);
        }
      }
    } else {
      updatedProtocols.push(instance);
    }
  }

  current = { ...current, protocols: updatedProtocols };

  return current;
}

function processReactions(
  snapshot: RuntimeSnapshot,
  reactions: readonly ReactionSpec[],
  ownerType: "baseTrack" | "protocol",
  ownerId: string,
  stateId: string,
  spec: ConventionSpec,
  baseTrack?: import("./types").BaseModuleSpec,
): RuntimeSnapshot {
  let current = snapshot;

  let best: ReactionSpec | undefined;
  for (const reaction of reactions) {
    if (evaluateBoolExpr(reaction.when, current)) {
      if (!best || (reaction.priority ?? 0) > (best.priority ?? 0)) {
        best = reaction;
      }
    }
  }

  if (!best) return current;

  if (best.goto === "STAY") {
    if (best.effects) {
      const ctx: EffectContext = {
        ownerType,
        ownerId,
        stateId,
        ply: current.ply,
      };
      const result = applyEffects(current, best.effects, ctx);
      current = result.snapshot;
    }
    return current;
  }

  if (best.goto === "POP") {
    // Base track can't POP; treat as no-op.
    return current;
  }

  // Transition base to new state.
  if (ownerType === "baseTrack" && baseTrack) {
    // Apply onExit of current state.
    const currentState = baseTrack.states[stateId];
    if (currentState?.onExit) {
      const ctx: EffectContext = {
        ownerType,
        ownerId,
        stateId,
        ply: current.ply,
      };
      const result = applyEffects(current, currentState.onExit, ctx);
      current = result.snapshot;
    }

    // Apply transition effects.
    if (best.effects) {
      const ctx: EffectContext = {
        ownerType,
        ownerId,
        stateId,
        ply: current.ply,
      };
      const result = applyEffects(current, best.effects, ctx);
      current = result.snapshot;
    }

    // Move to new state.
    const newBase: BaseTrackInstance = {
      trackId: current.base!.trackId,
      stateId: best.goto,
    };
    current = { ...current, base: newBase };

    // Apply onEnter of new state.
    const newState = baseTrack.states[best.goto];
    if (newState?.onEnter) {
      const ctx: EffectContext = {
        ownerType,
        ownerId,
        stateId: best.goto,
        ply: current.ply,
      };
      const result = applyEffects(current, newState.onEnter, ctx);
      current = result.snapshot;
    }

    // Export tags for new state.
    if (newState?.exportTags) {
      const tags = new Set(current.activeTags);
      for (const tag of newState.exportTags) {
        tags.add(tag);
      }
      current = { ...current, activeTags: tags };
    }
  }

  return current;
}

// ── Boot router advancement ─────────────────────────────────────────

interface BootResult {
  readonly snapshot: RuntimeSnapshot;
  readonly trackSelected: boolean;
}

function advanceBootRouter(
  snapshot: RuntimeSnapshot,
  event: { call: Call; seat: Seat },
  spec: ConventionSpec,
  observerSeat: Seat,
): BootResult {
  // If no boot router in spec, or base already selected, no-op.
  if (snapshot.base) {
    return { snapshot, trackSelected: false };
  }

  // Walk the boot router trie.
  // If spec doesn't have a compiled boot router, try direct opening pattern matching.
  const key = callKey(event.call);

  // Try compiled boot router if available.
  // The boot router is a compiled trie — check if convention spec defines one.
  // For now, use direct opening pattern matching.
  let bestTrackId: string | undefined;
  let bestPriority = Infinity;

  for (const track of getBaseModules(spec)) {
    for (const pattern of track.openingPatterns) {
      if (pattern.prefix.length === 1) {
        // Single-event prefix — check if it matches this event.
        if (matchesEventPattern(pattern.prefix[0]!, event, observerSeat)) {
          const priority = pattern.priority ?? Infinity;
          if (priority < bestPriority) {
            bestPriority = priority;
            bestTrackId = track.id;
          }
        }
      }
    }
  }

  if (bestTrackId) {
    const track = getBaseModules(spec).find((t) => t.id === bestTrackId)!;
    // Find the matching pattern to get the start state.
    let startState = track.initialStateId;
    for (const pattern of track.openingPatterns) {
      if (pattern.prefix.length === 1) {
        if (
          matchesEventPattern(pattern.prefix[0]!, event, observerSeat)
        ) {
          startState = pattern.startState;
          break;
        }
      }
    }

    const base: BaseTrackInstance = {
      trackId: bestTrackId,
      stateId: startState,
    };

    let updated: RuntimeSnapshot = { ...snapshot, base };

    // Apply onEnter effects for the initial state.
    const stateSpec = track.states[startState];
    if (stateSpec?.onEnter) {
      const ctx: EffectContext = {
        ownerType: "baseTrack",
        ownerId: bestTrackId,
        stateId: startState,
        ply: snapshot.ply,
      };
      const result = applyEffects(updated, stateSpec.onEnter, ctx);
      updated = result.snapshot;
    }

    // Export tags for the initial state.
    if (stateSpec?.exportTags) {
      const tags = new Set(updated.activeTags);
      for (const tag of stateSpec.exportTags) {
        tags.add(tag);
      }
      updated = { ...updated, activeTags: tags };
    }

    return { snapshot: updated, trackSelected: true };
  }

  return { snapshot, trackSelected: false };
}

// ── Main replay function ────────────────────────────────────────────

/**
 * Deterministic replay: walk the conversation history and produce
 * the final runtime snapshot.
 *
 * Algorithm:
 * 1. Initialize snapshot (empty state).
 * 2. For each event in history:
 *    a. Advance boot router (if base not yet selected).
 *    b. If boot router selects a track, instantiate base track.
 *    c. Build ordered frame list: [exclusive protocol if any, other protocols by depth, base].
 *    d. For each frame (top to bottom):
 *       - Find first matching transition.
 *       - If match: apply effects, advance state.
 *       - If routing === "consume": stop processing this event for lower frames.
 *    e. Run settle phase: settleProtocolLifecycle().
 *    f. Increment ply.
 * 3. Return final snapshot.
 */
export function replay(
  history: readonly { call: Call; seat: Seat }[],
  spec: ConventionSpec,
  observerSeat: Seat,
): RuntimeSnapshot {
  let snapshot: RuntimeSnapshot = {
    bootNodeId: "root",
    protocols: [],
    registers: {},
    activeTags: new Set<string>(),
    doneLatches: new Set<string>(),
    ply: 0,
  };

  for (const event of history) {
    // a. Advance boot router.
    const bootResult = advanceBootRouter(
      snapshot,
      event,
      spec,
      observerSeat,
    );
    snapshot = bootResult.snapshot;

    // c. Build ordered frame list.
    const frames = buildFrameList(snapshot, spec);

    // d. Process event through frames top-to-bottom.
    let consumed = false;
    for (const frame of frames) {
      if (consumed) break;

      // Find first matching transition.
      let matched: TransitionSpec | undefined;
      for (const t of frame.transitions) {
        // Guard check.
        if (t.guard) {
          const localState =
            frame.kind === "protocol" ? frame.localState : undefined;
          if (!evaluateBoolExpr(t.guard, snapshot, localState)) continue;
        }

        if (matchesEventPattern(t.when, event, observerSeat)) {
          matched = t;
          break;
        }
      }

      if (!matched) continue;

      // Apply transition.
      const ownerType: "baseTrack" | "protocol" =
        frame.kind === "base" ? "baseTrack" : "protocol";
      const ctx: EffectContext = {
        ownerType,
        ownerId: frame.id,
        stateId: frame.stateId,
        ply: snapshot.ply,
      };

      // Apply onExit of current state.
      if (matched.goto !== "STAY") {
        snapshot = applyOnExitEffects(
          snapshot,
          frame,
          spec,
        );
      }

      // Apply transition effects.
      if (matched.effects) {
        const result = applyEffects(
          snapshot,
          matched.effects,
          ctx,
          frame.localState,
        );
        snapshot = result.snapshot;

        // Update local state for protocol.
        if (frame.kind === "protocol") {
          snapshot = updateProtocolLocalState(
            snapshot,
            frame.instanceKey!,
            result.localState,
          );
        }
      }

      // Advance state.
      if (matched.goto === "POP" && frame.kind === "protocol") {
        // Protocol exits.
        const protocolSpec = getProtocolModules(spec).find((p) => p.id === frame.id);
        if (protocolSpec) {
          const latchKey = `${frame.id}:${protocolSpec.scopeKey ?? frame.id}`;
          const latches = new Set(snapshot.doneLatches);
          latches.add(latchKey);
          snapshot = {
            ...snapshot,
            doneLatches: latches,
            protocols: snapshot.protocols.filter(
              (p) => p.instanceKey !== frame.instanceKey,
            ),
          };
        }
      } else if (matched.goto !== "STAY") {
        // Advance to new state.
        if (frame.kind === "base") {
          const newBase: BaseTrackInstance = {
            trackId: snapshot.base!.trackId,
            stateId: matched.goto,
          };
          snapshot = { ...snapshot, base: newBase };

          // Apply onEnter of new state.
          const baseTrack = getBaseModules(spec).find(
            (t) => t.id === frame.id,
          );
          const newState = baseTrack?.states[matched.goto];
          if (newState?.onEnter) {
            const enterCtx: EffectContext = {
              ownerType: "baseTrack",
              ownerId: frame.id,
              stateId: matched.goto,
              ply: snapshot.ply,
            };
            const result = applyEffects(
              snapshot,
              newState.onEnter,
              enterCtx,
            );
            snapshot = result.snapshot;
          }
          if (newState?.exportTags) {
            const tags = new Set(snapshot.activeTags);
            for (const tag of newState.exportTags) {
              tags.add(tag);
            }
            snapshot = { ...snapshot, activeTags: tags };
          }
        } else {
          // Protocol state transition.
          const protocolSpec = getProtocolModules(spec).find(
            (p) => p.id === frame.id,
          );
          const instance = snapshot.protocols.find(
            (p) => p.instanceKey === frame.instanceKey,
          );
          if (instance && protocolSpec) {
            const updatedInstance: ProtocolInstance = {
              ...instance,
              stateId: matched.goto,
            };

            // Apply onEnter of new state.
            const newState = protocolSpec.states[matched.goto];
            let updatedLocal = updatedInstance.localState;
            if (newState?.onEnter) {
              const enterCtx: EffectContext = {
                ownerType: "protocol",
                ownerId: frame.id,
                stateId: matched.goto,
                ply: snapshot.ply,
              };
              const result = applyEffects(
                snapshot,
                newState.onEnter,
                enterCtx,
                updatedLocal,
              );
              snapshot = result.snapshot;
              updatedLocal = result.localState;
            }

            snapshot = {
              ...snapshot,
              protocols: snapshot.protocols.map((p) =>
                p.instanceKey === frame.instanceKey
                  ? { ...updatedInstance, localState: updatedLocal }
                  : p,
              ),
            };

            if (newState?.exportTags) {
              const tags = new Set(snapshot.activeTags);
              for (const tag of newState.exportTags) {
                tags.add(tag);
              }
              snapshot = { ...snapshot, activeTags: tags };
            }
          }
        }
      }

      // Check routing — consume stops propagation.
      const routing = matched.routing ?? "consume";
      if (routing === "consume") {
        consumed = true;
      }
    }

    // e. Settle phase.
    snapshot = settleProtocolLifecycle(snapshot, spec, observerSeat);

    // f. Increment ply.
    snapshot = { ...snapshot, ply: snapshot.ply + 1 };
  }

  return snapshot;
}

// ── Helper: apply onExit effects for a frame ────────────────────────

function applyOnExitEffects(
  snapshot: RuntimeSnapshot,
  frame: FrameDescriptor,
  spec: ConventionSpec,
): RuntimeSnapshot {
  if (frame.kind === "base") {
    const baseTrack = getBaseModules(spec).find((t) => t.id === frame.id);
    const stateSpec = baseTrack?.states[frame.stateId];
    if (stateSpec?.onExit) {
      const ctx: EffectContext = {
        ownerType: "baseTrack",
        ownerId: frame.id,
        stateId: frame.stateId,
        ply: snapshot.ply,
      };
      return applyEffects(snapshot, stateSpec.onExit, ctx).snapshot;
    }
  } else {
    const protocolSpec = getProtocolModules(spec).find((p) => p.id === frame.id);
    const stateSpec = protocolSpec?.states[frame.stateId] as
      | FrameStateSpec
      | undefined;
    if (stateSpec?.onExit) {
      const ctx: EffectContext = {
        ownerType: "protocol",
        ownerId: frame.id,
        stateId: frame.stateId,
        ply: snapshot.ply,
      };
      const result = applyEffects(
        snapshot,
        stateSpec.onExit,
        ctx,
        frame.localState,
      );
      return result.snapshot;
    }
  }
  return snapshot;
}

// ── Helper: update protocol local state ─────────────────────────────

function updateProtocolLocalState(
  snapshot: RuntimeSnapshot,
  instanceKey: string,
  newLocal: Readonly<Record<string, unknown>>,
): RuntimeSnapshot {
  return {
    ...snapshot,
    protocols: snapshot.protocols.map((p) =>
      p.instanceKey === instanceKey ? { ...p, localState: newLocal } : p,
    ),
  };
}

// ── computeActiveSurfaces ───────────────────────────────────────────

/**
 * Convenience function: given a snapshot and spec, compute the composed
 * surface for the current decision point.
 */
export function computeActiveSurfaces(
  snapshot: RuntimeSnapshot,
  spec: ConventionSpec,
): ComposedSurface {
  const stack = buildSurfaceStack(snapshot, spec);
  return composeSurfaceStack(stack);
}
