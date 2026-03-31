//! RED tests: Convention pipeline adapter must produce correct bids for all fixture scenarios.
//!
//! Each test loads pipeline golden-master fixtures (captured from the TS pipeline),
//! builds a ConventionStrategyAdapter, and asserts that suggest_bid() returns the
//! expected call for each scenario.
//!
//! Run: `cargo test -p bridge-service -- --ignored convention_pipeline`

use bridge_conventions::registry::bundle_registry::resolve_bundle;
use bridge_conventions::registry::spec_builder::spec_from_bundle;
use bridge_conventions::teaching::teaching_types::{SurfaceGroup, SurfaceGroupRelationship};
use bridge_conventions::types::system_config::BaseSystemId;
use bridge_engine::hand_evaluator::evaluate_hand_hcp;
use bridge_engine::types::{Auction, AuctionEntry, Call, Hand, Seat};
use bridge_service::convention_adapter::ConventionStrategyAdapter;
use bridge_session::heuristics::{BiddingContext, BiddingStrategy};
use serde::Deserialize;

const PIPELINE_FIXTURE_DIR: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../bridge-conventions/fixtures/pipeline"
);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PipelineSnapshot {
    bundle_id: String,
    label: String,
    #[allow(dead_code)]
    seed: u64,
    selected_call: Option<serde_json::Value>,
    hand: serde_json::Value,
    #[allow(dead_code)]
    evaluation: serde_json::Value,
    auction_entries: Vec<serde_json::Value>,
}

fn load_pipeline_fixtures(bundle_id: &str) -> Vec<PipelineSnapshot> {
    let path = format!("{}/{}.json", PIPELINE_FIXTURE_DIR, bundle_id);
    let json_str = std::fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("Failed to read {}: {}", path, e));
    serde_json::from_str(&json_str)
        .unwrap_or_else(|e| panic!("Failed to deserialize {}: {}", path, e))
}

fn build_adapter(bundle_id: &str) -> ConventionStrategyAdapter {
    let spec = spec_from_bundle(bundle_id, BaseSystemId::Sayc)
        .unwrap_or_else(|| panic!("spec_from_bundle failed for {}", bundle_id));

    let resolved = resolve_bundle(bundle_id, BaseSystemId::Sayc)
        .unwrap_or_else(|| panic!("resolve_bundle failed for {}", bundle_id));

    // Convert types::teaching::SurfaceGroup → teaching::teaching_types::SurfaceGroup
    let surface_groups: Vec<SurfaceGroup> = resolved
        .derived_teaching
        .surface_groups
        .iter()
        .map(|sg| SurfaceGroup {
            id: sg.id.clone(),
            label: sg.label.clone(),
            members: sg.members.clone(),
            relationship: match sg.relationship {
                bridge_conventions::types::teaching::SurfaceGroupRelationship::MutuallyExclusive => {
                    SurfaceGroupRelationship::MutuallyExclusive
                }
                bridge_conventions::types::teaching::SurfaceGroupRelationship::EquivalentEncoding => {
                    SurfaceGroupRelationship::EquivalentEncoding
                }
                bridge_conventions::types::teaching::SurfaceGroupRelationship::PolicyAlternative => {
                    SurfaceGroupRelationship::PolicyAlternative
                }
            },
            description: sg.description.clone(),
        })
        .collect();

    ConventionStrategyAdapter::new(spec, surface_groups)
}

fn build_bidding_context(snapshot: &PipelineSnapshot) -> BiddingContext {
    let hand: Hand = serde_json::from_value(snapshot.hand.clone())
        .unwrap_or_else(|e| {
            panic!(
                "{}/{}: hand deserialization failed: {}",
                snapshot.bundle_id, snapshot.label, e
            )
        });

    let evaluation = evaluate_hand_hcp(&hand);

    let entries: Vec<AuctionEntry> = snapshot
        .auction_entries
        .iter()
        .map(|entry| {
            serde_json::from_value(entry.clone()).unwrap_or_else(|e| {
                panic!(
                    "{}/{}: auction entry deserialization failed: {}",
                    snapshot.bundle_id, snapshot.label, e
                )
            })
        })
        .collect();

    // Infer dealer from first auction entry (if present)
    let dealer = entries.first().map(|e| e.seat);

    BiddingContext {
        hand,
        auction: Auction {
            entries,
            is_complete: false,
        },
        seat: Seat::South,
        evaluation,
        vulnerability: None,
        dealer,
    }
}

fn run_bundle_tests(bundle_id: &str) {
    let snapshots = load_pipeline_fixtures(bundle_id);
    assert!(
        !snapshots.is_empty(),
        "No fixtures found for {}",
        bundle_id
    );

    let adapter = build_adapter(bundle_id);
    let mut pass_count = 0;
    let mut fail_count = 0;
    let mut failures = Vec::new();

    for snapshot in &snapshots {
        // Skip off-system cases (no expected bid)
        let expected_call_json = match &snapshot.selected_call {
            Some(c) => c,
            None => continue,
        };

        let expected: Call = serde_json::from_value(expected_call_json.clone()).unwrap_or_else(|e| {
            panic!(
                "{}/{}: selected_call deserialization failed: {}",
                snapshot.bundle_id, snapshot.label, e
            )
        });

        let ctx = build_bidding_context(snapshot);
        let result = adapter.suggest_bid(&ctx);

        match result {
            Some(ref bid) if bid.call == expected => {
                pass_count += 1;
            }
            _ => {
                fail_count += 1;
                failures.push(format!(
                    "  {}: expected {:?}, got {:?}",
                    snapshot.label,
                    expected,
                    result.map(|r| r.call),
                ));
            }
        }
    }

    if !failures.is_empty() {
        panic!(
            "Bundle '{}': {}/{} cases failed:\n{}",
            bundle_id,
            fail_count,
            pass_count + fail_count,
            failures.join("\n"),
        );
    }
}

#[test]
#[ignore]
fn nt_bundle_adapter_produces_correct_bids() {
    run_bundle_tests("nt-bundle");
}

#[test]
#[ignore]
fn nt_stayman_adapter_produces_correct_bids() {
    run_bundle_tests("nt-stayman");
}

#[test]
#[ignore]
fn nt_transfers_adapter_produces_correct_bids() {
    run_bundle_tests("nt-transfers");
}

#[test]
#[ignore]
fn bergen_bundle_adapter_produces_correct_bids() {
    run_bundle_tests("bergen-bundle");
}

#[test]
#[ignore]
fn weak_twos_adapter_produces_correct_bids() {
    run_bundle_tests("weak-twos-bundle");
}

#[test]
#[ignore]
fn dont_bundle_adapter_produces_correct_bids() {
    run_bundle_tests("dont-bundle");
}
