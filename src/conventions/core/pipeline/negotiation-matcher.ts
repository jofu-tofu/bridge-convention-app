/**
 * Kernel matcher — evaluates NegotiationExpr predicates against NegotiationState.
 */

import type { NegotiationState } from "../../../core/contracts/committed-step";
import type { BidSuitName } from "../../../core/contracts/bid-action";
import type { NegotiationExpr } from "../rule-module";

/**
 * Evaluate a NegotiationExpr against the current NegotiationState.
 */
export function matchKernel(
  expr: NegotiationExpr,
  kernel: NegotiationState,
): boolean {
  switch (expr.kind) {
    case "fit":
      if (kernel.fitAgreed === null) return false;
      if (expr.strain !== undefined) return kernel.fitAgreed.strain === expr.strain;
      return true;

    case "no-fit":
      return kernel.fitAgreed === null;

    case "forcing":
      return kernel.forcing === expr.level;

    case "captain":
      return kernel.captain === expr.who;

    case "uncontested":
      return kernel.competition === "uncontested";

    case "doubled":
      return kernel.competition === "doubled";

    case "redoubled":
      return kernel.competition === "redoubled";

    case "overcalled": {
      if (typeof kernel.competition === "string") return false;
      if (kernel.competition.kind !== "overcalled") return false;
      if (expr.below === undefined) return true;
      return isBidBelow(
        kernel.competition.level,
        kernel.competition.strain,
        expr.below.level,
        expr.below.strain,
      );
    }

    case "and":
      return expr.exprs.every((e) => matchKernel(e, kernel));

    case "or":
      return expr.exprs.some((e) => matchKernel(e, kernel));

    case "not":
      return !matchKernel(expr.expr, kernel);
  }
}

// ── Internal helpers ─────────────────────────────────────────────────

const STRAIN_ORDER: Record<BidSuitName, number> = {
  clubs: 0,
  diamonds: 1,
  hearts: 2,
  spades: 3,
  notrump: 4,
};

/** Is the bid (level, strain) strictly below the threshold (thLevel, thStrain)? */
function isBidBelow(
  level: number,
  strain: BidSuitName,
  thLevel: number,
  thStrain: BidSuitName,
): boolean {
  if (level < thLevel) return true;
  if (level > thLevel) return false;
  return STRAIN_ORDER[strain] < STRAIN_ORDER[thStrain];
}
