//! RED tests: Service method contracts for ServicePortImpl lifecycle.
//!
//! Tests the full session lifecycle: creation → drill start → bid submission →
//! phase transitions → viewport queries → error handling.
//!
//! Run: `cargo test -p bridge-service -- --ignored service_contracts`

use bridge_engine::types::{Call, BidSuit, Seat};
use bridge_service::port::{DevServicePort, ServicePort};
use bridge_service::request_types::SessionConfig;
use bridge_service::service_impl::ServicePortImpl;

fn make_config(convention_id: &str, seed: u64) -> SessionConfig {
    SessionConfig {
        convention_id: convention_id.to_string(),
        user_seat: Some(Seat::South),
        seed: Some(seed),
        base_system_id: None,
        practice_mode: None,
        target_module_id: None,
        practice_role: None,
        play_preference: None,
        // Force opponents to pass so convention bids aren't blocked by interference
        opponent_mode: Some(bridge_session::types::OpponentMode::None),
        vulnerability: None,
    }
}

fn create_test_session(service: &mut ServicePortImpl, convention_id: &str, seed: u64) -> String {
    service
        .create_session(make_config(convention_id, seed))
        .expect("create_session should succeed")
}

#[test]
#[ignore]
fn session_creation_succeeds_with_nt_bundle() {
    let mut service = ServicePortImpl::new();
    let handle = create_test_session(&mut service, "nt-bundle", 42);
    assert!(!handle.is_empty(), "Handle should be non-empty");
}

#[test]
#[ignore]
fn start_drill_returns_valid_bidding_viewport() {
    let mut service = ServicePortImpl::new();
    let handle = create_test_session(&mut service, "nt-bundle", 42);
    let result = service.start_drill(&handle).expect("start_drill should succeed");

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
#[ignore]
fn start_drill_ai_bids_run_until_user_turn() {
    let mut service = ServicePortImpl::new();
    let handle = create_test_session(&mut service, "nt-bundle", 42);
    let result = service.start_drill(&handle).expect("start_drill should succeed");

    // NT bundle: dealer is typically North (opens 1NT), then East passes.
    // So at least N+E should have bid before South's turn.
    assert!(
        !result.ai_bids.is_empty(),
        "AI should have bid before user's turn (dealer=North for NT bundle)",
    );
}

#[test]
#[ignore]
fn submit_correct_bid_accepted_with_grade() {
    let mut service = ServicePortImpl::new();
    let handle = create_test_session(&mut service, "nt-bundle", 42);
    let _drill = service.start_drill(&handle).expect("start_drill should succeed");

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
#[ignore]
fn submit_wrong_bid_rejected() {
    let mut service = ServicePortImpl::new();
    let handle = create_test_session(&mut service, "nt-bundle", 42);
    let _drill = service.start_drill(&handle).expect("start_drill should succeed");

    let expected_call = service
        .get_expected_bid(&handle)
        .expect("get_expected_bid should succeed")
        .expect("expected bid should exist");

    // Pick a bid that's different from expected
    let wrong_call = if expected_call == Call::Pass {
        Call::Bid { level: 1, strain: BidSuit::Clubs }
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
#[ignore]
fn submit_bid_completing_auction_returns_phase_transition() {
    let mut service = ServicePortImpl::new();
    let handle = create_test_session(&mut service, "nt-bundle", 42);
    let _drill = service.start_drill(&handle).expect("start_drill should succeed");

    // Loop: get expected bid → submit until phase transition
    let mut iterations = 0;
    let max_iterations = 50; // safety limit

    loop {
        iterations += 1;
        assert!(
            iterations <= max_iterations,
            "Auction did not complete within {} iterations",
            max_iterations,
        );

        let expected = service
            .get_expected_bid(&handle)
            .expect("get_expected_bid should succeed");

        let call = match expected {
            Some(c) => c,
            None => Call::Pass, // fallback if no convention bid
        };

        let result = service.submit_bid(&handle, call).expect("submit_bid should succeed");

        if let Some(ref transition) = result.phase_transition {
            assert_eq!(
                transition.from,
                bridge_session::types::GamePhase::Bidding,
                "Transition should be from Bidding phase",
            );
            return; // success
        }
    }
}

#[test]
#[ignore]
fn accept_prompt_play_transitions_to_playing() {
    let mut service = ServicePortImpl::new();
    // Use play_preference = always so we get a prompt
    let mut config = make_config("nt-bundle", 42);
    config.play_preference = Some(bridge_session::types::PlayPreference::Prompt);
    let handle = service.create_session(config).expect("create_session should succeed");
    let _drill = service.start_drill(&handle).expect("start_drill should succeed");

    // Complete auction
    for _ in 0..50 {
        let expected = service.get_expected_bid(&handle).ok().flatten();
        let call = expected.unwrap_or(Call::Pass);
        let result = service.submit_bid(&handle, call).expect("submit_bid should succeed");
        if result.phase_transition.is_some() {
            break;
        }
    }

    let result = service
        .accept_prompt(&handle, Some("play"), None)
        .expect("accept_prompt(play) should succeed");

    assert_eq!(
        result.phase,
        bridge_session::types::GamePhase::Playing,
        "accept_prompt(play) should transition to Playing",
    );
}

#[test]
#[ignore]
fn accept_prompt_skip_transitions_to_explanation() {
    let mut service = ServicePortImpl::new();
    let mut config = make_config("nt-bundle", 43);
    config.play_preference = Some(bridge_session::types::PlayPreference::Prompt);
    let handle = service.create_session(config).expect("create_session should succeed");
    let _drill = service.start_drill(&handle).expect("start_drill should succeed");

    // Complete auction
    for _ in 0..50 {
        let expected = service.get_expected_bid(&handle).ok().flatten();
        let call = expected.unwrap_or(Call::Pass);
        let result = service.submit_bid(&handle, call).expect("submit_bid should succeed");
        if result.phase_transition.is_some() {
            break;
        }
    }

    let result = service
        .accept_prompt(&handle, Some("skip"), None)
        .expect("accept_prompt(skip) should succeed");

    assert_eq!(
        result.phase,
        bridge_session::types::GamePhase::Explanation,
        "accept_prompt(skip) should transition to Explanation",
    );
}

#[test]
#[ignore]
fn submit_bid_during_wrong_phase_returns_error() {
    let mut service = ServicePortImpl::new();
    let mut config = make_config("nt-bundle", 44);
    config.play_preference = Some(bridge_session::types::PlayPreference::Skip);
    let handle = service.create_session(config).expect("create_session should succeed");
    let _drill = service.start_drill(&handle).expect("start_drill should succeed");

    // Complete auction (play_preference=skip auto-transitions to Explanation)
    for _ in 0..50 {
        let expected = service.get_expected_bid(&handle).ok().flatten();
        let call = expected.unwrap_or(Call::Pass);
        let result = service.submit_bid(&handle, call).expect("submit_bid should succeed");
        if result.phase_transition.is_some() {
            break;
        }
    }

    // Now in Explanation phase — submitting a bid should fail
    let result = service.submit_bid(&handle, Call::Pass);
    assert!(
        result.is_err(),
        "submit_bid during Explanation phase should return an error",
    );
}

#[test]
#[ignore]
fn viewport_getters_return_none_for_wrong_phase() {
    let mut service = ServicePortImpl::new();
    let handle = create_test_session(&mut service, "nt-bundle", 45);
    let _drill = service.start_drill(&handle).expect("start_drill should succeed");

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
