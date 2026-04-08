use crate::constants::rank_index;
use crate::error::EngineError;
use crate::types::{Card, Hand, Seat, Suit, Trick};

/// Get all legal plays from a hand given the lead suit.
/// - No lead = all cards legal (first to play in trick).
/// - Follow suit if possible.
/// - Void in led suit = any card legal (no forced trump).
pub fn get_legal_plays(hand: &Hand, lead_suit: Option<Suit>) -> Vec<Card> {
    match lead_suit {
        None => hand.cards.clone(),
        Some(suit) => {
            let follow: Vec<Card> = hand.cards.iter().filter(|c| c.suit == suit).cloned().collect();
            if follow.is_empty() {
                hand.cards.clone()
            } else {
                follow
            }
        }
    }
}

/// Determine trick winner after all 4 cards played.
/// - If trump suit defined and any trump was played: highest trump wins.
/// - Otherwise: highest card of led suit wins.
pub fn get_trick_winner(trick: &Trick) -> Result<Seat, EngineError> {
    if trick.plays.len() != 4 {
        return Err(EngineError::IncompleteTrick);
    }

    let lead_suit = trick.plays[0].card.suit;
    let trump_suit = trick.trump_suit;

    // Check for trump cards
    if let Some(trump) = trump_suit {
        let trump_plays: Vec<_> = trick.plays.iter().filter(|p| p.card.suit == trump).collect();
        if !trump_plays.is_empty() {
            return trump_plays
                .iter()
                .max_by_key(|p| rank_index(p.card.rank))
                .map(|p| p.seat)
                .ok_or(EngineError::IncompleteTrick);
        }
    }

    // No trump played — highest of led suit wins
    let follow_plays: Vec<_> = trick.plays.iter().filter(|p| p.card.suit == lead_suit).collect();
    follow_plays
        .iter()
        .max_by_key(|p| rank_index(p.card.rank))
        .map(|p| p.seat)
        .ok_or(EngineError::IncompleteTrick)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{Card, Hand, PlayedCard, Rank, Seat, Suit, Trick};

    fn card(suit: Suit, rank: Rank) -> Card {
        Card { suit, rank }
    }

    fn played(seat: Seat, suit: Suit, rank: Rank) -> PlayedCard {
        PlayedCard { card: card(suit, rank), seat }
    }

    #[test]
    fn no_lead_all_cards_legal() {
        let hand = Hand {
            cards: vec![
                card(Suit::Spades, Rank::Ace),
                card(Suit::Hearts, Rank::King),
                card(Suit::Diamonds, Rank::Queen),
            ],
        };
        let legal = get_legal_plays(&hand, None);
        assert_eq!(legal.len(), 3);
    }

    #[test]
    fn must_follow_suit() {
        let hand = Hand {
            cards: vec![
                card(Suit::Spades, Rank::Ace),
                card(Suit::Spades, Rank::King),
                card(Suit::Hearts, Rank::Queen),
                card(Suit::Diamonds, Rank::Jack),
            ],
        };
        let legal = get_legal_plays(&hand, Some(Suit::Spades));
        assert_eq!(legal.len(), 2);
        assert!(legal.iter().all(|c| c.suit == Suit::Spades));
    }

    #[test]
    fn void_any_card_legal() {
        let hand = Hand {
            cards: vec![
                card(Suit::Hearts, Rank::Ace),
                card(Suit::Diamonds, Rank::King),
                card(Suit::Clubs, Rank::Queen),
            ],
        };
        let legal = get_legal_plays(&hand, Some(Suit::Spades));
        assert_eq!(legal.len(), 3);
    }

    #[test]
    fn highest_of_led_suit_wins_nt() {
        let trick = Trick {
            plays: vec![
                played(Seat::North, Suit::Spades, Rank::Ten),
                played(Seat::East, Suit::Spades, Rank::Jack),
                played(Seat::South, Suit::Spades, Rank::Ace),
                played(Seat::West, Suit::Spades, Rank::King),
            ],
            trump_suit: None,
            winner: None,
        };
        assert_eq!(get_trick_winner(&trick).unwrap(), Seat::South);
    }

    #[test]
    fn off_suit_does_not_win() {
        let trick = Trick {
            plays: vec![
                played(Seat::North, Suit::Spades, Rank::Two),
                played(Seat::East, Suit::Hearts, Rank::Ace),
                played(Seat::South, Suit::Spades, Rank::Three),
                played(Seat::West, Suit::Diamonds, Rank::Ace),
            ],
            trump_suit: None,
            winner: None,
        };
        assert_eq!(get_trick_winner(&trick).unwrap(), Seat::South);
    }

    #[test]
    fn trump_beats_led_suit() {
        let trick = Trick {
            plays: vec![
                played(Seat::North, Suit::Spades, Rank::Ace),
                played(Seat::East, Suit::Hearts, Rank::Two), // trump
                played(Seat::South, Suit::Spades, Rank::King),
                played(Seat::West, Suit::Spades, Rank::Queen),
            ],
            trump_suit: Some(Suit::Hearts),
            winner: None,
        };
        assert_eq!(get_trick_winner(&trick).unwrap(), Seat::East);
    }

    #[test]
    fn highest_trump_wins() {
        let trick = Trick {
            plays: vec![
                played(Seat::North, Suit::Spades, Rank::Ace),
                played(Seat::East, Suit::Hearts, Rank::Two),   // trump
                played(Seat::South, Suit::Hearts, Rank::King), // higher trump
                played(Seat::West, Suit::Spades, Rank::King),
            ],
            trump_suit: Some(Suit::Hearts),
            winner: None,
        };
        assert_eq!(get_trick_winner(&trick).unwrap(), Seat::South);
    }

    #[test]
    fn incomplete_trick_errors() {
        let trick = Trick {
            plays: vec![
                played(Seat::North, Suit::Spades, Rank::Ace),
            ],
            trump_suit: None,
            winner: None,
        };
        assert!(get_trick_winner(&trick).is_err());
    }

    #[test]
    fn empty_trick_errors() {
        let trick = Trick {
            plays: vec![],
            trump_suit: None,
            winner: None,
        };
        assert!(get_trick_winner(&trick).is_err());
    }
}
