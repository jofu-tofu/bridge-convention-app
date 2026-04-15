//! Local FSM advancement — advances a module's local phase based on
//! observations in a CommittedStep.
//!
//! Mirrors TS from `pipeline/observation/local-fsm.ts`.

use crate::pipeline::observation::committed_step::CommittedStep;
use crate::pipeline::observation::route_matcher::step_matches_obs;
use crate::types::rule_types::{PhaseRef, PhaseTransition};

/// Advance the local FSM given a CommittedStep.
///
/// Returns the new phase. If no transition matches, returns `current_phase`.
/// First matching transition wins.
///
/// Actor-agnostic by default: phase transitions fire on observation shape
/// regardless of who bid. Transitions whose `on` pattern specifies `level`
/// or `jump` additionally require the containing step's `Call::Bid` to
/// satisfy those constraints; this is how e.g. 2M `accept` (non-jump) and
/// 3M `super-accept` (jump / level=3) are distinguished as distinct FSM
/// edges despite sharing `act=accept`.
///
/// `prior_log` is the committed-step slice preceding `step` — needed for
/// jump detection against the minimum legal level.
pub fn advance_local_fsm(
    current_phase: &str,
    step: &CommittedStep,
    prior_log: &[CommittedStep],
    transitions: &[PhaseTransition],
) -> String {
    for transition in transitions {
        if !matches_from(current_phase, &transition.from) {
            continue;
        }

        if step_matches_obs(&transition.on, step, prior_log, None) {
            return transition.to.clone();
        }
    }

    current_phase.to_string()
}

fn matches_from(current: &str, from: &PhaseRef) -> bool {
    match from {
        PhaseRef::Single(phase) => current == phase,
        PhaseRef::Multiple(phases) => phases.iter().any(|p| p == current),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::bid_action::*;
    use crate::types::rule_types::*;

    fn make_step(actions: Vec<BidAction>) -> CommittedStep {
        CommittedStep {
            actor: bridge_engine::types::Seat::South,
            call: bridge_engine::types::Call::Pass,
            resolved_claim: None,
            public_actions: actions,
            negotiation_delta: crate::types::negotiation::NegotiationDelta::default(),
            state_after: crate::pipeline::observation::committed_step::initial_negotiation(),
            status: crate::pipeline::observation::committed_step::CommittedStepStatus::Resolved,
        }
    }

    #[test]
    fn advance_on_match() {
        let transitions = vec![PhaseTransition {
            from: PhaseRef::Single("idle".into()),
            to: "asked".into(),
            on: ObsPattern {
                act: ObsPatternAct::Specific(BidActionType::Inquire),
                feature: Some(HandFeature::MajorSuit),
                suit: None,
                strain: None,
                strength: None,
                actor: None,
                level: None,
                jump: None,
            },
        }];

        let step = make_step(vec![BidAction::Inquire {
            feature: HandFeature::MajorSuit,
            suit: None,
        }]);

        assert_eq!(advance_local_fsm("idle", &step, &[], &transitions), "asked");
    }

    #[test]
    fn no_match_stays() {
        let transitions = vec![PhaseTransition {
            from: PhaseRef::Single("idle".into()),
            to: "asked".into(),
            on: ObsPattern {
                act: ObsPatternAct::Specific(BidActionType::Inquire),
                feature: Some(HandFeature::MajorSuit),
                suit: None,
                strain: None,
                strength: None,
                actor: None,
                level: None,
                jump: None,
            },
        }];

        let step = make_step(vec![BidAction::Pass]);

        assert_eq!(advance_local_fsm("idle", &step, &[], &transitions), "idle");
    }

    #[test]
    fn wrong_phase_no_advance() {
        let transitions = vec![PhaseTransition {
            from: PhaseRef::Single("idle".into()),
            to: "asked".into(),
            on: ObsPattern {
                act: ObsPatternAct::Specific(BidActionType::Inquire),
                feature: Some(HandFeature::MajorSuit),
                suit: None,
                strain: None,
                strength: None,
                actor: None,
                level: None,
                jump: None,
            },
        }];

        let step = make_step(vec![BidAction::Inquire {
            feature: HandFeature::MajorSuit,
            suit: None,
        }]);

        assert_eq!(
            advance_local_fsm("other-phase", &step, &[], &transitions),
            "other-phase"
        );
    }

    #[test]
    fn level_gated_transition_distinguishes_accept_vs_super_accept() {
        use bridge_engine::types::{BidSuit, Call, Seat};
        // Two transitions out of `transferred-hearts`:
        //  - `accept` at level 2 → accepted-hearts
        //  - `accept` at level 3 → super-accepted-hearts
        let transitions = vec![
            PhaseTransition {
                from: PhaseRef::Single("transferred-hearts".into()),
                to: "super-accepted-hearts".into(),
                on: ObsPattern {
                    act: ObsPatternAct::Specific(BidActionType::Accept),
                    feature: Some(HandFeature::HeldSuit),
                    suit: Some(ObsSuit::Hearts),
                    strain: None,
                    strength: None,
                    actor: None,
                    level: Some(3),
                    jump: None,
                },
            },
            PhaseTransition {
                from: PhaseRef::Single("transferred-hearts".into()),
                to: "accepted-hearts".into(),
                on: ObsPattern {
                    act: ObsPatternAct::Specific(BidActionType::Accept),
                    feature: Some(HandFeature::HeldSuit),
                    suit: Some(ObsSuit::Hearts),
                    strain: None,
                    strength: None,
                    actor: None,
                    level: Some(2),
                    jump: None,
                },
            },
        ];

        fn bid_accept_step(level: u8) -> CommittedStep {
            CommittedStep {
                actor: Seat::South,
                call: Call::Bid {
                    level,
                    strain: BidSuit::Hearts,
                },
                resolved_claim: None,
                public_actions: vec![BidAction::Accept {
                    feature: HandFeature::HeldSuit,
                    suit: Some(ObsSuit::Hearts),
                    strength: None,
                }],
                negotiation_delta: crate::types::negotiation::NegotiationDelta::default(),
                state_after: crate::pipeline::observation::committed_step::initial_negotiation(),
                status: crate::pipeline::observation::committed_step::CommittedStepStatus::Resolved,
            }
        }

        let two_h = bid_accept_step(2);
        let three_h = bid_accept_step(3);

        assert_eq!(
            advance_local_fsm("transferred-hearts", &two_h, &[], &transitions),
            "accepted-hearts"
        );
        assert_eq!(
            advance_local_fsm("transferred-hearts", &three_h, &[], &transitions),
            "super-accepted-hearts"
        );
    }

    #[test]
    fn untagged_level_is_backwards_compatible() {
        // A transition without `level` / `jump` should match any level — preserving
        // existing fixture behavior.
        let transitions = vec![PhaseTransition {
            from: PhaseRef::Single("idle".into()),
            to: "asked".into(),
            on: ObsPattern {
                act: ObsPatternAct::Specific(BidActionType::Inquire),
                feature: Some(HandFeature::MajorSuit),
                suit: None,
                strain: None,
                strength: None,
                actor: None,
                level: None,
                jump: None,
            },
        }];
        let step = make_step(vec![BidAction::Inquire {
            feature: HandFeature::MajorSuit,
            suit: None,
        }]);
        assert_eq!(
            advance_local_fsm("idle", &step, &[], &transitions),
            "asked"
        );
    }
}
