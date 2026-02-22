use crate::constants::hcp_value;
use crate::types::{
    Card, DistributionPoints, Hand, HandEvaluation, HandEvaluationStrategy, Suit, SuitLength,
};

/// Sum of high card points (A=4, K=3, Q=2, J=1) in the hand.
pub fn calculate_hcp(hand: &Hand) -> u32 {
    hand.cards.iter().map(|c| hcp_value(c.rank)).sum()
}

/// Returns [Spades, Hearts, Diamonds, Clubs] matching SUIT_ORDER.
pub fn get_suit_length(hand: &Hand) -> SuitLength {
    let mut counts = [0u8; 4];
    for card in &hand.cards {
        let idx = suit_order_index(card.suit);
        counts[idx] += 1;
    }
    counts
}

fn suit_order_index(suit: Suit) -> usize {
    match suit {
        Suit::Spades => 0,
        Suit::Hearts => 1,
        Suit::Diamonds => 2,
        Suit::Clubs => 3,
    }
}

/// True if shape is 4333, 4432, or 5332 (standard balanced patterns).
pub fn is_balanced(shape: &SuitLength) -> bool {
    // Sorting network for 4 elements — 5 conditional swaps
    let mut a = shape[0];
    let mut b = shape[1];
    let mut c = shape[2];
    let mut d = shape[3];

    if a < b { std::mem::swap(&mut a, &mut b); }
    if c < d { std::mem::swap(&mut c, &mut d); }
    if a < c { std::mem::swap(&mut a, &mut c); }
    if b < d { std::mem::swap(&mut b, &mut d); }
    if b < c { std::mem::swap(&mut b, &mut c); }

    // a >= b >= c >= d, sum = 13
    (a == 4 && b == 3 && c == 3 && d == 3)
        || (a == 4 && b == 4 && c == 3 && d == 2)
        || (a == 5 && b == 3 && c == 3 && d == 2)
}

/// Single-pass HCP + shape calculation.
pub fn calculate_hcp_and_shape(hand: &Hand) -> (u32, SuitLength) {
    let mut hcp = 0u32;
    let mut counts = [0u8; 4];
    for card in &hand.cards {
        hcp += hcp_value(card.rank);
        counts[suit_order_index(card.suit)] += 1;
    }
    (hcp, counts)
}

/// Shortness (void=3, singleton=2, doubleton=1) and length (5+ cards: count-4) points.
pub fn calculate_distribution_points(shape: &SuitLength) -> DistributionPoints {
    let mut shortness = 0u32;
    let mut length = 0u32;
    for &count in shape.iter() {
        match count {
            0 => shortness += 3,
            1 => shortness += 2,
            2 => shortness += 1,
            _ => {}
        }
        if count > 4 {
            length += (count - 4) as u32;
        }
    }
    DistributionPoints {
        shortness,
        length,
        total: shortness + length,
    }
}

/// Filter and return all cards of the given suit from the hand.
pub fn get_cards_in_suit(hand: &Hand, suit: Suit) -> Vec<Card> {
    hand.cards.iter().filter(|c| c.suit == suit).cloned().collect()
}

// --- HCP Strategy (V1 default) ---

pub struct HcpStrategy;

impl HandEvaluationStrategy for HcpStrategy {
    fn name(&self) -> &str {
        "HCP"
    }

    fn evaluate(&self, hand: &Hand) -> HandEvaluation {
        let hcp = calculate_hcp(hand);
        let shape = get_suit_length(hand);
        let distribution = calculate_distribution_points(&shape);
        HandEvaluation {
            hcp,
            distribution,
            shape,
            total_points: hcp + distribution.total,
            strategy: "HCP".to_string(),
        }
    }
}

pub fn evaluate_hand(hand: &Hand, strategy: &dyn HandEvaluationStrategy) -> HandEvaluation {
    strategy.evaluate(hand)
}

/// Convenience: evaluate with default HCP strategy.
pub fn evaluate_hand_hcp(hand: &Hand) -> HandEvaluation {
    evaluate_hand(hand, &HcpStrategy)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{Card, Hand, Rank, Suit};

    fn make_hand(specs: &[(&str, &str)]) -> Hand {
        let cards: Vec<Card> = specs.iter().map(|(s, r)| Card {
            suit: match *s { "S" => Suit::Spades, "H" => Suit::Hearts, "D" => Suit::Diamonds, "C" => Suit::Clubs, _ => panic!() },
            rank: match *r {
                "2" => Rank::Two, "3" => Rank::Three, "4" => Rank::Four, "5" => Rank::Five,
                "6" => Rank::Six, "7" => Rank::Seven, "8" => Rank::Eight, "9" => Rank::Nine,
                "T" => Rank::Ten, "J" => Rank::Jack, "Q" => Rank::Queen, "K" => Rank::King,
                "A" => Rank::Ace, _ => panic!()
            },
        }).collect();
        Hand { cards }
    }

    #[test]
    fn hcp_all_aces() {
        // 4 aces + 9 spot cards = 16 HCP
        let hand = make_hand(&[
            ("S", "A"), ("H", "A"), ("D", "A"), ("C", "A"),
            ("S", "2"), ("S", "3"), ("S", "4"), ("H", "2"), ("H", "3"),
            ("D", "2"), ("D", "3"), ("C", "2"), ("C", "3"),
        ]);
        assert_eq!(calculate_hcp(&hand), 16);
    }

    #[test]
    fn hcp_yarborough() {
        // No face cards = 0 HCP
        let hand = make_hand(&[
            ("S", "2"), ("S", "3"), ("S", "4"), ("S", "5"),
            ("H", "2"), ("H", "3"), ("H", "4"),
            ("D", "2"), ("D", "3"), ("D", "4"),
            ("C", "2"), ("C", "3"), ("C", "4"),
        ]);
        assert_eq!(calculate_hcp(&hand), 0);
    }

    #[test]
    fn hcp_all_honors() {
        // AKQJ in every suit = 40 HCP... wait, that's 16 cards. Use 3 suits + partial
        let hand = make_hand(&[
            ("S", "A"), ("S", "K"), ("S", "Q"), ("S", "J"),
            ("H", "A"), ("H", "K"), ("H", "Q"),
            ("D", "A"), ("D", "K"), ("D", "Q"),
            ("C", "A"), ("C", "K"), ("C", "Q"),
        ]);
        assert_eq!(calculate_hcp(&hand), 37);
    }

    #[test]
    fn suit_length_4333() {
        let hand = make_hand(&[
            ("S", "A"), ("S", "K"), ("S", "Q"), ("S", "J"),
            ("H", "A"), ("H", "K"), ("H", "Q"),
            ("D", "A"), ("D", "K"), ("D", "Q"),
            ("C", "A"), ("C", "K"), ("C", "Q"),
        ]);
        let shape = get_suit_length(&hand);
        assert_eq!(shape, [4, 3, 3, 3]); // S=4, H=3, D=3, C=3
    }

    #[test]
    fn balanced_4333() {
        assert!(is_balanced(&[4, 3, 3, 3]));
    }

    #[test]
    fn balanced_4432() {
        assert!(is_balanced(&[4, 4, 3, 2]));
        assert!(is_balanced(&[3, 4, 4, 2]));
        assert!(is_balanced(&[2, 4, 3, 4]));
    }

    #[test]
    fn balanced_5332() {
        assert!(is_balanced(&[5, 3, 3, 2]));
        assert!(is_balanced(&[3, 5, 2, 3]));
    }

    #[test]
    fn unbalanced_5422() {
        assert!(!is_balanced(&[5, 4, 2, 2]));
    }

    #[test]
    fn unbalanced_6322() {
        assert!(!is_balanced(&[6, 3, 2, 2]));
    }

    #[test]
    fn unbalanced_singleton() {
        assert!(!is_balanced(&[5, 4, 3, 1]));
    }

    #[test]
    fn unbalanced_void() {
        assert!(!is_balanced(&[6, 4, 3, 0]));
    }

    #[test]
    fn distribution_points_flat() {
        let dp = calculate_distribution_points(&[4, 3, 3, 3]);
        assert_eq!(dp.shortness, 0);
        assert_eq!(dp.length, 0);
        assert_eq!(dp.total, 0);
    }

    #[test]
    fn distribution_points_void() {
        let dp = calculate_distribution_points(&[5, 5, 3, 0]);
        // void=3, two 5-card suits: (5-4)*2=2 length
        assert_eq!(dp.shortness, 3);
        assert_eq!(dp.length, 2);
        assert_eq!(dp.total, 5);
    }

    #[test]
    fn distribution_points_singleton() {
        let dp = calculate_distribution_points(&[5, 4, 3, 1]);
        // singleton=2, 5-card suit: length=1
        assert_eq!(dp.shortness, 2);
        assert_eq!(dp.length, 1);
        assert_eq!(dp.total, 3);
    }

    #[test]
    fn distribution_points_doubleton() {
        let dp = calculate_distribution_points(&[5, 4, 2, 2]);
        // two doubletons=2, 5-card suit: length=1
        assert_eq!(dp.shortness, 2);
        assert_eq!(dp.length, 1);
        assert_eq!(dp.total, 3);
    }

    #[test]
    fn evaluate_hand_hcp_strategy() {
        let hand = make_hand(&[
            ("S", "A"), ("S", "K"), ("S", "Q"), ("S", "J"),
            ("H", "A"), ("H", "K"), ("H", "Q"),
            ("D", "A"), ("D", "K"), ("D", "Q"),
            ("C", "A"), ("C", "K"), ("C", "Q"),
        ]);
        let eval = evaluate_hand_hcp(&hand);
        assert_eq!(eval.hcp, 37);
        assert_eq!(eval.shape, [4, 3, 3, 3]);
        assert_eq!(eval.distribution.total, 0);
        assert_eq!(eval.total_points, 37);
        assert_eq!(eval.strategy, "HCP");
    }

    #[test]
    fn calculate_hcp_and_shape_matches_separate() {
        let hand = make_hand(&[
            ("S", "A"), ("S", "K"), ("S", "2"), ("S", "3"), ("S", "4"),
            ("H", "Q"), ("H", "J"), ("H", "T"),
            ("D", "A"), ("D", "5"), ("D", "6"),
            ("C", "K"), ("C", "7"),
        ]);
        let (hcp, shape) = calculate_hcp_and_shape(&hand);
        assert_eq!(hcp, calculate_hcp(&hand));
        assert_eq!(shape, get_suit_length(&hand));
    }
}
