//! Deal-generation integrity: every registered bundle must be drillable.
//!
//! For each bundle × seed in `SEED_RANGE`, `create_drill_session` must
//! succeed — i.e., witness selection produces a non-empty projection and
//! rejection sampling finds a deal within the retry budget. Bundles with
//! known structural bugs are allowlisted in `KNOWN_BROKEN` with a blocker
//! reason and guarded by the canary test, mirroring the pattern in
//! `bridge-conventions/tests/canary_authority.rs`.
//!
//! Run: `cargo test -p bridge-service --test deal_generation_integrity`

use std::collections::HashSet;

use bridge_conventions::registry::module_registry::BASE_MODULE_IDS;
use bridge_conventions::registry::{list_bundle_inputs, system_configs::get_system_config};
use bridge_conventions::types::system_config::BaseSystemId;
use bridge_engine::types::{BidSuit, Call, Seat};
use bridge_service::error::ServiceError;
use bridge_service::port::{DevServicePort, ServicePort};
use bridge_service::request_types::SessionConfig;
use bridge_service::service_impl::ServicePortImpl;
use bridge_session::types::PracticeRole;

const SEED_RANGE: std::ops::RangeInclusive<u64> = 1..=10;

/// Bundles with known deal-generation bugs. Each entry is
/// `(bundle_id, blocker_description)`. The canary test asserts these
/// still fail — if one starts passing, the canary fires and the bundle
/// must be removed from this list so the main integrity test covers it.
const KNOWN_BROKEN: &[(&str, &str)] = &[];

fn make_config(bundle_id: &str, seed: u64) -> SessionConfig {
    SessionConfig {
        convention_id: bundle_id.to_string(),
        user_seat: Some(Seat::South),
        seed: Some(seed),
        system_config: get_system_config(BaseSystemId::Sayc),
        base_module_ids: BASE_MODULE_IDS.iter().map(|s| s.to_string()).collect(),
        practice_mode: None,
        target_module_id: None,
        practice_role: None,
        play_preference: None,
        opponent_mode: None,
        vulnerability: None,
        play_profile_id: None,
        vulnerability_distribution: None,
    }
}

fn try_create(bundle_id: &str, seed: u64) -> Result<(), ServiceError> {
    let mut service = ServicePortImpl::new();
    let handle = service.create_drill_session(make_config(bundle_id, seed))?;
    service.start_drill(&handle)?;
    Ok(())
}

/// Per-bundle summary of drill-creation outcomes across `SEED_RANGE`.
struct BundleOutcome {
    bundle: String,
    passed: Vec<u64>,
    failed: Vec<(u64, String)>,
}

fn run_bundle(bundle_id: &str) -> BundleOutcome {
    let mut passed = Vec::new();
    let mut failed = Vec::new();
    for seed in SEED_RANGE {
        match try_create(bundle_id, seed) {
            Ok(()) => passed.push(seed),
            Err(e) => failed.push((seed, format!("{e:?}"))),
        }
    }
    BundleOutcome {
        bundle: bundle_id.to_string(),
        passed,
        failed,
    }
}

#[test]
fn deal_generation_succeeds_for_all_healthy_bundles() {
    let broken: HashSet<&str> = KNOWN_BROKEN.iter().map(|(id, _)| *id).collect();
    let mut total_failures: Vec<BundleOutcome> = Vec::new();

    for bundle in list_bundle_inputs() {
        let id = bundle.id.as_str();
        if broken.contains(id) {
            continue;
        }
        let outcome = run_bundle(id);
        if !outcome.failed.is_empty() {
            total_failures.push(outcome);
        }
    }

    if !total_failures.is_empty() {
        let mut msg = String::from(
            "deal generation failed for healthy bundles \
             (either fix the bundle or add it to KNOWN_BROKEN with a blocker reason):\n",
        );
        for o in &total_failures {
            msg.push_str(&format!(
                "  {} — passed {}/{}, failures: {:?}\n",
                o.bundle,
                o.passed.len(),
                SEED_RANGE.end() - SEED_RANGE.start() + 1,
                o.failed
            ));
        }
        panic!("{msg}");
    }
}

#[test]
fn known_broken_bundles_canary() {
    // If a broken bundle starts succeeding across all seeds, alert us to
    // remove it from KNOWN_BROKEN so the main test begins guarding it.
    let mut now_passing: Vec<String> = Vec::new();
    for (id, _reason) in KNOWN_BROKEN {
        let outcome = run_bundle(id);
        if outcome.failed.is_empty() {
            now_passing.push(id.to_string());
        }
    }
    if !now_passing.is_empty() {
        panic!(
            "the following KNOWN_BROKEN bundles now pass all seeds — \
             remove them from KNOWN_BROKEN so the integrity test covers them: {:?}",
            now_passing
        );
    }
}

/// Strict seed-sweep for the kernel-gated blackwood-bundle: every seed in
/// 0..32 must produce a drill-able deal. This is stricter than the
/// main integrity loop (which uses 1..=10) — it guards the
/// fit-establishing prefix synthesis against sampling flakiness.
#[test]
fn blackwood_bundle_drills_successfully() {
    let mut failures: Vec<(u64, String)> = Vec::new();
    for seed in 0..32u64 {
        if let Err(e) = try_create("blackwood-bundle", seed) {
            failures.push((seed, format!("{e:?}")));
        }
    }
    assert!(
        failures.is_empty(),
        "blackwood-bundle failed for {} seeds: {:?}",
        failures.len(),
        failures
    );
}

/// Stayman drills with `PracticeRole::Both` may randomize to opener or
/// responder, but any accepted startup auction must still preserve the
/// partnership's 1NT entry point. Regresses the "served a non-Stayman auction"
/// failure mode reported from production.
#[test]
fn stayman_both_role_never_serves_without_partner_1nt_prefix() {
    let mut offenders: Vec<(u64, Seat, Vec<String>, Option<Call>)> = Vec::new();

    for seed in 0..64u64 {
        let mut service = ServicePortImpl::new();
        let config = SessionConfig {
            convention_id: "stayman-bundle".to_string(),
            user_seat: Some(Seat::South),
            seed: Some(seed),
            system_config: get_system_config(BaseSystemId::Sayc),
            base_module_ids: BASE_MODULE_IDS.iter().map(|s| s.to_string()).collect(),
            practice_mode: None,
            target_module_id: Some("stayman".to_string()),
            practice_role: Some(PracticeRole::Both),
            play_preference: None,
            opponent_mode: None,
            vulnerability: None,
            play_profile_id: None,
            vulnerability_distribution: None,
        };

        let handle = match service.create_drill_session(config) {
            Ok(handle) => handle,
            Err(ServiceError::DealGenerationExhausted { .. }) => continue,
            Err(err) => panic!("seed={seed}: unexpected create_drill_session error: {err:?}"),
        };

        let start = service
            .start_drill(&handle)
            .unwrap_or_else(|err| panic!("seed={seed}: unexpected start_drill error: {err:?}"));

        let has_partnership_1nt = start.viewport.auction_entries.iter().any(|entry| {
            matches!(
                entry.call,
                Call::Bid {
                    level: 1,
                    strain: BidSuit::NoTrump
                }
            ) && matches!(entry.seat, Seat::North | Seat::South)
        });

        if !has_partnership_1nt {
            let auction = start
                .viewport
                .auction_entries
                .iter()
                .map(|entry| format!("{:?}:{:?}", entry.seat, entry.call))
                .collect::<Vec<_>>();
            let expected_bid = service.get_expected_bid(&handle).unwrap_or(None);
            offenders.push((seed, start.viewport.dealer, auction, expected_bid));
        }
    }

    assert!(
        offenders.is_empty(),
        "stayman-bundle (PracticeRole::Both) served successful drills without a partnership 1NT prefix: {:?}",
        offenders
    );
}
