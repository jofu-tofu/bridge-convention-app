import type { BidAlert } from "./bidding";
import type { FactConstraintIR, PriorityClassId } from "./agreement-module";

/** Source-intent types that imply artificial encoding — bids where the call
 *  doesn't mean what it normally would. */
const ARTIFICIAL_INTENTS = new Set([
  "frontier-step",
  "relay-map",
  "alternate-encoding",
]);

/** Minimal shape for alert resolution — works with both MeaningSurface and
 *  any intermediate DTO that threads these fields. */
export interface AlertResolvable {
  readonly alert?: "alert" | "announce";
  readonly priorityClass?: PriorityClassId;
  readonly sourceIntent: { readonly type: string };
  readonly publicConsequences?: { readonly promises: readonly FactConstraintIR[] };
  readonly teachingLabel: string;
}

/** Resolve the effective alert for a surface or proposal.
 *  Returns null when the bid is not alertable (natural/standard). */
export function resolveAlert(surface: AlertResolvable): BidAlert | null {
  const kind = surface.alert ?? deriveAlertKind(surface);
  if (!kind) return null;

  return {
    kind,
    publicConstraints: surface.publicConsequences?.promises ?? [],
    teachingLabel: surface.teachingLabel,
  };
}

function deriveAlertKind(
  surface: Pick<AlertResolvable, "priorityClass" | "sourceIntent">,
): "alert" | "announce" | null {
  if (
    surface.priorityClass === "preferredConventional" ||
    surface.priorityClass === "obligatory"
  ) {
    return "alert";
  }
  if (ARTIFICIAL_INTENTS.has(surface.sourceIntent.type)) {
    return "alert";
  }
  return null;
}
