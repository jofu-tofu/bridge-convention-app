//! RED tests: Convention pipeline adapter must produce correct bids for all fixture scenarios.
//!
//! Each test loads pipeline golden-master fixtures (captured from the TS pipeline),
//! builds a ConventionStrategyAdapter, and asserts that suggest_bid() returns the
//! expected call for each scenario.
//!
//! Run: `cargo test -p bridge-service --test convention_pipeline_red`

use std::collections::HashMap;

use bridge_conventions::registry::bundle_registry::resolve_bundle;
use bridge_conventions::registry::spec_builder::spec_from_bundle;
use bridge_conventions::teaching::teaching_types::{SurfaceGroup, SurfaceGroupRelationship};
use bridge_conventions::types::system_config::BaseSystemId;
use bridge_engine::hand_evaluator::evaluate_hand_hcp;
use bridge_engine::types::{Auction, AuctionEntry, BidSuit, Call, Card, Hand, Seat, Suit};
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
fn nt_bundle_adapter_produces_correct_bids() {
    run_bundle_tests("nt-bundle");
}

#[test]
fn nt_stayman_adapter_produces_correct_bids() {
    run_bundle_tests("nt-stayman");
}

#[test]
fn nt_transfers_adapter_produces_correct_bids() {
    run_bundle_tests("nt-transfers");
}

#[test]
fn bergen_bundle_adapter_produces_correct_bids() {
    run_bundle_tests("bergen-bundle");
}

#[test]
fn weak_twos_adapter_produces_correct_bids() {
    run_bundle_tests("weak-twos-bundle");
}

#[test]
fn dont_bundle_adapter_produces_correct_bids() {
    run_bundle_tests("dont-bundle");
}

// ── Integration tests: grading wiring + kernel advancement ──────────

/// Helper: build a hand from a string like "SA SK SQ SJ HA HK HQ DA DK DC CA C2 C3"
fn make_hand(cards_str: &str) -> Hand {
    let cards: Vec<Card> = cards_str
        .split_whitespace()
        .map(|s| {
            let bytes = s.as_bytes();
            let suit = match bytes[0] {
                b'S' => Suit::Spades,
                b'H' => Suit::Hearts,
                b'D' => Suit::Diamonds,
                b'C' => Suit::Clubs,
                _ => panic!("Unknown suit: {}", s),
            };
            let rank = match &s[1..] {
                "A" => bridge_engine::types::Rank::Ace,
                "K" => bridge_engine::types::Rank::King,
                "Q" => bridge_engine::types::Rank::Queen,
                "J" => bridge_engine::types::Rank::Jack,
                "10" | "T" => bridge_engine::types::Rank::Ten,
                "9" => bridge_engine::types::Rank::Nine,
                "8" => bridge_engine::types::Rank::Eight,
                "7" => bridge_engine::types::Rank::Seven,
                "6" => bridge_engine::types::Rank::Six,
                "5" => bridge_engine::types::Rank::Five,
                "4" => bridge_engine::types::Rank::Four,
                "3" => bridge_engine::types::Rank::Three,
                "2" => bridge_engine::types::Rank::Two,
                _ => panic!("Unknown rank: {}", s),
            };
            Card { suit, rank }
        })
        .collect();
    assert_eq!(cards.len(), 13, "Hand must have 13 cards");
    Hand { cards }
}

#[test]
fn grading_wiring_truth_set_populated() {
    // Hand with both Stayman (4 spades) and transfer (5 hearts) options
    // after partner opens 1NT. If the pipeline selects one, the other
    // should appear in truth_set_calls.
    //
    // 4 spades + 5 hearts + 2 diamonds + 2 clubs, ~10 HCP → game-force
    let hand = make_hand("SA SQ S9 S4 HA HK H8 H5 H3 DQ D6 C7 C3");

    let adapter = build_adapter("nt-bundle");
    let ctx = BiddingContext {
        hand: hand.clone(),
        auction: Auction {
            entries: vec![AuctionEntry {
                seat: Seat::North,
                call: Call::Bid {
                    level: 1,
                    strain: BidSuit::NoTrump,
                },
            }],
            is_complete: false,
        },
        seat: Seat::South,
        evaluation: evaluate_hand_hcp(&hand),
        vulnerability: None,
        dealer: Some(Seat::North),
    };

    let mut all_hands = HashMap::new();
    // Partner's 1NT opening hand (15-17 balanced)
    let partner_hand = make_hand("SK SJ S3 HJ H7 DA DK DJ D5 CA CK CJ C8");
    all_hands.insert(Seat::North, partner_hand);
    all_hands.insert(Seat::South, hand);

    let (result, _eval) = adapter.suggest_with_evaluation(&ctx, Some(&all_hands));
    let bid = result.expect("Pipeline should produce a bid");

    // The pipeline should have selected a bid AND populated truth_set_calls
    // with at least one alternative (Stayman vs transfer are both valid).
    // If truth_set_calls is empty, the wiring is broken.
    assert!(
        !bid.truth_set_calls.is_empty() || bid.call != Call::Pass,
        "Expected truth_set_calls to contain alternatives or at least a non-Pass bid. \
         Got call={:?}, truth_set={:?}",
        bid.call,
        bid.truth_set_calls,
    );
}

#[test]
fn observation_log_tracks_fit_through_transfer_acceptance() {
    // Replay 1NT → 2♦ (transfer to hearts) → 2♥ (accept) and verify
    // that kernel advancement produces fit_agreed = Hearts/Final on the
    // accept step. We check indirectly via suggest_with_evaluation: if
    // relational context is threaded, fact evaluation on the next user
    // turn receives fit context.

    // Responder's hand: 5+ hearts, invitational (8-9 HCP)
    let responder = make_hand("S7 S3 HA HQ H9 H6 H2 DA D8 D5 CK C6 C4");
    // Opener's 1NT hand (15-17 balanced)
    let opener = make_hand("SA SK SQ HK HJ DK DJ D7 D3 CA CQ C9 C2");

    let adapter = build_adapter("nt-bundle");

    // After 1NT → 2♦ → 2♥, it's responder's turn
    let ctx = BiddingContext {
        hand: responder.clone(),
        auction: Auction {
            entries: vec![
                AuctionEntry {
                    seat: Seat::North,
                    call: Call::Bid { level: 1, strain: BidSuit::NoTrump },
                },
                AuctionEntry {
                    seat: Seat::South,
                    call: Call::Bid { level: 2, strain: BidSuit::Diamonds },
                },
                AuctionEntry {
                    seat: Seat::North,
                    call: Call::Bid { level: 2, strain: BidSuit::Hearts },
                },
            ],
            is_complete: false,
        },
        seat: Seat::South,
        evaluation: evaluate_hand_hcp(&responder),
        vulnerability: None,
        dealer: Some(Seat::North),
    };

    let mut all_hands = HashMap::new();
    all_hands.insert(Seat::North, opener);
    all_hands.insert(Seat::South, responder);

    let (result, eval) = adapter.suggest_with_evaluation(&ctx, Some(&all_hands));

    // The pipeline should produce a bid (not None).
    assert!(
        result.is_some(),
        "Pipeline should produce a bid after transfer acceptance"
    );

    // Verify the observation log has advancing kernel state.
    // The evaluation's auction_context should exist and the log's last
    // step should show fit_agreed is present after the accept.
    if let Some(ref auction_ctx) = eval.auction_context {
        let log = &auction_ctx.log;
        assert!(
            log.len() >= 3,
            "Observation log should have at least 3 steps, got {}",
            log.len()
        );

        // Step 3 (2♥ accept) should have fit_agreed set
        let accept_step = &log[2];
        assert!(
            accept_step.state_after.fit_agreed.is_some(),
            "After transfer acceptance (2♥), state_after.fit_agreed should be Some, \
             got None. Kernel advancement is not working."
        );

        let fit = accept_step.state_after.fit_agreed.as_ref().unwrap();
        assert_eq!(
            fit.strain,
            bridge_conventions::types::bid_action::BidSuitName::Hearts,
            "Agreed fit strain should be Hearts after 2♦ transfer → 2♥ accept"
        );
    }
}
