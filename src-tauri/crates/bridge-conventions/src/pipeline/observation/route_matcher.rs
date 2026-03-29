//! Route matcher — evaluates RouteExpr patterns against a CommittedStep log.
//!
//! Mirrors TS from `pipeline/observation/route-matcher.ts`.

use bridge_engine::types::Seat;

use crate::pipeline::observation::committed_step::CommittedStep;
use crate::types::bid_action::{BidAction, BidSuitName};
use crate::types::rule_types::{ObsPattern, ObsPatternAct, RouteExpr, TurnRole};

/// Derive actor role from seat and opener seat.
fn derive_actor_role(actor: Seat, opener_seat: Seat) -> TurnRole {
    if actor == opener_seat {
        return TurnRole::Opener;
    }
    if actor == partner_seat(opener_seat) {
        return TurnRole::Responder;
    }
    TurnRole::Opponent
}

/// Get the partner seat.
fn partner_seat(seat: Seat) -> Seat {
    match seat {
        Seat::North => Seat::South,
        Seat::South => Seat::North,
        Seat::East => Seat::West,
        Seat::West => Seat::East,
    }
}

/// Match a single ObsPattern against a single BidAction.
pub fn match_obs(pattern: &ObsPattern, obs: &BidAction, actor_role: Option<TurnRole>) -> bool {
    // Actor check
    if let (Some(pat_actor), Some(role)) = (pattern.actor, actor_role) {
        if pat_actor != role {
            return false;
        }
    }

    // Act check
    match &pattern.act {
        ObsPatternAct::Specific(act) => {
            if act != obs.act() {
                return false;
            }
        }
        ObsPatternAct::Any => {}
    }

    // Feature check
    if let Some(ref pat_feature) = pattern.feature {
        match obs.feature() {
            Some(f) if f == pat_feature => {}
            _ => return false,
        }
    }

    // Suit check
    if let Some(ref pat_suit) = pattern.suit {
        match obs.suit() {
            Some(s) if s == pat_suit => {}
            _ => {
                // Also check targetSuit for transfers
                match obs.target_suit() {
                    Some(ts) if ts == pat_suit => {}
                    _ => return false,
                }
            }
        }
    }

    // Strain check
    if let Some(ref pat_strain) = pattern.strain {
        match obs.strain() {
            Some(s) if s == pat_strain => {}
            _ => {
                match obs.target_suit() {
                    Some(ts) if BidSuitName::from(*ts) == *pat_strain => {}
                    _ => return false,
                }
            }
        }
    }

    // Strength check
    if let Some(ref pat_strength) = pattern.strength {
        match obs.strength() {
            Some(s) if s == pat_strength => {}
            _ => return false,
        }
    }

    true
}

/// Match a RouteExpr against a CommittedStep log.
pub fn match_route(
    expr: &RouteExpr,
    log: &[CommittedStep],
    opener_seat: Option<Seat>,
) -> bool {
    match expr {
        RouteExpr::Last { pattern } => match_last(pattern, log, opener_seat),
        RouteExpr::Contains { pattern } => match_contains(pattern, log, opener_seat),
        RouteExpr::Subseq { steps } => match_subseq(steps, log, opener_seat),
        RouteExpr::And { exprs } => exprs.iter().all(|e| match_route(e, log, opener_seat)),
        RouteExpr::Or { exprs } => exprs.iter().any(|e| match_route(e, log, opener_seat)),
        RouteExpr::Not { expr } => !match_route(expr, log, opener_seat),
    }
}

/// Does any observation in a step match the pattern?
fn step_matches_obs(
    pattern: &ObsPattern,
    step: &CommittedStep,
    opener_seat: Option<Seat>,
) -> bool {
    let actor_role = opener_seat.map(|os| derive_actor_role(step.actor, os));
    step.public_actions
        .iter()
        .any(|obs| match_obs(pattern, obs, actor_role))
}

fn match_last(
    pattern: &ObsPattern,
    log: &[CommittedStep],
    opener_seat: Option<Seat>,
) -> bool {
    match log.last() {
        Some(step) => step_matches_obs(pattern, step, opener_seat),
        None => false,
    }
}

fn match_contains(
    pattern: &ObsPattern,
    log: &[CommittedStep],
    opener_seat: Option<Seat>,
) -> bool {
    log.iter().any(|step| step_matches_obs(pattern, step, opener_seat))
}

fn match_subseq(
    patterns: &[ObsPattern],
    log: &[CommittedStep],
    opener_seat: Option<Seat>,
) -> bool {
    if patterns.is_empty() {
        return true;
    }

    let mut pattern_idx = 0;
    for step in log {
        if step_matches_obs(&patterns[pattern_idx], step, opener_seat) {
            pattern_idx += 1;
            if pattern_idx == patterns.len() {
                return true;
            }
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::bid_action::*;

    fn make_step(actor: Seat, actions: Vec<BidAction>) -> CommittedStep {
        CommittedStep {
            actor,
            call: bridge_engine::types::Call::Pass,
            resolved_claim: None,
            public_actions: actions,
            negotiation_delta: crate::types::negotiation::NegotiationDelta::default(),
            state_after: crate::pipeline::observation::committed_step::initial_negotiation(),
            status: CommittedStepStatus::Resolved,
        }
    }

    use crate::pipeline::observation::committed_step::CommittedStepStatus;

    #[test]
    fn match_obs_basic_act() {
        let pattern = ObsPattern {
            act: ObsPatternAct::Specific(BidActionType::Open),
            feature: None,
            suit: None,
            strain: Some(BidSuitName::Notrump),
            strength: None,
            actor: None,
        };
        let obs = BidAction::Open {
            strain: BidSuitName::Notrump,
            strength: None,
        };
        assert!(match_obs(&pattern, &obs, None));
    }

    #[test]
    fn match_obs_any_act() {
        let pattern = ObsPattern {
            act: ObsPatternAct::Any,
            feature: None,
            suit: None,
            strain: None,
            strength: None,
            actor: None,
        };
        let obs = BidAction::Pass;
        assert!(match_obs(&pattern, &obs, None));
    }

    #[test]
    fn match_route_last() {
        let log = vec![
            make_step(Seat::South, vec![BidAction::Open { strain: BidSuitName::Notrump, strength: None }]),
            make_step(Seat::North, vec![BidAction::Inquire { feature: HandFeature::MajorSuit, suit: None }]),
        ];
        let expr = RouteExpr::Last {
            pattern: ObsPattern {
                act: ObsPatternAct::Specific(BidActionType::Inquire),
                feature: Some(HandFeature::MajorSuit),
                suit: None,
                strain: None,
                strength: None,
                actor: None,
            },
        };
        assert!(match_route(&expr, &log, None));
    }

    #[test]
    fn match_route_subseq() {
        let log = vec![
            make_step(Seat::South, vec![BidAction::Open { strain: BidSuitName::Notrump, strength: None }]),
            make_step(Seat::West, vec![BidAction::Pass]),
            make_step(Seat::North, vec![BidAction::Inquire { feature: HandFeature::MajorSuit, suit: None }]),
        ];
        let expr = RouteExpr::Subseq {
            steps: vec![
                ObsPattern {
                    act: ObsPatternAct::Specific(BidActionType::Open),
                    feature: None,
                    suit: None,
                    strain: Some(BidSuitName::Notrump),
                    strength: None,
                    actor: None,
                },
                ObsPattern {
                    act: ObsPatternAct::Specific(BidActionType::Inquire),
                    feature: Some(HandFeature::MajorSuit),
                    suit: None,
                    strain: None,
                    strength: None,
                    actor: None,
                },
            ],
        };
        assert!(match_route(&expr, &log, None));
    }
}
