import type { PublicSnapshot } from "../../conventions/core/module-surface";
import type { PublicConstraint } from "../../conventions/core/agreement-module";
import type { PublicHandSpace } from "./posterior-types";
import type { HandPredicate } from "../../conventions/core/agreement-module";
import { FactOperator } from "../../conventions/pipeline/evaluation/meaning";

/**
 * Check if a set of clauses contains contradictions.
 * Detects: same factId with gte X and lte Y where Y < X.
 */
function hasContradiction(
  clauses: readonly { factId: string; operator: string; value: unknown }[],
): boolean {
  const gteBounds = new Map<string, number>();
  const lteBounds = new Map<string, number>();

  for (const clause of clauses) {
    if (clause.operator === "gte" && typeof clause.value === "number") {
      const existing = gteBounds.get(clause.factId);
      if (existing === undefined || clause.value > existing) {
        gteBounds.set(clause.factId, clause.value);
      }
    }
    if (clause.operator === "lte" && typeof clause.value === "number") {
      const existing = lteBounds.get(clause.factId);
      if (existing === undefined || clause.value < existing) {
        lteBounds.set(clause.factId, clause.value);
      }
    }
  }

  for (const [factId, gteVal] of gteBounds) {
    const lteVal = lteBounds.get(factId);
    if (lteVal !== undefined && lteVal < gteVal) {
      return true;
    }
  }
  return false;
}

/**
 * Compile a PublicSnapshot into PublicHandSpace[].
 * Groups constraints by subject seat, converts promises to clauses,
 * and detects contradictions.
 */
export function compilePublicHandSpace(snapshot: PublicSnapshot): PublicHandSpace[] {
  const commitments = snapshot.publicCommitments ?? [];
  if (commitments.length === 0) return [];

  // Group by subject seat
  const bySeat = new Map<string, PublicConstraint[]>();
  for (const c of commitments) {
    const existing = bySeat.get(c.subject);
    if (existing) {
      existing.push(c);
    } else {
      bySeat.set(c.subject, [c]);
    }
  }

  const result: PublicHandSpace[] = [];

  for (const [seatId, constraints] of bySeat) {
    const clauses: {
      factId: string;
      operator: FactOperator;
      value: number | boolean | string | { min: number; max: number } | readonly string[];
    }[] = [];

    for (const c of constraints) {
      clauses.push({
        factId: c.constraint.factId,
        operator: c.constraint.operator,
        value: c.constraint.value,
      });
    }

    const predicate: HandPredicate = {
      conjunction: "all",
      clauses,
    };

    const contradicted = hasContradiction(clauses);

    // Attach any latent branches from the snapshot
    const latentBranches = snapshot.latentBranches;

    result.push({
      seatId,
      constraints: [predicate],
      ...(contradicted ? { estimatedSize: 0 } : {}),
      ...(latentBranches && latentBranches.length > 0 ? { latentBranches } : {}),
    });
  }

  return result;
}
