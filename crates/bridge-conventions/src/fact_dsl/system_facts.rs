//! System fact evaluators — layers 3 and 6.
//!
//! Standard (layer 3): 10 facts from SystemConfig thresholds.
//! Relational (layer 6): 6 overrides using fitAgreed + trump total points.

use std::collections::HashMap;

use crate::types::{OneNtForcingStatus, SuitResponseForcingDuration, SystemConfig};

use super::point_helpers::compute_total_points;
use super::types::{fv_bool, fv_text, get_num, FactValue, RelationalFactContext};

// --- Fact IDs ---

pub const SYSTEM_RESPONDER_WEAK_HAND: &str = "system.responder.weakHand";
pub const SYSTEM_RESPONDER_INVITE_VALUES: &str = "system.responder.inviteValues";
pub const SYSTEM_RESPONDER_GAME_VALUES: &str = "system.responder.gameValues";
pub const SYSTEM_RESPONDER_SLAM_VALUES: &str = "system.responder.slamValues";
pub const SYSTEM_OPENER_NOT_MINIMUM: &str = "system.opener.notMinimum";
pub const SYSTEM_RESPONDER_TWO_LEVEL_NEW_SUIT: &str = "system.responderTwoLevelNewSuit";
pub const SYSTEM_SUIT_RESPONSE_IS_GAME_FORCING: &str = "system.suitResponseIsGameForcing";
pub const SYSTEM_ONE_NT_FORCING_AFTER_MAJOR: &str = "system.oneNtForcingAfterMajor";
pub const SYSTEM_RESPONDER_ONE_NT_RANGE: &str = "system.responder.oneNtRange";
pub const SYSTEM_DONT_OVERCALL_IN_RANGE: &str = "system.dontOvercall.inRange";

/// Evaluate standard system facts (layer 3) from HCP and SystemConfig.
pub fn evaluate_system_facts(sys: &SystemConfig, facts: &mut HashMap<String, FactValue>) {
    let hcp = get_num(facts, "hand.hcp");

    // HCP-based responder thresholds
    facts.insert(
        SYSTEM_RESPONDER_WEAK_HAND.to_string(),
        fv_bool(
            SYSTEM_RESPONDER_WEAK_HAND,
            hcp < sys.responder_thresholds.invite_min as f64,
        ),
    );
    facts.insert(
        SYSTEM_RESPONDER_INVITE_VALUES.to_string(),
        fv_bool(
            SYSTEM_RESPONDER_INVITE_VALUES,
            hcp >= sys.responder_thresholds.invite_min as f64
                && hcp <= sys.responder_thresholds.invite_max as f64,
        ),
    );
    facts.insert(
        SYSTEM_RESPONDER_GAME_VALUES.to_string(),
        fv_bool(
            SYSTEM_RESPONDER_GAME_VALUES,
            hcp >= sys.responder_thresholds.game_min as f64,
        ),
    );
    facts.insert(
        SYSTEM_RESPONDER_SLAM_VALUES.to_string(),
        fv_bool(
            SYSTEM_RESPONDER_SLAM_VALUES,
            hcp >= sys.responder_thresholds.slam_min as f64,
        ),
    );

    // Opener rebid
    facts.insert(
        SYSTEM_OPENER_NOT_MINIMUM.to_string(),
        fv_bool(
            SYSTEM_OPENER_NOT_MINIMUM,
            hcp >= sys.opener_rebid.not_minimum as f64,
        ),
    );

    // 2-level new suit
    facts.insert(
        SYSTEM_RESPONDER_TWO_LEVEL_NEW_SUIT.to_string(),
        fv_bool(
            SYSTEM_RESPONDER_TWO_LEVEL_NEW_SUIT,
            hcp >= sys.suit_response.two_level_min as f64,
        ),
    );

    // System constants (no hand data needed)
    facts.insert(
        SYSTEM_SUIT_RESPONSE_IS_GAME_FORCING.to_string(),
        fv_bool(
            SYSTEM_SUIT_RESPONSE_IS_GAME_FORCING,
            sys.suit_response.two_level_forcing_duration == SuitResponseForcingDuration::Game,
        ),
    );
    facts.insert(
        SYSTEM_ONE_NT_FORCING_AFTER_MAJOR.to_string(),
        fv_text(
            SYSTEM_ONE_NT_FORCING_AFTER_MAJOR,
            match sys.one_nt_response_after_major.forcing {
                OneNtForcingStatus::Forcing => "forcing",
                OneNtForcingStatus::SemiForcing => "semi-forcing",
                OneNtForcingStatus::NonForcing => "non-forcing",
            },
        ),
    );

    // 1NT response range
    facts.insert(
        SYSTEM_RESPONDER_ONE_NT_RANGE.to_string(),
        fv_bool(
            SYSTEM_RESPONDER_ONE_NT_RANGE,
            hcp >= sys.one_nt_response_after_major.min_hcp as f64
                && hcp <= sys.one_nt_response_after_major.max_hcp as f64,
        ),
    );

    // DONT overcall range
    facts.insert(
        SYSTEM_DONT_OVERCALL_IN_RANGE.to_string(),
        fv_bool(
            SYSTEM_DONT_OVERCALL_IN_RANGE,
            hcp >= sys.dont_overcall.min_hcp as f64 && hcp <= sys.dont_overcall.max_hcp as f64,
        ),
    );
}

/// Evaluate relational system facts (layer 6).
/// Overrides standard values when a trump fit is agreed.
pub fn evaluate_system_relational(
    sys: &SystemConfig,
    facts: &mut HashMap<String, FactValue>,
    ctx: &RelationalFactContext,
) {
    let trump_suit = detect_trump_suit(ctx);
    let trump_suit_name = trump_suit.as_deref();

    // If no trump suit agreed, standard values stand (no overrides)
    let tp = if let Some(suit_name) = trump_suit_name {
        compute_total_points(facts, sys.point_config.trump_formula, Some(suit_name))
    } else {
        return;
    };

    // Override with total-point thresholds
    facts.insert(
        SYSTEM_RESPONDER_WEAK_HAND.to_string(),
        fv_bool(
            SYSTEM_RESPONDER_WEAK_HAND,
            tp < sys.responder_thresholds.invite_min_tp.trump as f64,
        ),
    );
    facts.insert(
        SYSTEM_RESPONDER_INVITE_VALUES.to_string(),
        fv_bool(
            SYSTEM_RESPONDER_INVITE_VALUES,
            tp >= sys.responder_thresholds.invite_min_tp.trump as f64
                && tp <= sys.responder_thresholds.invite_max_tp.trump as f64,
        ),
    );
    facts.insert(
        SYSTEM_RESPONDER_GAME_VALUES.to_string(),
        fv_bool(
            SYSTEM_RESPONDER_GAME_VALUES,
            tp >= sys.responder_thresholds.game_min_tp.trump as f64,
        ),
    );
    facts.insert(
        SYSTEM_RESPONDER_SLAM_VALUES.to_string(),
        fv_bool(
            SYSTEM_RESPONDER_SLAM_VALUES,
            tp >= sys.responder_thresholds.slam_min_tp.trump as f64,
        ),
    );
    facts.insert(
        SYSTEM_OPENER_NOT_MINIMUM.to_string(),
        fv_bool(
            SYSTEM_OPENER_NOT_MINIMUM,
            tp >= sys.opener_rebid.not_minimum_tp.trump as f64,
        ),
    );
    // Note: SYSTEM_RESPONDER_TWO_LEVEL_NEW_SUIT has no Tp variant in TS — no override
}

/// Detect trump suit from relational context's fitAgreed.
fn detect_trump_suit(ctx: &RelationalFactContext) -> Option<String> {
    ctx.fit_agreed.as_ref().and_then(|fa| {
        let strain = fa.strain.as_str();
        match strain {
            "hearts" | "spades" | "diamonds" | "clubs" => Some(strain.to_string()),
            _ => None, // "notrump" → no trump suit
        }
    })
}
