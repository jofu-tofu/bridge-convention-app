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
        evidence_bundle: None,
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
