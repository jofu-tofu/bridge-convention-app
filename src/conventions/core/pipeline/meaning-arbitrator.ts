import type {
  ArbitrationResult,
  EncodedProposal,
  EliminationRecord,
} from "../../../core/contracts/module-surface";
import type { Call } from "../../../engine/types";
import type { MeaningSurface } from "../../../core/contracts/meaning";
import type {
  DecisionProvenance,
  EliminationTrace,
  ArbitrationTrace,
  LegalityTrace,
  EncodingTrace,
  ApplicabilityEvidence,
  HandoffTrace,
} from "../../../core/contracts/provenance";
import type { MeaningProposal } from "../../../core/contracts/meaning";
import { compareRanking, BAND_PRIORITY } from "../../../core/contracts/meaning";
import { evaluateProposal, classifyIntoSets } from "./arbitration-helpers";
import type {
  EvidenceBundleIR,
  ConditionEvidenceIR,
  RejectionEvidence,
  AlternativeEvidence,
} from "../../../core/contracts/evidence-bundle";
import type { DeclaredEncoderKind } from "../../../core/contracts/agreement-module";
import type { EncoderConfig } from "./encoder-resolver";
import { formatCallForEvidence } from "../../../engine/call-helpers";

/** Input to the arbitrator: a proposal paired with the surface it came from. */
export interface ArbitrationInput {
  readonly proposal: MeaningProposal;
  readonly surface: {
    readonly encoding: { readonly defaultCall: Call };
    readonly encoderKind?: DeclaredEncoderKind;
    readonly encoderConfig?: EncoderConfig;
  };
}

/** Build ArbitrationInput[] by zipping proposals with their source surfaces. */
export function zipProposalsWithSurfaces(
  proposals: readonly MeaningProposal[],
  surfaces: readonly MeaningSurface[],
): ArbitrationInput[] {
  return proposals.map((proposal, i) => {
    const surface = surfaces[i];
    if (!surface) {
      throw new Error(`zipProposalsWithSurfaces: no surface at index ${i}`);
    }
    return { proposal, surface };
  });
}

/**
 * Build a resolution function from semantic class alias pairs.
 * Each alias maps a module-local semanticClassId to a canonical ID.
 * When two proposals resolve to the same canonical ID, they are treated
 * as equivalent for deduplication (higher-ranked wins).
 */
function buildAliasResolver(
  aliases: readonly { from: string; to: string }[],
): (semanticClassId: string | undefined) => string | undefined {
  if (aliases.length === 0) {
    return (id) => id;
  }
  const aliasMap = new Map<string, string>();
  for (const { from, to } of aliases) {
    aliasMap.set(from, to);
  }
  return (id) => {
    if (id === undefined) return undefined;
    return aliasMap.get(id) ?? id;
  };
}

/**
 * Deduplicate a truth set by resolved semantic class.
 * For each group of proposals sharing the same resolved semanticClassId,
 * only the highest-ranked (first in sorted order) survives. Others are
 * eliminated with reason "semantic-class-alias-dedup".
 *
 * Proposals without a semanticClassId are never deduplicated.
 * The input array must already be sorted by ranking (highest first).
 */
function deduplicateBySemanticClassAlias(
  sorted: readonly EncodedProposal[],
  resolveAlias: (id: string | undefined) => string | undefined,
): {
  deduplicated: readonly EncodedProposal[];
  aliasEliminations: readonly EliminationRecord[];
  aliasEliminationTraces: readonly EliminationTrace[];
} {
  const seen = new Map<string, EncodedProposal>();
  const deduplicated: EncodedProposal[] = [];
  const aliasEliminations: EliminationRecord[] = [];
  const aliasEliminationTraces: EliminationTrace[] = [];

  for (const entry of sorted) {
    const resolved = resolveAlias(entry.proposal.semanticClassId);

    // Proposals without a semanticClassId cannot be alias-deduplicated
    if (resolved === undefined) {
      deduplicated.push(entry);
      continue;
    }

    const existing = seen.get(resolved);
    if (existing === undefined) {
      seen.set(resolved, entry);
      deduplicated.push(entry);
    } else {
      // This proposal is a lower-ranked duplicate — eliminate it
      aliasEliminations.push({
        candidateBidName: entry.proposal.meaningId,
        moduleId: entry.proposal.moduleId,
        reason: `Semantic class alias dedup: "${entry.proposal.semanticClassId}" and "${existing.proposal.semanticClassId}" both resolve to "${resolved}"`,
        gateId: "semantic-class-alias-dedup",
      });
      aliasEliminationTraces.push({
        candidateId: entry.proposal.meaningId,
        stage: "arbitration",
        reason: `Semantic class alias dedup: resolved to "${resolved}", already represented by "${existing.proposal.meaningId}"`,
        evidence: [],
        strength: "entailed",
      });
    }
  }

  return { deduplicated, aliasEliminations, aliasEliminationTraces };
}

// ─── Provenance Helpers ────────────────────────────────────────

/** Map a MeaningClause to a ConditionEvidenceIR (shared across provenance builders). */
function clauseToEvidence(c: { factId: string; satisfied: boolean; observedValue?: unknown; value: unknown }): ConditionEvidenceIR {
  return { conditionId: c.factId, factId: c.factId, satisfied: c.satisfied, observedValue: c.observedValue, threshold: c.value };
}

/** Build DecisionProvenance from gate-level traces and arbitration results. */
function buildProvenance(
  encoded: readonly EncodedProposal[],
  finalTruthSet: readonly EncodedProposal[],
  recommended: readonly EncodedProposal[],
  selected: EncodedProposal | null,
  traces: {
    legality: readonly LegalityTrace[];
    encoding: readonly EncodingTrace[];
    eliminations: readonly EliminationTrace[];
  },
  handoffs: readonly HandoffTrace[],
): DecisionProvenance {
  const arbitration: ArbitrationTrace[] = encoded.map((e) => {
    const isTruth = finalTruthSet.includes(e) && e.eligibility.hand.satisfied && e.eligibility.encoding.legal;
    const recIndex = recommended.indexOf(e);
    return {
      candidateId: e.proposal.meaningId,
      truthSetMember: isTruth,
      acceptableSetMember: !e.eligibility.hand.satisfied && e.eligibility.encoding.legal,
      recommendationRank: recIndex >= 0 ? recIndex : undefined,
      rankingInputs: {
        recommendationBand: BAND_PRIORITY[e.proposal.ranking.recommendationBand],
        handFitScore: undefined,
        modulePrecedence: e.proposal.ranking.modulePrecedence,
        specificity: e.proposal.ranking.specificity,
      },
    };
  });

  const applicability: ApplicabilityEvidence = selected
    ? {
      factDependencies: selected.proposal.clauses.map((c) => c.factId),
      evaluatedConditions: selected.proposal.clauses.map(clauseToEvidence),
    }
    : { factDependencies: [], evaluatedConditions: [] };

  return {
    applicability,
    activation: [], // activation traces not yet implemented — always empty
    transforms: [],
    encoding: traces.encoding,
    legality: traces.legality,
    arbitration,
    eliminations: traces.eliminations,
    handoffs,
  };
}

/** Build EvidenceBundleIR from arbitration results. */
function buildEvidenceBundle(
  inputs: readonly ArbitrationInput[],
  eliminations: readonly EliminationRecord[],
  finalTruthSet: readonly EncodedProposal[],
  selected: EncodedProposal | null,
): EvidenceBundleIR {
  const matched: EvidenceBundleIR["matched"] = selected
    ? { meaningId: selected.proposal.meaningId, satisfiedConditions: selected.proposal.clauses.map(clauseToEvidence) }
    : null;

  const rejected: RejectionEvidence[] = eliminations.map((e) => {
    const input = inputs.find((i) => i.proposal.meaningId === e.candidateBidName);
    const failedClauses = input?.proposal.clauses.filter((c) => !c.satisfied) ?? [];
    return {
      meaningId: e.candidateBidName,
      failedConditions: failedClauses.map(clauseToEvidence),
      negatableFailures: failedClauses.map((c) => clauseToEvidence({ ...c, satisfied: false })),
      moduleId: input?.proposal.moduleId ?? "unknown",
    };
  });

  const selectedFacts = selected ? new Set(selected.proposal.clauses.map(c => c.factId)) : new Set<string>();
  const alternatives: AlternativeEvidence[] = finalTruthSet
    .filter((e) => e !== selected)
    .map((e) => ({
      meaningId: e.proposal.meaningId,
      call: formatCallForEvidence(e.call),
      ranking: { band: e.proposal.ranking.recommendationBand, specificity: e.proposal.ranking.specificity },
      reason: "truth-set-member-not-selected",
      conditionDelta: e.proposal.clauses.filter(c => !selectedFacts.has(c.factId)).map(clauseToEvidence),
    }));

  return { matched, rejected, alternatives, exhaustive: true, fallbackReached: selected === null };
}

// ─── Main Arbitration ──────────────────────────────────────────

export function arbitrateMeanings(
  inputs: readonly ArbitrationInput[],
  options?: {
    legalCalls?: readonly Call[];
    semanticClassAliases?: readonly { from: string; to: string }[];
    handoffs?: readonly HandoffTrace[];
  },
): ArbitrationResult {
  // Step 1: Evaluate each proposal through gates (semantic, legality, encoding)
  const encoded: EncodedProposal[] = [];
  const eliminations: EliminationRecord[] = [];
  const provenanceEliminations: EliminationTrace[] = [];
  const provenanceLegality: LegalityTrace[] = [];
  const provenanceEncoding: EncodingTrace[] = [];

  for (const input of inputs) {
    const result = evaluateProposal(input, options?.legalCalls);
    provenanceLegality.push(result.provenanceLegality);
    provenanceEncoding.push(result.provenanceEncoding);
    if (result.elimination) eliminations.push(result.elimination);
    if (result.provenanceElimination) provenanceEliminations.push(result.provenanceElimination);
    if (result.encoded) encoded.push(result.encoded);
  }

  // Step 2: Classify into truth set (all satisfied + legal) and acceptable set
  const { truthSet, acceptableSet } = classifyIntoSets(encoded);

  // Step 3: Sort truth set by ranking, then deduplicate by semantic class alias
  const sortedTruth = [...truthSet].sort((a, b) =>
    compareRanking(a.proposal.ranking, b.proposal.ranking),
  );
  const resolveAlias = buildAliasResolver(options?.semanticClassAliases ?? []);
  const { deduplicated, aliasEliminations, aliasEliminationTraces } =
    deduplicateBySemanticClassAlias(sortedTruth, resolveAlias);
  eliminations.push(...aliasEliminations);
  provenanceEliminations.push(...aliasEliminationTraces);

  // Step 4: Select winner (highest-ranked in deduplicated truth set)
  const finalTruthSet = deduplicated;
  const recommended = deduplicated;
  const selected: EncodedProposal | null = recommended[0] ?? null;

  // Step 5: Build provenance and evidence (post-processing — separate from selection)
  const provenance = buildProvenance(
    encoded, finalTruthSet, recommended, selected,
    { legality: provenanceLegality, encoding: provenanceEncoding, eliminations: provenanceEliminations },
    options?.handoffs ?? [],
  );
  const evidenceBundle = buildEvidenceBundle(inputs, eliminations, finalTruthSet, selected);

  return {
    selected, truthSet: finalTruthSet, acceptableSet, recommended, eliminations,
    transformTraces: undefined,
    provenance, evidenceBundle,
  };
}
