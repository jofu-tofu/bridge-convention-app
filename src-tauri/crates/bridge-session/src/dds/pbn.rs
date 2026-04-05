//! PBN conversion for mid-play remaining-card DDS solves.

use std::collections::HashMap;

use bridge_engine::constants::rank_index;
use bridge_engine::types::{Card, Seat};

use super::{rank_char, PBN_SEAT_ORDER, PBN_SUIT_ORDER};

/// Convert remaining cards to DDS PBN format.
pub fn remaining_cards_to_pbn(hands: &HashMap<Seat, Vec<Card>>) -> String {
    let hand_strs = PBN_SEAT_ORDER
        .iter()
        .map(|seat| cards_to_pbn_hand(hands.get(seat).map_or(&[][..], Vec::as_slice)))
        .collect::<Vec<_>>();
    format!("N:{}", hand_strs.join(" "))
}

fn cards_to_pbn_hand(cards: &[Card]) -> String {
    let mut suit_groups = PBN_SUIT_ORDER
        .iter()
        .map(|&suit| (suit, Vec::<Card>::new()))
        .collect::<HashMap<_, _>>();

    for card in cards {
        suit_groups.entry(card.suit).or_default().push(card.clone());
    }

    PBN_SUIT_ORDER
        .iter()
        .map(|suit| {
            let mut ranks = suit_groups.remove(suit).unwrap_or_default();
            ranks.sort_by(|left, right| rank_index(right.rank).cmp(&rank_index(left.rank)));
            ranks
                .into_iter()
                .map(|card| rank_char(card.rank))
                .collect::<String>()
        })
        .collect::<Vec<_>>()
        .join(".")
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use bridge_engine::types::{Rank, Seat, Suit};

    use crate::dds::test_support::card;

    use super::remaining_cards_to_pbn;

    #[test]
    fn remaining_cards_to_pbn_orders_seats_suits_and_ranks() {
        let hands = HashMap::from([
            (
                Seat::North,
                vec![
                    card(Suit::Clubs, Rank::Two),
                    card(Suit::Spades, Rank::King),
                    card(Suit::Spades, Rank::Ace),
                    card(Suit::Hearts, Rank::Ten),
                    card(Suit::Diamonds, Rank::Seven),
                ],
            ),
            (
                Seat::East,
                vec![
                    card(Suit::Spades, Rank::Queen),
                    card(Suit::Spades, Rank::Jack),
                    card(Suit::Hearts, Rank::King),
                    card(Suit::Diamonds, Rank::Ace),
                    card(Suit::Clubs, Rank::Seven),
                    card(Suit::Clubs, Rank::Five),
                ],
            ),
            (
                Seat::South,
                vec![
                    card(Suit::Spades, Rank::Nine),
                    card(Suit::Hearts, Rank::Three),
                    card(Suit::Diamonds, Rank::Queen),
                    card(Suit::Diamonds, Rank::Jack),
                    card(Suit::Clubs, Rank::Ace),
                    card(Suit::Clubs, Rank::Ten),
                ],
            ),
            (
                Seat::West,
                vec![
                    card(Suit::Spades, Rank::Jack),
                    card(Suit::Spades, Rank::Five),
                    card(Suit::Hearts, Rank::Ace),
                    card(Suit::Diamonds, Rank::Ten),
                    card(Suit::Diamonds, Rank::Nine),
                    card(Suit::Clubs, Rank::King),
                    card(Suit::Clubs, Rank::Queen),
                ],
            ),
        ]);

        assert_eq!(
            remaining_cards_to_pbn(&hands),
            "N:AK.T.7.2 QJ.K.A.75 9.3.QJ.AT J5.A.T9.KQ"
        );
    }
}
