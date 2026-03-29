//! Arbitration helpers — gate pipeline and eligibility classification.
//!
//! Mirrors TS from `pipeline/evaluation/arbitration-helpers.ts`.

use bridge_engine::types::Call;

use crate::adapter::tree_evaluation::{
    CandidateEligibility, EncodingEligibility, EncodingFailureReason, HandEligibility,
    PedagogicalEligibility, SiblingConditionDetail,
};
use crate::pipeline::evaluation::encoder_resolver::resolve_encoding;
use crate::pipeline::evaluation::provenance::{
    EliminationTrace, LegalityTrace,
};
use crate::pipeline::evaluation::types::MeaningProposal;
use crate::pipeline::types::{CarrierTraces, EncodedProposal, PipelineCarrier};

/// Evaluate a proposal through the gate pipeline, producing an EncodedProposal + traces.
pub fn evaluate_proposal(
    proposal: &MeaningProposal,
    is_legal: &dyn Fn(&Call) -> bool,
) -> PipelineCarrier {
    let encoding_result = resolve_encoding(&proposal.encoding, is_legal);

    let hand_satisfied = proposal.all_satisfied;
    let encoding_legal = encoding_result.all_encodings.iter().any(|e| e.legal);

    // Build failed conditions for eligibility
    let failed_conditions: Vec<SiblingConditionDetail> = proposal
        .clauses
        .iter()
        .filter(|c| !c.satisfied)
        .map(|c| SiblingConditionDetail {
            name: c.fact_id.clone(),
            description: c.description.clone().unwrap_or_default(),
            condition_id: c.clause_id.clone(),
            fact_id: Some(c.fact_id.clone()),
            observed_value: c.observed_value.clone(),
            threshold: None,
        })
        .collect();

    let eligibility = CandidateEligibility {
        hand: HandEligibility {
            satisfied: hand_satisfied,
            failed_conditions,
        },
        encoding: EncodingEligibility {
            legal: encoding_legal,
            reason: if encoding_legal {
                None
            } else {
                Some(EncodingFailureReason::AllEncodingsIllegal)
            },
        },
        pedagogical: PedagogicalEligibility {
            acceptable: true, // Default — pedagogical gate is post-selection
            reasons: Vec::new(),
        },
    };

    let elimination = if !hand_satisfied {
        Some(EliminationTrace {
            gate_id: "semantic-applicability".into(),
            reason: "Hand does not satisfy all clauses".into(),
        })
    } else if !encoding_legal {
        Some(EliminationTrace {
            gate_id: "encoder-availability".into(),
            reason: "No legal encoding available".into(),
        })
    } else {
        None
    };

    PipelineCarrier {
        encoded: EncodedProposal {
            proposal: proposal.clone(),
            call: encoding_result.call,
            is_default_encoding: encoding_result.is_default,
            legal: encoding_legal,
            all_encodings: encoding_result.all_encodings,
            eligibility,
        },
        traces: CarrierTraces {
            encoding: encoding_result.trace,
            legality: LegalityTrace {
                legal: encoding_legal,
                reason: None,
            },
            elimination,
        },
    }
}

/// Classify carriers into truth set and acceptable set.
///
/// Truth set: hand satisfied AND legal encoding.
/// Acceptable set: a subset of truth set (same for now, pedagogical filtering later).
pub fn classify_into_sets(
    carriers: &[PipelineCarrier],
) -> (Vec<PipelineCarrier>, Vec<PipelineCarrier>) {
    let truth_set: Vec<PipelineCarrier> = carriers
        .iter()
        .filter(|c| {
            c.encoded.eligibility.hand.satisfied && c.encoded.eligibility.encoding.legal
        })
        .cloned()
        .collect();

    // Acceptable = truth set filtered by pedagogical acceptability
    let acceptable_set: Vec<PipelineCarrier> = truth_set
        .iter()
        .filter(|c| c.encoded.eligibility.pedagogical.acceptable)
        .cloned()
        .collect();

    (truth_set, acceptable_set)
}
