//! Primitive fact evaluators — layer 1.
//!
//! Evaluates 8 hardcoded facts directly from Hand and HandEvaluation:
//! - hand.hcp
//! - hand.suitLength.{spades,hearts,diamonds,clubs}
//! - hand.isBalanced
//! - hand.shortagePoints
//! - hand.lengthPoints

use std::collections::HashMap;

use bridge_engine::{is_balanced, Hand, HandEvaluation};

use super::types::{fv_bool, fv_num, FactValue};

/// Fact IDs for suit lengths, indexed as [Spades, Hearts, Diamonds, Clubs].
pub const SUIT_LENGTH_FACT_IDS: [&str; 4] = [
    "hand.suitLength.spades",
    "hand.suitLength.hearts",
    "hand.suitLength.diamonds",
    "hand.suitLength.clubs",
];

/// All suit names in the same order as SUIT_LENGTH_FACT_IDS.
pub const SUIT_NAMES: [&str; 4] = ["spades", "hearts", "diamonds", "clubs"];

/// Evaluate layer 1 primitive facts from hand data.
/// Inserts 8 facts into the provided map.
pub fn evaluate_primitives(
    _hand: &Hand,
    evaluation: &HandEvaluation,
    facts: &mut HashMap<String, FactValue>,
) {
    // HCP
    facts.insert(
        "hand.hcp".to_string(),
        fv_num("hand.hcp", evaluation.hcp as f64),
    );

    // Suit lengths (shape is [Spades, Hearts, Diamonds, Clubs])
    for (i, fact_id) in SUIT_LENGTH_FACT_IDS.iter().enumerate() {
        facts.insert(
            fact_id.to_string(),
            fv_num(fact_id, evaluation.shape[i] as f64),
        );
    }

    // Balanced
    facts.insert(
        "hand.isBalanced".to_string(),
        fv_bool("hand.isBalanced", is_balanced(&evaluation.shape)),
    );

    // Distribution point components (raw per-hand values, all 4 suits counted)
    facts.insert(
        "hand.shortagePoints".to_string(),
        fv_num(
            "hand.shortagePoints",
            evaluation.distribution.shortness as f64,
        ),
    );
    facts.insert(
        "hand.lengthPoints".to_string(),
        fv_num("hand.lengthPoints", evaluation.distribution.length as f64),
    );
}

/// Map a suit name string to its shape index (0=S, 1=H, 2=D, 3=C).
pub fn suit_name_to_index(name: &str) -> Option<usize> {
    match name {
        "spades" => Some(0),
        "hearts" => Some(1),
        "diamonds" => Some(2),
        "clubs" => Some(3),
        _ => None,
    }
}

/// Map a suit name string to its suit length fact ID.
pub fn suit_name_to_fact_id(name: &str) -> Option<&'static str> {
    suit_name_to_index(name).map(|i| SUIT_LENGTH_FACT_IDS[i])
}
