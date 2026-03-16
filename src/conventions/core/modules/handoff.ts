import type { MachineTransition } from "../runtime/machine-types";
import type { MeaningSurface } from "../../../core/contracts/meaning";

/** What triggers a handoff. */
export type HandoffTrigger =
  | { readonly kind: "frontier"; readonly frontierId: string }
  | { readonly kind: "capability"; readonly capabilityId: string }
  | { readonly kind: "visible-meaning"; readonly semanticClassId: string };

/** Cross-module handoff: contributes transitions when a trigger is active. */
export interface HandoffSpec {
  readonly trigger: HandoffTrigger;
  readonly transitions: readonly MachineTransition[];
  readonly surfaces?: readonly MeaningSurface[];
}
