/**
 * ModulePackage — the contribution-based module declaration for profile compilation.
 *
 * Unlike ConventionModule (which is skeleton-aware and uses entryTransitions/hookTransitions),
 * ModulePackage declares what a module exports and how it connects via capabilities,
 * frontiers, and handoffs. The profile compiler resolves these declarations at compile time.
 */
import type { MeaningSurface } from "../../../core/contracts/meaning";
import type { FactCatalogExtension } from "../../../core/contracts/fact-catalog";
import type { ExplanationEntry } from "../../../core/contracts/explanation-catalog";
import type { PedagogicalRelation } from "../../../core/contracts/teaching-projection";
import type { MachineFragment } from "./machine-fragment";
import type { HandoffSpec } from "./handoff";
import type { AttachmentIR } from "../../../core/contracts/agreement-module";

// ── Surface contribution ────────────────────────────────────────────

export interface MeaningSurfaceContribution {
  readonly groupId: string;
  readonly surfaces: readonly MeaningSurface[];
}

// ── Module requirements ─────────────────────────────────────────────

export interface ModuleRequirement {
  readonly kind: "capability" | "module" | "fact";
  readonly id: string;
}

// ── Module kind ─────────────────────────────────────────────────────

export type ModuleKind = "base-system" | "add-on" | "overlay";

// ── ModulePackage ───────────────────────────────────────────────────

/**
 * A self-contained module contribution that can be compiled into a profile.
 *
 * Modules export contributions (surfaces, facts, explanations, semantic classes);
 * profiles compose them; runtime activates them; pipeline arbitrates them.
 *
 * Key differences from ConventionModule:
 * - No skeleton awareness — modules don't know about dispatch states
 * - Cross-module coupling via frontiers/handoffs instead of hookTransitions/exposedStates
 * - Capabilities-based activation instead of direct state references
 */
export interface ModulePackage {
  readonly moduleId: string;

  readonly meta?: {
    readonly description?: string;
    readonly kind?: ModuleKind;
  };

  /** Dependencies this module requires to function. */
  readonly requires?: readonly ModuleRequirement[];

  /** What this module contributes to the compiled profile. */
  readonly exports: {
    /** Capabilities this module provides (e.g., "stayman:ask-major"). */
    readonly capabilities?: readonly string[];
    /** Fact catalog extensions. */
    readonly facts?: FactCatalogExtension;
    /** Surface contributions organized by group ID. */
    readonly surfaces?: readonly MeaningSurfaceContribution[];
    /** Explanation catalog entries. */
    readonly explanationEntries?: readonly ExplanationEntry[];
    /** Intra-module pedagogical relations. */
    readonly pedagogicalRelations?: readonly PedagogicalRelation[];
    /** Semantic class IDs this module defines. */
    readonly semanticClasses?: readonly string[];
  };

  /** Runtime behavior: FSM states, activation, handoffs. */
  readonly runtime: {
    /** Profile-based activation conditions. */
    readonly activation?: readonly AttachmentIR[];
    /** FSM states and transitions contributed by this module. */
    readonly machineFragment?: MachineFragment;
    /** Handoff declarations for cross-module FSM coupling. */
    readonly handoffs?: readonly HandoffSpec[];
  };
}
