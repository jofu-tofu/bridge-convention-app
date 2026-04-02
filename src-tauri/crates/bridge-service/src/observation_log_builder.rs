//! Observation log construction — builds CommittedStep entries from pipeline
//! results, call-inferred matches, and negotiation state. Also contains the
//! incremental replay loop that reconstructs the full observation log from
//! an auction history.

use std::collections::HashMap;

use bridge_conventions::fact_dsl::evaluator::evaluate_facts;
use bridge_conventions::fact_dsl::types::FitAgreedContext;
use bridge_conventions::pipeline::observation::committed_step::{
    initial_negotiation, AuctionContext, ClaimRef, CommittedStep, CommittedStepStatus,
};
use bridge_conventions::pipeline::observation::local_fsm::advance_local_fsm;
use bridge_conventions::pipeline::observation::negotiation_extractor::{
    apply_negotiation_actions, compute_kernel_delta,
};
use bridge_conventions::pipeline::observation::normalize_intent::normalize_intent;
use bridge_conventions::pipeline::observation::rule_interpreter::{
    collect_matching_claims_with_phases, flatten_surfaces,
};
use bridge_conventions::pipeline::run_pipeline::{run_pipeline, PipelineInput};
use bridge_conventions::pipeline::types::{PipelineCarrier, PipelineResult};
use bridge_conventions::types::bid_action::BidActionType;
use bridge_conventions::types::fact_types::FactDefinition;
use bridge_conventions::types::meaning::BidMeaning;
use bridge_conventions::types::module_types::ConventionModule;
use bridge_conventions::types::system_config::SystemConfig;
use bridge_engine::hand_evaluator::evaluate_hand_hcp;
use bridge_engine::types::{Call, Hand, Seat};

use bridge_session::heuristics::BiddingContext;

use crate::strategy_pipeline::vulnerability_facts;

/// Find the carrier in a pipeline result that matches the actual call.
/// Searches selected, truth_set, recommended, and acceptable_set in that order.
pub(crate) fn find_carrier_for_call<'a>(
    result: &'a PipelineResult,
    actual_call: &Call,
) -> Option<&'a PipelineCarrier> {
    // Check selected first
    if let Some(ref sel) = result.selected {
        if sel.call() == actual_call {
            return Some(sel);
        }
    }
    // Then truth_set
    if let Some(found) = result.truth_set.iter().find(|c| c.call() == actual_call) {
        return Some(found);
    }
    // Then recommended
    if let Some(found) = result.recommended.iter().find(|c| c.call() == actual_call) {
        return Some(found);
    }
    // Then acceptable_set
    result
        .acceptable_set
        .iter()
        .find(|c| c.call() == actual_call)
}

/// Build a CommittedStep from a specific carrier (or None for off-system).
pub(crate) fn build_step_from_carrier(
    actor: Seat,
    call: &Call,
    carrier: Option<&PipelineCarrier>,
    prev_log: &[CommittedStep],
) -> CommittedStep {
    let resolved_claim = carrier.map(|c| ClaimRef {
        module_id: c.proposal().module_id.clone(),
        meaning_id: c.proposal().meaning_id.clone(),
        semantic_class_id: c.proposal().semantic_class_id.clone(),
        source_intent: c.proposal().source_intent.clone(),
    });

    let public_actions = carrier
        .map(|c| normalize_intent(&c.proposal().source_intent))
        .unwrap_or_default();

    let status = if carrier.is_some() {
        CommittedStepStatus::Resolved
    } else {
        CommittedStepStatus::OffSystem
    };

    let prev_kernel = prev_log
        .last()
        .map(|s| s.state_after.clone())
        .unwrap_or_else(initial_negotiation);
    let state_after = apply_negotiation_actions(&prev_kernel, &public_actions, actor);
    let negotiation_delta = compute_kernel_delta(&prev_kernel, &state_after);

    CommittedStep {
        actor,
        call: call.clone(),
        resolved_claim,
        public_actions,
        negotiation_delta,
        state_after,
        status,
    }
}

/// Build a CommittedStep by matching the actual call against available surfaces'
/// default_call. This enables the observation log to track opener/responder roles
/// even when hands aren't available for prior bidders.
pub(crate) fn build_call_inferred_step(
    actor: Seat,
    call: &Call,
    surfaces: &[BidMeaning],
    prev_log: &[CommittedStep],
) -> CommittedStep {
    // Find the surface whose default_call matches the actual call
    let matched = surfaces
        .iter()
        .find(|s| &s.encoding.default_call == call);

    let (resolved_claim, public_actions, status) = match matched {
        Some(surface) => {
            let claim = ClaimRef {
                module_id: surface.module_id.clone().unwrap_or_default(),
                meaning_id: surface.meaning_id.clone(),
                semantic_class_id: surface.semantic_class_id.clone(),
                source_intent: surface.source_intent.clone(),
            };
            let actions = normalize_intent(&surface.source_intent);
            (Some(claim), actions, CommittedStepStatus::Resolved)
        }
        None => {
            // No surface matches the call — check alternate encodings
            let alt_match = surfaces.iter().find(|s| {
                s.encoding
                    .alternate_encodings
                    .as_ref()
                    .map(|alts| alts.iter().any(|a| &a.call == call))
                    .unwrap_or(false)
            });
            match alt_match {
                Some(surface) => {
                    let claim = ClaimRef {
                        module_id: surface.module_id.clone().unwrap_or_default(),
                        meaning_id: surface.meaning_id.clone(),
                        semantic_class_id: surface.semantic_class_id.clone(),
                        source_intent: surface.source_intent.clone(),
                    };
                    let actions = normalize_intent(&surface.source_intent);
                    (Some(claim), actions, CommittedStepStatus::Resolved)
                }
                None => (None, Vec::new(), CommittedStepStatus::OffSystem),
            }
        }
    };

    let prev_kernel = prev_log
        .last()
        .map(|s| s.state_after.clone())
        .unwrap_or_else(initial_negotiation);
    let state_after = apply_negotiation_actions(&prev_kernel, &public_actions, actor);
    let negotiation_delta = compute_kernel_delta(&prev_kernel, &state_after);

    CommittedStep {
        actor,
        call: call.clone(),
        resolved_claim,
        public_actions,
        negotiation_delta,
        state_after,
        status,
    }
}

/// Build the observation log incrementally by replaying each prior auction entry.
/// Returns the completed log and the local FSM phase map.
pub(crate) fn build_observation_log(
    modules: &[ConventionModule],
    fact_definitions: &[FactDefinition],
    system_config: Option<&SystemConfig>,
    ctx: &BiddingContext,
    all_hands: Option<&HashMap<Seat, Hand>>,
) -> (Vec<CommittedStep>, HashMap<String, String>) {
    let mut log: Vec<CommittedStep> = Vec::new();
    let mut local_phases: HashMap<String, String> = HashMap::new();
    for module in modules {
        local_phases.insert(module.module_id.clone(), module.local.initial.clone());
    }

    for (i, entry) in ctx.auction.entries.iter().enumerate() {
        let step_context = AuctionContext { log: log.clone() };

        let surface_results = collect_matching_claims_with_phases(
            modules,
            &step_context,
            Some(entry.seat),
            &local_phases,
        );
        let surfaces = flatten_surfaces(&surface_results);

        let partial_auction = bridge_engine::types::Auction {
            entries: ctx.auction.entries[..i].to_vec(),
            is_complete: false,
        };
        let step_seat = entry.seat;
        let is_legal = move |call: &Call| -> bool {
            bridge_engine::auction::is_legal_call(&partial_auction, call, step_seat)
        };

        let step_hand = all_hands
            .and_then(|h| h.get(&entry.seat))
            .or_else(|| {
                if entry.seat == ctx.seat {
                    Some(&ctx.hand)
                } else {
                    None
                }
            });

        let pipeline_result = if !surfaces.is_empty() {
            if let Some(hand) = step_hand {
                let evaluation = evaluate_hand_hcp(hand);
                let vuln_facts = vulnerability_facts(ctx.vulnerability, entry.seat);

                let prev_kernel = log
                    .last()
                    .map(|s| s.state_after.clone())
                    .unwrap_or_else(initial_negotiation);
                let relational_ctx = prev_kernel.fit_agreed.as_ref().map(|fa| {
                    bridge_conventions::fact_dsl::types::RelationalFactContext {
                        bindings: None,
                        public_commitments: None,
                        fit_agreed: Some(
                            bridge_conventions::fact_dsl::types::FitAgreedContext {
                                strain: format!("{:?}", fa.strain).to_lowercase(),
                                confidence: fa.confidence,
                            },
                        ),
                    }
                });

                let facts = evaluate_facts(
                    hand,
                    &evaluation,
                    fact_definitions,
                    system_config,
                    relational_ctx.as_ref(),
                    vuln_facts.as_ref(),
                );
                Some(run_pipeline(PipelineInput {
                    surfaces: &surfaces,
                    facts: &facts,
                    is_legal: &is_legal,
                    inherited_dimensions: &[],
                    hand: step_hand,
                    system_config,
                }))
            } else {
                None
            }
        } else {
            None
        };

        // Build the observation log step for this auction entry.
        let step = if let Some(ref pr) = pipeline_result {
            let matching_carrier = find_carrier_for_call(pr, &entry.call);
            if matching_carrier.is_some() {
                build_step_from_carrier(entry.seat, &entry.call, matching_carrier, &log)
            } else {
                build_call_inferred_step(entry.seat, &entry.call, &surfaces, &log)
            }
        } else if !surfaces.is_empty() {
            build_call_inferred_step(entry.seat, &entry.call, &surfaces, &log)
        } else {
            build_step_from_carrier(entry.seat, &entry.call, None, &log)
        };

        // Advance local FSMs
        for module in modules {
            let current = local_phases
                .get(&module.module_id)
                .cloned()
                .unwrap_or_else(|| module.local.initial.clone());
            let next = advance_local_fsm(&current, &step, &module.local.transitions);
            local_phases.insert(module.module_id.clone(), next);
        }

        log.push(step);
    }

    (log, local_phases)
}

/// Derive an agreed fit from the observation log by looking for Accept actions
/// from partner. If partner accepted a suit (e.g., transfer acceptance), that
/// suit is the agreed fit for total-point threshold evaluation.
pub(crate) fn derive_fit_from_log(
    log: &[CommittedStep],
    user_seat: Seat,
) -> Option<FitAgreedContext> {
    use bridge_conventions::types::ConfidenceLevel;

    let partner = bridge_engine::constants::partner_seat(user_seat);

    // Look for Accept/Raise actions from partner
    for step in log.iter().rev() {
        if step.actor != partner {
            continue;
        }
        for action in &step.public_actions {
            match action.act() {
                BidActionType::Accept => {
                    if let Some(suit) = action.suit() {
                        let suit_name = format!("{:?}", suit).to_lowercase();
                        return Some(FitAgreedContext {
                            strain: suit_name,
                            confidence: ConfidenceLevel::Tentative,
                        });
                    }
                }
                BidActionType::Raise => {
                    if let Some(strain) = action.strain() {
                        let strain_name = format!("{:?}", strain).to_lowercase();
                        return Some(FitAgreedContext {
                            strain: strain_name,
                            confidence: ConfidenceLevel::Tentative,
                        });
                    }
                }
                _ => {}
            }
        }
    }
    None
}
