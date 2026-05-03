//! Route matcher — evaluates RouteExpr patterns against a CommittedStep log.
//!
//! Mirrors TS from `pipeline/observation/route-matcher.ts`.
//!
//! # Duplicate-phase disambiguation contract
//!
//! Multiple `StateEntry`s in a module may share the same `phase` string
//! (e.g. DONT's three `after-2x-dbl` states, negative-doubles's several
//! `after-oc-1c` states). When more than one state shares a phase, the
//! `rule_interpreter` runs `state_entry_matches` for each candidate and
//! collects surfaces from **every** state whose full predicate matches;
//! final selection happens in the arbitrator, not here.
//!
//! A state's full predicate is `phase AND turn AND kernel AND route`.
//! For same-phase states to behave deterministically, authors MUST make
//! the conjunction of `turn`, `kernel`, and `route` either:
//!
//! 1. **Mutually exclusive**, so at most one state matches a given
//!    auction position (e.g. negative-doubles distinguishes `after-oc-1c`
//!    states by `route.pattern.suit` + `.level` of the overcall); or
//!
//! 2. **Intentionally overlapping**, so multiple states all contribute
//!    surfaces that will be disambiguated later by clause evaluation and
//!    arbitration (e.g. jacoby-transfers' two `accepted-hearts` /
//!    turn=responder states split surfaces for rendering but expose
//!    disjoint clauses so arbitration always picks the intended one).
//!
//! Note that FSM phase transitions (`local_fsm::advance_local_fsm`) call
//! `step_matches_obs` with `opener_seat = None`, which means the
//! `ObsPattern.actor` field is IGNORED for FSM transitions (it is
//! honored by `match_route` during state evaluation, because
//! `state_entry_matches` threads the real opener seat through).
//! Authors relying on actor-gated transitions must instead gate via
//! level/jump/strain on the observation, or by splitting the `from`
//! phase upstream.

use bridge_engine::partner_seat;
use bridge_engine::types::{BidSuit, Call, Seat};

use crate::pipeline::observation::committed_step::CommittedStep;
use crate::types::bid_action::{BidAction, BidSuitName};
use crate::types::rule_types::{ObsPattern, ObsPatternAct, RouteExpr, TurnRole};

/// Match a single ObsPattern against a single BidAction.
///
/// Note: this function evaluates obs-level fields only (act/feature/suit/
/// strain/strength/actor). The `level` and `jump` fields require containing-
/// step + prior-log context and are enforced by `step_matches_obs`. Callers
/// that invoke `match_obs` directly will not enforce level/jump; FSM-style
/// consumers should use `step_matches_obs` instead.
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
            _ => match obs.target_suit() {
                Some(ts) if BidSuitName::from(*ts) == *pat_strain => {}
                _ => return false,
            },
        }
    } else if let Some(class) = pattern.suit_class {
        // suit_class only applies when strain is unset (strain wins). For an
        // observation, strain wins also when target_suit (transfer) is present.
        let strain_match = obs
            .strain()
            .map(|s| class.matches_strain(s))
            .or_else(|| obs.target_suit().map(|ts| class.matches_strain(&BidSuitName::from(*ts))))
            .unwrap_or(false);
        if !strain_match {
            return false;
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
pub fn match_route(expr: &RouteExpr, log: &[CommittedStep], opener_seat: Option<Seat>) -> bool {
    match expr {
        RouteExpr::Last { pattern } => match_last(pattern, log, opener_seat),
        RouteExpr::Contains { pattern } => match_contains(pattern, log, opener_seat),
        RouteExpr::Subseq { steps } => match_subseq(steps, log, opener_seat),
        RouteExpr::And { exprs } => exprs.iter().all(|e| match_route(e, log, opener_seat)),
        RouteExpr::Or { exprs } => exprs.iter().any(|e| match_route(e, log, opener_seat)),
        RouteExpr::Not { expr } => !match_route(expr, log, opener_seat),
    }
}

/// Bid-suit rank for comparing bids (matches BidSuit declaration order).
fn bid_suit_rank(s: BidSuit) -> u8 {
    match s {
        BidSuit::Clubs => 0,
        BidSuit::Diamonds => 1,
        BidSuit::Hearts => 2,
        BidSuit::Spades => 3,
        BidSuit::NoTrump => 4,
    }
}

/// Minimum legal bid level for `strain` given `prior_log` — i.e. smallest
/// level `L` such that (L, strain) strictly exceeds all prior `Call::Bid`s.
/// Returns 1 if no prior bids constrain the strain.
fn min_legal_level_for(strain: BidSuit, prior_log: &[CommittedStep]) -> u8 {
    let target_rank = bid_suit_rank(strain);
    let mut min_level = 1u8;
    for step in prior_log {
        if let Call::Bid { level, strain: s } = step.call {
            let s_rank = bid_suit_rank(s);
            // A new bid (L', strain) is legal iff L' > level OR (L' == level AND
            // target_rank > s_rank). Minimum legal level w.r.t. this prior bid:
            let candidate = if target_rank > s_rank {
                level
            } else {
                level + 1
            };
            if candidate > min_level {
                min_level = candidate;
            }
        }
    }
    min_level
}

/// Check level/jump constraints from a pattern against the containing step.
/// `prior_log` is the log slice preceding `step`.
fn check_level_jump(
    pattern: &ObsPattern,
    step: &CommittedStep,
    prior_log: &[CommittedStep],
) -> bool {
    if pattern.level.is_none() && pattern.jump.is_none() {
        return true;
    }
    let (call_level, call_strain) = match step.call {
        Call::Bid { level, strain } => (level, strain),
        _ => return false, // Pass/Double/Redouble never match when level or jump set.
    };
    if let Some(expected) = pattern.level {
        if call_level != expected {
            return false;
        }
    }
    if let Some(expected_jump) = pattern.jump {
        let min_level = min_legal_level_for(call_strain, prior_log);
        let is_jump = call_level > min_level;
        if is_jump != expected_jump {
            return false;
        }
    }
    true
}

/// Does any observation in a step match the pattern?
///
/// Public so that FSM-style consumers (e.g. `local_fsm::advance_local_fsm`)
/// can honor level/jump enforcement the same way `match_route` does.
pub fn step_matches_obs(
    pattern: &ObsPattern,
    step: &CommittedStep,
    prior_log: &[CommittedStep],
    opener_seat: Option<Seat>,
) -> bool {
    if !check_level_jump(pattern, step, prior_log) {
        return false;
    }
    let actor_role = opener_seat.map(|os| {
        if step.actor == os {
            TurnRole::Opener
        } else if step.actor == partner_seat(os) {
            TurnRole::Responder
        } else {
            TurnRole::Opponent
        }
    });
    step.public_actions
        .iter()
        .any(|obs| match_obs(pattern, obs, actor_role))
}

fn match_last(pattern: &ObsPattern, log: &[CommittedStep], opener_seat: Option<Seat>) -> bool {
    match log.split_last() {
        Some((step, prior)) => step_matches_obs(pattern, step, prior, opener_seat),
        None => false,
    }
}

fn match_contains(pattern: &ObsPattern, log: &[CommittedStep], opener_seat: Option<Seat>) -> bool {
    log.iter()
        .enumerate()
        .any(|(i, step)| step_matches_obs(pattern, step, &log[..i], opener_seat))
}

fn match_subseq(patterns: &[ObsPattern], log: &[CommittedStep], opener_seat: Option<Seat>) -> bool {
    if patterns.is_empty() {
        return true;
    }

    let mut pattern_idx = 0;
    for (i, step) in log.iter().enumerate() {
        if step_matches_obs(&patterns[pattern_idx], step, &log[..i], opener_seat) {
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
            suit_class: None,
            strength: None,
            actor: None,
            level: None,
            jump: None,
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
            suit_class: None,
            strength: None,
            actor: None,
            level: None,
            jump: None,
        };
        let obs = BidAction::Pass;
        assert!(match_obs(&pattern, &obs, None));
    }

    #[test]
    fn match_route_last() {
        let log = vec![
            make_step(
                Seat::South,
                vec![BidAction::Open {
                    strain: BidSuitName::Notrump,
                    strength: None,
                }],
            ),
            make_step(
                Seat::North,
                vec![BidAction::Inquire {
                    feature: HandFeature::MajorSuit,
                    suit: None,
                }],
            ),
        ];
        let expr = RouteExpr::Last {
            pattern: ObsPattern {
                act: ObsPatternAct::Specific(BidActionType::Inquire),
                feature: Some(HandFeature::MajorSuit),
                suit: None,
                strain: None,
                suit_class: None,
                strength: None,
                actor: None,
                level: None,
                jump: None,
            },
        };
        assert!(match_route(&expr, &log, None));
    }

    #[test]
    fn match_route_subseq() {
        let log = vec![
            make_step(
                Seat::South,
                vec![BidAction::Open {
                    strain: BidSuitName::Notrump,
                    strength: None,
                }],
            ),
            make_step(Seat::West, vec![BidAction::Pass]),
            make_step(
                Seat::North,
                vec![BidAction::Inquire {
                    feature: HandFeature::MajorSuit,
                    suit: None,
                }],
            ),
        ];
        let expr = RouteExpr::Subseq {
            steps: vec![
                ObsPattern {
                    act: ObsPatternAct::Specific(BidActionType::Open),
                    feature: None,
                    suit: None,
                    strain: Some(BidSuitName::Notrump),
                    suit_class: None,
                    strength: None,
                    actor: None,
                    level: None,
                    jump: None,
                },
                ObsPattern {
                    act: ObsPatternAct::Specific(BidActionType::Inquire),
                    feature: Some(HandFeature::MajorSuit),
                    suit: None,
                    strain: None,
                    suit_class: None,
                    strength: None,
                    actor: None,
                    level: None,
                    jump: None,
                },
            ],
        };
        assert!(match_route(&expr, &log, None));
    }

    // --- level / jump matcher tests ---

    fn make_bid_step(
        actor: Seat,
        level: u8,
        strain: BidSuit,
        actions: Vec<BidAction>,
    ) -> CommittedStep {
        CommittedStep {
            actor,
            call: bridge_engine::types::Call::Bid { level, strain },
            resolved_claim: None,
            public_actions: actions,
            negotiation_delta: crate::types::negotiation::NegotiationDelta::default(),
            state_after: crate::pipeline::observation::committed_step::initial_negotiation(),
            status: CommittedStepStatus::Resolved,
        }
    }

    fn overcall_hearts_pattern(level: Option<u8>, jump: Option<bool>) -> ObsPattern {
        ObsPattern {
            act: ObsPatternAct::Specific(BidActionType::Overcall),
            feature: None,
            suit: Some(ObsSuit::Hearts),
            strain: None,
            suit_class: None,
            strength: None,
            actor: None,
            level,
            jump,
        }
    }

    #[test]
    fn level_none_matches_any_level() {
        // Backward compat: omitting level should match regardless of bid level.
        let log = vec![
            make_bid_step(
                Seat::South,
                1,
                BidSuit::Clubs,
                vec![BidAction::Open {
                    strain: BidSuitName::Clubs,
                    strength: None,
                }],
            ),
            make_bid_step(
                Seat::West,
                2,
                BidSuit::Hearts,
                vec![BidAction::Overcall {
                    feature: HandFeature::HeldSuit,
                    suit: Some(ObsSuit::Hearts),
                }],
            ),
        ];
        let expr = RouteExpr::Last {
            pattern: overcall_hearts_pattern(None, None),
        };
        assert!(match_route(&expr, &log, None));
    }

    #[test]
    fn level_exact_match_distinguishes_1h_vs_2h() {
        let log_1h = vec![make_bid_step(
            Seat::West,
            1,
            BidSuit::Hearts,
            vec![BidAction::Overcall {
                feature: HandFeature::HeldSuit,
                suit: Some(ObsSuit::Hearts),
            }],
        )];
        let log_2h = vec![
            make_bid_step(
                Seat::South,
                1,
                BidSuit::Clubs,
                vec![BidAction::Open {
                    strain: BidSuitName::Clubs,
                    strength: None,
                }],
            ),
            make_bid_step(
                Seat::West,
                2,
                BidSuit::Hearts,
                vec![BidAction::Overcall {
                    feature: HandFeature::HeldSuit,
                    suit: Some(ObsSuit::Hearts),
                }],
            ),
        ];
        let expr_1h = RouteExpr::Last {
            pattern: overcall_hearts_pattern(Some(1), None),
        };
        let expr_2h = RouteExpr::Last {
            pattern: overcall_hearts_pattern(Some(2), None),
        };
        assert!(match_route(&expr_1h, &log_1h, None));
        assert!(!match_route(&expr_1h, &log_2h, None));
        assert!(match_route(&expr_2h, &log_2h, None));
        assert!(!match_route(&expr_2h, &log_1h, None));
    }

    #[test]
    fn jump_true_requires_level_above_minimum_legal() {
        // After 1C-1S, a 3H bid is a jump (minimum legal for hearts is 2H).
        let jump_log = vec![
            make_bid_step(
                Seat::South,
                1,
                BidSuit::Clubs,
                vec![BidAction::Open {
                    strain: BidSuitName::Clubs,
                    strength: None,
                }],
            ),
            make_bid_step(
                Seat::West,
                1,
                BidSuit::Spades,
                vec![BidAction::Overcall {
                    feature: HandFeature::HeldSuit,
                    suit: Some(ObsSuit::Spades),
                }],
            ),
            make_bid_step(
                Seat::North,
                3,
                BidSuit::Hearts,
                vec![BidAction::Overcall {
                    feature: HandFeature::HeldSuit,
                    suit: Some(ObsSuit::Hearts),
                }],
            ),
        ];
        // Non-jump log: 1C-1S-2H (2H is minimum legal for hearts).
        let non_jump_log = vec![
            make_bid_step(
                Seat::South,
                1,
                BidSuit::Clubs,
                vec![BidAction::Open {
                    strain: BidSuitName::Clubs,
                    strength: None,
                }],
            ),
            make_bid_step(
                Seat::West,
                1,
                BidSuit::Spades,
                vec![BidAction::Overcall {
                    feature: HandFeature::HeldSuit,
                    suit: Some(ObsSuit::Spades),
                }],
            ),
            make_bid_step(
                Seat::North,
                2,
                BidSuit::Hearts,
                vec![BidAction::Overcall {
                    feature: HandFeature::HeldSuit,
                    suit: Some(ObsSuit::Hearts),
                }],
            ),
        ];
        let jump_expr = RouteExpr::Last {
            pattern: overcall_hearts_pattern(None, Some(true)),
        };
        let non_jump_expr = RouteExpr::Last {
            pattern: overcall_hearts_pattern(None, Some(false)),
        };
        assert!(match_route(&jump_expr, &jump_log, None));
        assert!(!match_route(&jump_expr, &non_jump_log, None));
        assert!(match_route(&non_jump_expr, &non_jump_log, None));
        assert!(!match_route(&non_jump_expr, &jump_log, None));
    }

    #[test]
    fn level_and_jump_require_bid_call() {
        // A Pass/Double step should never match when level or jump is Some.
        let log = vec![CommittedStep {
            actor: Seat::West,
            call: bridge_engine::types::Call::Pass,
            resolved_claim: None,
            public_actions: vec![BidAction::Pass],
            negotiation_delta: crate::types::negotiation::NegotiationDelta::default(),
            state_after: crate::pipeline::observation::committed_step::initial_negotiation(),
            status: CommittedStepStatus::Resolved,
        }];
        let expr = RouteExpr::Last {
            pattern: ObsPattern {
                act: ObsPatternAct::Specific(BidActionType::Pass),
                feature: None,
                suit: None,
                strain: None,
                suit_class: None,
                strength: None,
                actor: None,
                level: Some(1),
                jump: None,
            },
        };
        assert!(!match_route(&expr, &log, None));
    }

    #[test]
    fn obs_pattern_level_jump_serde_roundtrip() {
        let p = overcall_hearts_pattern(Some(2), Some(true));
        let json = serde_json::to_string(&p).unwrap();
        assert!(json.contains("\"level\":2"));
        assert!(json.contains("\"jump\":true"));
        let back: ObsPattern = serde_json::from_str(&json).unwrap();
        assert_eq!(back, p);
    }

    /// Regression: documents the same-phase disambiguation contract used by
    /// negative-doubles / DONT. Two state entries share a phase but carry
    /// different `route` patterns — `match_route` must select exactly the
    /// matching one against the auction tail.
    ///
    /// Models the negative-doubles shape: after 1C opening + a 1-level
    /// overcall, the fixture has separate states for overcall-diamonds,
    /// overcall-hearts, overcall-spades. Only the one whose `route` matches
    /// the actual overcall should accept its surfaces.
    #[test]
    fn route_last_disambiguates_same_phase_states_by_overcall_suit() {
        // Auction: 1C (South) - 1H (West)
        let log_1h = vec![
            make_bid_step(
                Seat::South,
                1,
                BidSuit::Clubs,
                vec![BidAction::Open {
                    strain: BidSuitName::Clubs,
                    strength: None,
                }],
            ),
            make_bid_step(
                Seat::West,
                1,
                BidSuit::Hearts,
                vec![BidAction::Overcall {
                    feature: HandFeature::HeldSuit,
                    suit: Some(ObsSuit::Hearts),
                }],
            ),
        ];

        let overcall_diamonds_route = RouteExpr::Last {
            pattern: ObsPattern {
                act: ObsPatternAct::Specific(BidActionType::Overcall),
                feature: None,
                suit: Some(ObsSuit::Diamonds),
                strain: None,
                suit_class: None,
                strength: None,
                actor: None,
                level: Some(1),
                jump: None,
            },
        };
        let overcall_hearts_route = RouteExpr::Last {
            pattern: ObsPattern {
                act: ObsPatternAct::Specific(BidActionType::Overcall),
                feature: None,
                suit: Some(ObsSuit::Hearts),
                strain: None,
                suit_class: None,
                strength: None,
                actor: None,
                level: Some(1),
                jump: None,
            },
        };
        let overcall_spades_route = RouteExpr::Last {
            pattern: ObsPattern {
                act: ObsPatternAct::Specific(BidActionType::Overcall),
                feature: None,
                suit: Some(ObsSuit::Spades),
                strain: None,
                suit_class: None,
                strength: None,
                actor: None,
                level: Some(1),
                jump: None,
            },
        };

        // Exactly one of the three same-phase routes matches the auction tail.
        assert!(!match_route(&overcall_diamonds_route, &log_1h, None));
        assert!(match_route(&overcall_hearts_route, &log_1h, None));
        assert!(!match_route(&overcall_spades_route, &log_1h, None));
    }

    #[test]
    fn obs_pattern_omitted_level_jump_deserializes_as_none() {
        // Existing fixture shape — no level/jump keys.
        let json = r#"{"act":"overcall","suit":"hearts"}"#;
        let p: ObsPattern = serde_json::from_str(json).unwrap();
        assert_eq!(p.level, None);
        assert_eq!(p.jump, None);
        // And re-serializing should not emit those keys.
        let back = serde_json::to_string(&p).unwrap();
        assert!(!back.contains("level"));
        assert!(!back.contains("jump"));
    }
}
