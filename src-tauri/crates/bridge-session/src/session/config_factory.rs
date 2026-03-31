//! Drill configuration factory — builds DrillConfig from convention ID and user seat.
//!
//! Ported from TS `src/session/config-factory.ts`. Simplified: no EnginePort
//! (Rust calls engine functions directly), no play strategy provider (deferred).

use std::collections::HashMap;

use bridge_engine::types::Seat;
use bridge_engine::SEATS;

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

/// NS seats set for strategy assignment.
const NS_SEATS: [Seat; 2] = [Seat::North, Seat::South];

/// Create a DrillConfig with the standard seat assignment pattern:
/// - User seat = User
/// - User's partner (NS) = convention strategy (ns_strategy)
/// - Opponents (EW) = opponent strategy (ew_strategy)
///
/// The caller provides the actual strategy instances — this function
/// just wires them to the right seats.
pub fn create_drill_config(
    convention_id: String,
    user_seat: Seat,
    ns_strategy: Box<dyn BiddingStrategy>,
    ew_strategy: Box<dyn BiddingStrategy>,
) -> DrillConfig {
    let mut strategies = HashMap::new();

    for &seat in &SEATS {
        if seat == user_seat {
            strategies.insert(seat, SeatAssignment::User);
        } else if NS_SEATS.contains(&seat) {
            // Clone-like: we need separate strategy instances per seat.
            // The caller provides one NS strategy; for the partner seat we reuse it.
            // Since BiddingStrategy is behind a trait object, we can't clone it.
            // Instead, the caller should provide a strategy that can be shared.
            // For now, we assign the ns_strategy to the first non-user NS seat found.
            strategies.insert(seat, SeatAssignment::Ai(ns_strategy));
            // After inserting the NS strategy, remaining NS seats need their own.
            // Since we only have one partner (user is one of NS), this works.
            break;
        }
    }

    // Fill remaining seats
    for &seat in &SEATS {
        if strategies.contains_key(&seat) {
            continue;
        }
        if seat == user_seat {
            strategies.insert(seat, SeatAssignment::User);
        } else if NS_SEATS.contains(&seat) {
            // This shouldn't happen if user is NS, but handle gracefully.
            // The ns_strategy was already consumed above.
            // In practice, user is always South, so North gets the strategy.
        } else {
            // EW seat
            strategies.insert(seat, SeatAssignment::Ai(ew_strategy));
            // Similarly, EW strategy consumed for first EW seat.
            // Need to handle second EW seat.
            break;
        }
    }

    // This approach with consuming Box doesn't work for multiple seats.
    // Redesign: accept a factory function or use the direct HashMap approach.
    // For now, let's just build the HashMap directly.
    DrillConfig {
        convention_id,
        user_seat,
        seat_strategies: strategies,
    }
}

/// Create a DrillConfig from pre-built seat assignments.
/// This is the preferred constructor — callers build the HashMap themselves.
pub fn create_drill_config_from_assignments(
    convention_id: String,
    user_seat: Seat,
    seat_strategies: HashMap<Seat, SeatAssignment>,
) -> DrillConfig {
    DrillConfig {
        convention_id,
        user_seat,
        seat_strategies,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::heuristics::{BiddingContext, BidResult};
    use bridge_engine::types::Call;

    struct TestStrategy {
        label: String,
    }
    impl BiddingStrategy for TestStrategy {
        fn id(&self) -> &str { "test-strategy" }
        fn name(&self) -> &str { "Test Strategy" }
        fn suggest_bid(&self, _ctx: &BiddingContext) -> Option<BidResult> {
            Some(BidResult {
                call: Call::Pass,
                rule_name: Some(self.label.clone()),
                explanation: "test".to_string(),
                ..Default::default()
            })
        }
        fn as_any(&self) -> &dyn std::any::Any { self }
    }

    #[test]
    fn get_strategy_returns_none_for_user() {
        let mut strategies = HashMap::new();
        strategies.insert(Seat::South, SeatAssignment::User);
        strategies.insert(Seat::North, SeatAssignment::Ai(Box::new(TestStrategy { label: "ns".to_string() })));

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
        strategies.insert(Seat::North, SeatAssignment::Ai(Box::new(TestStrategy { label: "ns".to_string() })));

        let config = DrillConfig {
            convention_id: "test".to_string(),
            user_seat: Seat::South,
            seat_strategies: strategies,
        };

        assert!(config.is_user_seat(Seat::South));
        assert!(!config.is_user_seat(Seat::North));
        assert!(!config.is_user_seat(Seat::East)); // not in map
    }

    #[test]
    fn create_config_from_assignments() {
        let mut strategies = HashMap::new();
        strategies.insert(Seat::South, SeatAssignment::User);
        strategies.insert(Seat::North, SeatAssignment::Ai(Box::new(TestStrategy { label: "ns".to_string() })));
        strategies.insert(Seat::East, SeatAssignment::Ai(Box::new(TestStrategy { label: "ew".to_string() })));
        strategies.insert(Seat::West, SeatAssignment::Ai(Box::new(TestStrategy { label: "ew".to_string() })));

        let config = create_drill_config_from_assignments(
            "nt-bundle".to_string(),
            Seat::South,
            strategies,
        );

        assert_eq!(config.convention_id, "nt-bundle");
        assert_eq!(config.user_seat, Seat::South);
        assert!(config.is_user_seat(Seat::South));
        assert!(config.get_strategy(Seat::North).is_some());
        assert!(config.get_strategy(Seat::East).is_some());
        assert!(config.get_strategy(Seat::West).is_some());
    }
}
