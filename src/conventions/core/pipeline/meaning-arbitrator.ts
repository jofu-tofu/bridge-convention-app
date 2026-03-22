import type {
  ArbitrationResult,
  EncodedProposal,
  EliminationRecord,
  PipelineCarrier,
  PipelineResult,
} from "../../../core/contracts/module-surface";
import type { Call } from "../../../engine/types";
import type { BidMeaning } from "../../../core/contracts/meaning";
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
  EvidenceBundle,
  ConditionEvidence,
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
  surfaces: readonly BidMeaning[],
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
 * For each group of carriers sharing the same resolved semanticClassId,
 * only the highest-ranked (first in sorted order) survives. Others are
 * eliminated with reason "semantic-class-alias-dedup".
 *
 * Carriers without a semanticClassId are never deduplicated.
 * The input array must already be sorted by ranking (highest first).
 */
function deduplicateBySemanticClassAlias(
  sorted: readonly PipelineCarrier[],
  resolveAlias: (id: string | undefined) => string | undefined,
): {
  deduplicated: readonly PipelineCarrier[];
  aliasEliminated: readonly PipelineCarrier[];
} {
  const seen = new Map<string, PipelineCarrier>();
  const deduplicated: PipelineCarrier[] = [];
  const aliasEliminated: PipelineCarrier[] = [];

  for (const carrier of sorted) {
    const resolved = resolveAlias(carrier.proposal.semanticClassId);

    // Carriers without a semanticClassId cannot be alias-deduplicated
    if (resolved === undefined) {
      deduplicated.push(carrier);
      continue;
    }

    const existing = seen.get(resolved);
    if (existing === undefined) {
      seen.set(resolved, carrier);
      deduplicated.push(carrier);
    } else {
      // This carrier is a lower-ranked duplicate — mark as eliminated
      const eliminatedCarrier: PipelineCarrier = {
        ...carrier,
        traces: {
          ...carrier.traces,
          elimination: {
            candidateId: carrier.proposal.meaningId,
            stage: "arbitration",
            reason: `Semantic class alias dedup: resolved to "${resolved}", already represented by "${existing.proposal.meaningId}"`,
            evidence: [],
            strength: "entailed",
          },
        },
      };
      aliasEliminated.push(eliminatedCarrier);
    }
  }

  return { deduplicated, aliasEliminated };
}

// ─── Provenance Helpers ────────────────────────────────────────

/** Map a MeaningClause to a ConditionEvidence (shared across provenance builders). */
function clauseToEvidence(c: { factId: string; satisfied: boolean; observedValue?: unknown; value: unknown }): ConditionEvidence {
  return { conditionId: c.factId, factId: c.factId, satisfied: c.satisfied, observedValue: c.observedValue, threshold: c.value };
}


/** Build EvidenceBundle from carriers. */
function buildEvidenceBundleFromCarriers(
  inputs: readonly ArbitrationInput[],
  eliminated: readonly PipelineCarrier[],
  finalTruthSet: readonly PipelineCarrier[],
  selected: PipelineCarrier | null,
): EvidenceBundle {
  const matched: EvidenceBundle["matched"] = selected
    ? { meaningId: selected.proposal.meaningId, satisfiedConditions: selected.proposal.clauses.map(clauseToEvidence) }
    : null;

  const rejected: RejectionEvidence[] = eliminated.map((c) => {
    const failedClauses = c.proposal.clauses.filter((cl) => !cl.satisfied);
    return {
      meaningId: c.proposal.meaningId,
      failedConditions: failedClauses.map(clauseToEvidence),
      negatableFailures: failedClauses.map((cl) => clauseToEvidence({ ...cl, satisfied: false })),
      moduleId: c.proposal.moduleId,
    };
  });

  const selectedFacts = selected ? new Set(selected.proposal.clauses.map(c => c.factId)) : new Set<string>();
  const alternatives: AlternativeEvidence[] = finalTruthSet
    .filter((c) => c !== selected)
    .map((c) => ({
      meaningId: c.proposal.meaningId,
      call: formatCallForEvidence(c.call),
      ranking: { band: c.proposal.ranking.recommendationBand, specificity: c.proposal.ranking.specificity },
      reason: "truth-set-member-not-selected",
      conditionDelta: c.proposal.clauses.filter(cl => !selectedFacts.has(cl.factId)).map(clauseToEvidence),
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
): PipelineResult {
  // Step 1: Evaluate each proposal through gates (semantic, legality, encoding)
  const passedCarriers: PipelineCarrier[] = [];
  const eliminatedCarriers: PipelineCarrier[] = [];

  for (const input of inputs) {
    const result = evaluateProposal(input, options?.legalCalls);
    if (result.passedAllGates || result.addToAcceptable) {
      passedCarriers.push(result.carrier);
    }
    if (!result.passedAllGates) {
      eliminatedCarriers.push(result.carrier);
    }
  }

  // Step 2: Classify into truth set (all satisfied + legal) and acceptable set
  const { truthSet, acceptableSet } = classifyIntoSets(passedCarriers);

  // Step 3: Sort truth set by ranking, then deduplicate by semantic class alias
  const sortedTruth = [...truthSet].sort((a, b) =>
    compareRanking(a.proposal.ranking, b.proposal.ranking),
  );
  const resolveAlias = buildAliasResolver(options?.semanticClassAliases ?? []);
  const { deduplicated, aliasEliminated } =
    deduplicateBySemanticClassAlias(sortedTruth, resolveAlias);
  eliminatedCarriers.push(...aliasEliminated);

  // Step 4: Select winner (highest-ranked in deduplicated truth set)
  const finalTruthSet = deduplicated;
  const recommended = deduplicated;
  const selected: PipelineCarrier | null = recommended[0] ?? null;

  // Step 5: Build cross-surface provenance
  const allCarriers = [...passedCarriers, ...eliminatedCarriers.filter(c => !passedCarriers.includes(c))];
  const arbitrationTraces: ArbitrationTrace[] = allCarriers.map((c) => {
    const isTruth = finalTruthSet.includes(c) && c.eligibility.hand.satisfied && c.eligibility.encoding.legal;
    const recIndex = recommended.indexOf(c);
    return {
      candidateId: c.proposal.meaningId,
      truthSetMember: isTruth,
      acceptableSetMember: !c.eligibility.hand.satisfied && c.eligibility.encoding.legal,
      recommendationRank: recIndex >= 0 ? recIndex : undefined,
      rankingInputs: {
        recommendationBand: BAND_PRIORITY[c.proposal.ranking.recommendationBand],
        handFitScore: undefined,
        modulePrecedence: c.proposal.ranking.modulePrecedence ?? 0,
        specificity: c.proposal.ranking.specificity,
      },
    };
  });

  const applicability: ApplicabilityEvidence = selected
    ? {
      factDependencies: selected.proposal.clauses.map((c) => c.factId),
      evaluatedConditions: selected.proposal.clauses.map(clauseToEvidence),
    }
    : { factDependencies: [], evaluatedConditions: [] };

  const evidenceBundle = buildEvidenceBundleFromCarriers(inputs, eliminatedCarriers, finalTruthSet, selected);

  return {
    selected,
    truthSet: finalTruthSet,
    acceptableSet,
    recommended,
    eliminated: eliminatedCarriers,
    applicability,
    activation: [], // activation traces not yet implemented — always empty
    arbitration: arbitrationTraces,
    handoffs: options?.handoffs ?? [],
    evidenceBundle,
  };
}

// ─── Legacy Conversion Shims (temporary — removed in Phase 4) ──

/** Convert PipelineResult to ArbitrationResult for unmigrated consumers. */
export function pipelineResultToArbitration(result: PipelineResult): ArbitrationResult {
  const carrierToEncoded = (c: PipelineCarrier): EncodedProposal => ({
    proposal: c.proposal,
    call: c.call,
    isDefaultEncoding: c.isDefaultEncoding,
    legal: c.legal,
    allEncodings: c.allEncodings,
    eligibility: c.eligibility,
  });

  return {
    selected: result.selected ? carrierToEncoded(result.selected) : null,
    truthSet: result.truthSet.map(carrierToEncoded),
    acceptableSet: result.acceptableSet.map(carrierToEncoded),
    recommended: result.recommended.map(carrierToEncoded),
    eliminations: result.eliminated.map((c) => ({
      candidateBidName: c.proposal.meaningId,
      moduleId: c.proposal.moduleId,
      reason: c.traces.elimination?.reason ?? "Gate check failed",
      gateId: undefined,
    })),
    evidenceBundle: result.evidenceBundle,
  };
}

/** Convert PipelineResult to DecisionProvenance for unmigrated consumers. */
export function pipelineResultToProvenance(result: PipelineResult): DecisionProvenance {
  const allCarriers = [
    ...result.truthSet,
    ...result.acceptableSet,
    ...result.eliminated,
  ];
  return {
    applicability: result.applicability,
    activation: result.activation,
    encoding: allCarriers.map((c) => c.traces.encoding),
    legality: allCarriers.map((c) => c.traces.legality),
    arbitration: result.arbitration,
    eliminations: result.eliminated
      .filter((c) => c.traces.elimination !== undefined)
      .map((c) => c.traces.elimination!),
    handoffs: result.handoffs,
  };
}
