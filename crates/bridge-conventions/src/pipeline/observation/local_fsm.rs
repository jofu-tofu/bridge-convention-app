//! Local FSM advancement — advances a module's local phase based on
//! observations in a CommittedStep.
//!
//! Mirrors TS from `pipeline/observation/local-fsm.ts`.

use crate::pipeline::observation::committed_step::CommittedStep;
use crate::pipeline::observation::route_matcher::match_obs;
use crate::types::rule_types::{PhaseRef, PhaseTransition};

/// Advance the local FSM given a CommittedStep.
///
/// Returns the new phase. If no transition matches, returns `current_phase`.
/// First matching transition wins.
///
/// Actor-agnostic by design: phase transitions fire on observation shape
/// regardless of who bid.
pub fn advance_local_fsm(
    current_phase: &str,
    step: &CommittedStep,
    transitions: &[PhaseTransition],
) -> String {
    for transition in transitions {
        if !matches_from(current_phase, &transition.from) {
            continue;
        }

        if step
            .public_actions
            .iter()
            .any(|obs| match_obs(&transition.on, obs, None))
        {
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
            },
        }];

        let step = make_step(vec![BidAction::Inquire {
            feature: HandFeature::MajorSuit,
            suit: None,
        }]);

        assert_eq!(advance_local_fsm("idle", &step, &transitions), "asked");
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
            },
        }];

        let step = make_step(vec![BidAction::Pass]);

        assert_eq!(advance_local_fsm("idle", &step, &transitions), "idle");
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
            },
        }];

        let step = make_step(vec![BidAction::Inquire {
            feature: HandFeature::MajorSuit,
            suit: None,
        }]);

        assert_eq!(
            advance_local_fsm("other-phase", &step, &transitions),
            "other-phase"
        );
    }
}
