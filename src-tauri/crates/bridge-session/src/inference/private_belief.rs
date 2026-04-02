//! Private belief conditioning — caps public ranges using the observer's own hand.
//!
//! When the observer holds 15 HCP, no other single seat can hold more than 25 (40 - 15).
//! Similarly, if the observer holds 5 spades, no other seat can hold more than 8.
//!
//! The per-seat caps are intentionally over-tight: each non-observer seat is capped
//! independently at (40 - observer_hcp), which allows the combined cap to exceed the
//! true remaining total. The posterior sampler's rejection step enforces the real
//! constraint (total dealt cards = 52, total HCP = 40). For typical hands (8-16 HCP),
//! rejection rates stay well under 50%. This matches the prior TS implementation.

use std::collections::HashMap;

use bridge_engine::hand_evaluator::evaluate_hand_hcp;
use bridge_engine::types::{Hand, Seat, Suit};

use super::types::{DerivedRanges, NumberRange};

/// Condition public belief ranges on the observer's own hand.
///
/// For each non-observer seat, tightens `hcp.max` and per-suit `length.max`
/// based on what the observer can see in their own hand. Returns a new map
/// with the tightened ranges (original map is not mutated).
pub fn condition_on_own_hand(
    ranges: &HashMap<Seat, DerivedRanges>,
    observer_seat: Seat,
    observer_hand: &Hand,
) -> HashMap<Seat, DerivedRanges> {
    let observer_hcp = evaluate_hand_hcp(observer_hand).hcp;
    let remaining_hcp = 40u32.saturating_sub(observer_hcp);

    // Count observer's suit lengths
    let mut observer_suit_lengths: HashMap<Suit, u32> = HashMap::new();
    for card in &observer_hand.cards {
        *observer_suit_lengths.entry(card.suit).or_insert(0) += 1;
    }

    ranges
        .iter()
        .map(|(&seat, dr)| {
            if seat == observer_seat {
                // Don't modify the observer's own ranges
                return (seat, dr.clone());
            }

            let capped_hcp = NumberRange {
                min: dr.hcp.min,
                max: dr.hcp.max.min(remaining_hcp),
            };

            let capped_suits: HashMap<Suit, NumberRange> = dr
                .suit_lengths
                .iter()
                .map(|(&suit, range)| {
                    let observer_in_suit = observer_suit_lengths.get(&suit).copied().unwrap_or(0);
                    let remaining_in_suit = 13u32.saturating_sub(observer_in_suit);
                    let capped = NumberRange {
                        min: range.min,
                        max: range.max.min(remaining_in_suit),
                    };
                    (suit, capped)
                })
                .collect();

            (
                seat,
                DerivedRanges {
                    hcp: capped_hcp,
                    suit_lengths: capped_suits,
                    is_balanced: dr.is_balanced,
                },
            )
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_engine::types::{Card, Rank};

    fn make_hand(cards: Vec<Card>) -> Hand {
        Hand { cards }
    }

    fn card(suit: Suit, rank: Rank) -> Card {
        Card { suit, rank }
    }

    fn default_ranges() -> DerivedRanges {
        let mut suit_lengths = HashMap::new();
        for &suit in &[Suit::Spades, Suit::Hearts, Suit::Diamonds, Suit::Clubs] {
            suit_lengths.insert(suit, NumberRange { min: 0, max: 13 });
        }
        DerivedRanges {
            hcp: NumberRange { min: 0, max: 40 },
            suit_lengths,
            is_balanced: None,
        }
    }

    #[test]
    fn caps_hcp_based_on_observer() {
        // South holds 15 HCP → other seats capped at 25
        let hand = make_hand(vec![
            // 4 Aces = 16 HCP (close enough to 15 for test)
            card(Suit::Spades, Rank::Ace),
            card(Suit::Hearts, Rank::Ace),
            card(Suit::Diamonds, Rank::Ace),
            card(Suit::Clubs, Rank::Ace),
        ]);
        // Actual HCP = 16

        let mut ranges = HashMap::new();
        ranges.insert(Seat::North, default_ranges());
        ranges.insert(Seat::East, default_ranges());
        ranges.insert(Seat::South, default_ranges());
        ranges.insert(Seat::West, default_ranges());

        let conditioned = condition_on_own_hand(&ranges, Seat::South, &hand);

        // Observer HCP = 16, remaining = 24
        assert_eq!(conditioned[&Seat::North].hcp.max, 24);
        assert_eq!(conditioned[&Seat::East].hcp.max, 24);
        assert_eq!(conditioned[&Seat::West].hcp.max, 24);
        // Observer's own ranges unchanged
        assert_eq!(conditioned[&Seat::South].hcp.max, 40);
    }

    #[test]
    fn caps_suit_lengths_based_on_observer() {
        // South holds 5 spades → other seats capped at 8 spades
        let hand = make_hand(vec![
            card(Suit::Spades, Rank::Ace),
            card(Suit::Spades, Rank::King),
            card(Suit::Spades, Rank::Queen),
            card(Suit::Spades, Rank::Jack),
            card(Suit::Spades, Rank::Ten),
        ]);

        let mut ranges = HashMap::new();
        ranges.insert(Seat::North, default_ranges());
        ranges.insert(Seat::East, default_ranges());

        let conditioned = condition_on_own_hand(&ranges, Seat::South, &hand);

        assert_eq!(conditioned[&Seat::North].suit_lengths[&Suit::Spades].max, 8);
        assert_eq!(conditioned[&Seat::East].suit_lengths[&Suit::Spades].max, 8);
        // Other suits unaffected (observer has 0 in those suits)
        assert_eq!(conditioned[&Seat::North].suit_lengths[&Suit::Hearts].max, 13);
    }

    #[test]
    fn void_suit_no_op() {
        // South has 0 spades → spade cap stays at 13
        let hand = make_hand(vec![
            card(Suit::Hearts, Rank::Ace),
        ]);

        let mut ranges = HashMap::new();
        ranges.insert(Seat::North, default_ranges());

        let conditioned = condition_on_own_hand(&ranges, Seat::South, &hand);

        assert_eq!(conditioned[&Seat::North].suit_lengths[&Suit::Spades].max, 13);
    }

    #[test]
    fn respects_existing_tighter_constraints() {
        // North already constrained to 15-17 HCP, observer has 10 HCP
        // Remaining = 30, but existing max (17) is tighter → keep 17
        let hand = make_hand(vec![
            card(Suit::Spades, Rank::Ace),   // 4
            card(Suit::Hearts, Rank::King),  // 3
            card(Suit::Diamonds, Rank::Queen), // 2
            // = 9 HCP (evaluate_hand_hcp will compute actual)
        ]);

        let mut north_ranges = default_ranges();
        north_ranges.hcp = NumberRange { min: 15, max: 17 };

        let mut ranges = HashMap::new();
        ranges.insert(Seat::North, north_ranges);

        let conditioned = condition_on_own_hand(&ranges, Seat::South, &hand);

        // 40 - 9 = 31, but existing max is 17, so min(17, 31) = 17
        assert_eq!(conditioned[&Seat::North].hcp.max, 17);
        assert_eq!(conditioned[&Seat::North].hcp.min, 15);
    }

    #[test]
    fn preserves_is_balanced() {
        let hand = make_hand(vec![card(Suit::Spades, Rank::Ace)]);

        let mut north_ranges = default_ranges();
        north_ranges.is_balanced = Some(true);

        let mut ranges = HashMap::new();
        ranges.insert(Seat::North, north_ranges);

        let conditioned = condition_on_own_hand(&ranges, Seat::South, &hand);

        assert_eq!(conditioned[&Seat::North].is_balanced, Some(true));
    }
}
