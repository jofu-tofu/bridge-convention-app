//! ObsPattern → human-readable transition labels for learning viewport.
//!
//! Ported from TS `src/session/format-obs-label.ts`.

use bridge_conventions::ObsPattern;
use bridge_conventions::{BidActionType, BidSuitName, HandFeature, ObsPatternAct, ObsSuit};
use bridge_engine::types::Call;

use super::build_viewport::format_call;

// ── Display maps ──────────────────────────────────────────────────

fn suit_display(suit: ObsSuit) -> &'static str {
    match suit {
        ObsSuit::Spades => "spades",
        ObsSuit::Hearts => "hearts",
        ObsSuit::Diamonds => "diamonds",
        ObsSuit::Clubs => "clubs",
    }
}

fn bid_suit_name_display(s: BidSuitName) -> &'static str {
    match s {
        BidSuitName::Spades => "spades",
        BidSuitName::Hearts => "hearts",
        BidSuitName::Diamonds => "diamonds",
        BidSuitName::Clubs => "clubs",
        BidSuitName::Notrump => "notrump",
    }
}

fn feature_display(feature: HandFeature) -> &'static str {
    match feature {
        HandFeature::MajorSuit => "a major",
        HandFeature::ShortMajor => "short major",
        HandFeature::HeldSuit => "",
        HandFeature::SuitQuality => "suit quality",
        HandFeature::Strength => "HCP range",
        HandFeature::Fit => "support",
        HandFeature::Balanced => "balanced hand",
        HandFeature::Shortage => "shortage",
        HandFeature::Control => "control",
        HandFeature::KeyCards => "key cards",
        HandFeature::Stopper => "stoppers",
        HandFeature::TwoSuited => "two-suited",
    }
}

// ── Helpers ───────────────────────────────────────────────────────

fn suit_phrase(suit: Option<ObsSuit>) -> String {
    match suit {
        Some(s) => suit_display(s).to_string(),
        None => String::new(),
    }
}

/// Resolve the "suit" slot from either ObsSuit or BidSuitName (strain).
fn suit_or_strain_phrase(suit: Option<ObsSuit>, strain: Option<BidSuitName>) -> String {
    if let Some(s) = suit {
        return suit_display(s).to_string();
    }
    if let Some(s) = strain {
        return bid_suit_name_display(s).to_string();
    }
    String::new()
}

fn feature_phrase(feature: Option<HandFeature>, suit: Option<ObsSuit>) -> String {
    match feature {
        None => suit_phrase(suit),
        Some(HandFeature::HeldSuit) => {
            let s = suit_phrase(suit);
            if s.is_empty() {
                "a suit".to_string()
            } else {
                s
            }
        }
        Some(f) => {
            let base = feature_display(f);
            let s = suit_phrase(suit);
            if s.is_empty() {
                base.to_string()
            } else {
                format!("{} {}", s, base).trim().to_string()
            }
        }
    }
}

// ── Public API ────────────────────────────────────────────────────

/// Format an ObsPattern's action as a human-readable phrase.
pub fn format_obs_action(obs: &ObsPattern) -> String {
    let s = suit_or_strain_phrase(obs.suit, obs.strain);
    let fp = feature_phrase(obs.feature, obs.suit);

    match &obs.act {
        ObsPatternAct::Specific(act) => match act {
            BidActionType::Open => {
                if s.is_empty() {
                    "opening".to_string()
                } else {
                    format!("opening {}", s)
                }
            }
            BidActionType::Show => format!("showing {}", fp),
            BidActionType::Deny => format!("denying {}", fp),
            BidActionType::Inquire => format!("asking for {}", fp),
            BidActionType::Transfer => format!("transferring to {}", s),
            BidActionType::Accept => format!("accepting {}", fp),
            BidActionType::Decline => format!("declining {}", fp),
            BidActionType::Raise => {
                if s.is_empty() {
                    "raising".to_string()
                } else {
                    format!("raising {}", s)
                }
            }
            BidActionType::Place => {
                if s.is_empty() {
                    "placing the contract".to_string()
                } else {
                    format!("placing the contract in {}", s)
                }
            }
            BidActionType::Signoff => {
                if s.is_empty() {
                    "signing off".to_string()
                } else {
                    format!("signing off in {}", s)
                }
            }
            BidActionType::Force => "forcing".to_string(),
            BidActionType::Agree => {
                if s.is_empty() {
                    "agreeing".to_string()
                } else {
                    format!("agreeing on {}", s)
                }
            }
            BidActionType::Relay => "relaying".to_string(),
            BidActionType::Overcall => format!("overcalling {}", fp),
            BidActionType::Double => "doubling".to_string(),
            BidActionType::Pass => "passing".to_string(),
            BidActionType::Redouble => "redoubling".to_string(),
        },
        ObsPatternAct::Any => "any action".to_string(),
    }
}

/// Format a full transition label including the triggering call and turn.
pub fn format_transition_label(
    obs: &ObsPattern,
    trigger_call: Option<&Call>,
    turn: Option<&str>,
) -> String {
    let action = format_obs_action(obs);

    if let Some(call) = trigger_call {
        let call_str = format_call(call);
        let mut parts = vec!["After".to_string()];
        if let Some(t) = turn {
            parts.push(t.to_string());
        }
        parts.push("bids".to_string());
        parts.push(call_str);
        parts.push(format!("({})", action));
        return parts.join(" ");
    }

    let mut parts = vec!["After".to_string()];
    if let Some(t) = turn {
        parts.push(t.to_string());
    }
    parts.push(action);
    parts.join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_conventions::{BidActionType, ObsPattern, ObsPatternAct};
    use bridge_engine::types::{BidSuit, Call};

    fn obs(act: BidActionType) -> ObsPattern {
        ObsPattern {
            act: ObsPatternAct::Specific(act),
            feature: None,
            suit: None,
            strain: None,
            strength: None,
            actor: None,
            level: None,
            jump: None,
        }
    }

    #[test]
    fn format_obs_action_simple_actions() {
        assert_eq!(format_obs_action(&obs(BidActionType::Pass)), "passing");
        assert_eq!(format_obs_action(&obs(BidActionType::Double)), "doubling");
        assert_eq!(
            format_obs_action(&obs(BidActionType::Redouble)),
            "redoubling"
        );
        assert_eq!(format_obs_action(&obs(BidActionType::Relay)), "relaying");
        assert_eq!(format_obs_action(&obs(BidActionType::Force)), "forcing");
    }

    #[test]
    fn format_obs_action_with_suit() {
        let o = ObsPattern {
            act: ObsPatternAct::Specific(BidActionType::Open),
            feature: None,
            suit: Some(ObsSuit::Spades),
            strain: None,
            strength: None,
            actor: None,
            level: None,
            jump: None,
        };
        assert_eq!(format_obs_action(&o), "opening spades");
    }

    #[test]
    fn format_obs_action_open_no_suit() {
        assert_eq!(format_obs_action(&obs(BidActionType::Open)), "opening");
    }

    #[test]
    fn format_obs_action_show_feature() {
        let o = ObsPattern {
            act: ObsPatternAct::Specific(BidActionType::Show),
            feature: Some(HandFeature::Balanced),
            suit: None,
            strain: None,
            strength: None,
            actor: None,
            level: None,
            jump: None,
        };
        assert_eq!(format_obs_action(&o), "showing balanced hand");
    }

    #[test]
    fn format_obs_action_transfer_with_strain() {
        let o = ObsPattern {
            act: ObsPatternAct::Specific(BidActionType::Transfer),
            feature: None,
            suit: None,
            strain: Some(BidSuitName::Hearts),
            strength: None,
            actor: None,
            level: None,
            jump: None,
        };
        assert_eq!(format_obs_action(&o), "transferring to hearts");
    }

    #[test]
    fn format_obs_action_any() {
        let o = ObsPattern {
            act: ObsPatternAct::Any,
            feature: None,
            suit: None,
            strain: None,
            strength: None,
            actor: None,
            level: None,
            jump: None,
        };
        assert_eq!(format_obs_action(&o), "any action");
    }

    #[test]
    fn format_transition_label_with_call_and_turn() {
        let o = obs(BidActionType::Show);
        let call = Call::Bid {
            level: 1,
            strain: BidSuit::NoTrump,
        };
        let label = format_transition_label(&o, Some(&call), Some("opener"));
        assert_eq!(label, "After opener bids 1NT (showing )");
    }

    #[test]
    fn format_transition_label_no_call() {
        let o = obs(BidActionType::Pass);
        let label = format_transition_label(&o, None, Some("responder"));
        assert_eq!(label, "After responder passing");
    }

    #[test]
    fn format_transition_label_no_turn() {
        let o = obs(BidActionType::Relay);
        let label = format_transition_label(&o, None, None);
        assert_eq!(label, "After relaying");
    }
}
