//! RED tests: Service method contracts for ServicePortImpl lifecycle.
//!
//! Tests the full session lifecycle: creation → drill start → bid submission →
//! phase transitions → viewport queries → error handling.
//!
//! Run: `cargo test -p bridge-service --test service_contracts_red`

use bridge_conventions::registry::module_registry::BASE_MODULE_IDS;
use bridge_conventions::registry::system_configs::get_system_config;
use bridge_conventions::types::system_config::BaseSystemId;
use bridge_engine::types::{BidSuit, Call, Seat};
use bridge_service::port::{DevServicePort, ServicePort};
use bridge_service::request_types::SessionConfig;
use bridge_service::service_impl::ServicePortImpl;

fn make_config(convention_id: &str, seed: u64) -> SessionConfig {
    SessionConfig {
        convention_id: convention_id.to_string(),
        user_seat: Some(Seat::South),
        seed: Some(seed),
        system_config: get_system_config(BaseSystemId::Sayc),
        base_module_ids: BASE_MODULE_IDS.iter().map(|s| s.to_string()).collect(),
        practice_mode: None,
        target_module_id: None,
        practice_role: None,
        play_preference: None,
        // Force opponents to pass so convention bids aren't blocked by interference
        opponent_mode: Some(bridge_session::types::OpponentMode::None),
        vulnerability: None,
        play_profile_id: None,
        vulnerability_distribution: None,
    }
}

fn create_test_session(service: &mut ServicePortImpl, convention_id: &str, seed: u64) -> String {
    // Phase 2: witness-based rejection sampling may exhaust for some seeds.
    // Retry across a small seed window to find one that produces a drill.
    let mut last_err = None;
    for offset in 0..32u64 {
        match service.create_drill_session(make_config(convention_id, seed + offset)) {
            Ok(h) => return h,
            Err(e) => last_err = Some(e),
        }
    }
    panic!("create_drill_session failed across 32 seed offsets: {last_err:?}");
}

fn make_competitive_config(convention_id: &str, seed: u64) -> SessionConfig {
    SessionConfig {
        convention_id: convention_id.to_string(),
        user_seat: Some(Seat::South),
        seed: Some(seed),
        system_config: get_system_config(BaseSystemId::Sayc),
        base_module_ids: BASE_MODULE_IDS.iter().map(|s| s.to_string()).collect(),
        practice_mode: None,
        target_module_id: None,
        practice_role: None,
        play_preference: None,
        opponent_mode: Some(bridge_session::types::OpponentMode::Natural),
        vulnerability: None,
        play_profile_id: None,
        vulnerability_distribution: None,
    }
}

/// Drive the auction to completion by submitting expected bids.
/// Returns the BidSubmitResult that triggered the phase transition,
/// or panics if the auction didn't complete within 50 iterations.
fn complete_auction(
    service: &mut ServicePortImpl,
    handle: &str,
) -> bridge_service::response_types::BidSubmitResult {
    for _ in 0..50 {
        let expected = service.get_expected_bid(handle).ok().flatten();
        let call = expected.unwrap_or(Call::Pass);
        let result = service
            .submit_bid(handle, call)
            .expect("submit_bid should succeed");
        if result.phase_transition.is_some() {
            return result;
        }
    }
    panic!("Auction did not complete within 50 iterations");
}

#[test]
fn session_creation_succeeds_with_nt_bundle() {
    let mut service = ServicePortImpl::new();
    let handle = create_test_session(&mut service, "nt-bundle", 42);
    assert!(!handle.is_empty(), "Handle should be non-empty");
}

#[test]
fn start_drill_returns_valid_bidding_viewport() {
    let mut service = ServicePortImpl::new();
    let handle = create_test_session(&mut service, "nt-bundle", 42);
    let result = service
        .start_drill(&handle)
        .expect("start_drill should succeed");

    assert_eq!(
        result.viewport.hand.cards.len(),
        13,
        "Hand should have 13 cards, got {}",
        result.viewport.hand.cards.len(),
    );
    assert!(
        !result.viewport.legal_calls.is_empty(),
        "legal_calls should be non-empty",
    );
    assert_eq!(
        result.viewport.seat,
        Seat::South,
        "User seat should be South",
    );
}

#[test]
fn start_drill_ai_bids_run_until_user_turn() {
    let mut service = ServicePortImpl::new();
    let handle = create_test_session(&mut service, "nt-bundle", 42);
    let result = service
        .start_drill(&handle)
        .expect("start_drill should succeed");

    // NT bundle responder drills now allow either:
    // - startup AI bids emitted via `ai_bids`, or
    // - a witness-derived initial auction already populated in the viewport.
    assert!(
        !result.ai_bids.is_empty() || result.viewport.auction_entries.len() >= 2,
        "expected prior auction context before South's turn, got ai_bids={:?}, auction={:?}",
        result.ai_bids,
        result.viewport.auction_entries,
    );
}

#[test]
fn negative_doubles_responder_starts_at_double_decision() {
    let mut service = ServicePortImpl::new();
    let mut config = make_competitive_config("negative-doubles-bundle", 42);
    config.practice_role = Some(bridge_session::types::PracticeRole::Responder);
    let handle = service
        .create_drill_session(config)
        .expect("create_drill_session should succeed");

    let result = service
        .start_drill(&handle)
        .expect("start_drill should succeed");
    let expected = service
        .get_expected_bid(&handle)
        .expect("get_expected_bid should succeed")
        .expect("expected bid should exist");

    assert_eq!(result.viewport.dealer, Seat::North);
    assert_eq!(result.viewport.auction_entries.len(), 2);
    assert_eq!(result.viewport.auction_entries[0].seat, Seat::North);
    assert_eq!(result.viewport.auction_entries[1].seat, Seat::East);
    assert_eq!(expected, Call::Double);
    assert!(result.viewport.is_user_turn);
}

#[test]
fn negative_doubles_opener_seed_avoids_same_suit_overcall() {
    let mut service = ServicePortImpl::new();
    let mut config = make_competitive_config("negative-doubles-bundle", 47);
    config.practice_role = Some(bridge_session::types::PracticeRole::Opener);
    let handle = service
        .create_drill_session(config)
        .expect("create_drill_session should succeed");

    let _start = service
        .start_drill(&handle)
        .expect("start_drill should succeed");
    let opening = service
        .get_expected_bid(&handle)
        .expect("get_expected_bid should succeed")
        .expect("expected opening bid should exist");

    let result = service
        .submit_bid(&handle, opening.clone())
        .expect("submit_bid should succeed");

    let first_ai_call = result
        .ai_bids
        .first()
        .expect("opponent should act after the opening bid")
        .call
        .clone();

    match (opening, first_ai_call) {
        (
            Call::Bid {
                strain: opening_strain,
                ..
            },
            Call::Bid {
                strain: overcall_strain,
                ..
            },
        ) => assert_ne!(opening_strain, overcall_strain),
        other => panic!("expected opening and overcall bids, got {:?}", other),
    }
}

#[test]
fn submit_correct_bid_accepted_with_grade() {
    let mut service = ServicePortImpl::new();
    let handle = create_test_session(&mut service, "nt-bundle", 42);
    let _drill = service
        .start_drill(&handle)
        .expect("start_drill should succeed");

    // Get the expected bid from the convention strategy
    let expected_call = service
        .get_expected_bid(&handle)
        .expect("get_expected_bid should succeed")
        .expect("expected bid should exist for nt-bundle");

    let result = service
        .submit_bid(&handle, expected_call)
        .expect("submit_bid should succeed");

    assert!(result.accepted, "Correct bid should be accepted");
    assert_eq!(
        result.grade,
        Some(bridge_session::session::BidGrade::Correct),
        "Correct bid should be graded as Correct",
    );
}

#[test]
fn submit_wrong_bid_rejected() {
    let mut service = ServicePortImpl::new();
    let handle = create_test_session(&mut service, "nt-bundle", 42);
    let _drill = service
        .start_drill(&handle)
        .expect("start_drill should succeed");

    let expected_call = service
        .get_expected_bid(&handle)
        .expect("get_expected_bid should succeed")
        .expect("expected bid should exist");

    // Pick a bid that's different from expected
    let wrong_call = if expected_call == Call::Pass {
        Call::Bid {
            level: 1,
            strain: BidSuit::Clubs,
        }
    } else {
        Call::Pass
    };

    let result = service
        .submit_bid(&handle, wrong_call)
        .expect("submit_bid should succeed (returns result, not error)");

    assert!(!result.accepted, "Wrong bid should not be accepted");
    assert_eq!(
        result.grade,
        Some(bridge_session::session::BidGrade::Incorrect),
        "Wrong bid should be graded as Incorrect",
    );
}

#[test]
fn submit_bid_completing_auction_returns_phase_transition() {
    let mut service = ServicePortImpl::new();
    let handle = create_test_session(&mut service, "nt-bundle", 42);
    let _drill = service
        .start_drill(&handle)
        .expect("start_drill should succeed");

    let result = complete_auction(&mut service, &handle);
    assert_eq!(
        result.phase_transition.as_ref().unwrap().from,
        bridge_session::types::GamePhase::Bidding,
        "Transition should be from Bidding phase",
    );
}

#[test]
fn enter_play_transitions_to_playing() {
    let mut service = ServicePortImpl::new();
    // Use play_preference = always so we get a prompt
    let mut config = make_config("nt-bundle", 42);
    config.play_preference = Some(bridge_session::types::PlayPreference::Prompt);
    let handle = service
        .create_drill_session(config)
        .expect("create_drill_session should succeed");
    let _drill = service
        .start_drill(&handle)
        .expect("start_drill should succeed");

    complete_auction(&mut service, &handle);

    let result = service
        .enter_play(&handle, None)
        .expect("enter_play should succeed");

    assert_eq!(
        result.phase,
        bridge_session::types::GamePhase::Playing,
        "enter_play should transition to Playing",
    );
}

#[test]
fn decline_play_transitions_to_explanation() {
    let mut service = ServicePortImpl::new();
    let mut config = make_config("nt-bundle", 43);
    config.play_preference = Some(bridge_session::types::PlayPreference::Prompt);
    let handle = service
        .create_drill_session(config)
        .expect("create_drill_session should succeed");
    let _drill = service
        .start_drill(&handle)
        .expect("start_drill should succeed");

    complete_auction(&mut service, &handle);

    service
        .decline_play(&handle)
        .expect("decline_play should succeed");

    let viewport = service
        .get_explanation_viewport(&handle)
        .expect("get_explanation_viewport should succeed");

    assert!(
        viewport.is_some(),
        "decline_play should transition to Explanation (explanation viewport available)",
    );
}

#[test]
fn submit_bid_during_wrong_phase_returns_error() {
    let mut service = ServicePortImpl::new();
    let mut config = make_config("nt-bundle", 44);
    config.play_preference = Some(bridge_session::types::PlayPreference::Skip);
    let handle = service
        .create_drill_session(config)
        .expect("create_drill_session should succeed");
    let _drill = service
        .start_drill(&handle)
        .expect("start_drill should succeed");

    // Complete auction (play_preference=skip auto-transitions to Explanation)
    complete_auction(&mut service, &handle);

    // Now in Explanation phase — submitting a bid should fail
    let result = service.submit_bid(&handle, Call::Pass);
    assert!(
        result.is_err(),
        "submit_bid during Explanation phase should return an error",
    );
}

#[test]
fn get_module_config_schema_works_for_system_module() {
    let service = ServicePortImpl::new();
    let result = service.get_module_config_schema("stayman", None);
    match &result {
        Ok(schema) => {
            eprintln!("Schema: {} surfaces", schema.surfaces.len());
            for s in &schema.surfaces {
                eprintln!(
                    "  Surface: {} ({}) - {} params",
                    s.name,
                    s.call_display,
                    s.parameters.len()
                );
            }
        }
        Err(e) => eprintln!("Error: {}", e),
    }
    assert!(
        result.is_ok(),
        "get_module_config_schema failed: {:?}",
        result.err()
    );
    let schema = result.unwrap();
    assert_eq!(schema.module_id, "stayman");
    assert!(
        !schema.surfaces.is_empty(),
        "Stayman should have configurable surfaces"
    );
}

#[test]
fn viewport_getters_return_none_for_wrong_phase() {
    let mut service = ServicePortImpl::new();
    let handle = create_test_session(&mut service, "nt-bundle", 45);
    let _drill = service
        .start_drill(&handle)
        .expect("start_drill should succeed");

    // During Bidding phase, playing viewport should be None
    let playing_vp = service
        .get_playing_viewport(&handle)
        .expect("get_playing_viewport should not error");
    assert!(
        playing_vp.is_none(),
        "Playing viewport should be None during Bidding phase",
    );

    // Declarer prompt viewport should also be None during Bidding
    let prompt_vp = service
        .get_declarer_prompt_viewport(&handle)
        .expect("get_declarer_prompt_viewport should not error");
    assert!(
        prompt_vp.is_none(),
        "Declarer prompt viewport should be None during Bidding phase",
    );
}

// ── Playing-viewport visibility ─────────────────────────────────────
//
// Regression: face_up_seats during play used `user_seat` instead of
// `effective_user_seat`, so when the user accepted "Play as Declarer"
// (DeclarerSwap), the declarer's hand was hidden. The viewport must always
// expose both the seat the user is currently controlling and dummy.

/// Drive a normal auction to the DeclarerPrompt phase and return the contract.
fn drive_to_prompt(
    service: &mut ServicePortImpl,
    seed: u64,
) -> (String, bridge_engine::types::Contract) {
    let mut config = make_config("nt-bundle", seed);
    config.play_preference = Some(bridge_session::types::PlayPreference::Prompt);
    let handle = service
        .create_drill_session(config)
        .expect("create_drill_session should succeed");
    service
        .start_drill(&handle)
        .expect("start_drill should succeed");
    complete_auction(service, &handle);
    let prompt = service
        .get_declarer_prompt_viewport(&handle)
        .expect("get_declarer_prompt_viewport should not error")
        .expect("DeclarerPrompt viewport should exist after auction");
    (handle, prompt.contract)
}

#[test]
fn playing_viewport_shows_user_seat_and_dummy_when_no_swap() {
    // No-swap path: enter_play with no seat override → effective_user_seat
    // stays at user_seat (South). visible_hands must contain South + dummy.
    let mut service = ServicePortImpl::new();
    let (handle, contract) = drive_to_prompt(&mut service, 42);

    service
        .enter_play(&handle, None)
        .expect("enter_play should succeed");

    let vp = service
        .get_playing_viewport(&handle)
        .expect("get_playing_viewport should not error")
        .expect("playing viewport should exist after enter_play");

    let dummy = bridge_engine::constants::partner_seat(contract.declarer);
    assert!(
        vp.visible_hands.contains_key(&Seat::South),
        "user seat (South) must be face-up in playing viewport",
    );
    assert!(
        vp.visible_hands.contains_key(&dummy),
        "dummy seat ({:?}) must be face-up in playing viewport",
        dummy,
    );
    if Seat::South != dummy {
        assert_eq!(
            vp.visible_hands.len(),
            2,
            "exactly 2 hands face-up when user and dummy differ",
        );
    }
}

#[test]
fn playing_viewport_shows_both_hands_on_declarer_swap() {
    // DeclarerSwap path: find a deal where partner (North) declares,
    // then call enter_play(handle, Some(North)) to take over. The viewport
    // must expose both North (now controlled by user) and South (dummy =
    // user's original seat).
    let mut service = ServicePortImpl::new();
    let mut found: Option<(String, bridge_engine::types::Contract)> = None;
    for seed in 0..200u64 {
        let mut svc = ServicePortImpl::new();
        let (handle, contract) = drive_to_prompt(&mut svc, seed);
        if contract.declarer == Seat::North {
            // Reuse this svc by moving it into `service` slot.
            service = svc;
            found = Some((handle, contract));
            break;
        }
    }
    let (handle, contract) =
        found.expect("expected to find a North-declared contract within 200 seeds");

    service
        .enter_play(&handle, Some(contract.declarer))
        .expect("enter_play (DeclarerSwap) should succeed");

    let vp = service
        .get_playing_viewport(&handle)
        .expect("get_playing_viewport should not error")
        .expect("playing viewport should exist after enter_play");

    assert!(
        vp.visible_hands.contains_key(&Seat::North),
        "declarer (North) must be face-up — user is now playing this hand",
    );
    assert!(
        vp.visible_hands.contains_key(&Seat::South),
        "dummy (South) must be face-up — user's original seat is now dummy",
    );
    assert_eq!(vp.visible_hands.len(), 2, "exactly 2 hands face-up");

    assert!(
        vp.user_controlled_seats.contains(&Seat::North),
        "user must control declarer (North) on DeclarerSwap, got {:?}",
        vp.user_controlled_seats,
    );
    assert!(
        vp.user_controlled_seats.contains(&Seat::South),
        "user must control dummy (South) on DeclarerSwap, got {:?}",
        vp.user_controlled_seats,
    );

    assert!(
        vp.rotated,
        "table should be rotated 180° when effective_user_seat == North",
    );
}
