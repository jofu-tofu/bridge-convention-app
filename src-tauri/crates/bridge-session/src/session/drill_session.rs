//! Drill session bidding — AI seat bid generation.
//!
//! Ported from TS `src/session/drill-session.ts`. Simplified from the TS
//! `DrillSession` object to a single `get_next_bid()` function.

use bridge_engine::types::{Auction, Call, Hand, Seat};
use bridge_engine::hand_evaluator::evaluate_hand_hcp;
use bridge_engine::auction::is_legal_call;

use crate::heuristics::{BiddingContext, BidResult};

use super::config_factory::DrillConfig;

/// Get the next bid for a seat in the drill.
///
/// Returns `None` for user seats (signals UI should wait for input).
/// For AI seats, delegates to the assigned `BiddingStrategy`.
/// Falls back to Pass if the strategy returns None or suggests an illegal call.
pub fn get_next_bid(
    config: &DrillConfig,
    seat: Seat,
    hand: &Hand,
    auction: &Auction,
) -> Option<BidResult> {
    let strategy = config.get_strategy(seat)?;

    let evaluation = evaluate_hand_hcp(hand);
    let context = BiddingContext {
        hand: hand.clone(),
        auction: auction.clone(),
        seat,
        evaluation,
        vulnerability: None,
        dealer: None,
    };

    let result = strategy.suggest_bid(&context);

    match result {
        None => {
            // Strategy returned None -- default to pass
            Some(BidResult {
                call: Call::Pass,
                rule_name: None,
                explanation: "No matching rule -- defaulting to pass".to_string(),
            })
        }
        Some(bid_result) => {
            // Validate the suggested call is legal
            if !is_legal_call(auction, &bid_result.call, seat) {
                Some(BidResult {
                    call: Call::Pass,
                    rule_name: None,
                    explanation: "Convention suggested illegal bid -- defaulting to pass".to_string(),
                })
            } else {
                Some(bid_result)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_engine::types::BidSuit;
    use std::collections::HashMap;
    use crate::heuristics::{BiddingContext, BiddingStrategy, BidResult};

    /// A strategy that always suggests 1NT.
    struct Always1NT;
    impl BiddingStrategy for Always1NT {
        fn id(&self) -> &str { "always-1nt" }
        fn name(&self) -> &str { "Always 1NT" }
        fn suggest_bid(&self, _ctx: &BiddingContext) -> Option<BidResult> {
            Some(BidResult {
                call: Call::Bid { level: 1, strain: BidSuit::NoTrump },
                rule_name: Some("test-1nt".to_string()),
                explanation: "Always 1NT".to_string(),
            })
        }
    }

    /// A strategy that always returns None.
    struct NullStrategy;
    impl BiddingStrategy for NullStrategy {
        fn id(&self) -> &str { "null" }
        fn name(&self) -> &str { "Null" }
        fn suggest_bid(&self, _ctx: &BiddingContext) -> Option<BidResult> {
            None
        }
    }

    /// A strategy that suggests an illegal bid (1C when 1H is already bid).
    struct IllegalBidStrategy;
    impl BiddingStrategy for IllegalBidStrategy {
        fn id(&self) -> &str { "illegal" }
        fn name(&self) -> &str { "Illegal" }
        fn suggest_bid(&self, _ctx: &BiddingContext) -> Option<BidResult> {
            Some(BidResult {
                call: Call::Bid { level: 1, strain: BidSuit::Clubs },
                rule_name: Some("illegal".to_string()),
                explanation: "Bad bid".to_string(),
            })
        }
    }

    fn empty_hand() -> Hand {
        Hand { cards: vec![] }
    }

    fn empty_auction() -> Auction {
        Auction { entries: vec![], is_complete: false }
    }

    fn make_config_with_strategy(seat: Seat, strategy: Box<dyn BiddingStrategy>) -> DrillConfig {
        let mut strategies = HashMap::new();
        strategies.insert(seat, super::super::config_factory::SeatAssignment::Ai(strategy));
        DrillConfig {
            convention_id: "test".to_string(),
            user_seat: Seat::South,
            seat_strategies: strategies,
        }
    }

    #[test]
    fn user_seat_returns_none() {
        let config = DrillConfig {
            convention_id: "test".to_string(),
            user_seat: Seat::South,
            seat_strategies: {
                let mut m = HashMap::new();
                m.insert(Seat::South, super::super::config_factory::SeatAssignment::User);
                m
            },
        };
        let result = get_next_bid(&config, Seat::South, &empty_hand(), &empty_auction());
        assert!(result.is_none());
    }

    #[test]
    fn ai_seat_delegates_to_strategy() {
        let config = make_config_with_strategy(Seat::North, Box::new(Always1NT));
        let result = get_next_bid(&config, Seat::North, &empty_hand(), &empty_auction());
        let bid = result.unwrap();
        assert_eq!(bid.call, Call::Bid { level: 1, strain: BidSuit::NoTrump });
    }

    #[test]
    fn null_strategy_defaults_to_pass() {
        let config = make_config_with_strategy(Seat::North, Box::new(NullStrategy));
        let result = get_next_bid(&config, Seat::North, &empty_hand(), &empty_auction());
        let bid = result.unwrap();
        assert_eq!(bid.call, Call::Pass);
    }

    #[test]
    fn illegal_bid_defaults_to_pass() {
        // Set up auction where 1H was already bid, making 1C illegal
        let auction = Auction {
            entries: vec![
                bridge_engine::types::AuctionEntry {
                    seat: Seat::North,
                    call: Call::Bid { level: 1, strain: BidSuit::Hearts },
                },
            ],
            is_complete: false,
        };
        let config = make_config_with_strategy(Seat::East, Box::new(IllegalBidStrategy));
        let result = get_next_bid(&config, Seat::East, &empty_hand(), &auction);
        let bid = result.unwrap();
        assert_eq!(bid.call, Call::Pass);
    }

    #[test]
    fn unregistered_seat_returns_none() {
        let config = DrillConfig {
            convention_id: "test".to_string(),
            user_seat: Seat::South,
            seat_strategies: HashMap::new(),
        };
        let result = get_next_bid(&config, Seat::West, &empty_hand(), &empty_auction());
        assert!(result.is_none());
    }
}
