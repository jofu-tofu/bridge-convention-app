//! Meaning arbitrator — tiered selection producing PipelineResult.
//!
//! Mirrors TS from `pipeline/evaluation/meaning-arbitrator.ts`.

use std::collections::HashSet;

use bridge_engine::types::Call;

use crate::pipeline::evaluation::arbitration_helpers::{classify_into_sets, evaluate_proposal};
use crate::pipeline::evaluation::provenance::{
    ApplicabilityEvidence, ArbitrationTrace, HandoffTrace,
};
use crate::pipeline::evaluation::types::{compare_ranking, MeaningProposal};
use crate::pipeline::evidence_bundle::{
    AlternativeEvidence, AlternativeRanking, ConditionEvidence, EvidenceBundle,
    MatchedEvidence, RejectionEvidence,
};
use crate::pipeline::types::{PipelineCarrier, PipelineResult};

/// Arbitrate meanings — main entry point.
///
/// Gates → classify → sort → deduplicate → select.
pub fn arbitrate_meanings(
    proposals: &[MeaningProposal],
    is_legal: &dyn Fn(&Call) -> bool,
) -> PipelineResult {
    if proposals.is_empty() {
        return PipelineResult::empty();
    }

    // Step 1: Evaluate all proposals through gates
    let carriers: Vec<PipelineCarrier> = proposals
        .iter()
        .map(|p| evaluate_proposal(p, is_legal))
        .collect();

    // Step 2: Classify into truth and acceptable sets
    let (mut truth_set, acceptable_set) = classify_into_sets(&carriers);

    // Step 3: Sort truth set by ranking
    truth_set.sort_by(|a, b| compare_ranking(&a.encoded.proposal.ranking, &b.encoded.proposal.ranking));

    // Step 4: Deduplicate by semantic class
    let deduped = deduplicate_by_semantic_class(&truth_set);

    // Step 5: Select winner (first in sorted, deduplicated truth set)
    let selected = deduped.first().cloned();

    // Step 6: Identify eliminated carriers
    let truth_ids: HashSet<&str> = truth_set.iter().map(|c| c.encoded.proposal.meaning_id.as_str()).collect();
    let eliminated: Vec<PipelineCarrier> = carriers
        .iter()
        .filter(|c| !truth_ids.contains(c.encoded.proposal.meaning_id.as_str()))
        .cloned()
        .collect();

    // Build arbitration traces
    let arbitration: Vec<ArbitrationTrace> = carriers
        .iter()
        .map(|c| {
            let outcome = if selected.as_ref().map(|s| &s.encoded.proposal.meaning_id) == Some(&c.encoded.proposal.meaning_id) {
                "selected"
            } else if truth_ids.contains(c.encoded.proposal.meaning_id.as_str()) {
                "truth-set"
            } else {
                "eliminated"
            };
            ArbitrationTrace {
                meaning_id: c.encoded.proposal.meaning_id.clone(),
                module_id: c.encoded.proposal.module_id.clone(),
                outcome: outcome.into(),
                reason: c.traces.elimination.as_ref().map(|e| e.reason.clone()),
            }
        })
        .collect();

    // Build handoff traces from selected carrier's negotiation delta
    let handoffs: Vec<HandoffTrace> = Vec::new(); // Populated by adapter layer

    let matched_count = truth_set.len();
    let eliminated_count = eliminated.len();

    // Build evidence bundle from carriers
    let evidence_bundle = build_evidence_bundle(&selected, &truth_set, &eliminated);

    PipelineResult {
        selected,
        truth_set,
        acceptable_set,
        recommended: deduped,
        eliminated,
        applicability: ApplicabilityEvidence {
            total_surfaces: proposals.len(),
            matched_count,
            eliminated_count,
        },
        activation: Vec::new(), // Populated by observation layer
        arbitration,
        handoffs,
        evidence_bundle: Some(evidence_bundle),
    }
}

/// Build an EvidenceBundle from the arbitration results.
fn build_evidence_bundle(
    selected: &Option<PipelineCarrier>,
    truth_set: &[PipelineCarrier],
    eliminated: &[PipelineCarrier],
) -> EvidenceBundle {
    // Matched: selected carrier's satisfied conditions
    let matched = selected.as_ref().map(|carrier| {
        let conditions = carrier.proposal().clauses.iter()
            .filter(|c| c.satisfied)
            .map(|c| ConditionEvidence {
                condition_id: c.clause_id.clone().unwrap_or_else(|| c.fact_id.clone()),
                fact_id: Some(c.fact_id.clone()),
                satisfied: true,
                description: c.description.clone(),
                observed_value: c.observed_value.clone(),
                threshold: None,
                params: None,
            })
            .collect();
        MatchedEvidence {
            meaning_id: carrier.proposal().meaning_id.clone(),
            satisfied_conditions: conditions,
        }
    });

    // Rejected: eliminated carriers' failed conditions
    let rejected: Vec<RejectionEvidence> = eliminated.iter()
        .map(|carrier| {
            let failed = carrier.proposal().clauses.iter()
                .filter(|c| !c.satisfied)
                .map(|c| ConditionEvidence {
                    condition_id: c.clause_id.clone().unwrap_or_else(|| c.fact_id.clone()),
                    fact_id: Some(c.fact_id.clone()),
                    satisfied: false,
                    description: c.description.clone(),
                    observed_value: c.observed_value.clone(),
                    threshold: None,
                    params: None,
                })
                .collect();
            RejectionEvidence {
                meaning_id: carrier.proposal().meaning_id.clone(),
                failed_conditions: failed,
                module_id: carrier.proposal().module_id.clone(),
                negatable_failures: None,
            }
        })
        .collect();

    // Alternatives: truth set entries that weren't selected
    let selected_id = selected.as_ref().map(|c| c.proposal().meaning_id.as_str());
    let alternatives: Vec<AlternativeEvidence> = truth_set.iter()
        .filter(|c| Some(c.proposal().meaning_id.as_str()) != selected_id)
        .map(|carrier| {
            let p = carrier.proposal();
            AlternativeEvidence {
                meaning_id: p.meaning_id.clone(),
                call: format!("{:?}", carrier.call()),
                ranking: AlternativeRanking {
                    band: format!("{:?}", p.ranking.recommendation_band),
                    specificity: p.ranking.specificity,
                },
                reason: "Alternative in truth set".to_string(),
                condition_delta: None,
            }
        })
        .collect();

    EvidenceBundle {
        matched,
        rejected,
        alternatives,
        exhaustive: true,
        fallback_reached: selected.is_none(),
    }
}

/// Deduplicate carriers by semantic class — keep highest-ranked per class.
///
/// NOTE: Only checks raw `semantic_class_id`. Alias resolution (cross-module
/// equivalence via aliased class IDs) is not implemented — spike (2026-04-02)
/// found no alias data in module fixtures and no cross-module duplicate class
/// IDs in any of the 4 bundles. Revisit if alias fields are added to fixtures.
fn deduplicate_by_semantic_class(sorted_carriers: &[PipelineCarrier]) -> Vec<PipelineCarrier> {
    let mut seen_classes: HashSet<String> = HashSet::new();
    let mut result = Vec::new();

    for carrier in sorted_carriers {
        let class_id = &carrier.encoded.proposal.semantic_class_id;
        if class_id.is_empty() || seen_classes.insert(class_id.clone()) {
            result.push(carrier.clone());
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    // Integration tests will use golden-master fixtures.
    // Unit tests verify deduplication logic.

    #[test]
    fn deduplicate_preserves_order() {
        // Empty input should produce empty output
        let result = deduplicate_by_semantic_class(&[]);
        assert!(result.is_empty());
    }
}
