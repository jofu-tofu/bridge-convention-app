//! Phase 0 — Characterization tests for today's drill-setup behavior.
//!
//! These tests describe what `build_drill_setup` (and `start_drill`) do
//! today, not what they "should" do. They serve as the safety net for the
//! Drill Surface-Targeting refactor (Phase 1+): each subsequent phase must
//! keep them green to demonstrate equivalence-preservation. The IO contract
//! they lock down:
//!
//! 1. Stayman bundle, responder role — drill lands on a 1NT-prefix decision
//!    point, or exhausts cleanly.
//! 2. NMF bundle, responder role — drill prefix is the canonical
//!    `1m – pass – 1M – pass – 1NT – pass` 6-call shape (suits flexible).
//! 3. Negative doubles bundle, responder role — drill prefix is the
//!    `opening – overcall` 2-call shape.
//! 4. Negative doubles bundle, opener role — drill prefix is the
//!    `opening – overcall – double – pass` 4-call shape.
//! 5. `start_drill` with an always-rejecting predicate exhausts the inner
//!    budget and returns an `Err` whose message starts with
//!    `"deal generation exhausted"` (which `build_drill_setup` translates
//!    to `ServiceError::DealGenerationExhausted` for the UI).
//!
//! All assertions are tolerant of seed-dependent exhaustion: any single
//! seed may legitimately fail rejection sampling. Each test sweeps a small
//! seed range and asserts every result is either a shape-compliant
//! success or an explicit `DealGenerationExhausted` — never a silent
//! fall-through.

use bridge_conventions::registry::module_registry::BASE_MODULE_IDS;
use bridge_conventions::registry::system_configs::get_system_config;
use bridge_conventions::types::rule_types::TargetSelector;
use bridge_conventions::types::system_config::BaseSystemId;
use bridge_engine::types::{BidSuit, Call, Seat};
use bridge_service::error::ServiceError;
use bridge_service::port::ServicePort;
use bridge_service::request_types::SessionConfig;
use bridge_service::service_impl::ServicePortImpl;
use bridge_session::types::{PlayPreference, PracticeMode, PracticeRole};

const SEED_RANGE: std::ops::Range<u64> = 1..6;

fn make_config(
    bundle_id: &str,
    target_module_id: Option<&str>,
    role: PracticeRole,
    seed: u64,
) -> SessionConfig {
    SessionConfig {
        convention_id: bundle_id.to_string(),
        user_seat: Some(Seat::South),
        seed: Some(seed),
        system_config: get_system_config(BaseSystemId::Sayc),
        base_module_ids: BASE_MODULE_IDS.iter().map(|s| s.to_string()).collect(),
        practice_mode: Some(PracticeMode::DecisionDrill),
        target: target_module_id.map(|s| TargetSelector::Module {
            module_id: s.to_string(),
        }),
        practice_role: Some(role),
        play_preference: Some(PlayPreference::Skip),
        opponent_mode: None,
        vulnerability: None,
        play_profile_id: None,
        vulnerability_distribution: None,
    }
}

/// Run a drill end-to-end and return the resulting auction prefix (the
/// `auction_entries` visible at the user's first turn). `Ok(None)` means
/// the drill exhausted cleanly.
fn drill_prefix(config: SessionConfig) -> Result<Option<Vec<(Seat, Call)>>, ServiceError> {
    let mut service = ServicePortImpl::new();
    let handle = match service.create_drill_session(config) {
        Ok(h) => h,
        Err(ServiceError::DealGenerationExhausted { .. }) => return Ok(None),
        Err(e) => return Err(e),
    };
    let start = service.start_drill(&handle)?;
    let entries = start
        .viewport
        .auction_entries
        .iter()
        .map(|e| (e.seat, e.call.clone()))
        .collect::<Vec<_>>();
    Ok(Some(entries))
}

/// Stayman responder drill: when the drill succeeds, the auction prefix
/// must contain a partnership 1NT bid (the entry point for stayman).
#[test]
fn stayman_drill_lands_on_partnership_1nt_prefix() {
    let mut at_least_one_success = false;
    for seed in SEED_RANGE {
        let cfg = make_config(
            "stayman-bundle",
            Some("stayman"),
            PracticeRole::Responder,
            seed,
        );
        let prefix = drill_prefix(cfg).unwrap_or_else(|e| panic!("seed={seed}: {e:?}"));
        let Some(entries) = prefix else { continue };
        at_least_one_success = true;

        let has_partnership_1nt = entries.iter().any(|(seat, call)| {
            matches!(
                call,
                Call::Bid {
                    level: 1,
                    strain: BidSuit::NoTrump
                }
            ) && matches!(seat, Seat::North | Seat::South)
        });
        assert!(
            has_partnership_1nt,
            "seed={seed}: stayman drill prefix lacks partnership 1NT: {entries:?}"
        );
    }
    assert!(
        at_least_one_success,
        "expected at least one stayman seed in {SEED_RANGE:?} to drill successfully"
    );
}

/// NMF responder drill: the auction prefix is exactly six entries shaped
/// `1m – pass – 1M – pass – 1NT – pass` with North dealer + South responder.
/// Suit choices (which minor / which major) are deal-dependent, so we
/// assert the shape only.
#[test]
fn nmf_drill_has_six_call_prefix_with_1m_1m_1nt_shape() {
    let mut at_least_one_success = false;
    for seed in SEED_RANGE {
        let cfg = make_config("nmf-bundle", Some("nmf"), PracticeRole::Responder, seed);
        let prefix = drill_prefix(cfg).unwrap_or_else(|e| panic!("seed={seed}: {e:?}"));
        let Some(entries) = prefix else { continue };
        at_least_one_success = true;

        assert_eq!(
            entries.len(),
            6,
            "seed={seed}: NMF prefix should be 6 entries [opening, pass, response, pass, 1NT, pass], got: {entries:?}"
        );

        // [0] North 1m
        assert_eq!(entries[0].0, Seat::North, "seed={seed}: opener seat");
        match &entries[0].1 {
            Call::Bid {
                level: 1,
                strain: BidSuit::Clubs | BidSuit::Diamonds,
            } => {}
            other => panic!("seed={seed}: opener should bid 1 of a minor, got {other:?}"),
        }

        // [1] East pass
        assert_eq!(entries[1], (Seat::East, Call::Pass), "seed={seed}: [1]");

        // [2] South 1M
        assert_eq!(entries[2].0, Seat::South, "seed={seed}: responder seat");
        match &entries[2].1 {
            Call::Bid {
                level: 1,
                strain: BidSuit::Hearts | BidSuit::Spades,
            } => {}
            other => panic!("seed={seed}: responder should bid 1 of a major, got {other:?}"),
        }

        // [3] West pass
        assert_eq!(entries[3], (Seat::West, Call::Pass), "seed={seed}: [3]");

        // [4] North 1NT
        assert_eq!(
            entries[4],
            (
                Seat::North,
                Call::Bid {
                    level: 1,
                    strain: BidSuit::NoTrump
                }
            ),
            "seed={seed}: opener rebid"
        );

        // [5] East pass
        assert_eq!(entries[5], (Seat::East, Call::Pass), "seed={seed}: [5]");
    }
    assert!(
        at_least_one_success,
        "expected at least one NMF seed in {SEED_RANGE:?} to drill successfully"
    );
}

/// Negative doubles, responder role: the auction prefix is exactly two
/// entries shaped `opening – overcall` (both bids, never doubles or
/// passes). Specific suit/level depends on the deal.
#[test]
fn negdbl_responder_has_two_call_prefix() {
    let mut at_least_one_success = false;
    for seed in SEED_RANGE {
        let cfg = make_config(
            "negative-doubles-bundle",
            Some("negative-doubles"),
            PracticeRole::Responder,
            seed,
        );
        let prefix = drill_prefix(cfg).unwrap_or_else(|e| panic!("seed={seed}: {e:?}"));
        let Some(entries) = prefix else { continue };
        at_least_one_success = true;

        assert_eq!(
            entries.len(),
            2,
            "seed={seed}: negdbl responder prefix should be 2 entries [opening, overcall], got: {entries:?}"
        );

        // [0] dealer opens — must be a Bid
        assert!(
            matches!(entries[0].1, Call::Bid { level: 1, .. }),
            "seed={seed}: [0] should be a 1-level opening bid, got {:?}",
            entries[0]
        );

        // [1] overcaller (LHO of dealer) overcalls — must be a Bid
        assert!(
            matches!(entries[1].1, Call::Bid { .. }),
            "seed={seed}: [1] should be an overcall bid, got {:?}",
            entries[1]
        );

        // Seats: [0] is dealer; [1] is dealer's LHO. Negdbl drills always
        // place the user as responder, so dealer = partner. With user_seat
        // South, partner = North, LHO of North = East.
        assert_eq!(
            entries[0].0,
            Seat::North,
            "seed={seed}: opener should be North"
        );
        assert_eq!(
            entries[1].0,
            Seat::East,
            "seed={seed}: overcaller should be East"
        );
    }
    assert!(
        at_least_one_success,
        "expected at least one negdbl-responder seed in {SEED_RANGE:?} to drill successfully"
    );
}

/// Negative doubles, opener role: the auction prefix is exactly four
/// entries shaped `opening – overcall – double – pass`.
#[test]
fn negdbl_opener_has_four_call_prefix() {
    let mut at_least_one_success = false;
    for seed in SEED_RANGE {
        let cfg = make_config(
            "negative-doubles-bundle",
            Some("negative-doubles"),
            PracticeRole::Opener,
            seed,
        );
        let prefix = drill_prefix(cfg).unwrap_or_else(|e| panic!("seed={seed}: {e:?}"));
        let Some(entries) = prefix else { continue };
        at_least_one_success = true;

        assert_eq!(
            entries.len(),
            4,
            "seed={seed}: negdbl opener prefix should be 4 entries [open, overcall, dbl, pass], got: {entries:?}"
        );

        // [0] opener (user) opens
        assert!(
            matches!(entries[0].1, Call::Bid { level: 1, .. }),
            "seed={seed}: [0] opening bid"
        );
        // [1] LHO overcalls
        assert!(
            matches!(entries[1].1, Call::Bid { .. }),
            "seed={seed}: [1] overcall"
        );
        // [2] partner negative-doubles
        assert_eq!(
            entries[2].1,
            Call::Double,
            "seed={seed}: [2] should be Double, got {:?}",
            entries[2].1
        );
        // [3] RHO passes
        assert_eq!(
            entries[3].1,
            Call::Pass,
            "seed={seed}: [3] should be Pass, got {:?}",
            entries[3].1
        );

        // Opener-role drills place the user as dealer. With user_seat South,
        // dealer = South, so seats round-robin S → W → N → E.
        assert_eq!(entries[0].0, Seat::South, "seed={seed}: opener seat");
        assert_eq!(entries[1].0, Seat::West, "seed={seed}: overcaller seat");
        assert_eq!(entries[2].0, Seat::North, "seed={seed}: partner seat");
        assert_eq!(entries[3].0, Seat::East, "seed={seed}: RHO seat");
    }
    assert!(
        at_least_one_success,
        "expected at least one negdbl-opener seed in {SEED_RANGE:?} to drill successfully"
    );
}

/// Inner-loop characterization: when the deal-acceptance predicate always
/// rejects, `start_drill` exhausts its budget and returns an `Err` whose
/// message starts with `"deal generation exhausted"`. The outer
/// `build_drill_setup` retry loop translates this into
/// `ServiceError::DealGenerationExhausted` after exhausting all eight
/// seed-shifted retries.
///
/// We test the inner contract here because there is no public API for
/// injecting a custom predicate into `build_drill_setup` — but the inner
/// error string is exactly what the outer loop pattern-matches on
/// (`drill_setup.rs:227`), so locking it down protects the outer
/// translation layer too.
#[test]
fn start_drill_returns_exhaustion_err_when_predicate_always_rejects() {
    use bridge_engine::types::DealConstraints;
    use bridge_session::session::start_drill::{
        start_drill, ConventionConfig, StartDrillOptions,
    };
    use bridge_session::session::DrillConfig;
    use std::collections::HashMap;
    use std::sync::Arc;

    let convention = ConventionConfig {
        id: "stayman-bundle".to_string(),
        deal_constraints: DealConstraints {
            seats: Vec::new(),
            dealer: Some(Seat::North),
            vulnerability: None,
            max_attempts: Some(50_000),
            seed: Some(1),
        },
        allowed_dealers: None,
    };

    // Predicate that rejects every deal.
    let always_reject: Arc<bridge_session::session::start_drill::DealAcceptancePredicate> =
        Arc::new(|_deal, _seat| false);

    let options = StartDrillOptions {
        practice_role: PracticeRole::Responder,
        deal_acceptance_predicate: Some(always_reject),
        ..Default::default()
    };
    let drill_config = DrillConfig {
        convention_id: "stayman-bundle".to_string(),
        user_seat: Seat::South,
        seat_strategies: HashMap::new(),
    };
    let mut rng_state = 0.5_f64;
    let result = start_drill(
        &convention,
        Seat::South,
        drill_config,
        &options,
        &mut || {
            let v = rng_state;
            rng_state = (rng_state + 0.137).fract();
            v
        },
    );
    let err = match result {
        Ok(_) => panic!("expected exhaustion err, got Ok"),
        Err(e) => e,
    };
    assert!(
        err.starts_with("deal generation exhausted"),
        "expected exhaustion err, got: {err}"
    );
}
