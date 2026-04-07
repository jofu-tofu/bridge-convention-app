//! Centralized total-point computation.
//!
//! All callers that need formula-driven point totals use `compute_total_points()`.
//! The engine computes raw components (HCP, shortage, length); this module
//! composes them according to a `PointFormula`.

use std::collections::HashMap;

use crate::types::system_config::PointFormula;

use super::primitives::{suit_name_to_index, SUIT_LENGTH_FACT_IDS};
use super::types::{get_num, FactValue};

/// Compute shortage points (3/2/1) excluding one suit.
/// Used when trump/bound suit is known and should not contribute shortage.
pub fn compute_shortage_excluding(
    facts: &HashMap<String, FactValue>,
    excluded_suit_name: &str,
) -> f64 {
    let excluded_idx = suit_name_to_index(excluded_suit_name);
    let mut shortage_points = 0.0;
    for i in 0..4 {
        if Some(i) == excluded_idx {
            continue;
        }
        let length = get_num(facts, SUIT_LENGTH_FACT_IDS[i]);
        if length == 0.0 {
            shortage_points += 3.0;
        } else if length == 1.0 {
            shortage_points += 2.0;
        } else if length == 2.0 {
            shortage_points += 1.0;
        }
    }
    shortage_points
}

/// Central total-point computation. All callers use this.
///
/// `excluded_suit`: when a trump/bound suit is known, exclude it from shortage
/// calculation. Pass `None` for all-suit shortage (raw `hand.shortagePoints`).
pub fn compute_total_points(
    facts: &HashMap<String, FactValue>,
    formula: PointFormula,
    excluded_suit: Option<&str>,
) -> f64 {
    let mut total = get_num(facts, "hand.hcp");

    if formula.include_shortage {
        let shortage = match excluded_suit {
            Some(suit) => compute_shortage_excluding(facts, suit),
            None => get_num(facts, "hand.shortagePoints"),
        };
        total += shortage;
    }

    if formula.include_length {
        // Length points are suit-independent (always count 5+ card suits)
        total += get_num(facts, "hand.lengthPoints");
    }

    total
}
