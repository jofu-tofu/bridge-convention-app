import type { BidAlert } from "../../core/strategy-types";
import { Disclosure, type BidMeaningClause } from "./meaning";
import type { TeachingLabel } from "../../core/authored-text";

// ─── Disclosure-based conventionality derivation ─────────────────────
//
// Alertability is derived from the `disclosure` field on BidMeaning.
// Constraints carry `isPublic` on the FactConstraint itself; no separate
// publicConstraints pipeline is needed.

/** Minimal shape for alert resolution — only needs disclosure and teachingLabel.
 *  Alertability is derived from the `disclosure` field. */
export interface AlertResolvable {
  readonly disclosure: Disclosure;
  readonly clauses: readonly BidMeaningClause[];
  readonly teachingLabel: TeachingLabel;
}

/** Derive whether a bid is alertable from its disclosure classification.
 *  A bid is alertable (requires some form of opponent notification) unless
 *  it has natural meaning (disclosure === "natural"). */
export function isAlertable(
  disclosure: Disclosure,
): boolean {
  return disclosure !== Disclosure.Natural;
}

/** Resolve whether a surface is alertable.
 *  Returns BidAlert when the bid is conventional, null when natural.
 *  Alertability is derived from the `disclosure` field.
 *  annotationType distinguishes ACBL alerts, announcements, and educational labels. */
export function resolveAlert(surface: AlertResolvable): BidAlert | null {
  if (!isAlertable(surface.disclosure)) return null;

  const annotationType = surface.disclosure === Disclosure.Announcement
    ? "announce" as const
    : surface.disclosure === Disclosure.Standard
      ? "educational" as const
      : "alert" as const;

  return {
    teachingLabel: surface.teachingLabel.name,
    annotationType,
  };
}
