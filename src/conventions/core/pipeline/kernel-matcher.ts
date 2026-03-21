/**
 * Kernel matcher — evaluates KernelExpr predicates against KernelState.
 */

import type { KernelState } from "../../../core/contracts/committed-step";
import type { ObsStrain } from "../../../core/contracts/canonical-observation";
import type { KernelExpr } from "../rule-module";

/**
 * Evaluate a KernelExpr against the current KernelState.
 */
export function matchKernel(
  expr: KernelExpr,
  kernel: KernelState,
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

const STRAIN_ORDER: Record<ObsStrain, number> = {
  clubs: 0,
  diamonds: 1,
  hearts: 2,
  spades: 3,
  notrump: 4,
};

/** Is the bid (level, strain) strictly below the threshold (thLevel, thStrain)? */
function isBidBelow(
  level: number,
  strain: ObsStrain,
  thLevel: number,
  thStrain: ObsStrain,
): boolean {
  if (level < thLevel) return true;
  if (level > thLevel) return false;
  return STRAIN_ORDER[strain] < STRAIN_ORDER[thStrain];
}
