import type { PublicSnapshot } from "../../core/contracts/module-surface";
import type { PublicConstraint } from "../../core/contracts/agreement-module";
import type {
  FactorGraphIR,
  FactorSpec,
  FactorOrigin,
  AmbiguityFamilyIR,
  FactorStrength,
} from "../../core/contracts/factor-graph";
import type { SuitName } from "../../engine/types";

// ─── Validation types ───────────────────────────────────────

export interface FactorGraphValidation {
  readonly valid: boolean;
  readonly contradictions: readonly FactorContradiction[];
}

export interface FactorContradiction {
  readonly seat: string;
  readonly factId: string;
  readonly lowerBound: number;
  readonly upperBound: number;
}

// ─── Constants ──────────────────────────────────────────────

const MAX_HCP = 40;
const MAX_SUIT_LENGTH = 13;

// ─── Origin mapping ─────────────────────────────────────────

function mapOriginKind(
  origin: PublicConstraint["origin"],
): FactorOrigin["originKind"] {
  return origin;
}

function mapStrength(_strength: PublicConstraint["strength"]): FactorStrength {
  // Both "hard" and "entailed" map to "hard" — entailed denials are still
  // hard constraints for sampling purposes.
  return "hard";
}

function buildOrigin(constraint: PublicConstraint): FactorOrigin {
  return {
    sourceConstraint: constraint,
    sourceMeaning: constraint.sourceMeaning,
    originKind: mapOriginKind(constraint.origin),
  };
}

// ─── Suit extraction ────────────────────────────────────────

const SUIT_LENGTH_PREFIX = "hand.suitLength.";

function extractSuit(factId: string): SuitName | null {
  if (factId.startsWith(SUIT_LENGTH_PREFIX)) {
    return factId.slice(SUIT_LENGTH_PREFIX.length) as SuitName;
  }
  return null;
}

// ─── Factor compilation helpers ─────────────────────────────

function isDenial(origin: PublicConstraint["origin"]): boolean {
  return origin === "entailed-denial";
}

/** Shared logic for compiling HCP-range and suit-length constraints. */
function compileRangeConstraint(
  constraint: PublicConstraint,
  kind: "hcp-range" | "suit-length",
  maxVal: number,
  denial: boolean,
  extraFields?: Record<string, unknown>,
): FactorSpec {
  const { operator, value } = constraint.constraint;
  const seat = constraint.subject;
  const strength = mapStrength(constraint.strength);
  const origin = buildOrigin(constraint);

  if (denial) {
    if (operator === "gte" && typeof value === "number") {
      return { kind, seat, min: 0, max: value - 1, strength, origin, ...extraFields } as FactorSpec;
    }
    if (operator === "lte" && typeof value === "number") {
      return { kind, seat, min: value + 1, max: maxVal, strength, origin, ...extraFields } as FactorSpec;
    }
  }

  if (operator === "gte" && typeof value === "number") {
    return { kind, seat, min: value, max: maxVal, strength, origin, ...extraFields } as FactorSpec;
  }
  if (operator === "lte" && typeof value === "number") {
    return { kind, seat, min: 0, max: value, strength, origin, ...extraFields } as FactorSpec;
  }

  // Fallback for unsupported operators — treat as exclusion
  const label = kind === "hcp-range" ? "hcp" : `${(extraFields as { suit?: string })?.suit} length`;
  return { kind: "exclusion", seat, constraint: `${label} ${operator} ${JSON.stringify(value)}`, strength, origin };
}

function compileHcpRange(constraint: PublicConstraint, denial: boolean): FactorSpec {
  return compileRangeConstraint(constraint, "hcp-range", MAX_HCP, denial);
}

function compileSuitLength(constraint: PublicConstraint, suit: SuitName, denial: boolean): FactorSpec {
  return compileRangeConstraint(constraint, "suit-length", MAX_SUIT_LENGTH, denial, { suit });
}

function compileIsBalanced(
  constraint: PublicConstraint,
  denial: boolean,
): FactorSpec {
  const seat = constraint.subject;
  const strength = mapStrength(constraint.strength);
  const origin = buildOrigin(constraint);

  if (denial) {
    // Denial of isBalanced → exclusion with "not-balanced"
    return { kind: "exclusion", seat, constraint: "not-balanced", strength, origin };
  }

  return { kind: "shape", seat, pattern: "balanced", strength, origin };
}

function compileSingleConstraint(pc: PublicConstraint): FactorSpec {
  const factId = pc.constraint.factId;
  const denial = isDenial(pc.origin);

  if (factId === "hand.hcp") {
    return compileHcpRange(pc, denial);
  }

  const suit = extractSuit(factId);
  if (suit !== null) {
    return compileSuitLength(pc, suit, denial);
  }

  if (factId === "hand.isBalanced") {
    return compileIsBalanced(pc, denial);
  }

  // Unknown fact ID → generic ExclusionFactor
  const strength = mapStrength(pc.strength);
  const origin = buildOrigin(pc);
  return {
    kind: "exclusion",
    seat: pc.subject,
    constraint: `${factId} ${pc.constraint.operator} ${JSON.stringify(pc.constraint.value)}`,
    strength,
    origin,
  };
}

// ─── Ambiguity schema compilation ───────────────────────────

function compileAmbiguitySchema(
  snapshot: PublicSnapshot,
): readonly AmbiguityFamilyIR[] {
  const latentBranches = snapshot.latentBranches;
  if (!latentBranches || latentBranches.length === 0) return [];

  return latentBranches.map((branchSet) => ({
    familyId: branchSet.setId,
    alternatives: branchSet.alternatives.map((alt) => ({
      branchId: alt.branchId,
      meaningId: alt.meaningId,
      description: alt.description,
    })),
    exclusivity: "xor" as const,
  }));
}

// ─── Main compilation function ──────────────────────────────

/**
 * Compile a PublicSnapshot into a FactorGraphIR.
 *
 * Produces a convention-erased set of typed FactorSpec entries that reference
 * seats via fields rather than being grouped per-seat. This is the Phase 3
 * replacement for compilePublicHandSpace.
 */
export function compileFactorGraph(snapshot: PublicSnapshot): FactorGraphIR {
  const commitments = snapshot.publicCommitments ?? [];

  const factors: FactorSpec[] = [];

  for (const commitment of commitments) {
    const factor = compileSingleConstraint(commitment);
    factors.push(factor);
  }

  return {
    factors,
    ambiguitySchema: compileAmbiguitySchema(snapshot),
    evidencePins: [],
  };
}

// ─── Validation ─────────────────────────────────────────────

/**
 * Validate a FactorGraphIR for contradictions.
 *
 * Checks HcpRangeFactor and SuitLengthFactor entries on the same seat (and suit)
 * for incompatible bounds (combined min > combined max).
 */
export function validateFactorGraph(graph: FactorGraphIR): FactorGraphValidation {
  const contradictions: FactorContradiction[] = [];

  // Group HCP range factors by seat
  const hcpBySeat = new Map<string, { mins: number[]; maxes: number[] }>();
  // Group suit-length factors by seat+suit
  const suitBySeatSuit = new Map<string, { mins: number[]; maxes: number[]; factId: string }>();

  for (const factor of graph.factors) {
    if (factor.kind === "hcp-range") {
      let entry = hcpBySeat.get(factor.seat);
      if (!entry) {
        entry = { mins: [], maxes: [] };
        hcpBySeat.set(factor.seat, entry);
      }
      entry.mins.push(factor.min);
      entry.maxes.push(factor.max);
    }

    if (factor.kind === "suit-length") {
      const key = `${factor.seat}:${factor.suit}`;
      let entry = suitBySeatSuit.get(key);
      if (!entry) {
        entry = { mins: [], maxes: [], factId: `hand.suitLength.${factor.suit}` };
        suitBySeatSuit.set(key, entry);
      }
      entry.mins.push(factor.min);
      entry.maxes.push(factor.max);
    }
  }

  // Check HCP contradictions
  for (const [seat, { mins, maxes }] of hcpBySeat) {
    const effectiveMin = Math.max(...mins);
    const effectiveMax = Math.min(...maxes);
    if (effectiveMin > effectiveMax) {
      contradictions.push({
        seat,
        factId: "hand.hcp",
        lowerBound: effectiveMin,
        upperBound: effectiveMax,
      });
    }
  }

  // Check suit-length contradictions
  for (const [key, { mins, maxes, factId }] of suitBySeatSuit) {
    const seat = key.split(":")[0]!;
    const effectiveMin = Math.max(...mins);
    const effectiveMax = Math.min(...maxes);
    if (effectiveMin > effectiveMax) {
      contradictions.push({
        seat,
        factId,
        lowerBound: effectiveMin,
        upperBound: effectiveMax,
      });
    }
  }

  return {
    valid: contradictions.length === 0,
    contradictions,
  };
}
