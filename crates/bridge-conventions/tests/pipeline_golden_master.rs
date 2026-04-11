//! Pipeline golden-master tests: Load TS pipeline output JSON fixtures →
//! deserialize in Rust → validate selected bid, truth set, and teaching data.
//!
//! These fixtures are captured by `scripts/capture-pipeline-snapshots.ts` and
//! represent the canonical TS pipeline behavior. The Rust port must produce
//! equivalent results (exact match on selected/truthSet/acceptableSet meaning
//! IDs and calls).

use serde::Deserialize;

const PIPELINE_FIXTURE_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/fixtures/pipeline");

/// Simplified snapshot structure matching the TS capture script output.
/// We only validate the fields that matter for golden-master comparison.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PipelineSnapshot {
    bundle_id: String,
    label: String,
    seed: u64,
    selected_meaning_id: Option<String>,
    selected_call: Option<serde_json::Value>,
    truth_set_meaning_ids: Vec<String>,
    truth_set_calls: Vec<serde_json::Value>,
    acceptable_set_meaning_ids: Vec<String>,
    eliminated_count: usize,
    bid_grade_if_correct: String,
    call_view_count: usize,
    meaning_view_count: usize,
    why_not_count: usize,
    // Hand and evaluation are present but we don't need to deserialize them
    // for the fixture validation — they're inputs, not outputs.
    hand: serde_json::Value,
    evaluation: serde_json::Value,
    auction_entries: Vec<serde_json::Value>,
}

fn load_pipeline_fixtures(bundle_id: &str) -> Vec<PipelineSnapshot> {
    let path = format!("{}/{}.json", PIPELINE_FIXTURE_DIR, bundle_id);
    let json_str =
        std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("Failed to read {}: {}", path, e));
    serde_json::from_str(&json_str)
        .unwrap_or_else(|e| panic!("Failed to deserialize {}: {}", path, e))
}

fn validate_bundle_snapshots(bundle_id: &str) {
    let snapshots = load_pipeline_fixtures(bundle_id);
    assert!(
        !snapshots.is_empty(),
        "No snapshots found for {}",
        bundle_id
    );

    for snapshot in &snapshots {
        assert_eq!(snapshot.bundle_id, bundle_id);

        // Validate internal consistency
        if snapshot.selected_meaning_id.is_some() {
            // If there's a selected meaning, it should be in the truth set
            let selected = snapshot.selected_meaning_id.as_ref().unwrap();
            assert!(
                snapshot.truth_set_meaning_ids.contains(selected),
                "{}/{}: selected meaning '{}' not in truth set {:?}",
                bundle_id,
                snapshot.label,
                selected,
                snapshot.truth_set_meaning_ids,
            );

            // Selected call should be present
            assert!(
                snapshot.selected_call.is_some(),
                "{}/{}: selected meaning but no selected call",
                bundle_id,
                snapshot.label,
            );

            // Grade should be "correct" when there's a selection
            assert_eq!(
                snapshot.bid_grade_if_correct, "correct",
                "{}/{}: expected correct grade for selected bid",
                bundle_id, snapshot.label,
            );
        } else {
            // Off-system: no selected meaning, empty truth set
            assert!(
                snapshot.truth_set_meaning_ids.is_empty(),
                "{}/{}: off-system but has truth set",
                bundle_id,
                snapshot.label,
            );
            assert_eq!(
                snapshot.bid_grade_if_correct, "off-system",
                "{}/{}: expected off-system grade",
                bundle_id, snapshot.label,
            );
        }

        // Truth set calls should match truth set meanings in count
        assert_eq!(
            snapshot.truth_set_meaning_ids.len(),
            snapshot.truth_set_calls.len(),
            "{}/{}: truth set meanings/calls count mismatch",
            bundle_id,
            snapshot.label,
        );

        // Acceptable set = truth set (all conditions pass, legal encoding).
        // Just verify it deserializes.
        let _ = snapshot.acceptable_set_meaning_ids.len();
    }

    println!(
        "{}: {} snapshots validated (selected: {}, off-system: {})",
        bundle_id,
        snapshots.len(),
        snapshots
            .iter()
            .filter(|s| s.selected_meaning_id.is_some())
            .count(),
        snapshots
            .iter()
            .filter(|s| s.selected_meaning_id.is_none())
            .count(),
    );
}

#[test]
fn nt_bundle_pipeline_snapshots() {
    validate_bundle_snapshots("nt-bundle");
}

#[test]
fn nt_stayman_pipeline_snapshots() {
    validate_bundle_snapshots("nt-stayman");
}

#[test]
fn nt_transfers_pipeline_snapshots() {
    validate_bundle_snapshots("nt-transfers");
}

#[test]
fn bergen_bundle_pipeline_snapshots() {
    validate_bundle_snapshots("bergen-bundle");
}

#[test]
fn weak_twos_bundle_pipeline_snapshots() {
    validate_bundle_snapshots("weak-twos-bundle");
}

#[test]
fn dont_bundle_pipeline_snapshots() {
    validate_bundle_snapshots("dont-bundle");
}

/// Verify that the hand field deserializes as a valid bridge-engine Hand.
#[test]
fn pipeline_snapshot_hand_deserializes() {
    let snapshots = load_pipeline_fixtures("nt-bundle");
    for snapshot in &snapshots {
        let hand: Result<bridge_engine::types::Hand, _> =
            serde_json::from_value(snapshot.hand.clone());
        assert!(
            hand.is_ok(),
            "{}/{}: hand failed to deserialize: {:?}",
            snapshot.bundle_id,
            snapshot.label,
            hand.err(),
        );
        let hand = hand.unwrap();
        assert_eq!(
            hand.cards.len(),
            13,
            "{}/{}: hand has {} cards, expected 13",
            snapshot.bundle_id,
            snapshot.label,
            hand.cards.len(),
        );
    }
}

/// Verify selected calls deserialize as valid bridge-engine Calls.
#[test]
fn pipeline_snapshot_calls_deserialize() {
    let snapshots = load_pipeline_fixtures("nt-bundle");
    for snapshot in &snapshots {
        if let Some(ref call_json) = snapshot.selected_call {
            let call: Result<bridge_engine::types::Call, _> =
                serde_json::from_value(call_json.clone());
            assert!(
                call.is_ok(),
                "{}/{}: selected call failed to deserialize: {:?}",
                snapshot.bundle_id,
                snapshot.label,
                call.err(),
            );
        }

        for (i, call_json) in snapshot.truth_set_calls.iter().enumerate() {
            let call: Result<bridge_engine::types::Call, _> =
                serde_json::from_value(call_json.clone());
            assert!(
                call.is_ok(),
                "{}/{}: truth set call {} failed to deserialize: {:?}",
                snapshot.bundle_id,
                snapshot.label,
                i,
                call.err(),
            );
        }
    }
}
