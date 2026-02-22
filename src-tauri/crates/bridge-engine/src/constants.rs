use crate::types::{Card, Hand, Rank, Seat, Suit};

pub const SUITS: [Suit; 4] = [Suit::Clubs, Suit::Diamonds, Suit::Hearts, Suit::Spades];

/// Suit ordering matching SuitLength tuple: [Spades, Hearts, Diamonds, Clubs]
pub const SUIT_ORDER: [Suit; 4] = [Suit::Spades, Suit::Hearts, Suit::Diamonds, Suit::Clubs];

pub const RANKS: [Rank; 13] = [
    Rank::Two, Rank::Three, Rank::Four, Rank::Five, Rank::Six, Rank::Seven,
    Rank::Eight, Rank::Nine, Rank::Ten, Rank::Jack, Rank::Queen, Rank::King, Rank::Ace,
];

pub const SEATS: [Seat; 4] = [Seat::North, Seat::East, Seat::South, Seat::West];

pub fn seat_index(seat: Seat) -> usize {
    match seat {
        Seat::North => 0,
        Seat::East => 1,
        Seat::South => 2,
        Seat::West => 3,
    }
}

pub fn rank_index(rank: Rank) -> usize {
    match rank {
        Rank::Two => 0,
        Rank::Three => 1,
        Rank::Four => 2,
        Rank::Five => 3,
        Rank::Six => 4,
        Rank::Seven => 5,
        Rank::Eight => 6,
        Rank::Nine => 7,
        Rank::Ten => 8,
        Rank::Jack => 9,
        Rank::Queen => 10,
        Rank::King => 11,
        Rank::Ace => 12,
    }
}

pub fn hcp_value(rank: Rank) -> u32 {
    match rank {
        Rank::Jack => 1,
        Rank::Queen => 2,
        Rank::King => 3,
        Rank::Ace => 4,
        _ => 0,
    }
}

pub fn create_deck() -> Vec<Card> {
    let mut cards = Vec::with_capacity(52);
    for &suit in &SUITS {
        for &rank in &RANKS {
            cards.push(Card { suit, rank });
        }
    }
    cards
}

pub fn create_hand(cards: Vec<Card>) -> Result<Hand, crate::error::EngineError> {
    if cards.len() != 13 {
        return Err(crate::error::EngineError::InvalidHandSize(cards.len()));
    }
    Ok(Hand { cards })
}

pub fn next_seat(seat: Seat) -> Seat {
    SEATS[(seat_index(seat) + 1) % 4]
}

pub fn partner_seat(seat: Seat) -> Seat {
    SEATS[(seat_index(seat) + 2) % 4]
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn deck_has_52_unique_cards() {
        let deck = create_deck();
        assert_eq!(deck.len(), 52);
        let unique: HashSet<String> = deck.iter()
            .map(|c| format!("{:?}{:?}", c.suit, c.rank))
            .collect();
        assert_eq!(unique.len(), 52);
    }

    #[test]
    fn seat_rotation() {
        assert_eq!(next_seat(Seat::North), Seat::East);
        assert_eq!(next_seat(Seat::East), Seat::South);
        assert_eq!(next_seat(Seat::South), Seat::West);
        assert_eq!(next_seat(Seat::West), Seat::North);
    }

    #[test]
    fn partner_mapping() {
        assert_eq!(partner_seat(Seat::North), Seat::South);
        assert_eq!(partner_seat(Seat::South), Seat::North);
        assert_eq!(partner_seat(Seat::East), Seat::West);
        assert_eq!(partner_seat(Seat::West), Seat::East);
    }

    #[test]
    fn hcp_values_correct() {
        assert_eq!(hcp_value(Rank::Two), 0);
        assert_eq!(hcp_value(Rank::Nine), 0);
        assert_eq!(hcp_value(Rank::Ten), 0);
        assert_eq!(hcp_value(Rank::Jack), 1);
        assert_eq!(hcp_value(Rank::Queen), 2);
        assert_eq!(hcp_value(Rank::King), 3);
        assert_eq!(hcp_value(Rank::Ace), 4);
    }

    #[test]
    fn create_hand_requires_13_cards() {
        let deck = create_deck();
        let result = create_hand(deck[0..12].to_vec());
        assert!(result.is_err());

        let result = create_hand(deck[0..13].to_vec());
        assert!(result.is_ok());
    }

    #[test]
    fn suit_order_is_spades_hearts_diamonds_clubs() {
        assert_eq!(SUIT_ORDER, [Suit::Spades, Suit::Hearts, Suit::Diamonds, Suit::Clubs]);
    }
}
