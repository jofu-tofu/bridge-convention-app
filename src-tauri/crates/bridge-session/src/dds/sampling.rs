//! Monte Carlo remaining-card sampling with optional L1 range filtering.

use std::collections::{HashMap, HashSet};

use bridge_engine::types::{Card, Seat};
use bridge_engine::{calculate_hcp, get_suit_length, Hand};
use rand::seq::SliceRandom;
use rand::Rng;

use crate::inference::types::DerivedRanges;

use super::ALL_SEATS;

/// Sample complete remaining-card assignments across all four seats.
pub fn sample_deals(
    remaining_cards: &HashMap<Seat, Vec<Card>>,
    visible_seats: &[Seat],
    constraints: &HashMap<Seat, DerivedRanges>,
    use_constraints: bool,
    count: usize,
    max_attempts: usize,
    rng: &mut impl Rng,
) -> Vec<HashMap<Seat, Vec<Card>>> {
    let visible_set: HashSet<Seat> = visible_seats.iter().copied().collect();
    let mut non_visible_seats = Vec::new();
    let mut seat_card_counts = HashMap::new();
    let mut unknown_pool = Vec::new();

    for seat in ALL_SEATS {
        let cards = remaining_cards.get(&seat).map_or(&[][..], Vec::as_slice);
        if visible_set.contains(&seat) {
            continue;
        }
        non_visible_seats.push(seat);
        seat_card_counts.insert(seat, cards.len());
        unknown_pool.extend_from_slice(cards);
    }

    let mut results = Vec::new();
    let mut attempts = 0;

    while results.len() < count && attempts < max_attempts {
        attempts += 1;

        let mut shuffled_pool = unknown_pool.clone();
        shuffled_pool.shuffle(rng);

        let mut offset = 0;
        let mut deal = HashMap::new();
        let mut valid = true;

        for seat in &non_visible_seats {
            let needed = *seat_card_counts.get(seat).unwrap_or(&0);
            let cards = shuffled_pool[offset..offset + needed].to_vec();
            offset += needed;

            if use_constraints {
                if let Some(ranges) = constraints.get(seat) {
                    if !satisfies_constraints(&cards, ranges) {
                        valid = false;
                        break;
                    }
                }
            }

            deal.insert(*seat, cards);
        }

        if !valid {
            continue;
        }

        for seat in ALL_SEATS {
            if visible_set.contains(&seat) {
                deal.insert(
                    seat,
                    remaining_cards.get(&seat).cloned().unwrap_or_default(),
                );
            }
        }

        results.push(deal);
    }

    results
}

fn satisfies_constraints(cards: &[Card], ranges: &DerivedRanges) -> bool {
    let hand = Hand {
        cards: cards.to_vec(),
    };
    let hcp = calculate_hcp(&hand);
    if hcp < ranges.hcp.min || hcp > ranges.hcp.max {
        return false;
    }

    let shape = get_suit_length(&hand);
    for (suit, range) in &ranges.suit_lengths {
        let suit_count = match suit {
            bridge_engine::types::Suit::Spades => shape[0] as u32,
            bridge_engine::types::Suit::Hearts => shape[1] as u32,
            bridge_engine::types::Suit::Diamonds => shape[2] as u32,
            bridge_engine::types::Suit::Clubs => shape[3] as u32,
        };
        if suit_count < range.min || suit_count > range.max {
            return false;
        }
    }

    true
}

#[cfg(test)]
mod tests {
    use std::collections::{HashMap, HashSet};

    use bridge_engine::types::{Rank, Seat, Suit};
    use rand::SeedableRng;
    use rand_chacha::ChaCha8Rng;

    use crate::dds::test_support::card;
    use crate::inference::types::{DerivedRanges, NumberRange};

    use super::sample_deals;

    fn open_ranges() -> HashMap<Suit, NumberRange> {
        HashMap::from([
            (Suit::Spades, NumberRange { min: 0, max: 13 }),
            (Suit::Hearts, NumberRange { min: 0, max: 13 }),
            (Suit::Diamonds, NumberRange { min: 0, max: 13 }),
            (Suit::Clubs, NumberRange { min: 0, max: 13 }),
        ])
    }

    #[test]
    fn sample_deals_keeps_visible_seats_and_valid_card_distribution() {
        let remaining_cards = HashMap::from([
            (
                Seat::North,
                vec![
                    card(Suit::Spades, Rank::Ace),
                    card(Suit::Hearts, Rank::King),
                ],
            ),
            (
                Seat::East,
                vec![
                    card(Suit::Spades, Rank::Queen),
                    card(Suit::Clubs, Rank::Ten),
                ],
            ),
            (
                Seat::South,
                vec![
                    card(Suit::Diamonds, Rank::Ace),
                    card(Suit::Clubs, Rank::Ace),
                ],
            ),
            (
                Seat::West,
                vec![
                    card(Suit::Hearts, Rank::Two),
                    card(Suit::Diamonds, Rank::Three),
                ],
            ),
        ]);
        let mut rng = ChaCha8Rng::seed_from_u64(42);

        let deals = sample_deals(
            &remaining_cards,
            &[Seat::North, Seat::South],
            &HashMap::new(),
            false,
            5,
            25,
            &mut rng,
        );

        assert_eq!(deals.len(), 5);

        for deal in deals {
            assert_eq!(deal.get(&Seat::North), remaining_cards.get(&Seat::North));
            assert_eq!(deal.get(&Seat::South), remaining_cards.get(&Seat::South));
            assert_eq!(deal.get(&Seat::East).map(Vec::len), Some(2));
            assert_eq!(deal.get(&Seat::West).map(Vec::len), Some(2));

            let unique = deal
                .values()
                .flat_map(|cards| {
                    cards
                        .iter()
                        .map(|card| format!("{:?}{:?}", card.suit, card.rank))
                })
                .collect::<HashSet<_>>();
            assert_eq!(unique.len(), 8);
        }
    }

    #[test]
    fn sample_deals_applies_constraints_only_when_enabled() {
        let remaining_cards = HashMap::from([
            (Seat::North, Vec::new()),
            (
                Seat::East,
                vec![
                    card(Suit::Spades, Rank::Ace),
                    card(Suit::Spades, Rank::King),
                ],
            ),
            (Seat::South, Vec::new()),
            (
                Seat::West,
                vec![card(Suit::Clubs, Rank::Two), card(Suit::Clubs, Rank::Three)],
            ),
        ]);

        let mut suit_lengths = open_ranges();
        suit_lengths.insert(Suit::Spades, NumberRange { min: 2, max: 2 });
        suit_lengths.insert(Suit::Clubs, NumberRange { min: 0, max: 0 });
        let east_ranges = DerivedRanges {
            hcp: NumberRange { min: 7, max: 7 },
            suit_lengths,
            is_balanced: None,
        };
        let constraints = HashMap::from([(Seat::East, east_ranges)]);

        let mut constrained_rng = ChaCha8Rng::seed_from_u64(7);
        let constrained = sample_deals(
            &remaining_cards,
            &[Seat::North, Seat::South],
            &constraints,
            true,
            4,
            40,
            &mut constrained_rng,
        );

        assert!(!constrained.is_empty());
        for deal in &constrained {
            let east = deal.get(&Seat::East).unwrap();
            assert!(east.iter().all(|card| card.suit == Suit::Spades));
        }

        let mut unconstrained_rng = ChaCha8Rng::seed_from_u64(7);
        let unconstrained = sample_deals(
            &remaining_cards,
            &[Seat::North, Seat::South],
            &constraints,
            false,
            6,
            24,
            &mut unconstrained_rng,
        );

        assert!(unconstrained.iter().any(|deal| {
            deal.get(&Seat::East)
                .unwrap()
                .iter()
                .any(|card| card.suit == Suit::Clubs)
        }));
    }
}
