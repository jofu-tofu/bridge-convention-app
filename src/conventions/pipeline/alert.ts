import type { BidAlert } from "../../core/contracts/bidding";
import type { BidMeaningClause } from "../../core/contracts/meaning";

// ─── Disclosure-based conventionality derivation ─────────────────────
//
// Alertability is derived from the `disclosure` field on BidMeaning.
// Constraints carry `isPublic` on the FactConstraint itself; no separate
// publicConstraints pipeline is needed.

/** Minimal shape for alert resolution — only needs disclosure and teachingLabel.
 *  Alertability is derived from the `disclosure` field. */
export interface AlertResolvable {
  readonly disclosure: "alert" | "announcement" | "natural" | "standard";
  readonly clauses: readonly BidMeaningClause[];
  readonly teachingLabel: string;
}

/** Derive whether a bid is alertable from its disclosure classification.
 *  A bid is alertable (requires some form of opponent notification) unless
 *  it has natural meaning (disclosure === "natural"). */
export function isAlertable(
  disclosure: "alert" | "announcement" | "natural" | "standard",
): boolean {
  return disclosure !== "natural";
}

/** Resolve whether a surface is alertable.
 *  Returns BidAlert when the bid is conventional, null when natural.
 *  Alertability is derived from the `disclosure` field.
 *  annotationType distinguishes ACBL alerts, announcements, and educational labels. */
export function resolveAlert(surface: AlertResolvable): BidAlert | null {
  if (!isAlertable(surface.disclosure)) return null;

  const annotationType = surface.disclosure === "announcement"
    ? "announce" as const
    : surface.disclosure === "standard"
      ? "educational" as const
      : "alert" as const;

  return {
    teachingLabel: surface.teachingLabel,
    annotationType,
  };
}
