// ── Protocol Frame Architecture: Core Types ─────────────────────────
//
// All convention behavior is expressed as **modules**. A module is either:
// - role: "base"     — mutually exclusive, selected by opening pattern
// - role: "protocol" — guard-activated, layered on top of base modules
//
// Both share the same core: states, transitions, surfaces, facts, effects.
// The role field determines activation semantics, not the type shape.
//
// The runtime snapshot is a sparse state vector:
//   { bootNode, baseModule?, protocols[], registers, tags, doneLatches }

import type { Call, Seat, Auction } from "../../../engine/types";
import type { ConstraintDimension } from "../../../core/contracts/meaning";
import type { MeaningSurface, RankingMetadata } from "../../../core/contracts/meaning";
import type { FactCatalogExtension } from "../../../core/contracts/fact-catalog";
import type { ExplanationEntry } from "../../../core/contracts/explanation-catalog";


// ── Declarative Expression Types ────────────────────────────────────

/** Reference to a value in the public state. */
export type Ref =
  | { readonly kind: "reg"; readonly path: string }
  | { readonly kind: "history"; readonly path: string }
  | { readonly kind: "actor"; readonly path: "party" | "team" | "seat" }
  | { readonly kind: "base"; readonly path: "trackId" | "stateId" | "tag" }
  | { readonly kind: "tag"; readonly tag: string }
  | { readonly kind: "local"; readonly path: string }
  | { readonly kind: "protocol"; readonly protocolId: string; readonly path: "stateId" | "instanceKey" };

/** Boolean expression tree over public state. */
export type BoolExpr =
  | { readonly op: "and"; readonly args: readonly BoolExpr[] }
  | { readonly op: "or"; readonly args: readonly BoolExpr[] }
  | { readonly op: "not"; readonly arg: BoolExpr }
  | { readonly op: "exists"; readonly ref: Ref }
  | { readonly op: "eq"; readonly ref: Ref; readonly value: unknown }
  | { readonly op: "neq"; readonly ref: Ref; readonly value: unknown }
  | { readonly op: "in"; readonly ref: Ref; readonly values: readonly unknown[] }
  | { readonly op: "lt"; readonly ref: Ref; readonly value: number }
  | { readonly op: "gt"; readonly ref: Ref; readonly value: number }
  | { readonly op: "activeTag"; readonly tag: string }
  | { readonly op: "true" }
  | { readonly op: "false" };

/** State effect — writes to public registers or local protocol state. */
export type EffectSpec =
  | { readonly op: "setReg"; readonly path: string; readonly value: unknown | Ref }
  | { readonly op: "clearReg"; readonly path: string }
  | { readonly op: "setLocal"; readonly path: string; readonly value: unknown | Ref }
  | { readonly op: "clearLocal"; readonly path: string }
  | { readonly op: "exportTag"; readonly tag: string }
  | { readonly op: "removeTag"; readonly tag: string };

// ── BoolExpr Helpers ────────────────────────────────────────────────

export function and(...args: BoolExpr[]): BoolExpr {
  return { op: "and", args };
}

export function or(...args: BoolExpr[]): BoolExpr {
  return { op: "or", args };
}

export function not(arg: BoolExpr): BoolExpr {
  return { op: "not", arg };
}

export function exists(ref: Ref): BoolExpr {
  return { op: "exists", ref };
}

export function eq(ref: Ref, value: unknown): BoolExpr {
  return { op: "eq", ref, value };
}

export function neq(ref: Ref, value: unknown): BoolExpr {
  return { op: "neq", ref, value };
}

export function activeTag(tag: string): BoolExpr {
  return { op: "activeTag", tag };
}

export function reg(path: string): Ref {
  return { kind: "reg", path };
}

export function local(path: string): Ref {
  return { kind: "local", path };
}

export function tagRef(tag: string): Ref {
  return { kind: "tag", tag };
}

export function cap(capabilityId: string): BoolExpr {
  // Capabilities are derived booleans stored as tags with "cap:" prefix
  return { op: "activeTag", tag: `cap:${capabilityId}` };
}

// ── Public Semantic Schema ──────────────────────────────────────────

/** Writer policy for a register — who is allowed to set it. */
export type RegisterWriterPolicy = "singleLogicalOwner" | "multiWriter";

/** Specification for a single register in the public semantic contract. */
export interface RegisterSpec {
  readonly type: string;
  readonly description: string;
  readonly invariants?: readonly string[];
  readonly writerPolicy?: RegisterWriterPolicy;
}

/** A derived boolean capability — computed from registers + tags + history. */
export interface CapabilitySpec {
  readonly id: string;
  readonly when: BoolExpr;
  readonly description: string;
}

/**
 * The public semantic contract that all modules and protocols must
 * agree on. Defines the shared vocabulary of registers, capabilities,
 * and coordination points.
 */
export interface PublicSemanticSchema {
  readonly registers: Readonly<Record<string, RegisterSpec>>;
  readonly capabilities: Readonly<Record<string, CapabilitySpec>>;
}

// ── Event Patterns ──────────────────────────────────────────────────

/** Pattern for matching a single event in a conversation prefix. */
export interface EventPattern {
  readonly actor?: "self" | "partner" | "opponent" | "any";
  readonly call?: Call;
  /** Match any call of this type (bid/pass/double/redouble). */
  readonly callType?: Call["type"];
}

// ── Transition Types ────────────────────────────────────────────────

/** A transition spec within a frame state (base or protocol). */
export interface TransitionSpec {
  readonly transitionId: string;
  /** Event pattern to match. */
  readonly when: EventPattern;
  /** Target state ID, or "STAY" to remain, or "POP" to exit protocol. */
  readonly goto: string | "STAY" | "POP";
  readonly effects?: readonly EffectSpec[];
  /** Guard predicate over public state — transition only fires if true. */
  readonly guard?: BoolExpr;
  /**
   * Whether lower layers still see the event.
   * - "observe": lower layers also process this event
   * - "consume": lower layers do not see this event
   * Default: "consume"
   */
  readonly routing?: "observe" | "consume";
}

/** Zero-event reaction — evaluated in the settle phase after protocol exits. */
export interface ReactionSpec {
  readonly reactionId: string;
  /** Condition over public state. */
  readonly when: BoolExpr;
  /** Target state or special target. */
  readonly goto: string | "POP" | "STAY";
  readonly effects?: readonly EffectSpec[];
  readonly priority?: number;
}

// ── Frame State (shared by all modules) ─────────────────────────────

/** A state in a module's FSM. */
export interface FrameStateSpec {
  readonly id: string;
  /** Surface fragment ID active at this state. */
  readonly surface?: string;
  /** Tags exported when this state is active. */
  readonly exportTags?: readonly string[];
  readonly onEnter?: readonly EffectSpec[];
  readonly onExit?: readonly EffectSpec[];
  /** Event-driven transitions. */
  readonly eventTransitions: readonly TransitionSpec[];
  /** Zero-event reactions evaluated in settle phase. */
  readonly reactions?: readonly ReactionSpec[];
  /**
   * Protocol-only: whether this state overlays or takes over.
   * Ignored for base-role modules.
   */
  readonly mode?: "overlay" | "exclusive";
  /**
   * Protocol-only: whether other protocols may mount above this state.
   * - true: any protocol may mount
   * - false: no protocols may mount
   * - string[]: only listed module IDs may mount
   * Default: true. Ignored for base-role modules.
   */
  readonly acceptsMountedProtocols?: boolean | readonly string[];
  /** Protocol-only, exclusive states: whether to inherit the base surface. */
  readonly inheritBaseSurface?: "all" | "none";
}

// ── Module Spec (unified base + protocol) ───────────────────────────

/** Opening pattern that routes to a base module. */
export interface OpeningPatternSpec {
  /** Prefix of events that selects this module. */
  readonly prefix: readonly EventPattern[];
  /** State to enter when this pattern matches. */
  readonly startState: string;
  /** Priority for ambiguity resolution (lower = higher priority). */
  readonly priority?: number;
}

/** Anchor policy — where a protocol module attaches in the frame stack. */
export interface AnchorPolicy {
  /** What the module anchors to. */
  readonly target: "base" | "topVisible" | { readonly activeTag: string };
  /** Behavior when mounting is blocked. */
  readonly ifBlocked: "suppress" | "defer";
}

/**
 * Shared fields for all modules regardless of role.
 */
interface ModuleSpecBase {
  readonly id: string;
  readonly name: string;
  /** States in this module's FSM. */
  readonly states: Readonly<Record<string, FrameStateSpec>>;
  /** Initial state when the module activates. */
  readonly initialStateId: string;
  /** Fact catalog extension for this module. */
  readonly facts: FactCatalogExtension;
  /** Deal constraints for generating test hands. */
  readonly dealConstraints?: unknown;
  /** Explanation entries for teaching. */
  readonly explanationEntries?: readonly ExplanationEntry[];
}

/**
 * A base module — the primary conversation flow for an opening type.
 * Exactly one base module is active per conversation.
 */
export interface BaseModuleSpec extends ModuleSpecBase {
  readonly role: "base";
  /** Opening patterns contributed to the boot router. */
  readonly openingPatterns: readonly OpeningPatternSpec[];
  /** Surface fragment active while this module is a viable route (pre-selection). */
  readonly openingSurface?: string;
}

/**
 * A protocol module — guard-activated, layered on top of base modules.
 * Activates based on public state (registers, tags, capabilities),
 * not on specific base module state IDs.
 */
export interface ProtocolModuleSpec extends ModuleSpecBase {
  readonly role: "protocol";
  /**
   * Durable join condition: should an instance for this scope exist?
   * Evaluated against public state after every event.
   * Once true and instance created, this is not re-checked.
   */
  readonly attachWhen: BoolExpr;
  /**
   * Is the attached instance currently actionable/visible?
   * Evaluated each tick. Controls surface visibility, not lifecycle.
   */
  readonly surfaceWhen?: BoolExpr;
  /** Instance identity key — e.g., "verify:${reg.agreement.topic}". */
  readonly scopeKey?: string;
  /** Anchor policy for where in the frame stack this mounts. */
  readonly anchorPolicy?: AnchorPolicy;
  /** Completion configuration. */
  readonly completion?: {
    /** Prevents immediate re-entry after completion. */
    readonly doneLatchUntil?: BoolExpr;
  };
  /** Coexistence rules with other protocol modules. */
  readonly coexistence?: {
    /** Mutex group — only one module per group may be active. */
    readonly mutexGroup?: string;
    /** Priority within mutex group (lower = wins). */
    readonly priority?: number;
    /** Maximum concurrent instances of this module. */
    readonly maxInstances?: number;
  };
}

/** A module is either a base module or a protocol module. */
export type ModuleSpec = BaseModuleSpec | ProtocolModuleSpec;

// ── Surface Fragment ────────────────────────────────────────────────

/**
 * How a surface fragment interacts with lower layers:
 * - "augment": add rules/meanings; lower layers remain visible
 * - "compete": rules from both layers visible; ranking decides
 * - "shadow": for covered actions, lower layers are hidden/banned
 */
export type SurfaceRelation = "augment" | "compete" | "shadow";

/**
 * A surface fragment — a set of rules contributed by one frame at one state.
 * Multiple fragments compose into the effective decision surface.
 */
export interface SurfaceFragment {
  readonly id: string;
  /** How this fragment interacts with lower layers. */
  readonly relation: SurfaceRelation;
  /** Layer priority — higher number = higher in the stack. */
  readonly layerPriority: number;
  /** Which actions this fragment covers — "all" or specific calls. */
  readonly actionCoverage: "all" | readonly Call[];
  /** Legality overrides. */
  readonly legalMask?: Readonly<Record<string, "allow" | "ban">>;
  /** Optional meaning overrides for explainability. */
  readonly actionMeanings?: Readonly<Record<string, string>>;
  /** MeaningSurface rules in this fragment. */
  readonly surfaces: readonly MeaningSurface[];
  /** Fact evaluator IDs needed by these surfaces. */
  readonly factEvaluatorIds?: readonly string[];
  /** Constraint dimensions accumulated from prior-round surface groups.
   *  When present, the specificity deriver unions these with each surface's
   *  own derived dimensions so that later-round surfaces reflect the full
   *  communicative context established by earlier bids.
   *
   *  Example: post-Ogust surfaces inherit ["suitIdentity"] because the weak
   *  two opening already established which suit is being discussed. */
  readonly inheritedDimensions?: readonly ConstraintDimension[];
}

// ── Runtime Snapshot ────────────────────────────────────────────────

/** A value in the register bus with provenance tracking. */
export interface ProvenancedValue {
  readonly value: unknown;
  readonly writtenAtPly: number;
  readonly writtenBy: {
    readonly ownerType: "boot" | "baseTrack" | "protocol";
    readonly ownerId: string;
    readonly stateId: string;
  };
}

/** Active instance of a base track. */
export interface BaseTrackInstance {
  readonly trackId: string;
  readonly stateId: string;
}

/** Active instance of a protocol. */
export interface ProtocolInstance {
  readonly protocolId: string;
  readonly instanceKey: string;
  readonly stateId: string;
  /** What this instance is anchored to. */
  readonly anchor: "base" | string; // "base" or parent protocol instance key
  /** Depth in the frame stack. */
  readonly depth: number;
  /** Ply at which this instance was created. */
  readonly attachedAtPly: number;
  /** Local state for this instance. */
  readonly localState: Readonly<Record<string, unknown>>;
}

/**
 * The full runtime state at any point in the conversation.
 * This is the sparse state vector — exactly one base frame,
 * zero or more protocol frames, plus shared public state.
 */
export interface RuntimeSnapshot {
  /** Current node in the compiled boot router trie. */
  readonly bootNodeId: string;
  /** Active base track (undefined until opening pattern selects one). */
  readonly base?: BaseTrackInstance;
  /** Active protocol instances, ordered by depth. */
  readonly protocols: readonly ProtocolInstance[];
  /** Public register bus with provenance. */
  readonly registers: Readonly<Record<string, ProvenancedValue>>;
  /** Active tags (from state exports + effects). */
  readonly activeTags: ReadonlySet<string>;
  /** Done latches — protocol instances that have completed and cannot re-attach. */
  readonly doneLatches: ReadonlySet<string>; // "protocolId:scopeKey"
  /** Current ply (event index). */
  readonly ply: number;
}

// ── Provenance Types ────────────────────────────────────────────────

/** Trace of a register write. */
export interface RegisterWriteTrace {
  readonly registerPath: string;
  readonly value: unknown;
  readonly writtenAtPly: number;
  readonly by: {
    readonly ownerType: "boot" | "baseTrack" | "protocol";
    readonly ownerId: string;
    readonly stateId: string;
    readonly effectId?: string;
  };
}

/** Trace of a protocol attachment — why it activated. */
export interface ProtocolAttachTrace {
  readonly protocolId: string;
  readonly instanceKey: string;
  readonly attachedAtPly: number;
  readonly witness: readonly (
    | { readonly kind: "register"; readonly path: string; readonly source: RegisterWriteTrace }
    | { readonly kind: "tag"; readonly tag: string; readonly sourceOwner: { readonly ownerType: string; readonly ownerId: string; readonly stateId: string } }
    | { readonly kind: "capability"; readonly capabilityId: string; readonly inputs: readonly string[] }
  )[];
}

/** Full decision trace — provenance across the entire frame stack. */
export interface DecisionTrace {
  readonly winningRule: {
    readonly ownerType: "baseTrack" | "protocol";
    readonly ownerId: string;
    readonly stateId: string;
    readonly surfaceId: string;
    readonly ruleId: string;
    readonly instanceKey?: string;
  };
  readonly activeSurfaceStack: readonly {
    readonly surfaceId: string;
    readonly ownerType: "baseTrack" | "protocol";
    readonly ownerId: string;
    readonly stateId: string;
    readonly relation: SurfaceRelation;
    readonly layerPriority: number;
  }[];
  readonly activationChain: readonly ProtocolAttachTrace[];
}

/** Per-action resolution for teaching UI. */
export interface ActionResolution {
  readonly call: Call;
  readonly status: "recommended" | "available" | "blocked" | "shadowed";
  readonly effectiveMeaning: string;
  readonly controllingLayer: {
    readonly ownerType: "boot" | "baseTrack" | "protocol";
    readonly ownerId: string;
    readonly surfaceId: string;
  };
  readonly supportingRules: readonly {
    readonly ownerType: "baseTrack" | "protocol";
    readonly ownerId: string;
    readonly surfaceId: string;
    readonly ruleId: string;
  }[];
  readonly blockedBy?: readonly {
    readonly ownerId: string;
    readonly surfaceId: string;
    readonly reason: "shadow" | "ban";
  }[];
}

// ── Convention Spec (Top-Level Composition) ─────────────────────────

/**
 * A fully composed convention specification.
 * This is what gets compiled into a runnable convention system.
 *
 * All modules live in one list. The runtime separates them by role:
 * - role: "base" modules are mutually exclusive, selected by opening
 * - role: "protocol" modules are guard-activated, layered
 */
export interface ConventionSpec {
  readonly id: string;
  readonly name: string;
  /** The public semantic contract. */
  readonly schema: PublicSemanticSchema;
  /** All modules in this convention system. */
  readonly modules: readonly ModuleSpec[];
  /** All surface fragments referenced by modules. */
  readonly surfaces: Readonly<Record<string, SurfaceFragment>>;
}

// ── ConventionSpec Helpers ──────────────────────────────────────────

/** Extract base-role modules from a ConventionSpec. */
export function getBaseModules(spec: ConventionSpec): readonly BaseModuleSpec[] {
  return spec.modules.filter((m): m is BaseModuleSpec => m.role === "base");
}

/** Extract protocol-role modules from a ConventionSpec. */
export function getProtocolModules(spec: ConventionSpec): readonly ProtocolModuleSpec[] {
  return spec.modules.filter((m): m is ProtocolModuleSpec => m.role === "protocol");
}

// ── Boot Router Types ───────────────────────────────────────────────

/** A node in the compiled opening pattern trie. */
export interface BootTrieNode {
  readonly nodeId: string;
  /** Child nodes keyed by call string (e.g., "1NT", "P", "2C"). */
  readonly children: Readonly<Record<string, string>>; // call string → child nodeId
  /** If this node is a leaf, which base track does it select? */
  readonly selectedTrackId?: string;
  /** Opening surface fragments active while this node is current. */
  readonly viableSurfaces?: readonly string[]; // surface fragment IDs
  /** Which tracks are still viable at this node. */
  readonly viableTrackIds: readonly string[];
}

/** Compiled boot router — a prefix trie over opening patterns. */
export interface BootRouter {
  readonly rootNodeId: string;
  readonly nodes: Readonly<Record<string, BootTrieNode>>;
}
