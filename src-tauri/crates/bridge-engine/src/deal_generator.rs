use std::collections::HashMap;

use rand::prelude::*;
use rand_chacha::ChaCha8Rng;

use crate::constants::{create_deck, SUIT_ORDER};
use crate::error::EngineError;
use crate::hand_evaluator::{calculate_hcp, calculate_hcp_and_shape, get_suit_length, is_balanced};
use crate::types::{
    Card, Deal, DealConstraints, DealGeneratorResult, Hand, Seat, SeatConstraint, SuitLength,
    Vulnerability,
};

const DEFAULT_MAX_ATTEMPTS: u32 = 10_000;

fn fisher_yates_shuffle<R: Rng + ?Sized>(cards: &[Card], rng: &mut R) -> Vec<Card> {
    let mut buf: Vec<Card> = cards.to_vec();
    let len = buf.len();
    for i in (1..len).rev() {
        let j = rng.gen_range(0..=i);
        buf.swap(i, j);
    }
    buf
}

fn deal_from_shuffled(
    cards: &[Card],
    dealer: Seat,
    vulnerability: Vulnerability,
) -> Deal {
    let mut hands = HashMap::new();
    hands.insert(Seat::North, Hand { cards: cards[0..13].to_vec() });
    hands.insert(Seat::East, Hand { cards: cards[13..26].to_vec() });
    hands.insert(Seat::South, Hand { cards: cards[26..39].to_vec() });
    hands.insert(Seat::West, Hand { cards: cards[39..52].to_vec() });
    Deal { hands, dealer, vulnerability }
}

fn check_shape_constraint(shape: &SuitLength, constraint: &SeatConstraint) -> bool {
    if let Some(balanced) = constraint.balanced {
        if balanced != is_balanced(shape) {
            return false;
        }
    }

    if let Some(ref min_length) = constraint.min_length {
        for (i, &suit) in SUIT_ORDER.iter().enumerate() {
            if let Some(&min) = min_length.get(&suit) {
                if shape[i] < min {
                    return false;
                }
            }
        }
    }

    if let Some(ref max_length) = constraint.max_length {
        for (i, &suit) in SUIT_ORDER.iter().enumerate() {
            if let Some(&max) = max_length.get(&suit) {
                if shape[i] > max {
                    return false;
                }
            }
        }
    }

    if let Some(ref min_length_any) = constraint.min_length_any {
        let mut any_met = false;
        for (i, &suit) in SUIT_ORDER.iter().enumerate() {
            if let Some(&min) = min_length_any.get(&suit) {
                if shape[i] >= min {
                    any_met = true;
                    break;
                }
            }
        }
        if !any_met {
            return false;
        }
    }

    true
}

fn check_seat_constraint(hand: &Hand, constraint: &SeatConstraint) -> bool {
    let needs_hcp = constraint.min_hcp.is_some() || constraint.max_hcp.is_some();
    let needs_shape = constraint.balanced.is_some()
        || constraint.min_length.is_some()
        || constraint.max_length.is_some()
        || constraint.min_length_any.is_some();

    if needs_hcp && needs_shape {
        let (hcp, shape) = calculate_hcp_and_shape(hand);
        if let Some(min) = constraint.min_hcp {
            if hcp < min { return false; }
        }
        if let Some(max) = constraint.max_hcp {
            if hcp > max { return false; }
        }
        if !check_shape_constraint(&shape, constraint) { return false; }
    } else if needs_hcp {
        let hcp = calculate_hcp(hand);
        if let Some(min) = constraint.min_hcp {
            if hcp < min { return false; }
        }
        if let Some(max) = constraint.max_hcp {
            if hcp > max { return false; }
        }
    } else if needs_shape {
        let shape = get_suit_length(hand);
        if !check_shape_constraint(&shape, constraint) { return false; }
    }

    true
}

pub fn check_constraints(deal: &Deal, constraints: &DealConstraints) -> bool {
    for sc in &constraints.seats {
        if let Some(hand) = deal.hands.get(&sc.seat) {
            if !check_seat_constraint(hand, sc) {
                return false;
            }
        }
    }
    true
}

/// Generate a random deal satisfying the given constraints via rejection sampling.
pub fn generate_deal(constraints: &DealConstraints) -> Result<DealGeneratorResult, EngineError> {
    let dealer = constraints.dealer.unwrap_or(Seat::North);
    let vulnerability = constraints.vulnerability.unwrap_or(Vulnerability::None);
    let max_attempts = constraints.max_attempts.unwrap_or(DEFAULT_MAX_ATTEMPTS);

    let deck = create_deck();

    let mut rng: Box<dyn RngCore> = match constraints.seed {
        Some(seed) => Box::new(ChaCha8Rng::seed_from_u64(seed)),
        None => Box::new(thread_rng()),
    };

    for attempt in 1..=max_attempts {
        let shuffled = fisher_yates_shuffle(&deck, &mut *rng);
        let deal = deal_from_shuffled(&shuffled, dealer, vulnerability);

        if check_constraints(&deal, constraints) {
            return Ok(DealGeneratorResult {
                deal,
                iterations: attempt,
                relaxation_steps: 0,
            });
        }
    }

    Err(EngineError::MaxAttemptsExceeded(max_attempts))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{Suit, Vulnerability};

    #[test]
    fn unconstrained_deal_always_succeeds() {
        let constraints = DealConstraints {
            seats: vec![],
            vulnerability: None,
            dealer: None,
            max_attempts: None,
            seed: Some(42),
        };
        let result = generate_deal(&constraints).unwrap();
        assert_eq!(result.iterations, 1);
        assert_eq!(result.relaxation_steps, 0);

        // All 4 hands have 13 cards
        for seat in &[Seat::North, Seat::East, Seat::South, Seat::West] {
            assert_eq!(result.deal.hands[seat].cards.len(), 13);
        }
    }

    #[test]
    fn seed_determinism() {
        let constraints = DealConstraints {
            seats: vec![],
            vulnerability: None,
            dealer: None,
            max_attempts: None,
            seed: Some(42),
        };
        let r1 = generate_deal(&constraints).unwrap();
        let r2 = generate_deal(&constraints).unwrap();
        assert_eq!(r1.deal.hands[&Seat::North].cards, r2.deal.hands[&Seat::North].cards);
        assert_eq!(r1.deal.hands[&Seat::South].cards, r2.deal.hands[&Seat::South].cards);
    }

    #[test]
    fn different_seeds_produce_different_deals() {
        let c1 = DealConstraints {
            seats: vec![], vulnerability: None, dealer: None, max_attempts: None, seed: Some(1),
        };
        let c2 = DealConstraints {
            seats: vec![], vulnerability: None, dealer: None, max_attempts: None, seed: Some(2),
        };
        let r1 = generate_deal(&c1).unwrap();
        let r2 = generate_deal(&c2).unwrap();
        // Extremely unlikely to be equal
        assert_ne!(r1.deal.hands[&Seat::North].cards, r2.deal.hands[&Seat::North].cards);
    }

    #[test]
    fn hcp_constraint_respected() {
        let constraints = DealConstraints {
            seats: vec![SeatConstraint {
                seat: Seat::South,
                min_hcp: Some(15),
                max_hcp: Some(17),
                balanced: None,
                min_length: None,
                max_length: None,
                min_length_any: None,
            }],
            vulnerability: None,
            dealer: None,
            max_attempts: Some(50_000),
            seed: Some(100),
        };
        let result = generate_deal(&constraints).unwrap();
        let hcp = calculate_hcp(&result.deal.hands[&Seat::South]);
        assert!(hcp >= 15 && hcp <= 17, "HCP was {}", hcp);
    }

    #[test]
    fn balanced_constraint_respected() {
        let constraints = DealConstraints {
            seats: vec![SeatConstraint {
                seat: Seat::South,
                min_hcp: None,
                max_hcp: None,
                balanced: Some(true),
                min_length: None,
                max_length: None,
                min_length_any: None,
            }],
            vulnerability: None,
            dealer: None,
            max_attempts: Some(50_000),
            seed: Some(200),
        };
        let result = generate_deal(&constraints).unwrap();
        let shape = get_suit_length(&result.deal.hands[&Seat::South]);
        assert!(is_balanced(&shape), "Shape was {:?}", shape);
    }

    #[test]
    fn max_attempts_error() {
        let constraints = DealConstraints {
            seats: vec![SeatConstraint {
                seat: Seat::South,
                min_hcp: Some(40), // impossible
                max_hcp: None,
                balanced: None,
                min_length: None,
                max_length: None,
                min_length_any: None,
            }],
            vulnerability: None,
            dealer: None,
            max_attempts: Some(10),
            seed: Some(1),
        };
        let result = generate_deal(&constraints);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.to_string().contains("10 attempts"));
    }

    #[test]
    fn dealer_and_vulnerability_passed_through() {
        let constraints = DealConstraints {
            seats: vec![],
            vulnerability: Some(Vulnerability::Both),
            dealer: Some(Seat::East),
            max_attempts: None,
            seed: Some(42),
        };
        let result = generate_deal(&constraints).unwrap();
        assert_eq!(result.deal.dealer, Seat::East);
        assert_eq!(result.deal.vulnerability, Vulnerability::Both);
    }

    #[test]
    fn min_length_any_or_constraint() {
        let mut min_any = HashMap::new();
        min_any.insert(Suit::Spades, 5);
        min_any.insert(Suit::Hearts, 5);

        let constraints = DealConstraints {
            seats: vec![SeatConstraint {
                seat: Seat::South,
                min_hcp: None,
                max_hcp: None,
                balanced: None,
                min_length: None,
                max_length: None,
                min_length_any: Some(min_any),
            }],
            vulnerability: None,
            dealer: None,
            max_attempts: Some(50_000),
            seed: Some(300),
        };
        let result = generate_deal(&constraints).unwrap();
        let shape = get_suit_length(&result.deal.hands[&Seat::South]);
        // At least one of spades or hearts must be >= 5
        assert!(shape[0] >= 5 || shape[1] >= 5, "Shape was {:?}", shape);
    }

    #[test]
    fn total_hcp_invariant() {
        let constraints = DealConstraints {
            seats: vec![],
            vulnerability: None,
            dealer: None,
            max_attempts: None,
            seed: Some(42),
        };
        let result = generate_deal(&constraints).unwrap();
        let total: u32 = [Seat::North, Seat::East, Seat::South, Seat::West]
            .iter()
            .map(|s| calculate_hcp(&result.deal.hands[s]))
            .sum();
        assert_eq!(total, 40);
    }

    #[test]
    fn all_52_cards_present() {
        let constraints = DealConstraints {
            seats: vec![],
            vulnerability: None,
            dealer: None,
            max_attempts: None,
            seed: Some(42),
        };
        let result = generate_deal(&constraints).unwrap();
        let mut all_cards: Vec<_> = result.deal.hands.values()
            .flat_map(|h| h.cards.iter())
            .map(|c| format!("{:?}{:?}", c.suit, c.rank))
            .collect();
        all_cards.sort();
        all_cards.dedup();
        assert_eq!(all_cards.len(), 52);
    }
}
