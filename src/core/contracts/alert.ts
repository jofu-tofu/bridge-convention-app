import type { BidAlert } from "./bidding";
import type { FactConstraintIR } from "./agreement-module";
import type { MeaningSurfaceClause } from "./meaning";

// ─── Intent-based conventionality derivation ─────────────────────
//
// Alertability is derived from sourceIntent.type — no manual declaration.
// Natural intents are a small, well-defined set; everything else defaults
// to conventional (the safe default for bridge: unknown bids get alerted).

/** Source-intent types for bids with natural meaning — not alertable.
 *  A bid is "natural" when its meaning follows from standard bridge logic
 *  without partnership agreement. This is the exhaustive set of natural
 *  intent types; any intent not listed here is treated as conventional. */
const NATURAL_INTENTS = new Set([
  "NTInvite",                 // Direct 2NT invite over 1NT — natural
  "NTGame",                   // Direct 3NT over 1NT — natural
  "NTOpening",                // 1NT opening — natural
  "TerminalPass",             // Pass when nothing to say — natural
  "DONTPass",                 // Pass when overcaller has nothing — natural
  "DONTAcceptSpadesFallback", // Fallback pass in DONT — natural
  "WeakPass",                 // Pass with weak hand — natural
  "PostOgustPass",            // Pass after Ogust — natural
  "PreemptiveRaise",          // 1M-3M preemptive raise — natural (Bergen system, but the raise itself is natural)
]);

/** Source-intent types that are ACBL-announced (partner speaks the meaning aloud). */
const ANNOUNCE_INTENTS = new Set([
  "TransferToHearts",
  "TransferToSpades",
]);

/** Source-intent types for bids that are conventional but universally standard —
 *  alertable for educational display but NOT ACBL-required alerts.
 *  Per ACBL: Stayman is self-alerting, Weak Two openings are on the convention card. */
const STANDARD_INTENTS = new Set([
  "StaymanAsk",       // Stayman 2C — standard, not alerted at ACBL
  "ShowHearts",       // Stayman response — standard
  "ShowSpades",       // Stayman response — standard
  "DenyMajor",        // Stayman 2D denial — standard
  "WeakTwoOpen",      // Weak Two opening — on convention card
]);

/** Source-intent types that imply artificial encoding — bids where the call
 *  doesn't mean what it normally would. Always conventional. */
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

/** Minimal shape for alert resolution — only needs sourceIntent, clauses, and teachingLabel.
 *  Alertability is derived from sourceIntent.type membership in NATURAL_INTENTS. */
export interface AlertResolvable {
  readonly sourceIntent: { readonly type: string };
  readonly clauses: readonly MeaningSurfaceClause[];
  readonly teachingLabel: string;
}

/** Derive whether a bid is alertable from its sourceIntent.type.
 *  Convention default: bids are conventional (alertable) unless their intent
 *  type is in the NATURAL_INTENTS set. */
export function isAlertable(
  sourceIntentType: string,
): boolean {
  return !NATURAL_INTENTS.has(sourceIntentType);
}

/** Resolve whether a surface is alertable.
 *  Returns BidAlert when the bid is conventional, null when natural.
 *  Alertability is derived from sourceIntent.type — no manual declaration needed.
 *  Public constraints are auto-derived from clauses.
 *  annotationType distinguishes ACBL alerts, announcements, and educational labels. */
export function resolveAlert(surface: AlertResolvable): BidAlert | null {
  if (!isAlertable(surface.sourceIntent.type)) return null;

  const annotationType = ANNOUNCE_INTENTS.has(surface.sourceIntent.type)
    ? "announce" as const
    : STANDARD_INTENTS.has(surface.sourceIntent.type)
      ? "educational" as const
      : "alert" as const;

  return {
    publicConstraints: derivePublicConstraints(surface.clauses),
    teachingLabel: surface.teachingLabel,
    annotationType,
  };
}
