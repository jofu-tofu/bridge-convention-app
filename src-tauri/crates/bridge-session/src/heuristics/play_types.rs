//! Play-specific types for the heuristic play system.
//!
//! PlayContext, PlayResult, PlayHeuristic trait, and helper functions
//! used across all play heuristics.

use bridge_engine::constants::{partner_seat, rank_index};
use bridge_engine::{Card, Contract, Hand, PlayedCard, Seat, Suit, Trick};
use serde::{Deserialize, Serialize};

// ── Play context and result ──────────────────────────────────────────

/// Context passed to play strategies/heuristics for card selection.
#[derive(Debug, Clone)]
pub struct PlayContext {
    pub hand: Hand,
    pub current_trick: Vec<PlayedCard>,
    pub previous_tricks: Vec<Trick>,
    pub contract: Contract,
    pub seat: Seat,
    pub trump_suit: Option<Suit>,
    pub legal_plays: Vec<Card>,
    /// Visible after opening lead; None before dummy is revealed.
    pub dummy_hand: Option<Hand>,
}

/// Result of a play strategy suggestion.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayResult {
    pub card: Card,
    pub reason: String,
}

// ── PlayHeuristic trait ──────────────────────────────────────────────

/// Trait for individual play heuristics. Each heuristic inspects the context
/// and either returns a suggested card or declines (None).
pub trait PlayHeuristic: Send + Sync {
    /// Apply this heuristic to the given play context.
    /// Returns Some(card) if the heuristic has a suggestion, None to decline.
    fn apply(&self, context: &PlayContext) -> Option<Card>;

    /// Human-readable name for this heuristic (used in PlayResult.reason).
    fn name(&self) -> &str;
}

// ── Helper functions ─────────────────────────────────────────────────

/// Check if a rank is an honor (J, Q, K, A).
pub fn is_honor(rank: bridge_engine::Rank) -> bool {
    matches!(
        rank,
        bridge_engine::Rank::Jack
            | bridge_engine::Rank::Queen
            | bridge_engine::Rank::King
            | bridge_engine::Rank::Ace
    )
}

/// Returns true if rank `a` beats rank `b` (higher rank index).
pub fn rank_beats(a: bridge_engine::Rank, b: bridge_engine::Rank) -> bool {
    rank_index(a) > rank_index(b)
}

/// Sort cards by rank ascending (lowest first).
pub fn sort_by_rank_asc(cards: &[Card]) -> Vec<Card> {
    let mut sorted = cards.to_vec();
    sorted.sort_by_key(|c| rank_index(c.rank));
    sorted
}

/// Sort cards by rank descending (highest first).
pub fn sort_by_rank_desc(cards: &[Card]) -> Vec<Card> {
    let mut sorted = cards.to_vec();
    sorted.sort_by_key(|c| std::cmp::Reverse(rank_index(c.rank)));
    sorted
}

/// Check if a seat is a defender (not declarer or dummy).
pub fn is_defender(seat: Seat, declarer: Seat) -> bool {
    seat != declarer && seat != partner_seat(declarer)
}

/// Check if a card is among the legal plays.
pub fn is_legal_play(card: &Card, legal_plays: &[Card]) -> bool {
    legal_plays
        .iter()
        .any(|c| c.suit == card.suit && c.rank == card.rank)
}

/// Group cards by suit, returning a Vec of (Suit, Vec<Card>) pairs.
pub fn group_by_suit(cards: &[Card]) -> Vec<(Suit, Vec<Card>)> {
    use std::collections::BTreeMap;
    let mut groups: BTreeMap<u8, (Suit, Vec<Card>)> = BTreeMap::new();
    for c in cards {
        let key = suit_order_key(c.suit);
        groups
            .entry(key)
            .or_insert_with(|| (c.suit, Vec::new()))
            .1
            .push(c.clone());
    }
    groups.into_values().collect()
}

/// Deterministic suit ordering key for stable iteration.
fn suit_order_key(suit: Suit) -> u8 {
    match suit {
        Suit::Clubs => 0,
        Suit::Diamonds => 1,
        Suit::Hearts => 2,
        Suit::Spades => 3,
    }
}

/// Determine the current winning PlayedCard in an in-progress trick.
pub fn get_trick_winner_so_far(
    plays: &[PlayedCard],
    trump_suit: Option<Suit>,
) -> Option<&PlayedCard> {
    if plays.is_empty() {
        return None;
    }

    let led_suit = plays[0].card.suit;
    let mut winner = &plays[0];

    for play in plays.iter().skip(1) {
        let is_trump = trump_suit == Some(play.card.suit);
        let winner_is_trump = trump_suit == Some(winner.card.suit);

        if is_trump && !winner_is_trump {
            // Trump beats non-trump
            winner = play;
        } else if is_trump && winner_is_trump {
            // Both trump: higher wins
            if rank_beats(play.card.rank, winner.card.rank) {
                winner = play;
            }
        } else if !is_trump && play.card.suit == led_suit {
            // Same suit as led: higher wins
            if rank_beats(play.card.rank, winner.card.rank) {
                winner = play;
            }
        }
        // Off-suit non-trump: does not win
    }

    Some(winner)
}

/// Check if ranks form touching honors starting from the top (e.g., KQJ, QJT).
/// Returns the top card if a sequence is found.
pub fn top_of_touching_honors(suit_cards: &[Card]) -> Option<Card> {
    let sorted = sort_by_rank_desc(suit_cards);
    if sorted.len() < 2 {
        return None;
    }

    let top = &sorted[0];
    if !is_honor(top.rank) && top.rank != bridge_engine::Rank::Ten {
        return None;
    }

    let mut consecutive = 1usize;
    for i in 1..sorted.len() {
        if rank_index(sorted[i].rank) == rank_index(sorted[i - 1].rank) - 1 {
            consecutive += 1;
            if consecutive >= 3 || (consecutive >= 2 && is_honor(top.rank)) {
                return Some(top.clone());
            }
        } else {
            break;
        }
    }

    // Two touching honors (e.g., KQ) is enough if both are honors
    if consecutive >= 2 && is_honor(top.rank) && is_honor(sorted[1].rank) {
        return Some(top.clone());
    }

    None
}

/// Find the first non-trump suit that partner led in previous tricks.
pub fn find_partner_led_suit(
    previous_tricks: &[Trick],
    seat: Seat,
    trump_suit: Option<Suit>,
) -> Option<Suit> {
    let partner = partner_seat(seat);
    for trick in previous_tricks {
        if !trick.plays.is_empty() && trick.plays[0].seat == partner {
            let led_suit = trick.plays[0].card.suit;
            if Some(led_suit) != trump_suit {
                return Some(led_suit);
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_engine::Rank;

    fn card(suit: Suit, rank: Rank) -> Card {
        Card { suit, rank }
    }

    fn played(seat: Seat, suit: Suit, rank: Rank) -> PlayedCard {
        PlayedCard {
            card: card(suit, rank),
            seat,
        }
    }

    #[test]
    fn test_is_honor() {
        assert!(is_honor(Rank::Jack));
        assert!(is_honor(Rank::Queen));
        assert!(is_honor(Rank::King));
        assert!(is_honor(Rank::Ace));
        assert!(!is_honor(Rank::Ten));
        assert!(!is_honor(Rank::Two));
    }

    #[test]
    fn test_rank_beats() {
        assert!(rank_beats(Rank::Ace, Rank::King));
        assert!(rank_beats(Rank::King, Rank::Queen));
        assert!(!rank_beats(Rank::Queen, Rank::King));
        assert!(!rank_beats(Rank::Ace, Rank::Ace));
    }

    #[test]
    fn test_sort_by_rank() {
        let cards = vec![
            card(Suit::Spades, Rank::King),
            card(Suit::Spades, Rank::Two),
            card(Suit::Spades, Rank::Ace),
        ];
        let asc = sort_by_rank_asc(&cards);
        assert_eq!(asc[0].rank, Rank::Two);
        assert_eq!(asc[2].rank, Rank::Ace);

        let desc = sort_by_rank_desc(&cards);
        assert_eq!(desc[0].rank, Rank::Ace);
        assert_eq!(desc[2].rank, Rank::Two);
    }

    #[test]
    fn test_is_defender() {
        assert!(is_defender(Seat::East, Seat::South));
        assert!(is_defender(Seat::West, Seat::South));
        assert!(!is_defender(Seat::South, Seat::South));
        assert!(!is_defender(Seat::North, Seat::South)); // dummy
    }

    #[test]
    fn test_trick_winner_so_far_simple() {
        let plays = vec![
            played(Seat::North, Suit::Spades, Rank::Ten),
            played(Seat::East, Suit::Spades, Rank::King),
        ];
        let winner = get_trick_winner_so_far(&plays, None).unwrap();
        assert_eq!(winner.seat, Seat::East);
    }

    #[test]
    fn test_trick_winner_so_far_trump() {
        let plays = vec![
            played(Seat::North, Suit::Spades, Rank::Ace),
            played(Seat::East, Suit::Hearts, Rank::Two),
        ];
        let winner = get_trick_winner_so_far(&plays, Some(Suit::Hearts)).unwrap();
        assert_eq!(winner.seat, Seat::East); // low trump beats ace of led suit
    }

    #[test]
    fn test_touching_honors_kqj() {
        let cards = vec![
            card(Suit::Spades, Rank::King),
            card(Suit::Spades, Rank::Queen),
            card(Suit::Spades, Rank::Jack),
            card(Suit::Spades, Rank::Five),
        ];
        let top = top_of_touching_honors(&cards).unwrap();
        assert_eq!(top.rank, Rank::King);
    }

    #[test]
    fn test_touching_honors_kq() {
        let cards = vec![
            card(Suit::Spades, Rank::King),
            card(Suit::Spades, Rank::Queen),
            card(Suit::Spades, Rank::Five),
        ];
        let top = top_of_touching_honors(&cards).unwrap();
        assert_eq!(top.rank, Rank::King);
    }

    #[test]
    fn test_no_touching_honors() {
        let cards = vec![
            card(Suit::Spades, Rank::King),
            card(Suit::Spades, Rank::Jack),
            card(Suit::Spades, Rank::Five),
        ];
        let top = top_of_touching_honors(&cards);
        assert!(top.is_none());
    }
}
