/**
 * HandoffSpec — cross-module FSM coupling via frontier, capability, or visible meaning triggers.
 *
 * Handoffs replace the old hookTransitions pattern. Instead of referencing another
 * module's state ID directly, a handoff declares a trigger condition (frontier,
 * capability, or visible meaning) and the transitions to inject when that trigger
 * is resolved.
 */
import type { MachineTransition } from "../runtime/machine-types";
import type { MeaningSurface } from "../../../core/contracts/meaning";

/**
 * A trigger that activates a handoff.
 *
 * - "frontier": matches an exported frontier by ID (most common)
 * - "capability": matches when a capability is provided
 * - "visible-meaning": matches when a semantic class is visible in the auction
 */
export type HandoffTrigger =
  | { readonly kind: "frontier"; readonly frontierId: string }
  | { readonly kind: "capability"; readonly capabilityId: string }
  | { readonly kind: "visible-meaning"; readonly semanticClassId: string };

/**
 * A handoff declaration: transitions (and optional surfaces) to inject
 * when a trigger condition is met.
 */
export interface HandoffSpec {
  readonly trigger: HandoffTrigger;
  /** Transitions to prepend to the target state's transition array. */
  readonly transitions: readonly MachineTransition[];
  /** Optional surfaces to contribute to the target state's surface group. */
  readonly surfaces?: readonly MeaningSurface[];
}
