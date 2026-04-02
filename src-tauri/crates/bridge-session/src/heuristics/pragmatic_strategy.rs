//! Pragmatic bidding strategy — tactical generators for competitive situations.
//!
//! Generates context-appropriate bids for situations the convention system
//! doesn't cover: competitive overcalls, protective doubles, and NT downgrades.
//! Sits in the strategy chain after the convention adapter, before natural fallback.

use bridge_engine::types::{AuctionEntry, BidSuit, Call};
use bridge_engine::{is_legal_call};

use super::{BidResult, BiddingContext, BiddingStrategy};

/// Pragmatic bidding strategy with 3 tactical generators.
pub struct PragmaticStrategy;

impl BiddingStrategy for PragmaticStrategy {
    fn id(&self) -> &str {
        "pragmatic"
    }

    fn name(&self) -> &str {
        "Pragmatic Tactical"
    }

    fn suggest_bid(&self, context: &BiddingContext) -> Option<BidResult> {
        // Try generators in priority order
        try_competitive_overcall(context)
            .or_else(|| try_protective_double(context))
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

/// Suit order: [0]=Spades, [1]=Hearts, [2]=Diamonds, [3]=Clubs
const SHAPE_TO_BID_SUIT: [BidSuit; 4] = [
    BidSuit::Spades,
    BidSuit::Hearts,
    BidSuit::Diamonds,
    BidSuit::Clubs,
];

const SUIT_NAMES: [&str; 4] = ["Spades", "Hearts", "Diamonds", "Clubs"];

/// Competitive overcall: 8+ HCP, 5+ card suit, opponents have bid.
fn try_competitive_overcall(context: &BiddingContext) -> Option<BidResult> {
    let eval = &context.evaluation;
    if eval.hcp < 8 {
        return None;
    }

    // Check that opponents have bid (at least one non-pass call from E/W)
    let opponents_bid = context.auction.entries.iter().any(|e| {
        is_opponent(e, context) && !matches!(e.call, Call::Pass)
    });
    if !opponents_bid {
        return None;
    }

    // Find longest 5+ card suit
    let mut best_idx: Option<usize> = None;
    let mut best_len: u8 = 4;
    for i in 0..4 {
        if eval.shape[i] > best_len {
            best_len = eval.shape[i];
            best_idx = Some(i);
        }
    }

    let idx = best_idx?;
    let strain = SHAPE_TO_BID_SUIT[idx];

    // Find cheapest legal level (cap at 3 for safety)
    let max_level = if eval.hcp >= 16 { 4 } else if eval.hcp >= 12 { 3 } else { 2 };
    for level in 1..=max_level {
        let call = Call::Bid { level, strain };
        if is_legal_call(&context.auction, &call, context.seat) {
            return Some(BidResult {
                call,
                rule_name: None,
                explanation: format!(
                    "Competitive overcall with {} HCP and {}-card {} suit",
                    eval.hcp, best_len, SUIT_NAMES[idx]
                ),
                ..Default::default()
            });
        }
    }

    None
}

/// Protective double: in passout seat (3 passes after an opening bid), 10+ HCP.
fn try_protective_double(context: &BiddingContext) -> Option<BidResult> {
    let eval = &context.evaluation;
    if eval.hcp < 10 {
        return None;
    }

    let entries = &context.auction.entries;
    if entries.len() < 3 {
        return None;
    }

    // Check passout-seat pattern: opponent opened, two passes, now our turn
    // Pattern: opponent bid, partner pass, opponent pass → we're in balancing seat
    let n = entries.len();
    let last_three_are_pass_pattern =
        !matches!(entries[n - 3].call, Call::Pass)  // opponent's bid
        && matches!(entries[n - 2].call, Call::Pass)  // partner passed
        && matches!(entries[n - 1].call, Call::Pass);  // opponent passed

    if !last_three_are_pass_pattern {
        return None;
    }

    // Verify the non-pass bid was from an opponent
    if !is_opponent(&entries[n - 3], context) {
        return None;
    }

    let call = Call::Double;
    if is_legal_call(&context.auction, &call, context.seat) {
        return Some(BidResult {
            call,
            rule_name: None,
            explanation: format!(
                "Protective double with {} HCP in balancing seat",
                eval.hcp
            ),
            ..Default::default()
        });
    }

    None
}

/// Check if an auction entry is from an opponent (not same partnership as context.seat).
fn is_opponent(entry: &AuctionEntry, context: &BiddingContext) -> bool {
    use bridge_engine::types::Seat;
    let same_pair = matches!(
        (context.seat, entry.seat),
        (Seat::North, Seat::South) | (Seat::South, Seat::North)
        | (Seat::East, Seat::West) | (Seat::West, Seat::East)
        | (Seat::North, Seat::North) | (Seat::South, Seat::South)
        | (Seat::East, Seat::East) | (Seat::West, Seat::West)
    );
    !same_pair
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_engine::types::{Auction, AuctionEntry, Hand, HandEvaluation, Seat};
    use bridge_engine::DistributionPoints;

    fn make_context(hcp: u32, shape: [u8; 4], entries: Vec<AuctionEntry>) -> BiddingContext {
        let distribution = bridge_engine::calculate_distribution_points(&shape);
        BiddingContext {
            hand: Hand { cards: vec![] },
            auction: Auction { entries, is_complete: false },
            seat: Seat::South,
            evaluation: HandEvaluation {
                hcp,
                distribution,
                shape,
                total_points: hcp + distribution.total,
                strategy: "HCP".to_string(),
            },
            vulnerability: None,
            dealer: None,
        }
    }

    #[test]
    fn competitive_overcall_with_5_card_suit() {
        let ctx = make_context(10, [5, 3, 3, 2], vec![
            AuctionEntry { seat: Seat::West, call: Call::Bid { level: 1, strain: BidSuit::Clubs } },
        ]);
        let strategy = PragmaticStrategy;
        let result = strategy.suggest_bid(&ctx).unwrap();
        assert_eq!(result.call, Call::Bid { level: 1, strain: BidSuit::Spades });
        assert!(result.explanation.contains("Competitive overcall"));
    }

    #[test]
    fn declines_overcall_without_opponent_bid() {
        let ctx = make_context(10, [5, 3, 3, 2], vec![]);
        let strategy = PragmaticStrategy;
        assert!(strategy.suggest_bid(&ctx).is_none());
    }

    #[test]
    fn declines_overcall_with_low_hcp() {
        let ctx = make_context(6, [5, 3, 3, 2], vec![
            AuctionEntry { seat: Seat::West, call: Call::Bid { level: 1, strain: BidSuit::Clubs } },
        ]);
        let strategy = PragmaticStrategy;
        assert!(strategy.suggest_bid(&ctx).is_none());
    }

    #[test]
    fn protective_double_in_balancing_seat() {
        let ctx = make_context(12, [4, 3, 3, 3], vec![
            AuctionEntry { seat: Seat::West, call: Call::Bid { level: 1, strain: BidSuit::Hearts } },
            AuctionEntry { seat: Seat::North, call: Call::Pass },
            AuctionEntry { seat: Seat::East, call: Call::Pass },
        ]);
        let strategy = PragmaticStrategy;
        let result = strategy.suggest_bid(&ctx).unwrap();
        assert_eq!(result.call, Call::Double);
        assert!(result.explanation.contains("Protective double"));
    }

    #[test]
    fn no_protective_double_with_low_hcp() {
        let ctx = make_context(8, [4, 3, 3, 3], vec![
            AuctionEntry { seat: Seat::West, call: Call::Bid { level: 1, strain: BidSuit::Hearts } },
            AuctionEntry { seat: Seat::North, call: Call::Pass },
            AuctionEntry { seat: Seat::East, call: Call::Pass },
        ]);
        let strategy = PragmaticStrategy;
        assert!(strategy.suggest_bid(&ctx).is_none());
    }

    #[test]
    fn no_protective_double_not_balancing_seat() {
        let ctx = make_context(12, [4, 3, 3, 3], vec![
            AuctionEntry { seat: Seat::West, call: Call::Bid { level: 1, strain: BidSuit::Hearts } },
        ]);
        let strategy = PragmaticStrategy;
        // Only overcall check, not protective (need 3 entries for passout pattern)
        let result = strategy.suggest_bid(&ctx);
        // No 5-card suit, no overcall; no 3-entry pattern, no protective
        assert!(result.is_none());
    }
}
