import type { PublicSnapshot } from "../../core/contracts/module-surface";
import type { PublicConstraint, FactConstraintIR } from "../../core/contracts/agreement-module";
import type { PublicHandSpace } from "../../core/contracts/posterior";
import type { HandPredicateIR } from "../../core/contracts/predicate-surfaces";

/**
 * Negate a FactConstraintIR for denial processing.
 * - denial of "gte X" → "lte X-1"
 * - denial of "lte X" → "gte X+1"
 * - denial of "boolean true" → "boolean false" and vice versa
 * - other operators: returned as-is (cannot be trivially negated)
 */
function negateConstraint(
  c: FactConstraintIR,
): { factId: string; operator: "gte" | "lte" | "eq" | "range" | "boolean" | "in"; value: number | boolean | string | { min: number; max: number } | readonly string[] } {
  if (c.operator === "gte" && typeof c.value === "number") {
    return { factId: c.factId, operator: "lte", value: c.value - 1 };
  }
  if (c.operator === "lte" && typeof c.value === "number") {
    return { factId: c.factId, operator: "gte", value: c.value + 1 };
  }
  if (c.operator === "boolean" && typeof c.value === "boolean") {
    return { factId: c.factId, operator: "boolean", value: !c.value };
  }
  // Fallback: return as-is
  return { factId: c.factId, operator: c.operator, value: c.value };
}

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
 * negates denials, and detects contradictions.
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
      operator: "gte" | "lte" | "eq" | "range" | "boolean" | "in";
      value: number | boolean | string | { min: number; max: number } | readonly string[];
    }[] = [];

    for (const c of constraints) {
      const isDenial = c.origin === "entailed-denial" || c.origin === "explicit-denial";
      if (isDenial) {
        clauses.push(negateConstraint(c.constraint));
      } else {
        clauses.push({
          factId: c.constraint.factId,
          operator: c.constraint.operator,
          value: c.constraint.value,
        });
      }
    }

    const predicate: HandPredicateIR = {
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
