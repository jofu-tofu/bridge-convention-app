//! Rule interpreter — collects matching claims from ConventionModules.
//!
//! Mirrors TS from `pipeline/observation/rule-interpreter.ts`.

use bridge_engine::partner_seat;
use bridge_engine::types::Seat;
use std::collections::HashMap;

use crate::pipeline::observation::committed_step::{
    AuctionContext, CommittedStep, CommittedStepStatus,
};
use crate::pipeline::observation::local_fsm::advance_local_fsm;
use crate::pipeline::observation::negotiation_matcher::match_kernel;
use crate::pipeline::observation::route_matcher::match_route;
use crate::types::meaning::BidMeaning;
use crate::types::module_types::ConventionModule;
use crate::types::negotiation::NegotiationState;
use crate::types::rule_types::{PhaseRef, ResolvedSurface, StateEntry, TurnRole};

use super::committed_step::initial_negotiation;

/// Result for one module — resolved surfaces with their negotiation deltas.
#[derive(Debug, Clone)]
pub struct ModuleSurfaceResult {
    pub module_id: String,
    pub resolved: Vec<ResolvedSurface>,
}

/// Flatten resolved surfaces to BidMeaning vec (discarding deltas).
pub fn flatten_surfaces(results: &[ModuleSurfaceResult]) -> Vec<BidMeaning> {
    results
        .iter()
        .flat_map(|r| r.resolved.iter().map(|c| c.surface.clone()))
        .collect()
}

/// Derive the turn role for the next bidder.
pub fn derive_turn_role(next_seat: Seat, log: &[CommittedStep]) -> TurnRole {
    let opener_seat = find_opener_seat(log);

    match opener_seat {
        None => TurnRole::Opener,
        Some(os) => {
            if next_seat == os {
                TurnRole::Opener
            } else if next_seat == partner_seat(os) {
                TurnRole::Responder
            } else {
                TurnRole::Opponent
            }
        }
    }
}

/// Collect all matching claims from convention modules against the current auction context.
pub fn collect_matching_claims(
    modules: &[ConventionModule],
    context: &AuctionContext,
    next_seat: Option<Seat>,
) -> Vec<ModuleSurfaceResult> {
    let current_kernel = get_current_kernel(context);
    let turn_role = next_seat.map(|s| derive_turn_role(s, &context.log));
    let opener_seat = find_opener_seat(&context.log);

    let mut results = Vec::new();
    for module in modules {
        // Skip modules whose attachment conditions aren't met
        if !module.attachments.is_empty() && !check_attachments(&module.attachments, context) {
            continue;
        }

        let current_phase = replay_local_fsm(module, context);
        let resolved = collect_module_surfaces(
            module,
            &current_phase,
            &current_kernel,
            context,
            turn_role,
            opener_seat,
        );

        if !resolved.is_empty() {
            results.push(ModuleSurfaceResult {
                module_id: module.module_id.clone(),
                resolved,
            });
        }
    }

    results
}

/// Check if a module's attachment conditions are satisfied by the current context.
/// Returns true if ANY attachment is satisfied (OR semantics — any trigger fires the module).
fn check_attachments(
    attachments: &[crate::types::agreement::Attachment],
    context: &AuctionContext,
) -> bool {
    attachments
        .iter()
        .any(|att| check_single_attachment(att, context))
}

/// Check a single attachment predicate against the auction context.
fn check_single_attachment(
    att: &crate::types::agreement::Attachment,
    context: &AuctionContext,
) -> bool {
    // Check auction pattern if specified
    if let Some(ref pattern) = att.when_auction {
        if !check_auction_pattern(pattern, context) {
            return false;
        }
    }

    // Check public guard if specified
    if let Some(ref guard) = att.when_public {
        if !check_public_guard(guard, context) {
            return false;
        }
    }

    // All specified conditions passed (conditions are AND-ed within a single attachment)
    true
}

/// Check an auction pattern against the log.
fn check_auction_pattern(
    pattern: &crate::types::agreement::AuctionPattern,
    context: &AuctionContext,
) -> bool {
    use crate::types::agreement::AuctionPattern;

    match pattern {
        AuctionPattern::Sequence { calls } => {
            // Check if the auction log ends with this call sequence
            let log_calls: Vec<String> = context
                .log
                .iter()
                .map(|step| format!("{:?}", step.call))
                .collect();
            if log_calls.len() < calls.len() {
                return false;
            }
            let start = log_calls.len() - calls.len();
            log_calls[start..]
                .iter()
                .zip(calls.iter())
                .all(|(a, b)| a == b)
        }
        AuctionPattern::Contains { call, by_role: _ } => {
            // Check if any call in the log matches
            context
                .log
                .iter()
                .any(|step| format!("{:?}", step.call) == *call)
        }
        AuctionPattern::ByRole { role: _, last_call } => {
            // Check if the last call in the log matches
            context
                .log
                .last()
                .map(|step| format!("{:?}", step.call) == *last_call)
                .unwrap_or(false)
        }
    }
}

/// Check a public guard against the context's negotiation state.
fn check_public_guard(
    guard: &crate::types::agreement::PublicGuard,
    context: &AuctionContext,
) -> bool {
    use crate::types::agreement::GuardOperator;

    // Extract field value from the current kernel/negotiation state
    let field_value = match guard.field.as_str() {
        "forcingState" => context
            .log
            .last()
            .map(|step| format!("{:?}", step.state_after.forcing)),
        "fitAgreed" => context
            .log
            .last()
            .and_then(|step| step.state_after.fit_agreed.as_ref())
            .map(|f| format!("{:?}", f)),
        _ => None,
    };

    match guard.operator {
        GuardOperator::Exists => field_value.is_some(),
        GuardOperator::Eq => match (&field_value, &guard.value) {
            (Some(actual), Some(crate::types::agreement::GuardValue::Scalar(expected))) => {
                actual == expected
            }
            _ => false,
        },
        GuardOperator::Neq => match (&field_value, &guard.value) {
            (Some(actual), Some(crate::types::agreement::GuardValue::Scalar(expected))) => {
                actual != expected
            }
            _ => true,
        },
        GuardOperator::In => match (&field_value, &guard.value) {
            (Some(actual), Some(crate::types::agreement::GuardValue::List(list))) => {
                list.contains(actual)
            }
            _ => false,
        },
    }
}

/// Collect matching claims using pre-computed local phases (no replay).
///
/// Used by buildObservationLogViaRules to avoid O(N²×M) replay cost.
pub fn collect_matching_claims_with_phases(
    modules: &[ConventionModule],
    context: &AuctionContext,
    next_seat: Option<Seat>,
    local_phases: &HashMap<String, String>,
) -> Vec<ModuleSurfaceResult> {
    let current_kernel = get_current_kernel(context);
    let turn_role = next_seat.map(|s| derive_turn_role(s, &context.log));
    let opener_seat = find_opener_seat(&context.log);

    let mut results = Vec::new();
    for module in modules {
        let current_phase = local_phases
            .get(&module.module_id)
            .cloned()
            .unwrap_or_else(|| module.local.initial.clone());
        let resolved = collect_module_surfaces(
            module,
            &current_phase,
            &current_kernel,
            context,
            turn_role,
            opener_seat,
        );

        if !resolved.is_empty() {
            results.push(ModuleSurfaceResult {
                module_id: module.module_id.clone(),
                resolved,
            });
        }
    }

    results
}

// ── Internal helpers ─────────────────────────────────────────────────

fn get_current_kernel(context: &AuctionContext) -> NegotiationState {
    context
        .log
        .last()
        .map(|step| step.state_after.clone())
        .unwrap_or_else(initial_negotiation)
}

fn find_opener_seat(log: &[CommittedStep]) -> Option<Seat> {
    for step in log {
        if !step.public_actions.is_empty() && step.status != CommittedStepStatus::RawOnly {
            return Some(step.actor);
        }
    }
    None
}

fn replay_local_fsm(module: &ConventionModule, context: &AuctionContext) -> String {
    let mut phase = module.local.initial.clone();
    for (i, step) in context.log.iter().enumerate() {
        phase = advance_local_fsm(&phase, step, &context.log[..i], &module.local.transitions);
    }
    phase
}

fn collect_module_surfaces(
    module: &ConventionModule,
    current_phase: &str,
    current_kernel: &NegotiationState,
    context: &AuctionContext,
    turn_role: Option<TurnRole>,
    opener_seat: Option<Seat>,
) -> Vec<ResolvedSurface> {
    let mut resolved = Vec::new();
    if let Some(ref states) = module.states {
        for entry in states {
            if !state_entry_matches(
                entry,
                current_phase,
                current_kernel,
                context,
                turn_role,
                opener_seat,
            ) {
                continue;
            }
            for surface in &entry.surfaces {
                resolved.push(ResolvedSurface {
                    surface: surface.clone(),
                    negotiation_delta: entry.negotiation_delta.clone(),
                });
            }
        }
    }
    resolved
}

fn state_entry_matches(
    entry: &StateEntry,
    current_phase: &str,
    current_kernel: &NegotiationState,
    context: &AuctionContext,
    turn_role: Option<TurnRole>,
    opener_seat: Option<Seat>,
) -> bool {
    // Turn check
    if let (Some(entry_turn), Some(role)) = (entry.turn, turn_role) {
        if entry_turn != role {
            return false;
        }
    }

    // Phase check
    match &entry.phase {
        PhaseRef::Single(phase) => {
            if phase != current_phase {
                return false;
            }
        }
        PhaseRef::Multiple(phases) => {
            if !phases.iter().any(|p| p == current_phase) {
                return false;
            }
        }
    }

    // Kernel check
    if let Some(ref kernel_expr) = entry.kernel {
        if !match_kernel(kernel_expr, current_kernel) {
            return false;
        }
    }

    // Route check
    if let Some(ref route_expr) = entry.route {
        if !match_route(route_expr, &context.log, opener_seat) {
            return false;
        }
    }

    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::bid_action::*;
    use crate::types::rule_types::*;

    #[test]
    fn derive_turn_role_opener() {
        let log = vec![CommittedStep {
            actor: Seat::South,
            call: bridge_engine::types::Call::Pass,
            resolved_claim: None,
            public_actions: vec![BidAction::Open {
                strain: BidSuitName::Notrump,
                strength: None,
            }],
            negotiation_delta: crate::types::negotiation::NegotiationDelta::default(),
            state_after: initial_negotiation(),
            status: CommittedStepStatus::Resolved,
        }];
        assert_eq!(derive_turn_role(Seat::South, &log), TurnRole::Opener);
        assert_eq!(derive_turn_role(Seat::North, &log), TurnRole::Responder);
        assert_eq!(derive_turn_role(Seat::East, &log), TurnRole::Opponent);
    }

    #[test]
    fn derive_turn_role_no_log() {
        assert_eq!(derive_turn_role(Seat::South, &[]), TurnRole::Opener);
    }
}
