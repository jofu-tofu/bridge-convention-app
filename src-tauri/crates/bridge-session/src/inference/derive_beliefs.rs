//! Derive `PublicBeliefs` from accumulated `FactConstraint[]`.
//!
//! Constraint-first model: accumulated constraints per seat are the source of truth.
//! `derive_public_beliefs()` computes `DerivedRanges` (HCP min/max, per-suit length
//! min/max) and qualitative constraints from the raw constraint array.

use bridge_conventions::types::meaning::{ConstraintValue, FactConstraint, FactOperator};
use bridge_engine::types::{Seat, Suit};
use std::collections::HashMap;

use super::types::{
    DerivedRanges, HandInference, NumberRange, PublicBeliefs, QualitativeConstraint,
};

const ALL_SUITS: [Suit; 4] = [Suit::Spades, Suit::Hearts, Suit::Diamonds, Suit::Clubs];

/// Map factId suffix to engine Suit value for suit-length constraints.
fn suit_from_suffix(suffix: &str) -> Option<Suit> {
    match suffix {
        "spades" => Some(Suit::Spades),
        "hearts" => Some(Suit::Hearts),
        "diamonds" => Some(Suit::Diamonds),
        "clubs" => Some(Suit::Clubs),
        _ => None,
    }
}

/// Map Suit to factId suffix.
fn suit_to_suffix(suit: Suit) -> &'static str {
    match suit {
        Suit::Spades => "spades",
        Suit::Hearts => "hearts",
        Suit::Diamonds => "diamonds",
        Suit::Clubs => "clubs",
    }
}

/// Known qualitative factIds and their human-readable labels.
fn qualitative_label(fact_id: &str) -> Option<&'static str> {
    match fact_id {
        "bridge.hasFourCardMajor" => Some("Has 4-card major"),
        "bridge.hasFiveCardMajor" => Some("Has 5-card major"),
        "bridge.hasShortage" => Some("Has shortage (0-1 in a suit)"),
        _ => None,
    }
}

/// Extract a u32 from a `ConstraintValue`, handling Number variant.
fn value_as_u32(v: &ConstraintValue) -> Option<u32> {
    match v {
        ConstraintValue::Number(n) => n.as_u64().map(|n| n as u32),
        _ => None,
    }
}

/// Extract min/max from a Range `ConstraintValue`.
fn value_as_range(v: &ConstraintValue) -> Option<(u32, u32)> {
    match v {
        ConstraintValue::Range { min, max } => {
            let min = min.as_u64()? as u32;
            let max = max.as_u64()? as u32;
            Some((min, max))
        }
        _ => None,
    }
}

/// Derive `PublicBeliefs` from accumulated constraints for a single seat.
/// Source of truth is always the raw constraints array -- ranges and
/// qualitative labels are computed from it.
pub fn derive_public_beliefs(seat: Seat, constraints: &[FactConstraint]) -> PublicBeliefs {
    PublicBeliefs {
        seat,
        constraints: constraints.to_vec(),
        ranges: derive_ranges(constraints),
        qualitative: derive_qualitative(constraints),
    }
}

/// Compute flat display-friendly ranges from constraints.
/// Handles: hand.hcp, hand.suitLength.*, hand.isBalanced.
fn derive_ranges(constraints: &[FactConstraint]) -> DerivedRanges {
    let mut hcp_min: u32 = 0;
    let mut hcp_max: u32 = 40;
    let mut balanced: Option<bool> = None;

    let mut suit_mins: HashMap<Suit, u32> = ALL_SUITS.iter().map(|&s| (s, 0u32)).collect();
    let mut suit_maxes: HashMap<Suit, u32> = ALL_SUITS.iter().map(|&s| (s, 13u32)).collect();

    for c in constraints {
        // HCP constraints
        if c.fact_id == "hand.hcp" {
            match c.operator {
                FactOperator::Gte => {
                    if let Some(v) = value_as_u32(&c.value) {
                        hcp_min = hcp_min.max(v);
                    }
                }
                FactOperator::Lte => {
                    if let Some(v) = value_as_u32(&c.value) {
                        hcp_max = hcp_max.min(v);
                    }
                }
                FactOperator::Range => {
                    if let Some((min, max)) = value_as_range(&c.value) {
                        hcp_min = hcp_min.max(min);
                        hcp_max = hcp_max.min(max);
                    }
                }
                _ => {}
            }
            continue;
        }

        // Suit length constraints: hand.suitLength.<suit>
        if let Some(suffix) = c.fact_id.strip_prefix("hand.suitLength.") {
            if let Some(suit) = suit_from_suffix(suffix) {
                match c.operator {
                    FactOperator::Gte => {
                        if let Some(v) = value_as_u32(&c.value) {
                            *suit_mins.get_mut(&suit).unwrap() = suit_mins[&suit].max(v);
                        }
                    }
                    FactOperator::Lte => {
                        if let Some(v) = value_as_u32(&c.value) {
                            *suit_maxes.get_mut(&suit).unwrap() = suit_maxes[&suit].min(v);
                        }
                    }
                    _ => {}
                }
            }
            continue;
        }

        // Balanced constraint
        if c.fact_id == "hand.isBalanced" && c.operator == FactOperator::Boolean {
            if let ConstraintValue::Bool(b) = c.value {
                balanced = Some(b);
            }
        }
    }

    // Balanced distributions (4-3-3-3, 4-4-3-2, 5-3-3-2) guarantee >= 2 in every suit
    if balanced == Some(true) {
        for suit in &ALL_SUITS {
            let entry = suit_mins.get_mut(suit).unwrap();
            *entry = (*entry).max(2);
        }
    }

    // Clamp contradictions
    if hcp_min > hcp_max {
        hcp_min = hcp_max;
    }

    let mut suit_lengths = HashMap::new();
    for suit in &ALL_SUITS {
        let mut min = suit_mins[suit];
        let max = suit_maxes[suit];
        if min > max {
            min = max;
        }
        suit_lengths.insert(*suit, NumberRange { min, max });
    }

    DerivedRanges {
        hcp: NumberRange {
            min: hcp_min,
            max: hcp_max,
        },
        suit_lengths,
        is_balanced: balanced,
    }
}

/// Extract qualitative constraints -- those that don't reduce to flat per-suit ranges.
fn derive_qualitative(constraints: &[FactConstraint]) -> Vec<QualitativeConstraint> {
    let mut result = Vec::new();

    for c in constraints {
        if let Some(label) = qualitative_label(&c.fact_id) {
            // Only show positive assertions for now
            if c.operator == FactOperator::Boolean {
                if let ConstraintValue::Bool(true) = c.value {
                    // Deduplicate
                    if !result
                        .iter()
                        .any(|q: &QualitativeConstraint| q.fact_id == c.fact_id)
                    {
                        result.push(QualitativeConstraint {
                            fact_id: c.fact_id.clone(),
                            label: label.to_string(),
                            operator: "boolean".to_string(),
                            value: serde_json::Value::Bool(true),
                        });
                    }
                }
            }
        }
    }

    result
}

/// Convert a `HandInference` to `Vec<FactConstraint>`.
/// Used at the boundary where `InferenceProvider` returns `HandInference`
/// but the public beliefs pipeline needs `FactConstraint[]`.
pub fn hand_inference_to_constraints(inf: &HandInference) -> Vec<FactConstraint> {
    let mut constraints = Vec::new();

    if let Some(min) = inf.min_hcp {
        constraints.push(FactConstraint {
            fact_id: "hand.hcp".to_string(),
            operator: FactOperator::Gte,
            value: ConstraintValue::int(min as i64),
            is_public: None,
        });
    }
    if let Some(max) = inf.max_hcp {
        constraints.push(FactConstraint {
            fact_id: "hand.hcp".to_string(),
            operator: FactOperator::Lte,
            value: ConstraintValue::int(max as i64),
            is_public: None,
        });
    }
    if inf.is_balanced == Some(true) {
        constraints.push(FactConstraint {
            fact_id: "hand.isBalanced".to_string(),
            operator: FactOperator::Boolean,
            value: ConstraintValue::Bool(true),
            is_public: None,
        });
    }

    for (suit, si) in &inf.suits {
        let suffix = suit_to_suffix(*suit);
        if let Some(min) = si.min_length {
            constraints.push(FactConstraint {
                fact_id: format!("hand.suitLength.{}", suffix),
                operator: FactOperator::Gte,
                value: ConstraintValue::int(min as i64),
                is_public: None,
            });
        }
        if let Some(max) = si.max_length {
            constraints.push(FactConstraint {
                fact_id: format!("hand.suitLength.{}", suffix),
                operator: FactOperator::Lte,
                value: ConstraintValue::int(max as i64),
                is_public: None,
            });
        }
    }

    constraints
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_constraints_produce_maximally_loose_beliefs() {
        let beliefs = derive_public_beliefs(Seat::North, &[]);
        assert_eq!(beliefs.ranges.hcp, NumberRange { min: 0, max: 40 });
        assert_eq!(beliefs.ranges.is_balanced, None);
        for suit in &ALL_SUITS {
            assert_eq!(
                beliefs.ranges.suit_lengths[suit],
                NumberRange { min: 0, max: 13 }
            );
        }
        assert!(beliefs.qualitative.is_empty());
    }

    #[test]
    fn hcp_gte_narrows_min() {
        let constraints = vec![FactConstraint {
            fact_id: "hand.hcp".to_string(),
            operator: FactOperator::Gte,
            value: ConstraintValue::int(15),
            is_public: None,
        }];
        let beliefs = derive_public_beliefs(Seat::South, &constraints);
        assert_eq!(beliefs.ranges.hcp.min, 15);
        assert_eq!(beliefs.ranges.hcp.max, 40);
    }

    #[test]
    fn hcp_lte_narrows_max() {
        let constraints = vec![FactConstraint {
            fact_id: "hand.hcp".to_string(),
            operator: FactOperator::Lte,
            value: ConstraintValue::int(17),
            is_public: None,
        }];
        let beliefs = derive_public_beliefs(Seat::South, &constraints);
        assert_eq!(beliefs.ranges.hcp.min, 0);
        assert_eq!(beliefs.ranges.hcp.max, 17);
    }

    #[test]
    fn hcp_range_narrows_both() {
        let constraints = vec![FactConstraint {
            fact_id: "hand.hcp".to_string(),
            operator: FactOperator::Range,
            value: ConstraintValue::Range {
                min: serde_json::Number::from(15),
                max: serde_json::Number::from(17),
            },
            is_public: None,
        }];
        let beliefs = derive_public_beliefs(Seat::South, &constraints);
        assert_eq!(beliefs.ranges.hcp, NumberRange { min: 15, max: 17 });
    }

    #[test]
    fn suit_length_constraints() {
        let constraints = vec![
            FactConstraint {
                fact_id: "hand.suitLength.spades".to_string(),
                operator: FactOperator::Gte,
                value: ConstraintValue::int(5),
                is_public: None,
            },
            FactConstraint {
                fact_id: "hand.suitLength.clubs".to_string(),
                operator: FactOperator::Lte,
                value: ConstraintValue::int(3),
                is_public: None,
            },
        ];
        let beliefs = derive_public_beliefs(Seat::South, &constraints);
        assert_eq!(beliefs.ranges.suit_lengths[&Suit::Spades].min, 5);
        assert_eq!(beliefs.ranges.suit_lengths[&Suit::Clubs].max, 3);
    }

    #[test]
    fn balanced_constraint_sets_min_suit_length_2() {
        let constraints = vec![FactConstraint {
            fact_id: "hand.isBalanced".to_string(),
            operator: FactOperator::Boolean,
            value: ConstraintValue::Bool(true),
            is_public: None,
        }];
        let beliefs = derive_public_beliefs(Seat::South, &constraints);
        assert_eq!(beliefs.ranges.is_balanced, Some(true));
        for suit in &ALL_SUITS {
            assert_eq!(beliefs.ranges.suit_lengths[suit].min, 2);
        }
    }

    #[test]
    fn contradiction_clamping() {
        let constraints = vec![
            FactConstraint {
                fact_id: "hand.hcp".to_string(),
                operator: FactOperator::Gte,
                value: ConstraintValue::int(20),
                is_public: None,
            },
            FactConstraint {
                fact_id: "hand.hcp".to_string(),
                operator: FactOperator::Lte,
                value: ConstraintValue::int(10),
                is_public: None,
            },
        ];
        let beliefs = derive_public_beliefs(Seat::South, &constraints);
        // Clamp: min should equal max
        assert_eq!(beliefs.ranges.hcp.min, beliefs.ranges.hcp.max);
    }

    #[test]
    fn qualitative_constraints() {
        let constraints = vec![FactConstraint {
            fact_id: "bridge.hasFourCardMajor".to_string(),
            operator: FactOperator::Boolean,
            value: ConstraintValue::Bool(true),
            is_public: None,
        }];
        let beliefs = derive_public_beliefs(Seat::South, &constraints);
        assert_eq!(beliefs.qualitative.len(), 1);
        assert_eq!(beliefs.qualitative[0].label, "Has 4-card major");
    }

    #[test]
    fn qualitative_deduplication() {
        let constraints = vec![
            FactConstraint {
                fact_id: "bridge.hasFourCardMajor".to_string(),
                operator: FactOperator::Boolean,
                value: ConstraintValue::Bool(true),
                is_public: None,
            },
            FactConstraint {
                fact_id: "bridge.hasFourCardMajor".to_string(),
                operator: FactOperator::Boolean,
                value: ConstraintValue::Bool(true),
                is_public: None,
            },
        ];
        let beliefs = derive_public_beliefs(Seat::South, &constraints);
        assert_eq!(beliefs.qualitative.len(), 1);
    }

    #[test]
    fn hand_inference_to_constraints_roundtrip() {
        let inf = HandInference {
            seat: Seat::North,
            min_hcp: Some(15),
            max_hcp: Some(17),
            is_balanced: Some(true),
            suits: {
                let mut m = HashMap::new();
                m.insert(
                    Suit::Spades,
                    super::super::types::SuitInference {
                        min_length: Some(5),
                        max_length: None,
                    },
                );
                m
            },
            source: "test".to_string(),
        };
        let constraints = hand_inference_to_constraints(&inf);
        // Should have: hcp gte 15, hcp lte 17, isBalanced true, suitLength.spades gte 5
        assert_eq!(constraints.len(), 4);

        let beliefs = derive_public_beliefs(Seat::North, &constraints);
        assert_eq!(beliefs.ranges.hcp, NumberRange { min: 15, max: 17 });
        assert_eq!(beliefs.ranges.is_balanced, Some(true));
        assert_eq!(beliefs.ranges.suit_lengths[&Suit::Spades].min, 5);
    }
}
