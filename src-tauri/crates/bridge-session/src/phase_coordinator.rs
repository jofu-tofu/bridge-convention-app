//! Phase coordinator — stateless phase transition decisions.
//!
//! Maps (currentPhase, event) -> TransitionDescriptor for store consumption.
//! Ported from `src/session/phase-coordinator.ts`.

use bridge_engine::Seat;
use serde::{Deserialize, Serialize};

use crate::types::{GamePhase, PlayPreference};

// ── Event types ────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PhaseEvent {
    AuctionComplete {
        #[serde(rename = "servicePhase")]
        service_phase: GamePhase,
    },
    PromptEntered {
        #[serde(rename = "playPreference")]
        play_preference: PlayPreference,
    },
    AcceptPlay {
        #[serde(skip_serializing_if = "Option::is_none")]
        seat: Option<Seat>,
    },
    DeclinePlay,
    SkipToReview,
    PlayComplete,
    PlayThisHand {
        seat: Seat,
    },
    RestartPlay,
}

// ── Service action descriptors ─────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ServiceAction {
    AcceptPrompt {
        mode: PromptActionMode,
        #[serde(skip_serializing_if = "Option::is_none")]
        seat: Option<Seat>,
    },
    SkipToReview,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PromptActionMode {
    Play,
    Skip,
    Replay,
    Restart,
}

// ── Viewport identifiers ───────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ViewportNeeded {
    Bidding,
    DeclarerPrompt,
    Playing,
    Explanation,
}

// ── Transition descriptor ──────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransitionDescriptor {
    pub target_phase: Option<GamePhase>,
    pub viewports_needed: Vec<ViewportNeeded>,
    pub trigger_dds: bool,
    pub capture_inferences: bool,
    pub service_actions: Vec<ServiceAction>,
    pub reset_play: bool,
    pub chained_event: Option<PhaseEvent>,
}

impl TransitionDescriptor {
    fn no_transition() -> Self {
        Self {
            target_phase: None,
            viewports_needed: Vec::new(),
            trigger_dds: false,
            capture_inferences: false,
            service_actions: Vec::new(),
            reset_play: false,
            chained_event: None,
        }
    }
}

// ── Coordinator entry point ────────────────────────────────────────

pub fn resolve_transition(current_phase: GamePhase, event: &PhaseEvent) -> TransitionDescriptor {
    match event {
        PhaseEvent::AuctionComplete { service_phase } => resolve_auction_complete(*service_phase),
        PhaseEvent::PromptEntered { play_preference } => resolve_prompt_entered(*play_preference),
        PhaseEvent::AcceptPlay { seat } => {
            if current_phase != GamePhase::DeclarerPrompt {
                return TransitionDescriptor::no_transition();
            }
            resolve_accept_play(*seat)
        }
        PhaseEvent::DeclinePlay => {
            if current_phase != GamePhase::DeclarerPrompt {
                return TransitionDescriptor::no_transition();
            }
            resolve_decline_play()
        }
        PhaseEvent::SkipToReview => {
            if current_phase != GamePhase::Playing {
                return TransitionDescriptor::no_transition();
            }
            resolve_skip_to_review()
        }
        PhaseEvent::PlayComplete => {
            if current_phase != GamePhase::Playing {
                return TransitionDescriptor::no_transition();
            }
            resolve_play_complete()
        }
        PhaseEvent::PlayThisHand { seat } => {
            if current_phase != GamePhase::Explanation {
                return TransitionDescriptor::no_transition();
            }
            resolve_play_this_hand(*seat)
        }
        PhaseEvent::RestartPlay => {
            if current_phase != GamePhase::Playing {
                return TransitionDescriptor::no_transition();
            }
            resolve_restart_play()
        }
    }
}

// ── Event resolvers ────────────────────────────────────────────────

fn resolve_auction_complete(service_phase: GamePhase) -> TransitionDescriptor {
    match service_phase {
        GamePhase::DeclarerPrompt => TransitionDescriptor {
            capture_inferences: true,
            target_phase: Some(GamePhase::DeclarerPrompt),
            viewports_needed: vec![ViewportNeeded::DeclarerPrompt],
            ..TransitionDescriptor::no_transition()
        },
        GamePhase::Playing => TransitionDescriptor {
            capture_inferences: true,
            target_phase: Some(GamePhase::Playing),
            viewports_needed: vec![ViewportNeeded::Playing],
            reset_play: true,
            ..TransitionDescriptor::no_transition()
        },
        GamePhase::Explanation => TransitionDescriptor {
            capture_inferences: true,
            target_phase: Some(GamePhase::Explanation),
            viewports_needed: vec![ViewportNeeded::Explanation],
            trigger_dds: true,
            ..TransitionDescriptor::no_transition()
        },
        _ => TransitionDescriptor::no_transition(),
    }
}

fn resolve_prompt_entered(play_preference: PlayPreference) -> TransitionDescriptor {
    match play_preference {
        PlayPreference::Always => TransitionDescriptor {
            chained_event: Some(PhaseEvent::AcceptPlay { seat: None }),
            ..TransitionDescriptor::no_transition()
        },
        PlayPreference::Skip => TransitionDescriptor {
            chained_event: Some(PhaseEvent::DeclinePlay),
            ..TransitionDescriptor::no_transition()
        },
        PlayPreference::Prompt => TransitionDescriptor::no_transition(),
    }
}

fn resolve_accept_play(seat: Option<Seat>) -> TransitionDescriptor {
    TransitionDescriptor {
        target_phase: Some(GamePhase::Playing),
        viewports_needed: vec![ViewportNeeded::Playing],
        trigger_dds: false,
        capture_inferences: false,
        service_actions: vec![ServiceAction::AcceptPrompt {
            mode: PromptActionMode::Play,
            seat,
        }],
        reset_play: true,
        chained_event: None,
    }
}

fn resolve_decline_play() -> TransitionDescriptor {
    TransitionDescriptor {
        target_phase: Some(GamePhase::Explanation),
        viewports_needed: vec![ViewportNeeded::Explanation],
        trigger_dds: true,
        capture_inferences: false,
        service_actions: vec![ServiceAction::AcceptPrompt {
            mode: PromptActionMode::Skip,
            seat: None,
        }],
        reset_play: false,
        chained_event: None,
    }
}

fn resolve_skip_to_review() -> TransitionDescriptor {
    TransitionDescriptor {
        target_phase: Some(GamePhase::Explanation),
        viewports_needed: vec![ViewportNeeded::Explanation],
        trigger_dds: true,
        capture_inferences: false,
        service_actions: vec![ServiceAction::SkipToReview],
        reset_play: false,
        chained_event: None,
    }
}

fn resolve_play_complete() -> TransitionDescriptor {
    TransitionDescriptor {
        target_phase: Some(GamePhase::Explanation),
        viewports_needed: vec![ViewportNeeded::Explanation],
        trigger_dds: true,
        capture_inferences: false,
        service_actions: Vec::new(),
        reset_play: false,
        chained_event: None,
    }
}

fn resolve_play_this_hand(seat: Seat) -> TransitionDescriptor {
    TransitionDescriptor {
        target_phase: Some(GamePhase::Playing),
        viewports_needed: vec![ViewportNeeded::Playing],
        trigger_dds: false,
        capture_inferences: false,
        service_actions: vec![
            ServiceAction::AcceptPrompt {
                mode: PromptActionMode::Replay,
                seat: None,
            },
            ServiceAction::AcceptPrompt {
                mode: PromptActionMode::Play,
                seat: Some(seat),
            },
        ],
        reset_play: true,
        chained_event: None,
    }
}

fn resolve_restart_play() -> TransitionDescriptor {
    TransitionDescriptor {
        target_phase: None,
        viewports_needed: vec![ViewportNeeded::Playing],
        trigger_dds: false,
        capture_inferences: false,
        service_actions: vec![ServiceAction::AcceptPrompt {
            mode: PromptActionMode::Restart,
            seat: None,
        }],
        reset_play: true,
        chained_event: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn auction_complete_to_declarer_prompt() {
        let td = resolve_transition(
            GamePhase::Bidding,
            &PhaseEvent::AuctionComplete {
                service_phase: GamePhase::DeclarerPrompt,
            },
        );
        assert_eq!(td.target_phase, Some(GamePhase::DeclarerPrompt));
        assert!(td.capture_inferences);
        assert_eq!(td.viewports_needed, vec![ViewportNeeded::DeclarerPrompt]);
        assert!(!td.trigger_dds);
        assert!(!td.reset_play);
    }

    #[test]
    fn auction_complete_to_playing() {
        let td = resolve_transition(
            GamePhase::Bidding,
            &PhaseEvent::AuctionComplete {
                service_phase: GamePhase::Playing,
            },
        );
        assert_eq!(td.target_phase, Some(GamePhase::Playing));
        assert!(td.capture_inferences);
        assert!(td.reset_play);
        assert!(!td.trigger_dds);
    }

    #[test]
    fn auction_complete_to_explanation() {
        let td = resolve_transition(
            GamePhase::Bidding,
            &PhaseEvent::AuctionComplete {
                service_phase: GamePhase::Explanation,
            },
        );
        assert_eq!(td.target_phase, Some(GamePhase::Explanation));
        assert!(td.capture_inferences);
        assert!(td.trigger_dds);
        assert!(!td.reset_play);
    }

    #[test]
    fn auction_complete_to_bidding_is_no_op() {
        let td = resolve_transition(
            GamePhase::Bidding,
            &PhaseEvent::AuctionComplete {
                service_phase: GamePhase::Bidding,
            },
        );
        assert_eq!(td.target_phase, None);
    }

    #[test]
    fn prompt_entered_always_chains_accept() {
        let td = resolve_transition(
            GamePhase::DeclarerPrompt,
            &PhaseEvent::PromptEntered {
                play_preference: PlayPreference::Always,
            },
        );
        assert_eq!(
            td.chained_event,
            Some(PhaseEvent::AcceptPlay { seat: None })
        );
        assert_eq!(td.target_phase, None);
    }

    #[test]
    fn prompt_entered_skip_chains_decline() {
        let td = resolve_transition(
            GamePhase::DeclarerPrompt,
            &PhaseEvent::PromptEntered {
                play_preference: PlayPreference::Skip,
            },
        );
        assert_eq!(td.chained_event, Some(PhaseEvent::DeclinePlay));
    }

    #[test]
    fn prompt_entered_prompt_is_no_op() {
        let td = resolve_transition(
            GamePhase::DeclarerPrompt,
            &PhaseEvent::PromptEntered {
                play_preference: PlayPreference::Prompt,
            },
        );
        assert_eq!(td.target_phase, None);
        assert_eq!(td.chained_event, None);
    }

    #[test]
    fn accept_play_from_wrong_phase_is_no_op() {
        let td = resolve_transition(GamePhase::Bidding, &PhaseEvent::AcceptPlay { seat: None });
        assert_eq!(td.target_phase, None);
    }

    #[test]
    fn accept_play_from_declarer_prompt() {
        let td = resolve_transition(
            GamePhase::DeclarerPrompt,
            &PhaseEvent::AcceptPlay { seat: None },
        );
        assert_eq!(td.target_phase, Some(GamePhase::Playing));
        assert!(td.reset_play);
        assert_eq!(td.service_actions.len(), 1);
    }

    #[test]
    fn decline_play_from_declarer_prompt() {
        let td = resolve_transition(GamePhase::DeclarerPrompt, &PhaseEvent::DeclinePlay);
        assert_eq!(td.target_phase, Some(GamePhase::Explanation));
        assert!(td.trigger_dds);
    }

    #[test]
    fn skip_to_review_from_playing() {
        let td = resolve_transition(GamePhase::Playing, &PhaseEvent::SkipToReview);
        assert_eq!(td.target_phase, Some(GamePhase::Explanation));
        assert!(td.trigger_dds);
    }

    #[test]
    fn skip_to_review_from_wrong_phase() {
        let td = resolve_transition(GamePhase::Bidding, &PhaseEvent::SkipToReview);
        assert_eq!(td.target_phase, None);
    }

    #[test]
    fn play_complete() {
        let td = resolve_transition(GamePhase::Playing, &PhaseEvent::PlayComplete);
        assert_eq!(td.target_phase, Some(GamePhase::Explanation));
        assert!(td.trigger_dds);
        assert!(td.service_actions.is_empty());
    }

    #[test]
    fn play_this_hand_from_explanation() {
        let td = resolve_transition(
            GamePhase::Explanation,
            &PhaseEvent::PlayThisHand { seat: Seat::South },
        );
        assert_eq!(td.target_phase, Some(GamePhase::Playing));
        assert!(td.reset_play);
        assert_eq!(td.service_actions.len(), 2);
    }

    #[test]
    fn play_this_hand_from_wrong_phase() {
        let td = resolve_transition(
            GamePhase::Bidding,
            &PhaseEvent::PlayThisHand { seat: Seat::South },
        );
        assert_eq!(td.target_phase, None);
    }

    #[test]
    fn restart_play() {
        let td = resolve_transition(GamePhase::Playing, &PhaseEvent::RestartPlay);
        assert_eq!(td.target_phase, None); // no phase change
        assert!(td.reset_play);
        assert_eq!(td.service_actions.len(), 1);
    }

    #[test]
    fn restart_play_from_wrong_phase() {
        let td = resolve_transition(GamePhase::Explanation, &PhaseEvent::RestartPlay);
        assert_eq!(td.target_phase, None);
        assert!(!td.reset_play);
    }
}
