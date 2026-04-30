//! Drill configuration types — `DrillConfig` specifies who controls each seat
//! and what convention is being practiced. Construction lives in
//! `bridge-service::config_resolver`; callers build the HashMap directly.

use std::collections::HashMap;

use bridge_engine::types::Seat;

use crate::heuristics::BiddingStrategy;

// ── Seat assignment ─────────────────────────────────────────────────

/// Assignment for a single seat: user-controlled or AI with a strategy.
pub enum SeatAssignment {
    /// Human player — UI waits for input.
    User,
    /// AI-controlled with a bidding strategy.
    Ai(Box<dyn BiddingStrategy>),
}

// ── DrillConfig ─────────────────────────────────────────────────────

/// Configuration for a drill session — specifies who controls each seat
/// and what convention is being practiced.
pub struct DrillConfig {
    pub convention_id: String,
    pub user_seat: Seat,
    pub seat_strategies: HashMap<Seat, SeatAssignment>,
}

impl DrillConfig {
    /// Get the bidding strategy for a seat. Returns None for user seats
    /// or seats with no assignment.
    pub fn get_strategy(&self, seat: Seat) -> Option<&dyn BiddingStrategy> {
        match self.seat_strategies.get(&seat)? {
            SeatAssignment::User => None,
            SeatAssignment::Ai(strategy) => Some(strategy.as_ref()),
        }
    }

    /// Check if a seat is user-controlled.
    pub fn is_user_seat(&self, seat: Seat) -> bool {
        matches!(self.seat_strategies.get(&seat), Some(SeatAssignment::User))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::heuristics::{BidResult, BiddingContext};
    use bridge_engine::types::Call;

    struct TestStrategy {
        label: String,
    }
    impl BiddingStrategy for TestStrategy {
        fn id(&self) -> &str {
            "test-strategy"
        }
        fn name(&self) -> &str {
            "Test Strategy"
        }
        fn suggest_bid(&self, _ctx: &BiddingContext) -> Option<BidResult> {
            Some(BidResult {
                call: Call::Pass,
                rule_name: Some(self.label.clone()),
                explanation: "test".to_string(),
                ..Default::default()
            })
        }
        fn as_any(&self) -> &dyn std::any::Any {
            self
        }
    }

    #[test]
    fn get_strategy_returns_none_for_user() {
        let mut strategies = HashMap::new();
        strategies.insert(Seat::South, SeatAssignment::User);
        strategies.insert(
            Seat::North,
            SeatAssignment::Ai(Box::new(TestStrategy {
                label: "ns".to_string(),
            })),
        );

        let config = DrillConfig {
            convention_id: "test".to_string(),
            user_seat: Seat::South,
            seat_strategies: strategies,
        };

        assert!(config.get_strategy(Seat::South).is_none());
        assert!(config.get_strategy(Seat::North).is_some());
    }

    #[test]
    fn is_user_seat_check() {
        let mut strategies = HashMap::new();
        strategies.insert(Seat::South, SeatAssignment::User);
        strategies.insert(
            Seat::North,
            SeatAssignment::Ai(Box::new(TestStrategy {
                label: "ns".to_string(),
            })),
        );

        let config = DrillConfig {
            convention_id: "test".to_string(),
            user_seat: Seat::South,
            seat_strategies: strategies,
        };

        assert!(config.is_user_seat(Seat::South));
        assert!(!config.is_user_seat(Seat::North));
        assert!(!config.is_user_seat(Seat::East)); // not in map
    }
}
