// ── Protocol Lifecycle Engine ────────────────────────────────────────
//
// Public API for protocol lifecycle management:
// - BoolExpr evaluation against an ExpressionContext
// - Settle phase: capability evaluation, attach/detach, mutex, scope keys
// - Effect application with provenance
// - Protocol FSM advancement
//
// This module provides the reusable, testable core. The replay engine
// (replay.ts) orchestrates event processing and calls into these functions.

import { Seat } from "../../../engine/types";
import type { Call, AuctionEntry } from "../../../engine/types";
import { partnerSeat, areSamePartnership } from "../../../engine/constants";
import { callKey } from "../../../engine/call-helpers";
import type {
  BoolExpr,
  Ref,
  EffectSpec,
  ProtocolModuleSpec,
  ProtocolInstance,
  FrameStateSpec,
  RuntimeSnapshot,
  ProvenancedValue,
  PublicSemanticSchema,
  EventPattern,
  TransitionSpec,
  ReactionSpec,
} from "./types";

// ── Expression Context ──────────────────────────────────────────────

/**
 * Context for evaluating BoolExpr and resolving Ref values.
 *
 * Decouples expression evaluation from RuntimeSnapshot so that
 * callers (settle phase, FSM advance, tests) can provide exactly
 * the state they need.
 */
export interface ExpressionContext {
  readonly registers: Readonly<Record<string, ProvenancedValue>>;
  readonly activeTags: ReadonlySet<string>;
  readonly history: readonly AuctionEntry[];
  readonly actorSeat: Seat;
  readonly baseState?: {
    readonly trackId: string;
    readonly stateId: string;
    readonly tag?: string;
  };
  readonly protocolStates: ReadonlyMap<string, ProtocolInstance>;
  readonly localState?: Readonly<Record<string, unknown>>;
}

// ── Seat helpers ────────────────────────────────────────────────────

/** Get team identifier for a seat. */
function teamOf(seat: Seat): "NS" | "EW" {
  return seat === Seat.North || seat === Seat.South ? "NS" : "EW";
}

// ── Ref Resolution ──────────────────────────────────────────────────

/**
 * Resolve a Ref to its current value in the expression context.
 *
 * - reg   → register value
 * - tag   → boolean (tag existence)
 * - local → protocol-local state value
 * - base  → base track property
 * - protocol → protocol instance property
 * - history  → history property (currently: "length")
 * - actor    → actor seat/team info
 */
export function resolveRef(ref: Ref, context: ExpressionContext): unknown {
  switch (ref.kind) {
    case "reg":
      return context.registers[ref.path]?.value;
    case "tag":
      return context.activeTags.has(ref.tag);
    case "local":
      return context.localState?.[ref.path];
    case "base": {
      if (!context.baseState) return undefined;
      switch (ref.path) {
        case "trackId":
          return context.baseState.trackId;
        case "stateId":
          return context.baseState.stateId;
        case "tag":
          return context.baseState.tag;
      }
      return undefined;
    }
    case "protocol": {
      const inst = context.protocolStates.get(ref.protocolId);
      if (!inst) return undefined;
      switch (ref.path) {
        case "stateId":
          return inst.stateId;
        case "instanceKey":
          return inst.instanceKey;
      }
      return undefined;
    }
    case "history": {
      if (ref.path === "length") return context.history.length;
      return undefined;
    }
    case "actor": {
      switch (ref.path) {
        case "seat":
          return context.actorSeat;
        case "team":
          return teamOf(context.actorSeat);
        case "party":
          return teamOf(context.actorSeat);
      }
      return undefined;
    }
  }
}

/** Check whether a Ref points to an existing (defined) value. */
function refExists(ref: Ref, context: ExpressionContext): boolean {
  switch (ref.kind) {
    case "reg":
      return ref.path in context.registers;
    case "tag":
      return context.activeTags.has(ref.tag);
    case "local":
      return context.localState !== undefined && ref.path in context.localState;
    case "base":
      return context.baseState !== undefined;
    case "protocol":
      return context.protocolStates.has(ref.protocolId);
    case "history":
      return ref.path === "length";
    case "actor":
      return true;
  }
}

// ── BoolExpr Evaluation ─────────────────────────────────────────────

/**
 * Evaluate a BoolExpr against the given expression context.
 * Handles all expression variants: and, or, not, exists, eq, neq,
 * in, lt, gt, activeTag, true, false.
 */
export function evaluateBoolExpr(
  expr: BoolExpr,
  context: ExpressionContext,
): boolean {
  switch (expr.op) {
    case "true":
      return true;
    case "false":
      return false;
    case "activeTag":
      return context.activeTags.has(expr.tag);
    case "exists":
      return refExists(expr.ref, context);
    case "eq":
      return resolveRef(expr.ref, context) === expr.value;
    case "neq":
      return resolveRef(expr.ref, context) !== expr.value;
    case "in": {
      const val = resolveRef(expr.ref, context);
      return (expr.values as readonly unknown[]).includes(val);
    }
    case "lt": {
      const val = resolveRef(expr.ref, context);
      return typeof val === "number" && val < expr.value;
    }
    case "gt": {
      const val = resolveRef(expr.ref, context);
      return typeof val === "number" && val > expr.value;
    }
    case "and":
      return expr.args.every((a) => evaluateBoolExpr(a, context));
    case "or":
      return expr.args.some((a) => evaluateBoolExpr(a, context));
    case "not":
      return !evaluateBoolExpr(expr.arg, context);
  }
}

// ── Context builders ────────────────────────────────────────────────

/**
 * Build an ExpressionContext from a RuntimeSnapshot.
 * Used by the settle phase and other snapshot-based evaluation paths.
 */
function contextFromSnapshot(
  snapshot: RuntimeSnapshot,
  protocolInstance?: ProtocolInstance,
): ExpressionContext {
  return {
    registers: snapshot.registers,
    activeTags: snapshot.activeTags,
    history: [],
    actorSeat: Seat.North,
    baseState: snapshot.base
      ? { trackId: snapshot.base.trackId, stateId: snapshot.base.stateId }
      : undefined,
    protocolStates: new Map(
      snapshot.protocols.map((p) => [p.protocolId, p]),
    ),
    localState: protocolInstance?.localState,
  };
}

// ── Scope key interpolation ─────────────────────────────────────────

/**
 * Resolve a scope key template by interpolating `${reg.path}` references
 * against current registers.
 */
function resolveScopeKey(
  template: string,
  snapshot: RuntimeSnapshot,
): string {
  return template.replace(/\$\{reg\.([^}]+)\}/g, (_match, path: string) => {
    const entry = snapshot.registers[path];
    return entry?.value != null ? String(entry.value) : "";
  });
}

// ── Ref-as-value detection ──────────────────────────────────────────

const REF_KINDS = new Set(["reg", "tag", "local", "base", "protocol", "history", "actor"]);

/** Type guard: is this effect value a Ref object? */
function isRef(value: unknown): value is Ref {
  if (typeof value !== "object" || value === null) return false;
  return REF_KINDS.has((value as Record<string, unknown>)["kind"] as string);
}

/** Resolve an effect value — if it's a Ref, resolve it; otherwise return as-is. */
function resolveEffectValue(
  value: unknown,
  snapshot: RuntimeSnapshot,
  localState: Readonly<Record<string, unknown>>,
): unknown {
  if (isRef(value)) {
    const ctx = contextFromSnapshot(snapshot);
    return resolveRef(value, { ...ctx, localState });
  }
  return value;
}

// ── Effect Application ──────────────────────────────────────────────

/**
 * Apply a list of effects to the snapshot. Handles:
 * - setReg:    write to register bus with provenance
 * - clearReg:  remove register
 * - setLocal:  write to protocol-local state (matched by owner.ownerId)
 * - clearLocal: remove from protocol-local state
 * - exportTag: add tag to activeTags
 * - removeTag: remove tag from activeTags
 */
export function applyEffects(
  effects: readonly EffectSpec[],
  snapshot: RuntimeSnapshot,
  owner: { readonly ownerType: string; readonly ownerId: string; readonly stateId: string },
  ply: number,
): RuntimeSnapshot {
  let current = snapshot;

  for (const effect of effects) {
    switch (effect.op) {
      case "setReg": {
        const localForResolve = findProtocolLocal(current, owner.ownerId);
        const value = resolveEffectValue(effect.value, current, localForResolve);
        const registers: Record<string, ProvenancedValue> = {
          ...current.registers,
          [effect.path]: {
            value,
            writtenAtPly: ply,
            writtenBy: {
              ownerType: owner.ownerType as "boot" | "baseTrack" | "protocol",
              ownerId: owner.ownerId,
              stateId: owner.stateId,
            },
          },
        };
        current = { ...current, registers };
        break;
      }
      case "clearReg": {
        const { [effect.path]: _removed, ...rest } = current.registers;
        current = { ...current, registers: rest };
        break;
      }
      case "setLocal": {
        const localForResolve = findProtocolLocal(current, owner.ownerId);
        const value = resolveEffectValue(effect.value, current, localForResolve);
        current = {
          ...current,
          protocols: current.protocols.map((p) =>
            p.protocolId === owner.ownerId
              ? { ...p, localState: { ...p.localState, [effect.path]: value } }
              : p,
          ),
        };
        break;
      }
      case "clearLocal": {
        current = {
          ...current,
          protocols: current.protocols.map((p) => {
            if (p.protocolId !== owner.ownerId) return p;
            const { [effect.path]: _removed, ...rest } = p.localState;
            return { ...p, localState: rest };
          }),
        };
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

  return current;
}

/** Find the localState for a protocol instance by protocolId. */
function findProtocolLocal(
  snapshot: RuntimeSnapshot,
  protocolId: string,
): Readonly<Record<string, unknown>> {
  const inst = snapshot.protocols.find((p) => p.protocolId === protocolId);
  return inst?.localState ?? {};
}

// ── Event Pattern Matching ──────────────────────────────────────────

/** Check whether an event matches an EventPattern. */
function matchesEventPattern(
  pattern: EventPattern,
  call: Call,
  eventSeat: Seat,
  observerSeat: Seat,
): boolean {
  // Actor constraint.
  if (pattern.actor && pattern.actor !== "any") {
    switch (pattern.actor) {
      case "self":
        if (eventSeat !== observerSeat) return false;
        break;
      case "partner":
        if (eventSeat !== partnerSeat(observerSeat)) return false;
        break;
      case "opponent":
        if (areSamePartnership(eventSeat, observerSeat)) return false;
        break;
    }
  }

  // Call type constraint.
  if (pattern.callType && call.type !== pattern.callType) return false;

  // Specific call constraint.
  if (pattern.call) {
    if (callKey(pattern.call) !== callKey(call)) return false;
  }

  return true;
}

// ── Protocol FSM Advancement ────────────────────────────────────────

/**
 * Advance a protocol instance's FSM by one event.
 *
 * Tests transitions in the current state in declaration order.
 * Returns the updated instance, effects to apply, and routing flag.
 * Returns null if no transition matches.
 */
export function advanceProtocolState(
  instance: ProtocolInstance,
  spec: ProtocolModuleSpec,
  call: Call,
  seat: Seat,
  context: ExpressionContext,
): { readonly instance: ProtocolInstance; readonly effects: readonly EffectSpec[]; readonly consumed: boolean } | null {
  const state = spec.states[instance.stateId] as FrameStateSpec | undefined;
  if (!state) return null;

  for (const transition of state.eventTransitions) {
    // Match event pattern.
    if (!matchesEventPattern(transition.when, call, seat, context.actorSeat)) {
      continue;
    }

    // Guard check.
    if (transition.guard && !evaluateBoolExpr(transition.guard, context)) {
      continue;
    }

    // Transition matches — compute new state.
    let newStateId: string;
    if (transition.goto === "STAY") {
      newStateId = instance.stateId;
    } else {
      // "POP" or a real state ID — pass through as the stateId.
      newStateId = transition.goto;
    }

    const updatedInstance: ProtocolInstance = {
      ...instance,
      stateId: newStateId,
    };

    return {
      instance: updatedInstance,
      effects: transition.effects ?? [],
      consumed: (transition.routing ?? "consume") === "consume",
    };
  }

  return null;
}

// ── Settle Phase: Protocol Lifecycle ────────────────────────────────

/**
 * Settle phase — called after every event. Manages the full protocol
 * lifecycle: capability evaluation, attachment, exit, done latches,
 * scope key deduplication, and mutex group resolution.
 *
 * Steps:
 * 1. Evaluate capabilities from schema → add/remove `cap:*` tags
 * 2. Clear expired done latches (doneLatchUntil now true)
 * 3. Check exit conditions for attached protocols (reactions with POP)
 * 4. Apply done latches for exiting protocols
 * 5. Check attachWhen for non-attached protocols (skip done-latched, no-reentry)
 * 6. Handle scope key deduplication
 * 7. Handle mutex group resolution (higher priority wins)
 */
export function settleProtocolLifecycle(
  snapshot: RuntimeSnapshot,
  specs: readonly ProtocolModuleSpec[],
  schema: PublicSemanticSchema,
): RuntimeSnapshot {
  let current = snapshot;

  // ── Step 1: Evaluate capabilities ─────────────────────────
  // Remove stale cap:* tags, then recompute from schema.
  const capTags = new Set(current.activeTags);
  for (const tag of capTags) {
    if (tag.startsWith("cap:")) capTags.delete(tag);
  }
  const capCtx = contextFromSnapshot({ ...current, activeTags: capTags });
  for (const [id, capSpec] of Object.entries(schema.capabilities)) {
    if (evaluateBoolExpr(capSpec.when, capCtx)) {
      capTags.add(`cap:${id}`);
    }
  }
  current = { ...current, activeTags: capTags };

  // ── Step 2: Clear expired done latches ────────────────────
  const updatedLatches = new Set(current.doneLatches);
  for (const latchKey of current.doneLatches) {
    const sepIdx = latchKey.indexOf(":");
    const protocolId = sepIdx >= 0 ? latchKey.slice(0, sepIdx) : latchKey;
    const spec = specs.find((s) => s.id === protocolId);
    if (spec?.completion?.doneLatchUntil) {
      const latchCtx = contextFromSnapshot(current);
      if (evaluateBoolExpr(spec.completion.doneLatchUntil, latchCtx)) {
        updatedLatches.delete(latchKey);
      }
    }
  }
  current = { ...current, doneLatches: updatedLatches };

  // ── Step 3: Check exit conditions for attached protocols ──
  // Evaluate reactions on each attached protocol's current state.
  // A reaction with goto "POP" triggers exit.
  const exitedThisPass = new Set<string>(); // latchKeys
  const remainingProtocols: ProtocolInstance[] = [];

  for (const inst of current.protocols) {
    const spec = specs.find((s) => s.id === inst.protocolId);
    if (!spec) {
      remainingProtocols.push(inst);
      continue;
    }

    const state = spec.states[inst.stateId] as FrameStateSpec | undefined;
    if (!state?.reactions) {
      remainingProtocols.push(inst);
      continue;
    }

    // Find the highest-priority matching reaction.
    const instCtx = contextFromSnapshot(current, inst);
    let bestReaction: ReactionSpec | undefined;
    for (const reaction of state.reactions) {
      if (evaluateBoolExpr(reaction.when, instCtx)) {
        if (
          !bestReaction ||
          (reaction.priority ?? 0) > (bestReaction.priority ?? 0)
        ) {
          bestReaction = reaction;
        }
      }
    }

    if (bestReaction && bestReaction.goto === "POP") {
      // Protocol exits.
      // Apply reaction effects.
      if (bestReaction.effects) {
        current = applyEffects(
          bestReaction.effects,
          current,
          {
            ownerType: "protocol",
            ownerId: inst.protocolId,
            stateId: inst.stateId,
          },
          current.ply,
        );
      }

      // Apply onExit effects of the current state.
      if (state.onExit) {
        current = applyEffects(
          state.onExit,
          current,
          {
            ownerType: "protocol",
            ownerId: inst.protocolId,
            stateId: inst.stateId,
          },
          current.ply,
        );
      }

      // ── Step 4: Apply done latch if configured ────────────
      const scopeKey = resolveScopeKey(spec.scopeKey ?? spec.id, current);
      const latchKey = `${spec.id}:${scopeKey}`;
      exitedThisPass.add(latchKey);

      if (spec.completion?.doneLatchUntil) {
        const newLatches = new Set(current.doneLatches);
        newLatches.add(latchKey);
        current = { ...current, doneLatches: newLatches };
      }

      // Don't add to remainingProtocols — instance is removed.
    } else {
      remainingProtocols.push(inst);
    }
  }

  current = { ...current, protocols: remainingProtocols };

  // ── Step 5: Check attachWhen for non-attached protocols ───
  const attachCtx = contextFromSnapshot(current);

  // Existing scope keys (protocolId:scopeKey).
  const attachedScopeKeys = new Set(
    current.protocols.map((p) => `${p.protocolId}:${p.instanceKey}`),
  );

  const newInstances: ProtocolInstance[] = [];

  for (const spec of specs) {
    const scopeKey = resolveScopeKey(spec.scopeKey ?? spec.id, current);
    const latchKey = `${spec.id}:${scopeKey}`;

    // Skip if done-latched.
    if (current.doneLatches.has(latchKey)) continue;

    // No-reentry rule: an instance that exited this pass cannot re-attach.
    if (exitedThisPass.has(latchKey)) continue;

    // ── Step 6: Scope key deduplication ─────────────────────
    // Skip if already attached with the same scope key.
    if (attachedScopeKeys.has(latchKey)) continue;

    // Evaluate attachWhen.
    if (!evaluateBoolExpr(spec.attachWhen, attachCtx)) continue;

    // Create new instance.
    newInstances.push({
      protocolId: spec.id,
      instanceKey: scopeKey,
      stateId: spec.initialStateId,
      anchor: "base",
      depth: current.protocols.length + newInstances.length + 1,
      attachedAtPly: current.ply,
      localState: {},
    });

    // Mark scope key as taken to prevent duplicates within this pass.
    attachedScopeKeys.add(latchKey);
  }

  // ── Step 7: Mutex group resolution ────────────────────────
  // Combine existing + new instances, then resolve mutex conflicts.
  const allProtocols = [...current.protocols, ...newInstances];
  const resolved = resolveMutexGroups(allProtocols, specs);

  current = { ...current, protocols: resolved };

  return current;
}

/**
 * Resolve mutex groups: within each mutex group, keep only the
 * highest-priority instance (lowest priority number wins).
 * Protocols without a mutex group are always kept.
 */
function resolveMutexGroups(
  instances: readonly ProtocolInstance[],
  specs: readonly ProtocolModuleSpec[],
): readonly ProtocolInstance[] {
  // Group instances by mutexGroup.
  const mutexWinners = new Map<string, { instance: ProtocolInstance; priority: number }>();
  const result: ProtocolInstance[] = [];

  for (const inst of instances) {
    const spec = specs.find((s) => s.id === inst.protocolId);
    const mutexGroup = spec?.coexistence?.mutexGroup;

    if (!mutexGroup) {
      // No mutex group — always keep.
      result.push(inst);
      continue;
    }

    const priority = spec?.coexistence?.priority ?? Infinity;
    const existing = mutexWinners.get(mutexGroup);

    if (!existing || priority < existing.priority) {
      mutexWinners.set(mutexGroup, { instance: inst, priority });
    }
  }

  // Add mutex winners.
  for (const [, winner] of mutexWinners) {
    result.push(winner.instance);
  }

  return result;
}
