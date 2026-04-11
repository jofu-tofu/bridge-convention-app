//! Kernel extractor — computes NegotiationState and deltas.
//!
//! In the Rust port, NegotiationState is directly computed from CommittedStep
//! state tracking rather than extracted from MachineRegisters (which is a TS-only
//! legacy type). The computeKernelDelta function is preserved.
//!
//! `apply_negotiation_actions` advances NegotiationState by interpreting
//! canonical BidActions (Open, Transfer, Accept, Raise, Force, etc.).

use bridge_engine::types::Seat;

use crate::types::bid_action::{BidAction, BidSuitName, HandStrength, ObsSuit};
use crate::types::negotiation::*;

/// Convert an ObsSuit to the corresponding BidSuitName.
fn obs_suit_to_bid_suit(suit: &ObsSuit) -> BidSuitName {
    BidSuitName::from(*suit)
}

/// Apply a sequence of BidActions to a NegotiationState, returning the updated state.
///
/// Each action type maps to a specific negotiation state change:
/// - Open → sets captain to Responder (opener acted, responder decides next)
/// - Transfer → sets tentative fit on the target suit
/// - Accept → sets final fit (or upgrades tentative → final)
/// - Raise → sets tentative fit if none exists
/// - Agree → sets final fit
/// - Force → sets forcing level based on strength
/// - Signoff/Place → clears forcing
/// - Overcall/Double/Redouble → updates competition status
pub fn apply_negotiation_actions(
    prev: &NegotiationState,
    actions: &[BidAction],
    _actor: Seat,
) -> NegotiationState {
    let mut state = prev.clone();

    for action in actions {
        match action {
            BidAction::Open { .. } => {
                state.captain = Captain::Responder;
            }
            BidAction::Transfer { target_suit } => {
                let strain = obs_suit_to_bid_suit(target_suit);
                state.fit_agreed = Some(FitAgreed {
                    strain,
                    confidence: ConfidenceLevel::Tentative,
                });
            }
            BidAction::Accept { suit, .. } => {
                if let Some(obs) = suit {
                    let strain = obs_suit_to_bid_suit(obs);
                    state.fit_agreed = Some(FitAgreed {
                        strain,
                        confidence: ConfidenceLevel::Final,
                    });
                } else if let Some(ref mut fa) = state.fit_agreed {
                    // Upgrade tentative → final
                    fa.confidence = ConfidenceLevel::Final;
                }
            }
            BidAction::Raise { strain, .. } => {
                if state.fit_agreed.is_none() {
                    state.fit_agreed = Some(FitAgreed {
                        strain: *strain,
                        confidence: ConfidenceLevel::Tentative,
                    });
                }
            }
            BidAction::Agree { strain } => {
                state.fit_agreed = Some(FitAgreed {
                    strain: *strain,
                    confidence: ConfidenceLevel::Final,
                });
            }
            BidAction::Force { level } => {
                state.forcing = match level {
                    HandStrength::Game => ForcingLevel::Game,
                    _ => ForcingLevel::OneRound,
                };
            }
            BidAction::Signoff { .. } | BidAction::Place { .. } => {
                state.forcing = ForcingLevel::None;
            }
            BidAction::Overcall { suit, .. } => {
                if let Some(obs) = suit {
                    let strain = obs_suit_to_bid_suit(obs);
                    state.competition = Competition::Overcalled(OvercalledData {
                        kind: OvercalledKind::Overcalled,
                        strain,
                        level: 0, // Level not available from BidAction
                    });
                }
            }
            BidAction::Double { .. } => {
                state.competition = Competition::Simple(CompetitionSimple::Doubled);
            }
            BidAction::Redouble { .. } => {
                state.competition = Competition::Simple(CompetitionSimple::Redoubled);
            }
            // Show, Deny, Inquire, Decline, Relay, Pass — no negotiation state change
            _ => {}
        }
    }

    state
}

/// Compute the delta between two kernel states. Returns only changed fields.
pub fn compute_kernel_delta(
    before: &NegotiationState,
    after: &NegotiationState,
) -> NegotiationDelta {
    let mut delta = NegotiationDelta::default();

    if after.forcing != before.forcing {
        delta.forcing = Some(after.forcing);
    }

    if after.captain != before.captain {
        delta.captain = Some(after.captain);
    }

    if !fit_agreed_equal(&before.fit_agreed, &after.fit_agreed) {
        delta.fit_agreed = Some(after.fit_agreed.clone());
    }

    if !competition_equal(&before.competition, &after.competition) {
        delta.competition = Some(after.competition.clone());
    }

    delta
}

fn fit_agreed_equal(a: &Option<FitAgreed>, b: &Option<FitAgreed>) -> bool {
    match (a, b) {
        (None, None) => true,
        (Some(fa), Some(fb)) => fa.strain == fb.strain && fa.confidence == fb.confidence,
        _ => false,
    }
}

fn competition_equal(a: &Competition, b: &Competition) -> bool {
    a == b
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::types::bid_action::{BidSuitName, HandFeature};

    fn initial() -> NegotiationState {
        crate::pipeline::observation::committed_step::initial_negotiation()
    }

    #[test]
    fn delta_no_changes() {
        let state = initial();
        let delta = compute_kernel_delta(&state, &state);
        assert_eq!(delta, NegotiationDelta::default());
    }

    #[test]
    fn delta_forcing_changed() {
        let before = initial();
        let after = NegotiationState {
            forcing: ForcingLevel::Game,
            ..before.clone()
        };
        let delta = compute_kernel_delta(&before, &after);
        assert_eq!(delta.forcing, Some(ForcingLevel::Game));
        assert_eq!(delta.captain, None);
    }

    #[test]
    fn delta_fit_agreed_changed() {
        let before = initial();
        let after = NegotiationState {
            fit_agreed: Some(FitAgreed {
                strain: BidSuitName::Spades,
                confidence: ConfidenceLevel::Tentative,
            }),
            ..before.clone()
        };
        let delta = compute_kernel_delta(&before, &after);
        assert!(delta.fit_agreed.is_some());
    }

    // ── apply_negotiation_actions tests ──────────────────────────────

    #[test]
    fn apply_open_sets_captain_responder() {
        let state = initial();
        let actions = vec![BidAction::Open {
            strain: BidSuitName::Notrump,
            strength: None,
        }];
        let result = apply_negotiation_actions(&state, &actions, Seat::South);
        assert_eq!(result.captain, Captain::Responder);
    }

    #[test]
    fn apply_transfer_sets_tentative_fit() {
        let state = initial();
        let actions = vec![BidAction::Transfer {
            target_suit: ObsSuit::Hearts,
        }];
        let result = apply_negotiation_actions(&state, &actions, Seat::North);
        assert_eq!(
            result.fit_agreed,
            Some(FitAgreed {
                strain: BidSuitName::Hearts,
                confidence: ConfidenceLevel::Tentative,
            })
        );
    }

    #[test]
    fn apply_accept_sets_final_fit() {
        let state = initial();
        let actions = vec![BidAction::Accept {
            feature: HandFeature::Fit,
            suit: Some(ObsSuit::Hearts),
            strength: None,
        }];
        let result = apply_negotiation_actions(&state, &actions, Seat::South);
        assert_eq!(
            result.fit_agreed,
            Some(FitAgreed {
                strain: BidSuitName::Hearts,
                confidence: ConfidenceLevel::Final,
            })
        );
    }

    #[test]
    fn apply_accept_upgrades_tentative_to_final() {
        let state = NegotiationState {
            fit_agreed: Some(FitAgreed {
                strain: BidSuitName::Spades,
                confidence: ConfidenceLevel::Tentative,
            }),
            ..initial()
        };
        // Accept without explicit suit → upgrades existing tentative fit
        let actions = vec![BidAction::Accept {
            feature: HandFeature::Fit,
            suit: None,
            strength: None,
        }];
        let result = apply_negotiation_actions(&state, &actions, Seat::South);
        assert_eq!(
            result.fit_agreed,
            Some(FitAgreed {
                strain: BidSuitName::Spades,
                confidence: ConfidenceLevel::Final,
            })
        );
    }

    #[test]
    fn apply_agree_sets_final_fit() {
        let state = initial();
        let actions = vec![BidAction::Agree {
            strain: BidSuitName::Diamonds,
        }];
        let result = apply_negotiation_actions(&state, &actions, Seat::South);
        assert_eq!(
            result.fit_agreed,
            Some(FitAgreed {
                strain: BidSuitName::Diamonds,
                confidence: ConfidenceLevel::Final,
            })
        );
    }

    #[test]
    fn apply_force_game_sets_forcing_level() {
        let state = initial();
        let actions = vec![BidAction::Force {
            level: HandStrength::Game,
        }];
        let result = apply_negotiation_actions(&state, &actions, Seat::South);
        assert_eq!(result.forcing, ForcingLevel::Game);
    }

    #[test]
    fn apply_signoff_clears_forcing() {
        let state = NegotiationState {
            forcing: ForcingLevel::Game,
            ..initial()
        };
        let actions = vec![BidAction::Signoff { strain: None }];
        let result = apply_negotiation_actions(&state, &actions, Seat::South);
        assert_eq!(result.forcing, ForcingLevel::None);
    }

    #[test]
    fn apply_overcall_sets_competition() {
        let state = initial();
        let actions = vec![BidAction::Overcall {
            feature: HandFeature::HeldSuit,
            suit: Some(ObsSuit::Spades),
        }];
        let result = apply_negotiation_actions(&state, &actions, Seat::East);
        match result.competition {
            Competition::Overcalled(ref data) => {
                assert_eq!(data.strain, BidSuitName::Spades);
            }
            _ => panic!("Expected Overcalled competition"),
        }
    }

    #[test]
    fn apply_double_sets_doubled() {
        let state = initial();
        let actions = vec![BidAction::Double {
            feature: HandFeature::Strength,
        }];
        let result = apply_negotiation_actions(&state, &actions, Seat::West);
        assert_eq!(
            result.competition,
            Competition::Simple(CompetitionSimple::Doubled)
        );
    }

    #[test]
    fn apply_multiple_actions_applied_sequentially() {
        let state = initial();
        let actions = vec![
            BidAction::Open {
                strain: BidSuitName::Notrump,
                strength: None,
            },
            BidAction::Force {
                level: HandStrength::Game,
            },
        ];
        let result = apply_negotiation_actions(&state, &actions, Seat::South);
        assert_eq!(result.captain, Captain::Responder);
        assert_eq!(result.forcing, ForcingLevel::Game);
    }
}
