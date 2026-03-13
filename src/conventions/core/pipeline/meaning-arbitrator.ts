import type {
  ArbitrationResult,
  EncodedProposal,
  EliminationRecord,
} from "../../../core/contracts/module-surface";
import type { Call } from "../../../engine/types";
import type { MeaningSurface } from "../../../core/contracts/meaning-surface";
import type {
  DecisionProvenance,
  EliminationTrace,
  ArbitrationTrace,
  LegalityTrace,
  EncodingTrace,
  ApplicabilityEvidence,
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

/** Format a Call as a human-readable string for evidence output. */
function formatCallForEvidence(call: Call): string {
  if (call.type !== "bid") {
    return call.type.charAt(0).toUpperCase() + call.type.slice(1);
  }
  return `${call.level}${call.strain}`;
}

/** Input to the arbitrator: a proposal paired with the surface it came from. */
export interface ArbitrationInput {
  readonly proposal: MeaningProposal;
  readonly surface: {
    readonly encoding: { readonly defaultCall: Call };
    readonly encoderKind?: import("../../../core/contracts/agreement-module").DeclaredEncoderKind;
    readonly encoderConfig?: import("./encoder-resolver").EncoderConfig;
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
export function buildAliasResolver(
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

export function arbitrateMeanings(
  inputs: readonly ArbitrationInput[],
  options?: {
    legalCalls?: readonly Call[];
    semanticClassAliases?: readonly { from: string; to: string }[];
  },
): ArbitrationResult {
  const encoded: EncodedProposal[] = [];
  const eliminations: EliminationRecord[] = [];

  // Provenance collectors
  const provenanceEliminations: EliminationTrace[] = [];
  const provenanceLegality: LegalityTrace[] = [];
  const provenanceEncoding: EncodingTrace[] = [];

  for (const input of inputs) {
    const result = evaluateProposal(input, options?.legalCalls);

    provenanceLegality.push(result.provenanceLegality);
    provenanceEncoding.push(result.provenanceEncoding);
    if (result.elimination) eliminations.push(result.elimination);
    if (result.provenanceElimination) provenanceEliminations.push(result.provenanceElimination);
    if (result.encoded) {
      encoded.push(result.encoded);
    }
  }

  const { truthSet, acceptableSet } = classifyIntoSets(encoded);

  // Sort truth set by ranking (ascending — first element is highest rank)
  const sortedTruth = [...truthSet].sort((a, b) =>
    compareRanking(a.proposal.ranking, b.proposal.ranking),
  );

  // Apply semantic class alias deduplication if aliases are provided
  const resolveAlias = buildAliasResolver(options?.semanticClassAliases ?? []);
  const {
    deduplicated: deduplicatedTruth,
    aliasEliminations,
    aliasEliminationTraces,
  } = deduplicateBySemanticClassAlias(sortedTruth, resolveAlias);

  // Merge alias eliminations into the main elimination arrays
  eliminations.push(...aliasEliminations);
  provenanceEliminations.push(...aliasEliminationTraces);

  const recommended = deduplicatedTruth;

  // After alias dedup, the truth set is deduplicatedTruth
  const finalTruthSet = deduplicatedTruth;

  const selected: EncodedProposal | null = recommended.length > 0 ? (recommended[0] ?? null) : null;

  // Build arbitration traces for all candidates that made it through gates
  const arbitrationTraces: ArbitrationTrace[] = encoded.map((e, _index) => {
    const isTruth = finalTruthSet.includes(e) && e.eligibility.hand.satisfied && e.eligibility.encoding.legal;
    const isAcceptable = !e.eligibility.hand.satisfied && e.eligibility.encoding.legal;
    const recIndex = recommended.indexOf(e);
    return {
      candidateId: e.proposal.meaningId,
      truthSetMember: isTruth,
      acceptableSetMember: isAcceptable,
      recommendationRank: recIndex >= 0 ? recIndex : undefined,
      rankingInputs: {
        recommendationBand: BAND_PRIORITY[e.proposal.ranking.recommendationBand],
        handFitScore: undefined,
        modulePrecedence: e.proposal.ranking.modulePrecedence,
        specificity: e.proposal.ranking.specificity,
      },
    };
  });

  // Build applicability evidence from the selected candidate (or empty if none)
  const applicability: ApplicabilityEvidence = selected
    ? {
      factDependencies: selected.proposal.clauses.map((c) => c.factId),
      evaluatedConditions: selected.proposal.clauses.map((c) => ({
        conditionId: c.factId,
        factId: c.factId,
        satisfied: c.satisfied,
        observedValue: c.observedValue,
        threshold: c.value,
      })),
    }
    : {
      factDependencies: [],
      evaluatedConditions: [],
    };

  const provenance: DecisionProvenance = {
    applicability,
    activation: [], // Module activation happens upstream
    transforms: [], // Transforms applied upstream by composeSurfaces
    encoding: provenanceEncoding,
    legality: provenanceLegality,
    arbitration: arbitrationTraces,
    eliminations: provenanceEliminations,
    handoffs: [], // Handoffs not yet tracked
  };

  // Build EvidenceBundleIR
  const matchedEvidence: EvidenceBundleIR["matched"] = selected
    ? {
        meaningId: selected.proposal.meaningId,
        satisfiedConditions: selected.proposal.clauses.map((c): ConditionEvidenceIR => ({
          conditionId: c.factId,
          factId: c.factId,
          satisfied: c.satisfied,
          observedValue: c.observedValue,
          threshold: c.value,
        })),
      }
    : null;

  const rejectedEvidence: RejectionEvidence[] = eliminations.map((e) => {
    const input = inputs.find((i) => i.proposal.meaningId === e.candidateBidName);
    const failedClauses = input?.proposal.clauses.filter((c) => !c.satisfied) ?? [];
    return {
      meaningId: e.candidateBidName,
      failedConditions: failedClauses.map((c): ConditionEvidenceIR => ({
        conditionId: c.factId,
        factId: c.factId,
        satisfied: c.satisfied,
        observedValue: c.observedValue,
        threshold: c.value,
      })),
      moduleId: input?.proposal.moduleId ?? "unknown",
    };
  });

  const alternativeEvidence: AlternativeEvidence[] = finalTruthSet
    .filter((e) => e !== selected)
    .map((e) => ({
      meaningId: e.proposal.meaningId,
      call: formatCallForEvidence(e.call),
      ranking: {
        band: e.proposal.ranking.recommendationBand,
        specificity: e.proposal.ranking.specificity,
      },
      reason: "truth-set-member-not-selected",
    }));

  const evidenceBundle: EvidenceBundleIR = {
    matched: matchedEvidence,
    rejected: rejectedEvidence,
    alternatives: alternativeEvidence,
    exhaustive: true,
    fallbackReached: selected === null,
  };

  return {
    selected,
    truthSet: finalTruthSet,
    acceptableSet,
    recommended,
    eliminations,
    transformTraces: undefined, // Transform traces grafted by upstream mergeUpstreamProvenance
    provenance,
    evidenceBundle,
  };
}
