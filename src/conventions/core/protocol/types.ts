// ── Protocol Types: Declarative Expressions & Surface Fragments ─────
//
// Shared types for the convention pipeline:
// - Declarative expression types (BoolExpr, Ref, EffectSpec)
// - Public semantic schema (registers, capabilities)
// - Event patterns and transition specs
// - Surface fragments for decision surface composition
// - ConventionSpec top-level composition type

import type { Call } from "../../../engine/types";
import type { ConstraintDimension, BidMeaning } from "../../pipeline/evaluation/meaning";


// ── Declarative Expression Types ────────────────────────────────────

/** Reference to a value in the public state. */
type Ref =
  | { readonly kind: "reg"; readonly path: string }
  | { readonly kind: "history"; readonly path: string }
  | { readonly kind: "actor"; readonly path: "party" | "team" | "seat" }
  | { readonly kind: "base"; readonly path: "trackId" | "stateId" | "tag" }
  | { readonly kind: "tag"; readonly tag: string }
  | { readonly kind: "local"; readonly path: string }
  | { readonly kind: "protocol"; readonly protocolId: string; readonly path: "stateId" | "instanceKey" };

/** Boolean expression tree over public state. */
type BoolExpr =
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
type EffectSpec =
  | { readonly op: "setReg"; readonly path: string; readonly value: unknown }
  | { readonly op: "clearReg"; readonly path: string }
  | { readonly op: "setLocal"; readonly path: string; readonly value: unknown }
  | { readonly op: "clearLocal"; readonly path: string }
  | { readonly op: "exportTag"; readonly tag: string }
  | { readonly op: "removeTag"; readonly tag: string };

// ── Public Semantic Schema ──────────────────────────────────────────

/** Writer policy for a register — who is allowed to set it. */
type RegisterWriterPolicy = "singleLogicalOwner" | "multiWriter";

/** Specification for a single register in the public semantic contract. */
interface RegisterSpec {
  readonly type: string;
  readonly description: string;
  readonly invariants?: readonly string[];
  readonly writerPolicy?: RegisterWriterPolicy;
}

/** A derived boolean capability — computed from registers + tags + history. */
interface CapabilitySpec {
  readonly id: string;
  readonly when: BoolExpr;
  readonly description: string;
}

/**
 * The public semantic contract that all modules and protocols must
 * agree on. Defines the shared vocabulary of registers, capabilities,
 * and coordination points.
 */
interface PublicSemanticSchema {
  readonly registers: Readonly<Record<string, RegisterSpec>>;
  readonly capabilities: Readonly<Record<string, CapabilitySpec>>;
}

// ── Event Patterns ──────────────────────────────────────────────────

/** Pattern for matching a single event in a conversation prefix. */
interface EventPattern {
  readonly actor?: "self" | "partner" | "opponent" | "any";
  readonly call?: Call;
  /** Match any call of this type (bid/pass/double/redouble). */
  readonly callType?: Call["type"];
}

// ── Transition Types ────────────────────────────────────────────────

/** A transition spec within a frame state (base or protocol). */
interface TransitionSpec {
  readonly transitionId: string;
  /** Event pattern to match. */
  readonly when: EventPattern;
  /** Target state ID, or "STAY" to remain, or "POP" to exit protocol. */
  readonly goto: string;
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
interface ReactionSpec {
  readonly reactionId: string;
  /** Condition over public state. */
  readonly when: BoolExpr;
  /** Target state or special target. */
  readonly goto: string;
  readonly effects?: readonly EffectSpec[];
  readonly priority?: number;
}

// ── Surface Fragment ────────────────────────────────────────────────

/**
 * How a surface fragment interacts with lower layers:
 * - "augment": add rules/meanings; lower layers remain visible
 * - "compete": rules from both layers visible; ranking decides
 * - "shadow": for covered actions, lower layers are hidden/banned
 */
type SurfaceRelation = "augment" | "compete" | "shadow";

/**
 * A surface fragment — a set of rules contributed by one frame at one state.
 * Multiple fragments compose into the effective decision surface.
 */
interface SurfaceFragment {
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
  /** BidMeaning rules in this fragment. */
  readonly surfaces: readonly BidMeaning[];
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

// ── Convention Spec (Top-Level Composition) ─────────────────────────

/**
 * A fully composed convention specification.
 * This is what gets compiled into a runnable convention system.
 *
 * All convention behavior flows through modules — declarative
 * convention modules with local FSM, rules, facts, and explanations.
 */
export interface ConventionSpec {
  readonly id: string;
  readonly name: string;
  /** Convention modules for rule-based surface selection. */
  readonly modules: readonly ConventionModule[];
  /** System config for parameterized fact evaluation. When omitted, defaults to SAYC. */
  readonly systemConfig?: SystemConfig;
}

import type { ConventionModule } from "../convention-module";
import type { SystemConfig } from "../../definitions/system-config";


