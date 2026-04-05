//! Incremental inference engine with asymmetric per-partnership providers.
//!
//! Uses `InferenceConfig` to route bids to the appropriate `InferenceProvider`
//! based on whether the bidder is in the observer's partnership or not.

use bridge_conventions::types::meaning::FactConstraint;
use bridge_engine::types::{Auction, AuctionEntry, Seat};
use bridge_engine::{partner_seat, SEATS};
use std::collections::HashMap;

use super::derive_beliefs::{derive_public_beliefs, hand_inference_to_constraints};
use super::types::{InferenceConfig, InferenceProvider, InferenceSnapshot, PublicBeliefs};

fn is_own_partnership(observer_seat: Seat, bidder_seat: Seat) -> bool {
    bidder_seat == observer_seat || bidder_seat == partner_seat(observer_seat)
}

/// Incremental inference engine that tracks per-seat constraints and
/// produces a timeline of inference snapshots.
pub struct InferenceEngine {
    config: InferenceConfig,
    observer_seat: Seat,
    raw_constraints: HashMap<Seat, Vec<FactConstraint>>,
    timeline: Vec<InferenceSnapshot>,
}

impl InferenceEngine {
    /// Create an incremental inference engine.
    /// Uses asymmetric providers: own partnership uses convention-aware inference,
    /// opponent partnership uses natural bidding theory.
    pub fn new(config: InferenceConfig, observer_seat: Seat) -> Self {
        let raw_constraints: HashMap<Seat, Vec<FactConstraint>> =
            SEATS.iter().map(|&s| (s, Vec::new())).collect();

        Self {
            config,
            observer_seat,
            raw_constraints,
            timeline: Vec::new(),
        }
    }

    /// Process a single bid and update inferences.
    pub fn process_bid(&mut self, entry: &AuctionEntry, auction_before: &Auction) {
        let bidder_seat = entry.seat;
        let provider: &dyn InferenceProvider =
            if is_own_partnership(self.observer_seat, bidder_seat) {
                self.config.own_partnership.as_ref()
            } else {
                self.config.opponent_partnership.as_ref()
            };

        let new_constraints: Vec<FactConstraint> =
            match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                provider.infer_from_bid(entry, auction_before, bidder_seat)
            })) {
                Ok(Some(inference)) => {
                    let constraints = hand_inference_to_constraints(&inference);
                    self.raw_constraints
                        .get_mut(&bidder_seat)
                        .unwrap()
                        .extend(constraints.clone());
                    constraints
                }
                Ok(None) => Vec::new(),
                Err(_) => {
                    // Inference errors are silently swallowed -- never propagated to callers
                    Vec::new()
                }
            };

        self.timeline.push(InferenceSnapshot {
            entry: entry.clone(),
            new_constraints,
            cumulative_beliefs: self.compute_beliefs(),
        });
    }

    /// Get derived public beliefs for all seats.
    pub fn get_beliefs(&self) -> HashMap<Seat, PublicBeliefs> {
        self.compute_beliefs()
    }

    /// Get per-bid inference timeline snapshots.
    pub fn get_timeline(&self) -> &[InferenceSnapshot] {
        &self.timeline
    }

    /// Clear all accumulated constraints and timeline.
    pub fn reset(&mut self) {
        for seat in &SEATS {
            self.raw_constraints.get_mut(seat).unwrap().clear();
        }
        self.timeline.clear();
    }

    fn compute_beliefs(&self) -> HashMap<Seat, PublicBeliefs> {
        SEATS
            .iter()
            .map(|&seat| {
                let beliefs = derive_public_beliefs(seat, &self.raw_constraints[&seat]);
                (seat, beliefs)
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_conventions::types::meaning::{ConstraintValue, FactOperator};
    use bridge_engine::types::{BidSuit, Call};

    use crate::inference::types::HandInference;

    /// A configurable test provider that returns a fixed HandInference.
    struct FixedProvider {
        result: Option<HandInference>,
        call_log: std::sync::Mutex<Vec<AuctionEntry>>,
    }

    impl FixedProvider {
        fn new(result: Option<HandInference>) -> Self {
            Self {
                result,
                call_log: std::sync::Mutex::new(Vec::new()),
            }
        }
    }

    impl InferenceProvider for FixedProvider {
        fn id(&self) -> &str {
            "test-provider"
        }
        fn name(&self) -> &str {
            "test-provider"
        }
        fn infer_from_bid(
            &self,
            entry: &AuctionEntry,
            _auction_before: &Auction,
            _seat: Seat,
        ) -> Option<HandInference> {
            self.call_log.lock().unwrap().push(entry.clone());
            self.result.clone()
        }
    }

    /// A provider that panics on every call.
    struct PanickingProvider;

    impl InferenceProvider for PanickingProvider {
        fn id(&self) -> &str {
            "panicking"
        }
        fn name(&self) -> &str {
            "panicking"
        }
        fn infer_from_bid(
            &self,
            _entry: &AuctionEntry,
            _auction_before: &Auction,
            _seat: Seat,
        ) -> Option<HandInference> {
            panic!("provider exploded");
        }
    }

    fn bid_1nt() -> AuctionEntry {
        AuctionEntry {
            seat: Seat::North,
            call: Call::Bid {
                level: 1,
                strain: BidSuit::NoTrump,
            },
        }
    }

    fn pass_entry(seat: Seat) -> AuctionEntry {
        AuctionEntry {
            seat,
            call: Call::Pass,
        }
    }

    fn empty_auction() -> Auction {
        Auction {
            entries: vec![],
            is_complete: false,
        }
    }

    /// A provider that returns a fixed result and tracks call count via shared counter.
    struct CountingProvider {
        result: Option<HandInference>,
        count: std::sync::Arc<std::sync::atomic::AtomicUsize>,
    }

    impl CountingProvider {
        fn new(
            result: Option<HandInference>,
        ) -> (Self, std::sync::Arc<std::sync::atomic::AtomicUsize>) {
            let count = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
            (
                Self {
                    result,
                    count: count.clone(),
                },
                count,
            )
        }
    }

    impl InferenceProvider for CountingProvider {
        fn id(&self) -> &str {
            "counting"
        }
        fn name(&self) -> &str {
            "counting"
        }
        fn infer_from_bid(
            &self,
            _entry: &AuctionEntry,
            _auction_before: &Auction,
            _seat: Seat,
        ) -> Option<HandInference> {
            self.count.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            self.result.clone()
        }
    }

    #[test]
    fn routes_own_partnership_bids_to_own_provider() {
        let (own, own_count) = CountingProvider::new(None);
        let (opponent, opp_count) = CountingProvider::new(None);

        let mut engine = InferenceEngine::new(
            InferenceConfig {
                own_partnership: Box::new(own),
                opponent_partnership: Box::new(opponent),
            },
            Seat::South,
        );

        let entry = bid_1nt(); // North bids -- same partnership as South observer
        engine.process_bid(&entry, &empty_auction());

        assert_eq!(own_count.load(std::sync::atomic::Ordering::SeqCst), 1);
        assert_eq!(opp_count.load(std::sync::atomic::Ordering::SeqCst), 0);
    }

    #[test]
    fn routes_opponent_bids_to_opponent_provider() {
        let (own, own_count) = CountingProvider::new(None);
        let (opponent, opp_count) = CountingProvider::new(None);

        let mut engine = InferenceEngine::new(
            InferenceConfig {
                own_partnership: Box::new(own),
                opponent_partnership: Box::new(opponent),
            },
            Seat::South,
        );

        engine.process_bid(&pass_entry(Seat::East), &empty_auction());

        assert_eq!(opp_count.load(std::sync::atomic::Ordering::SeqCst), 1);
        assert_eq!(own_count.load(std::sync::atomic::Ordering::SeqCst), 0);
    }

    #[test]
    fn accumulates_constraints_and_returns_derived_beliefs() {
        let inference = HandInference {
            seat: Seat::North,
            source: "test".to_string(),
            min_hcp: Some(15),
            max_hcp: Some(17),
            is_balanced: None,
            suits: HashMap::new(),
        };

        let mut engine = InferenceEngine::new(
            InferenceConfig {
                own_partnership: Box::new(FixedProvider::new(Some(inference))),
                opponent_partnership: Box::new(FixedProvider::new(None)),
            },
            Seat::South,
        );

        engine.process_bid(&bid_1nt(), &empty_auction());
        let result = engine.get_beliefs();

        assert_eq!(result[&Seat::North].ranges.hcp.min, 15);
        assert_eq!(result[&Seat::North].ranges.hcp.max, 17);
        // Other seats should have wide-open defaults
        assert_eq!(result[&Seat::South].ranges.hcp.min, 0);
        assert_eq!(result[&Seat::South].ranges.hcp.max, 40);
    }

    #[test]
    fn null_inference_does_not_push_constraints() {
        let mut engine = InferenceEngine::new(
            InferenceConfig {
                own_partnership: Box::new(FixedProvider::new(None)),
                opponent_partnership: Box::new(FixedProvider::new(None)),
            },
            Seat::South,
        );

        engine.process_bid(&bid_1nt(), &empty_auction());
        let result = engine.get_beliefs();

        assert_eq!(result[&Seat::North].ranges.hcp.min, 0);
        assert_eq!(result[&Seat::North].ranges.hcp.max, 40);
    }

    #[test]
    fn swallows_provider_panics_silently() {
        let mut engine = InferenceEngine::new(
            InferenceConfig {
                own_partnership: Box::new(PanickingProvider),
                opponent_partnership: Box::new(FixedProvider::new(None)),
            },
            Seat::South,
        );

        // Should not panic
        engine.process_bid(&bid_1nt(), &empty_auction());

        // Beliefs should still be wide-open defaults
        let result = engine.get_beliefs();
        assert_eq!(result[&Seat::North].ranges.hcp.min, 0);
    }

    #[test]
    fn timeline_records_snapshots() {
        let inference = HandInference {
            seat: Seat::North,
            source: "test".to_string(),
            min_hcp: Some(12),
            max_hcp: None,
            is_balanced: None,
            suits: HashMap::new(),
        };

        let mut engine = InferenceEngine::new(
            InferenceConfig {
                own_partnership: Box::new(FixedProvider::new(Some(inference))),
                opponent_partnership: Box::new(FixedProvider::new(None)),
            },
            Seat::South,
        );

        assert!(engine.get_timeline().is_empty());

        engine.process_bid(&bid_1nt(), &empty_auction());

        let timeline = engine.get_timeline();
        assert_eq!(timeline.len(), 1);
        assert_eq!(timeline[0].entry.seat, Seat::North);
        assert_eq!(timeline[0].new_constraints.len(), 1);
        assert_eq!(timeline[0].new_constraints[0].fact_id, "hand.hcp");
        assert_eq!(timeline[0].new_constraints[0].operator, FactOperator::Gte);
        assert_eq!(
            timeline[0].new_constraints[0].value,
            ConstraintValue::int(12)
        );
    }

    #[test]
    fn timeline_records_snapshot_on_null_inference() {
        let mut engine = InferenceEngine::new(
            InferenceConfig {
                own_partnership: Box::new(FixedProvider::new(None)),
                opponent_partnership: Box::new(FixedProvider::new(None)),
            },
            Seat::South,
        );

        engine.process_bid(&bid_1nt(), &empty_auction());

        assert_eq!(engine.get_timeline().len(), 1);
        assert!(engine.get_timeline()[0].new_constraints.is_empty());
    }

    #[test]
    fn timeline_records_snapshot_on_panic() {
        let mut engine = InferenceEngine::new(
            InferenceConfig {
                own_partnership: Box::new(PanickingProvider),
                opponent_partnership: Box::new(FixedProvider::new(None)),
            },
            Seat::South,
        );

        engine.process_bid(&bid_1nt(), &empty_auction());

        assert_eq!(engine.get_timeline().len(), 1);
        assert!(engine.get_timeline()[0].new_constraints.is_empty());
    }

    #[test]
    fn reset_clears_constraints_and_timeline() {
        let inference = HandInference {
            seat: Seat::North,
            source: "test".to_string(),
            min_hcp: Some(15),
            max_hcp: Some(17),
            is_balanced: None,
            suits: HashMap::new(),
        };

        let mut engine = InferenceEngine::new(
            InferenceConfig {
                own_partnership: Box::new(FixedProvider::new(Some(inference))),
                opponent_partnership: Box::new(FixedProvider::new(None)),
            },
            Seat::South,
        );

        engine.process_bid(&bid_1nt(), &empty_auction());
        assert_eq!(engine.get_timeline().len(), 1);
        assert_eq!(engine.get_beliefs()[&Seat::North].ranges.hcp.min, 15);

        engine.reset();

        assert!(engine.get_timeline().is_empty());
        assert_eq!(engine.get_beliefs()[&Seat::North].ranges.hcp.min, 0);
        assert_eq!(engine.get_beliefs()[&Seat::North].ranges.hcp.max, 40);
    }
}
