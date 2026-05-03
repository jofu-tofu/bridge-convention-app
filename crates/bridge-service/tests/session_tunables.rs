//! Drill-form tunables: play_profile_id + vulnerability_distribution flow
//! from `SessionConfig` through `create_drill_session` and reach the
//! resulting `SessionState`.
//!
//! Run: `cargo test -p bridge-service --test session_tunables`

use bridge_conventions::registry::module_registry::BASE_MODULE_IDS;
use bridge_conventions::registry::system_configs::get_system_config;
use bridge_conventions::types::system_config::BaseSystemId;
use bridge_engine::types::Seat;
use bridge_service::port::ServicePort;
use bridge_service::request_types::{SessionConfig, VulnerabilityDistribution};
use bridge_service::service_impl::ServicePortImpl;
use bridge_session::heuristics::play_profiles::PlayProfileId;

fn base_config(seed: u64) -> SessionConfig {
    SessionConfig {
        convention_id: "nt-bundle".to_string(),
        user_seat: Some(Seat::South),
        seed: Some(seed),
        system_config: get_system_config(BaseSystemId::Sayc),
        base_module_ids: BASE_MODULE_IDS.iter().map(|s| s.to_string()).collect(),
        practice_mode: None,
        target: None,
        practice_role: None,
        play_preference: None,
        opponent_mode: None,
        vulnerability: None,
        play_profile_id: None,
        vulnerability_distribution: None,
    }
}

/// Helper: try seeds in `range` until one succeeds, return the handle.
/// Witness sampling can exhaust occasionally; widen the seed window so
/// the test asserts plumbing rather than sampling luck.
fn create_with_retry<F>(service: &mut ServicePortImpl, mut configure: F) -> String
where
    F: FnMut(u64) -> SessionConfig,
{
    for seed in 1..200u64 {
        if let Ok(handle) = service.create_drill_session(configure(seed)) {
            return handle;
        }
    }
    panic!("create_drill_session failed across 200 seeds");
}

#[test]
fn play_profile_id_propagates_to_needs_dds_play() {
    // Contract: DDS runs for Expert and WorldClass; heuristics-only for
    // Beginner and ClubPlayer. `use_posterior` decides random vs
    // belief-filtered MC sampling — not whether DDS runs at all.
    let cases: &[(PlayProfileId, bool, &str)] = &[
        (PlayProfileId::Expert, true, "expert"),
        (PlayProfileId::WorldClass, true, "world-class"),
        (PlayProfileId::ClubPlayer, false, "club-player"),
        (PlayProfileId::Beginner, false, "beginner"),
    ];

    for (profile_id, expected, label) in cases {
        let mut service = ServicePortImpl::new();
        let mut cfg = base_config(0);
        cfg.play_profile_id = Some(*profile_id);
        let handle = create_with_retry(&mut service, |seed| {
            let mut c = cfg.clone();
            c.seed = Some(seed);
            c
        });
        assert_eq!(
            service.needs_dds_play(&handle).expect("needs_dds_play"),
            *expected,
            "{} profile: needs_dds_play should be {}",
            label,
            expected,
        );
    }
}

#[test]
fn vulnerability_distribution_pinned_to_one_state_yields_that_state() {
    let mut service = ServicePortImpl::new();
    let mut cfg = base_config(0);
    cfg.vulnerability_distribution = Some(VulnerabilityDistribution {
        none: 0.0,
        ours: 0.0,
        theirs: 0.0,
        both: 1.0,
    });
    let handle = create_with_retry(&mut service, |seed| {
        let mut c = cfg.clone();
        c.seed = Some(seed);
        c
    });

    let result = service.start_drill(&handle).expect("start_drill");
    // Vulnerability is exposed via the bidding viewport's deal vulnerability.
    let vuln = result.viewport.vulnerability;
    assert_eq!(
        vuln,
        bridge_engine::types::Vulnerability::Both,
        "distribution pinned to `both` must yield Both vulnerability, got {:?}",
        vuln
    );
}

#[test]
fn explicit_vulnerability_override_wins_over_distribution() {
    let mut service = ServicePortImpl::new();
    let mut cfg = base_config(0);
    cfg.vulnerability = Some(bridge_engine::types::Vulnerability::EastWest);
    cfg.vulnerability_distribution = Some(VulnerabilityDistribution {
        none: 1.0,
        ours: 0.0,
        theirs: 0.0,
        both: 0.0,
    });
    let handle = create_with_retry(&mut service, |seed| {
        let mut c = cfg.clone();
        c.seed = Some(seed);
        c
    });

    let result = service.start_drill(&handle).expect("start_drill");
    assert_eq!(
        result.viewport.vulnerability,
        bridge_engine::types::Vulnerability::EastWest,
        "explicit vulnerability must override distribution"
    );
}
