//! Observation log builder — constructs a CommittedStep[] from per-step data.
//!
//! Mirrors TS from `pipeline/observation/observation-log-builder.ts`.

use bridge_engine::types::{Call, Seat};

use crate::pipeline::observation::committed_step::{
    initial_negotiation, ClaimRef, CommittedStep, CommittedStepStatus,
};
use crate::pipeline::observation::negotiation_extractor::compute_kernel_delta;
use crate::pipeline::observation::normalize_intent::normalize_intent;
use crate::pipeline::types::PipelineResult;
use crate::types::negotiation::NegotiationState;

/// Input for one auction step.
pub struct ObservationLogStep {
    pub actor: Seat,
    pub call: Call,
    pub state_after: NegotiationState,
    pub pipeline_result: Option<PipelineResult>,
}

/// Build a CommittedStep vec from per-step auction data.
///
/// Threads kernel state through the loop: step N's prev_kernel is
/// step N-1's state_after (or INITIAL_NEGOTIATION for step 0).
pub fn build_observation_log(steps: &[ObservationLogStep]) -> Vec<CommittedStep> {
    let mut log = Vec::with_capacity(steps.len());
    let mut prev_kernel = initial_negotiation();

    for step in steps {
        let resolved_claim = extract_claim_ref(&step.pipeline_result);
        let public_actions = extract_public_obs(&step.pipeline_result);
        let negotiation_delta = compute_kernel_delta(&prev_kernel, &step.state_after);
        let status = derive_status(&step.pipeline_result);

        let committed = CommittedStep {
            actor: step.actor,
            call: step.call.clone(),
            resolved_claim,
            public_actions,
            negotiation_delta,
            state_after: step.state_after.clone(),
            status,
        };
        prev_kernel = committed.state_after.clone();
        log.push(committed);
    }

    log
}

fn extract_claim_ref(result: &Option<PipelineResult>) -> Option<ClaimRef> {
    let result = result.as_ref()?;
    let carrier = result.selected.as_ref()?;
    let proposal = &carrier.encoded.proposal;

    Some(ClaimRef {
        module_id: proposal.module_id.clone(),
        meaning_id: proposal.meaning_id.clone(),
        semantic_class_id: proposal.semantic_class_id.clone(),
        source_intent: proposal.source_intent.clone(),
    })
}

fn extract_public_obs(
    result: &Option<PipelineResult>,
) -> Vec<crate::types::bid_action::BidAction> {
    match result {
        Some(r) => match &r.selected {
            Some(carrier) => normalize_intent(&carrier.encoded.proposal.source_intent),
            None => Vec::new(),
        },
        None => Vec::new(),
    }
}

fn derive_status(result: &Option<PipelineResult>) -> CommittedStepStatus {
    match result {
        None => CommittedStepStatus::OffSystem,
        Some(r) => {
            if r.selected.is_some() {
                CommittedStepStatus::Resolved
            } else if !r.truth_set.is_empty() {
                CommittedStepStatus::Ambiguous
            } else {
                CommittedStepStatus::OffSystem
            }
        }
    }
}
