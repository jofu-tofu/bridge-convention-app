//! Extended clause evaluation — Rust-only extended clauses against hand and facts.

use std::collections::HashMap;

use bridge_engine::{Hand, Rank, Suit};

use crate::types::{CompareOp, ExtendedClause};

use super::primitives::SUIT_LENGTH_FACT_IDS;
use super::types::{get_bool, get_num, FactValue};

/// Evaluate a Rust-only extended clause.
pub(super) fn evaluate_extended_clause(
    clause: &ExtendedClause,
    hand: &Hand,
    facts: &HashMap<String, FactValue>,
) -> bool {
    match clause {
        ExtendedClause::TopHonorCount { suit, min, max } => {
            let count = count_top_honors(hand, *suit);
            let above_min = min.map_or(true, |m| count >= m);
            let below_max = max.map_or(true, |m| count <= m);
            above_min && below_max
        }
        ExtendedClause::AceCount { min, max } => {
            let count = count_rank(hand, Rank::Ace);
            let above_min = min.map_or(true, |m| count >= m);
            let below_max = max.map_or(true, |m| count <= m);
            above_min && below_max
        }
        ExtendedClause::KingCount { min, max } => {
            let count = count_rank(hand, Rank::King);
            let above_min = min.map_or(true, |m| count >= m);
            let below_max = max.map_or(true, |m| count <= m);
            above_min && below_max
        }
        ExtendedClause::SuitCompare { a, op, b } => {
            let len_a = get_suit_length_from_facts(facts, *a);
            let len_b = get_suit_length_from_facts(facts, *b);
            match op {
                CompareOp::Gt => len_a > len_b,
                CompareOp::Gte => len_a >= len_b,
                CompareOp::Eq => len_a == len_b,
            }
        }
        ExtendedClause::LongestSuitIs { suit } => {
            let target = *suit;
            let suits = [Suit::Spades, Suit::Hearts, Suit::Diamonds, Suit::Clubs];
            let mut longest_suit = Suit::Spades;
            let mut longest_len = 0.0_f64;
            for &s in &suits {
                let len = get_suit_length_from_facts(facts, s);
                if len > longest_len {
                    longest_len = len;
                    longest_suit = s;
                }
                // Tie-break by priority: S > H > D > C (first encountered wins
                // since we iterate in that order)
            }
            longest_suit == target
        }
        ExtendedClause::VulnerabilityIs { vulnerable } => {
            let is_vul = get_bool(facts, "bridge.isVulnerable");
            is_vul == *vulnerable
        }
        ExtendedClause::BooleanFact { fact_id, expected } => get_bool(facts, fact_id) == *expected,
        ExtendedClause::NumericFact { fact_id, min, max } => {
            let val = get_num(facts, fact_id);
            let above_min = min.map_or(true, |m| val >= m);
            let below_max = max.map_or(true, |m| val <= m);
            above_min && below_max
        }
    }
}

/// Count A/K/Q in a specific suit.
fn count_top_honors(hand: &Hand, suit: Suit) -> u8 {
    hand.cards
        .iter()
        .filter(|c| c.suit == suit && matches!(c.rank, Rank::Ace | Rank::King | Rank::Queen))
        .count() as u8
}

/// Count cards of a specific rank across all suits.
fn count_rank(hand: &Hand, rank: Rank) -> u8 {
    hand.cards.iter().filter(|c| c.rank == rank).count() as u8
}

/// Get suit length from the fact map via suit enum.
fn get_suit_length_from_facts(facts: &HashMap<String, FactValue>, suit: Suit) -> f64 {
    let idx = match suit {
        Suit::Spades => 0,
        Suit::Hearts => 1,
        Suit::Diamonds => 2,
        Suit::Clubs => 3,
    };
    get_num(facts, SUIT_LENGTH_FACT_IDS[idx])
}
