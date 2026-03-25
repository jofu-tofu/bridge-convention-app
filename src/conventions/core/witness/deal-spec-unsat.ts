import type {
  DealSpec,
  UnsatisfiableResult,
  SeatRole,
} from "../deal-spec-types";

/** Maximum HCP a single 13-card hand can hold (AKQJ x 4 suits = 37). */
const MAX_HAND_HCP = 37;

/** Total HCP in a standard 52-card deck. */
const TOTAL_DECK_HCP = 40;

/** Cards per hand. */
const HAND_SIZE = 13;

/** Number of suits. */
const NUM_SUITS = 4;

/** Map from suit factId suffix to a stable label. */
const SUIT_FACT_IDS = [
  "hand.suitLength.spades",
  "hand.suitLength.hearts",
  "hand.suitLength.diamonds",
  "hand.suitLength.clubs",
] as const;

// ─── Per-seat analysis ────────────────────────────────────────

interface SeatBounds {
  readonly role: SeatRole;
  minHcp: number;
  maxHcp: number;
  /** Minimum lengths per suit [spades, hearts, diamonds, clubs]. */
  minLengths: [number, number, number, number];
  /** Maximum lengths per suit. */
  maxLengths: [number, number, number, number];
}

function createBounds(role: SeatRole): SeatBounds {
  return {
    role,
    minHcp: 0,
    maxHcp: MAX_HAND_HCP,
    minLengths: [0, 0, 0, 0],
    maxLengths: [HAND_SIZE, HAND_SIZE, HAND_SIZE, HAND_SIZE],
  };
}

function suitIndex(factId: string): number {
  return SUIT_FACT_IDS.indexOf(factId as typeof SUIT_FACT_IDS[number]);
}

function extractBoundsFromLayer(
  bounds: SeatBounds,
  predicate: {
    readonly clauses: readonly {
      readonly factId: string;
      readonly operator: string;
      readonly value: number | boolean | string | { min: number; max: number } | readonly string[];
    }[];
    readonly conjunction: "all" | "any";
  },
): void {
  // For "any" conjunction, we can only tighten bounds conservatively
  // by checking if ALL alternatives are individually impossible.
  // For "all" conjunction, every clause must be simultaneously satisfiable.
  if (predicate.conjunction === "any") {
    // Cannot tighten individual bounds from an OR — skip
    return;
  }

  for (const clause of predicate.clauses) {
    if (clause.factId === "hand.hcp") {
      applyHcpBounds(bounds, clause.operator, clause.value);
      continue;
    }

    const idx = suitIndex(clause.factId);
    if (idx >= 0) {
      applySuitBounds(bounds, idx, clause.operator, clause.value);
    }
  }
}

function applyHcpBounds(
  bounds: SeatBounds,
  operator: string,
  value: number | boolean | string | { min: number; max: number } | readonly string[],
): void {
  switch (operator) {
    case "gte":
      bounds.minHcp = Math.max(bounds.minHcp, value as number);
      break;
    case "lte":
      bounds.maxHcp = Math.min(bounds.maxHcp, value as number);
      break;
    case "eq":
      bounds.minHcp = Math.max(bounds.minHcp, value as number);
      bounds.maxHcp = Math.min(bounds.maxHcp, value as number);
      break;
    case "range": {
      const range = value as { min: number; max: number };
      bounds.minHcp = Math.max(bounds.minHcp, range.min);
      bounds.maxHcp = Math.min(bounds.maxHcp, range.max);
      break;
    }
  }
}

function applySuitBounds(
  bounds: SeatBounds,
  idx: number,
  operator: string,
  value: number | boolean | string | { min: number; max: number } | readonly string[],
): void {
  switch (operator) {
    case "gte":
      bounds.minLengths[idx] = Math.max(bounds.minLengths[idx]!, value as number);
      break;
    case "lte":
      bounds.maxLengths[idx] = Math.min(bounds.maxLengths[idx]!, value as number);
      break;
    case "eq":
      bounds.minLengths[idx] = Math.max(bounds.minLengths[idx]!, value as number);
      bounds.maxLengths[idx] = Math.min(bounds.maxLengths[idx]!, value as number);
      break;
    case "range": {
      const range = value as { min: number; max: number };
      bounds.minLengths[idx] = Math.max(bounds.minLengths[idx]!, range.min);
      bounds.maxLengths[idx] = Math.min(bounds.maxLengths[idx]!, range.max);
      break;
    }
  }
}

// ─── Checks ───────────────────────────────────────────────────

function checkSingleSeat(bounds: SeatBounds): string[] {
  const problems: string[] = [];

  // HCP range check
  if (bounds.minHcp > bounds.maxHcp) {
    problems.push(
      `${bounds.role}: HCP range inverted (min ${bounds.minHcp} > max ${bounds.maxHcp})`,
    );
  }
  if (bounds.minHcp > MAX_HAND_HCP) {
    problems.push(
      `${bounds.role}: minHcp ${bounds.minHcp} exceeds maximum possible ${MAX_HAND_HCP}`,
    );
  }
  if (bounds.maxHcp < 0) {
    problems.push(
      `${bounds.role}: maxHcp ${bounds.maxHcp} is negative`,
    );
  }

  // Per-suit length checks
  for (let i = 0; i < NUM_SUITS; i++) {
    const min = bounds.minLengths[i]!;
    const max = bounds.maxLengths[i]!;
    if (min > max) {
      problems.push(
        `${bounds.role}: ${SUIT_FACT_IDS[i]} range inverted (min ${min} > max ${max})`,
      );
    }
    if (min > HAND_SIZE) {
      problems.push(
        `${bounds.role}: ${SUIT_FACT_IDS[i]} min ${min} exceeds hand size ${HAND_SIZE}`,
      );
    }
  }

  // Sum of minimum suit lengths exceeds hand size
  const minSum = bounds.minLengths.reduce((a, b) => a + b, 0);
  if (minSum > HAND_SIZE) {
    problems.push(
      `${bounds.role}: minimum suit lengths sum to ${minSum}, exceeding hand size ${HAND_SIZE}`,
    );
  }

  return problems;
}

function checkCrossSeats(allBounds: SeatBounds[]): string[] {
  const problems: string[] = [];

  // Total minimum HCP across all seats must not exceed 40
  const totalMinHcp = allBounds.reduce((sum, b) => sum + b.minHcp, 0);
  if (totalMinHcp > TOTAL_DECK_HCP) {
    const involved = allBounds
      .filter((b) => b.minHcp > 0)
      .map((b) => `${b.role}(min ${b.minHcp})`);
    problems.push(
      `Cross-seat: combined minimum HCP ${totalMinHcp} exceeds deck total ${TOTAL_DECK_HCP} [${involved.join(", ")}]`,
    );
  }

  return problems;
}

/**
 * Detect if a DealSpec is unsatisfiable.
 *
 * Returns null when the spec appears satisfiable, or a UnsatisfiableResult
 * with the unsatCore (diagnostic messages identifying conflicting constraints)
 * and optionally a nearestSatisfiable hint.
 *
 * Checks performed:
 * - Per-seat: HCP range validity, suit length validity, suit length sum
 * - Cross-seat: combined minimum HCP vs total deck HCP (40)
 *
 * Only seat constraint layers are analyzed. Public-guard, exclusion, and
 * joint layers are not checked (they depend on runtime state, not hand shapes).
 */
export function detectUnsat(
  spec: DealSpec,
): UnsatisfiableResult | null {
  const boundsMap = new Map<SeatRole, SeatBounds>();

  for (const layer of spec.layers) {
    if (layer.kind !== "seat") continue;

    let bounds = boundsMap.get(layer.role);
    if (!bounds) {
      bounds = createBounds(layer.role);
      boundsMap.set(layer.role, bounds);
    }

    extractBoundsFromLayer(bounds, layer.predicate);
  }

  const allBounds = Array.from(boundsMap.values());
  const problems: string[] = [];

  // Per-seat checks
  for (const bounds of allBounds) {
    problems.push(...checkSingleSeat(bounds));
  }

  // Cross-seat checks
  problems.push(...checkCrossSeats(allBounds));

  if (problems.length === 0) {
    return null;
  }

  // Try to suggest a relaxation for the first problem
  const nearestSatisfiable = computeNearestSatisfiable(allBounds, problems);

  return {
    specId: spec.specId,
    unsatCore: problems,
    ...(nearestSatisfiable && { nearestSatisfiable }),
  };
}

function computeNearestSatisfiable(
  allBounds: SeatBounds[],
  _problems: string[],
): { relaxedConstraintId: string; delta: string } | undefined {
  // Find the first seat with an HCP issue and suggest relaxation
  for (const bounds of allBounds) {
    if (bounds.minHcp > MAX_HAND_HCP) {
      return {
        relaxedConstraintId: `${bounds.role}:hand.hcp:gte`,
        delta: `Relax minHcp from ${bounds.minHcp} to ${MAX_HAND_HCP}`,
      };
    }
    if (bounds.minHcp > bounds.maxHcp) {
      return {
        relaxedConstraintId: `${bounds.role}:hand.hcp:range`,
        delta: `Relax minHcp from ${bounds.minHcp} to ${bounds.maxHcp} (or raise maxHcp to ${bounds.minHcp})`,
      };
    }
  }

  // Cross-seat HCP relaxation
  const totalMinHcp = allBounds.reduce((sum, b) => sum + b.minHcp, 0);
  if (totalMinHcp > TOTAL_DECK_HCP) {
    const excess = totalMinHcp - TOTAL_DECK_HCP;
    // Find the seat with the highest minHcp to suggest relaxing
    const highest = allBounds.reduce((a, b) => (a.minHcp >= b.minHcp ? a : b));
    return {
      relaxedConstraintId: `${highest.role}:hand.hcp:gte`,
      delta: `Reduce minHcp by at least ${excess} (e.g., ${highest.role} from ${highest.minHcp} to ${highest.minHcp - excess})`,
    };
  }

  // Suit length sum relaxation
  for (const bounds of allBounds) {
    const minSum = bounds.minLengths.reduce((a, b) => a + b, 0);
    if (minSum > HAND_SIZE) {
      const excess = minSum - HAND_SIZE;
      return {
        relaxedConstraintId: `${bounds.role}:suitLength:sum`,
        delta: `Reduce total minimum suit lengths by at least ${excess}`,
      };
    }
  }

  return undefined;
}
