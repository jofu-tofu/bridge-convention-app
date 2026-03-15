import type { BidAlert } from "./bidding";
import type { FactConstraintIR, PriorityClassId } from "./agreement-module";
import type { MeaningSurfaceClause } from "./meaning-surface";

/** Source-intent types that imply artificial encoding — bids where the call
 *  doesn't mean what it normally would. */
const ARTIFICIAL_INTENTS = new Set([
  "frontier-step",
  "relay-map",
  "alternate-encoding",
]);

/** Determine if a clause represents publicly observable information.
 *  Two paths to being public:
 *  1. Primitive hand facts (hand.*) — universally disclosed when explaining any bid.
 *  2. Clause explicitly marked isPublic by the convention author — the bundle decides
 *     what bridge-derived or module facts are worth disclosing. */
function isPublicClause(clause: MeaningSurfaceClause): boolean {
  if (clause.isPublic) return true;
  return clause.factId.startsWith("hand.");
}

/** Convert a clause to a FactConstraintIR (strips clauseId, description, isPublic). */
function clauseToConstraint(clause: MeaningSurfaceClause): FactConstraintIR {
  return {
    factId: clause.factId,
    operator: clause.operator,
    value: clause.value,
  };
}

/** Auto-derive public constraints from surface clauses.
 *  Primitive hand facts (hand.*) are always public — every convention
 *  discloses HCP and suit lengths when explaining a bid.
 *  Anything else is public only if the convention author marks it (isPublic: true).
 *  This keeps the framework convention-universal: bundles control disclosure. */
export function derivePublicConstraints(
  clauses: readonly MeaningSurfaceClause[],
): readonly FactConstraintIR[] {
  return clauses.filter(isPublicClause).map(clauseToConstraint);
}

/** Minimal shape for alert resolution — works with both MeaningSurface and
 *  any intermediate DTO that threads these fields. */
export interface AlertResolvable {
  readonly alert?: "alert" | "announce";
  readonly priorityClass?: PriorityClassId;
  readonly sourceIntent: { readonly type: string };
  readonly clauses: readonly MeaningSurfaceClause[];
  readonly teachingLabel: string;
}

/** Resolve the effective alert for a surface or proposal.
 *  Returns null when the bid is not alertable (natural/standard).
 *  Public constraints are auto-derived from hand.* clauses + isPublic clauses. */
export function resolveAlert(surface: AlertResolvable): BidAlert | null {
  const kind = surface.alert ?? deriveAlertKind(surface);
  if (!kind) return null;

  return {
    kind,
    publicConstraints: derivePublicConstraints(surface.clauses),
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
