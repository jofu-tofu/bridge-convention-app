//! Opening lead heuristics for the first trick of a hand.
//!
//! Sub-helpers for suit-contract and NT opening lead logic,
//! used by the opening_lead heuristic in heuristic_play.rs.

use bridge_engine::{Card, Rank, Suit};

use super::play_types::{
    group_by_suit, is_legal_play, sort_by_rank_asc, sort_by_rank_desc,
    top_of_touching_honors,
};

// ── Lead sub-helpers ─────────────────────────────────────────────────

/// Suit contracts: lead ace from AK combination in a side suit.
pub fn lead_from_ak_combination(
    cards: &[Card],
    trump_suit: Suit,
    legal_plays: &[Card],
) -> Option<Card> {
    let suit_groups = group_by_suit(cards);
    for (suit, suit_cards) in &suit_groups {
        if *suit == trump_suit {
            continue;
        }
        let has_ace = suit_cards.iter().any(|c| c.rank == Rank::Ace);
        let has_king = suit_cards.iter().any(|c| c.rank == Rank::King);
        if has_ace && has_king {
            let ace = suit_cards.iter().find(|c| c.rank == Rank::Ace).unwrap();
            if is_legal_play(ace, legal_plays) {
                return Some(ace.clone());
            }
        }
    }
    None
}

/// Lead top of touching honors from any suit.
pub fn lead_touching_honors(
    suit_groups: &[(Suit, Vec<Card>)],
    legal_plays: &[Card],
) -> Option<Card> {
    for (_suit, cards) in suit_groups {
        if let Some(top) = top_of_touching_honors(cards) {
            if is_legal_play(&top, legal_plays) {
                return Some(top);
            }
        }
    }
    None
}

/// 4th best from longest suit in the given groups.
pub fn lead_fourth_best(
    suit_groups: &[(Suit, Vec<Card>)],
    legal_plays: &[Card],
) -> Option<Card> {
    let mut longest_suit: Option<&(Suit, Vec<Card>)> = None;
    let mut longest_len = 0;

    for entry in suit_groups {
        let len = entry.1.len();
        if len > longest_len {
            longest_len = len;
            longest_suit = Some(entry);
        }
    }

    if let Some((_suit, cards)) = longest_suit {
        if longest_len >= 4 {
            let sorted = sort_by_rank_desc(cards);
            // 0-indexed: 4th from top is index 3
            if let Some(fourth_best) = sorted.get(3) {
                if is_legal_play(fourth_best, legal_plays) {
                    return Some(fourth_best.clone());
                }
            }
        }
    }
    None
}

/// Suit contracts: lead a singleton in a side suit.
pub fn lead_short_suit(
    cards: &[Card],
    trump_suit: Suit,
    legal_plays: &[Card],
) -> Option<Card> {
    let suit_groups = group_by_suit(cards);
    for (suit, suit_cards) in &suit_groups {
        if *suit == trump_suit {
            continue; // Don't lead singleton trump
        }
        if suit_cards.len() == 1 {
            let singleton = &suit_cards[0];
            if is_legal_play(singleton, legal_plays) {
                return Some(singleton.clone());
            }
        }
    }
    None
}

/// General fallback: lead low from longest non-trump suit.
pub fn lead_low_from_longest(
    cards: &[Card],
    trump_suit: Option<Suit>,
    legal_plays: &[Card],
) -> Option<Card> {
    let suit_groups = group_by_suit(cards);
    let mut longest_suit: Option<Suit> = None;
    let mut longest_len = 0;
    let mut longest_cards: Option<&Vec<Card>> = None;

    for (suit, suit_cards) in &suit_groups {
        if trump_suit == Some(*suit) {
            continue;
        }
        if suit_cards.len() > longest_len {
            longest_len = suit_cards.len();
            longest_suit = Some(*suit);
            longest_cards = Some(suit_cards);
        }
    }

    if longest_suit.is_some() {
        if let Some(cards) = longest_cards {
            let sorted = sort_by_rank_asc(cards);
            if let Some(lowest) = sorted.first() {
                if is_legal_play(lowest, legal_plays) {
                    return Some(lowest.clone());
                }
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

    #[test]
    fn test_ak_combination_leads_ace() {
        let cards = vec![
            card(Suit::Hearts, Rank::Ace),
            card(Suit::Hearts, Rank::King),
            card(Suit::Hearts, Rank::Five),
            card(Suit::Spades, Rank::Queen),
        ];
        let result =
            lead_from_ak_combination(&cards, Suit::Spades, &cards);
        assert!(result.is_some());
        let c = result.unwrap();
        assert_eq!(c.suit, Suit::Hearts);
        assert_eq!(c.rank, Rank::Ace);
    }

    #[test]
    fn test_ak_combination_skips_trump_suit() {
        let cards = vec![
            card(Suit::Hearts, Rank::Ace),
            card(Suit::Hearts, Rank::King),
        ];
        // Hearts is trump — should not lead AK
        let result =
            lead_from_ak_combination(&cards, Suit::Hearts, &cards);
        assert!(result.is_none());
    }

    #[test]
    fn test_fourth_best_from_long_suit() {
        let cards = vec![
            card(Suit::Diamonds, Rank::King),
            card(Suit::Diamonds, Rank::Jack),
            card(Suit::Diamonds, Rank::Eight),
            card(Suit::Diamonds, Rank::Five),
            card(Suit::Diamonds, Rank::Three),
        ];
        let groups = group_by_suit(&cards);
        let result = lead_fourth_best(&groups, &cards);
        assert!(result.is_some());
        let c = result.unwrap();
        assert_eq!(c.rank, Rank::Five); // 4th from top: K, J, 8, 5
    }

    #[test]
    fn test_short_suit_lead_singleton() {
        let cards = vec![
            card(Suit::Hearts, Rank::Seven),
            card(Suit::Spades, Rank::King),
            card(Suit::Spades, Rank::Queen),
        ];
        let result = lead_short_suit(&cards, Suit::Clubs, &cards);
        assert!(result.is_some());
        let c = result.unwrap();
        assert_eq!(c.suit, Suit::Hearts);
        assert_eq!(c.rank, Rank::Seven);
    }

    #[test]
    fn test_lead_low_from_longest() {
        let cards = vec![
            card(Suit::Hearts, Rank::King),
            card(Suit::Hearts, Rank::Queen),
            card(Suit::Hearts, Rank::Five),
            card(Suit::Hearts, Rank::Three),
            card(Suit::Spades, Rank::Ace),
        ];
        let result = lead_low_from_longest(&cards, None, &cards);
        assert!(result.is_some());
        let c = result.unwrap();
        assert_eq!(c.suit, Suit::Hearts);
        assert_eq!(c.rank, Rank::Three);
    }
}
