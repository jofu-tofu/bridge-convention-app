/** The 4-gate sequence that every proposal passes through. */
export type GateId =
  | "semantic-applicability"
  | "obligation-satisfaction"
  | "encoder-availability"
  | "concrete-legality";

export interface GateResult {
  readonly gateId: GateId;
  readonly passed: boolean;
  readonly reason?: string;
}

export interface GatedProposal {
  readonly candidateBidName: string;
  readonly moduleId: string;
  readonly gateResults: readonly GateResult[];
  readonly passedAllGates: boolean;
}

/** The canonical gate evaluation order. */
const GATE_ORDER: readonly GateId[] = [
  "semantic-applicability",
  "obligation-satisfaction",
  "encoder-availability",
  "concrete-legality",
] as const;

/** Evaluate a candidate against the gate sequence. Returns on first failure. */
export function evaluateGates(
  checks: readonly {
    gateId: GateId;
    passed: boolean;
    reason?: string;
  }[],
): { results: readonly GateResult[]; passedAll: boolean } {
  const results: GateResult[] = [];
  for (const gateId of GATE_ORDER) {
    const check = checks.find((c) => c.gateId === gateId);
    if (!check) {
      // Gate not evaluated — treat as passed (forward-compatible)
      results.push({ gateId, passed: true });
      continue;
    }
    results.push({ gateId, passed: check.passed, reason: check.reason });
    if (!check.passed) {
      return { results, passedAll: false };
    }
  }
  return { results, passedAll: true };
}
