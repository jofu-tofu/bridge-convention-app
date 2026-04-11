//! FactComposition tree interpreter.
//!
//! Evaluates a `FactComposition` tree against a hand and previously evaluated facts,
//! returning a `FactData` (boolean, number, or string).

use std::collections::HashMap;

use bridge_engine::{Hand, Rank, Suit};

use crate::types::{
    CompareOp, ComputeExpr, ExtendedClause, FactComposition, FactOutput, PrimitiveClause,
    PrimitiveClauseOperator, PrimitiveClauseValue,
};

use super::primitives::{suit_name_to_index, SUIT_LENGTH_FACT_IDS};
use super::types::{get_bool, get_num, FactData, FactValue};

/// Evaluate a composition tree, returning the computed value.
///
/// Boolean nodes (Primitive/Extended/And/Or/Not) return `FactData::Boolean`.
/// Match nodes return the `then` value of the first matching case, or `default`.
/// Compute nodes return `FactData::Number`.
pub fn evaluate_composition(
    comp: &FactComposition,
    hand: &Hand,
    facts: &HashMap<String, FactValue>,
    bindings: Option<&HashMap<String, String>>,
) -> FactData {
    match comp {
        FactComposition::Primitive { clause } => {
            FactData::Boolean(evaluate_primitive_clause(clause, facts))
        }
        FactComposition::Extended { clause } => {
            FactData::Boolean(evaluate_extended_clause(clause, hand, facts))
        }
        FactComposition::And { operands } => {
            let result = operands
                .iter()
                .all(|op| evaluate_composition(op, hand, facts, bindings).as_bool());
            FactData::Boolean(result)
        }
        FactComposition::Or { operands } => {
            let result = operands
                .iter()
                .any(|op| evaluate_composition(op, hand, facts, bindings).as_bool());
            FactData::Boolean(result)
        }
        FactComposition::Not { operand } => {
            let inner = evaluate_composition(operand, hand, facts, bindings).as_bool();
            FactData::Boolean(!inner)
        }
        FactComposition::Match { cases, default } => {
            for case in cases {
                if evaluate_composition(&case.when, hand, facts, bindings).as_bool() {
                    return fact_output_to_data(&case.then);
                }
            }
            fact_output_to_data(default)
        }
        FactComposition::Compute { expr } => {
            FactData::Number(evaluate_compute_expr(expr, facts, bindings))
        }
    }
}

/// Evaluate a JSON-serializable primitive clause against the fact map.
fn evaluate_primitive_clause(clause: &PrimitiveClause, facts: &HashMap<String, FactValue>) -> bool {
    let fact_value = match facts.get(&clause.fact_id) {
        Some(fv) => fv.value.as_number(),
        None => {
            // Boolean fact lookup: check if fact_id points to a boolean
            if let Some(fv) = facts.get(&clause.fact_id) {
                return match &clause.operator {
                    PrimitiveClauseOperator::Eq => {
                        let expected = clause_value_as_f64(&clause.value);
                        if fv.value.as_bool() {
                            expected == 1.0
                        } else {
                            expected == 0.0
                        }
                    }
                    _ => fv.value.as_bool(),
                };
            }
            return false;
        }
    };

    match &clause.operator {
        PrimitiveClauseOperator::Gte => fact_value >= clause_value_as_f64(&clause.value),
        PrimitiveClauseOperator::Lte => fact_value <= clause_value_as_f64(&clause.value),
        PrimitiveClauseOperator::Eq => {
            (fact_value - clause_value_as_f64(&clause.value)).abs() < f64::EPSILON
        }
        PrimitiveClauseOperator::Range => {
            if let PrimitiveClauseValue::Range { min, max } = &clause.value {
                let min_f = number_to_f64(min);
                let max_f = number_to_f64(max);
                fact_value >= min_f && fact_value <= max_f
            } else {
                false
            }
        }
    }
}

/// Evaluate a Rust-only extended clause.
fn evaluate_extended_clause(
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

/// Evaluate a ComputeExpr to a numeric value.
fn evaluate_compute_expr(
    expr: &ComputeExpr,
    facts: &HashMap<String, FactValue>,
    bindings: Option<&HashMap<String, String>>,
) -> f64 {
    match expr {
        ComputeExpr::Literal { value } => *value,
        ComputeExpr::FactRef { fact_id } => get_num(facts, fact_id),
        ComputeExpr::Add { operands } => operands
            .iter()
            .map(|op| evaluate_compute_expr(op, facts, bindings))
            .sum(),
        ComputeExpr::ShortagePoints { trump_suit_binding } => {
            let trump_suit_name = bindings
                .and_then(|b| b.get(trump_suit_binding.as_str()))
                .or_else(|| {
                    bindings.and_then(|b| {
                        b.get(&trump_suit_binding.trim_start_matches('$').to_string())
                    })
                })
                .map(|s| s.as_str());

            let trump_idx = trump_suit_name.and_then(suit_name_to_index);

            let mut shortage_points = 0.0;
            for i in 0..4 {
                if Some(i) == trump_idx {
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
    }
}

/// Convert a FactOutput to FactData.
fn fact_output_to_data(output: &FactOutput) -> FactData {
    match output {
        FactOutput::Text(s) => FactData::Text(s.clone()),
        FactOutput::Number(n) => FactData::Number(*n),
        FactOutput::Boolean(b) => FactData::Boolean(*b),
    }
}

/// Extract f64 from a PrimitiveClauseValue (Single variant).
fn clause_value_as_f64(value: &PrimitiveClauseValue) -> f64 {
    match value {
        PrimitiveClauseValue::Single(n) => number_to_f64(n),
        PrimitiveClauseValue::Range { min, .. } => number_to_f64(min),
    }
}

/// Convert serde_json::Number to f64.
fn number_to_f64(n: &serde_json::Number) -> f64 {
    n.as_f64().unwrap_or(0.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{MatchCase, PrimitiveClauseOperator, PrimitiveClauseValue};
    use bridge_engine::{Card, Hand, Rank, Suit};

    fn empty_hand() -> Hand {
        Hand { cards: vec![] }
    }

    fn make_facts(pairs: &[(&str, f64)]) -> HashMap<String, FactValue> {
        pairs
            .iter()
            .map(|(id, val)| {
                (
                    id.to_string(),
                    FactValue {
                        fact_id: id.to_string(),
                        value: FactData::Number(*val),
                    },
                )
            })
            .collect()
    }

    #[test]
    fn primitive_gte_true() {
        let comp = FactComposition::Primitive {
            clause: PrimitiveClause {
                fact_id: "hand.hcp".to_string(),
                operator: PrimitiveClauseOperator::Gte,
                value: PrimitiveClauseValue::Single(serde_json::Number::from(10)),
            },
        };
        let facts = make_facts(&[("hand.hcp", 12.0)]);
        let result = evaluate_composition(&comp, &empty_hand(), &facts, None);
        assert_eq!(result, FactData::Boolean(true));
    }

    #[test]
    fn primitive_gte_false() {
        let comp = FactComposition::Primitive {
            clause: PrimitiveClause {
                fact_id: "hand.hcp".to_string(),
                operator: PrimitiveClauseOperator::Gte,
                value: PrimitiveClauseValue::Single(serde_json::Number::from(15)),
            },
        };
        let facts = make_facts(&[("hand.hcp", 12.0)]);
        let result = evaluate_composition(&comp, &empty_hand(), &facts, None);
        assert_eq!(result, FactData::Boolean(false));
    }

    #[test]
    fn and_composition() {
        let comp = FactComposition::And {
            operands: vec![
                FactComposition::Primitive {
                    clause: PrimitiveClause {
                        fact_id: "hand.hcp".to_string(),
                        operator: PrimitiveClauseOperator::Gte,
                        value: PrimitiveClauseValue::Single(serde_json::Number::from(8)),
                    },
                },
                FactComposition::Primitive {
                    clause: PrimitiveClause {
                        fact_id: "hand.suitLength.spades".to_string(),
                        operator: PrimitiveClauseOperator::Gte,
                        value: PrimitiveClauseValue::Single(serde_json::Number::from(4)),
                    },
                },
            ],
        };
        let facts = make_facts(&[("hand.hcp", 10.0), ("hand.suitLength.spades", 5.0)]);
        assert_eq!(
            evaluate_composition(&comp, &empty_hand(), &facts, None),
            FactData::Boolean(true)
        );
    }

    #[test]
    fn match_composition_first_case_wins() {
        let comp = FactComposition::Match {
            cases: vec![
                MatchCase {
                    when: FactComposition::Primitive {
                        clause: PrimitiveClause {
                            fact_id: "hand.suitLength.spades".to_string(),
                            operator: PrimitiveClauseOperator::Gte,
                            value: PrimitiveClauseValue::Single(serde_json::Number::from(5)),
                        },
                    },
                    then: FactOutput::Text("spades".to_string()),
                },
                MatchCase {
                    when: FactComposition::Primitive {
                        clause: PrimitiveClause {
                            fact_id: "hand.suitLength.hearts".to_string(),
                            operator: PrimitiveClauseOperator::Gte,
                            value: PrimitiveClauseValue::Single(serde_json::Number::from(5)),
                        },
                    },
                    then: FactOutput::Text("hearts".to_string()),
                },
            ],
            default: FactOutput::Text("none".to_string()),
        };
        let facts = make_facts(&[
            ("hand.suitLength.spades", 5.0),
            ("hand.suitLength.hearts", 6.0),
        ]);
        assert_eq!(
            evaluate_composition(&comp, &empty_hand(), &facts, None),
            FactData::Text("spades".to_string())
        );
    }

    #[test]
    fn match_composition_default() {
        let comp = FactComposition::Match {
            cases: vec![MatchCase {
                when: FactComposition::Primitive {
                    clause: PrimitiveClause {
                        fact_id: "hand.suitLength.spades".to_string(),
                        operator: PrimitiveClauseOperator::Gte,
                        value: PrimitiveClauseValue::Single(serde_json::Number::from(5)),
                    },
                },
                then: FactOutput::Text("spades".to_string()),
            }],
            default: FactOutput::Text("none".to_string()),
        };
        let facts = make_facts(&[("hand.suitLength.spades", 3.0)]);
        assert_eq!(
            evaluate_composition(&comp, &empty_hand(), &facts, None),
            FactData::Text("none".to_string())
        );
    }

    #[test]
    fn compute_add() {
        let comp = FactComposition::Compute {
            expr: ComputeExpr::Add {
                operands: vec![
                    ComputeExpr::FactRef {
                        fact_id: "hand.hcp".to_string(),
                    },
                    ComputeExpr::Literal { value: 3.0 },
                ],
            },
        };
        let facts = make_facts(&[("hand.hcp", 10.0)]);
        assert_eq!(
            evaluate_composition(&comp, &empty_hand(), &facts, None),
            FactData::Number(13.0)
        );
    }

    #[test]
    fn top_honor_count() {
        let hand = Hand {
            cards: vec![
                Card {
                    suit: Suit::Spades,
                    rank: Rank::Ace,
                },
                Card {
                    suit: Suit::Spades,
                    rank: Rank::King,
                },
                Card {
                    suit: Suit::Spades,
                    rank: Rank::Five,
                },
                Card {
                    suit: Suit::Hearts,
                    rank: Rank::Queen,
                },
            ],
        };
        let facts = HashMap::new();
        let clause = ExtendedClause::TopHonorCount {
            suit: Suit::Spades,
            min: Some(2),
            max: None,
        };
        assert!(evaluate_extended_clause(&clause, &hand, &facts));

        let clause2 = ExtendedClause::TopHonorCount {
            suit: Suit::Spades,
            min: Some(3),
            max: None,
        };
        assert!(!evaluate_extended_clause(&clause2, &hand, &facts));
    }

    #[test]
    fn suit_compare() {
        let facts = make_facts(&[
            ("hand.suitLength.spades", 5.0),
            ("hand.suitLength.hearts", 4.0),
        ]);
        let clause = ExtendedClause::SuitCompare {
            a: Suit::Spades,
            op: CompareOp::Gt,
            b: Suit::Hearts,
        };
        assert!(evaluate_extended_clause(&clause, &empty_hand(), &facts));
    }

    #[test]
    fn shortage_points_compute() {
        let comp = FactComposition::Compute {
            expr: ComputeExpr::Add {
                operands: vec![
                    ComputeExpr::FactRef {
                        fact_id: "hand.hcp".to_string(),
                    },
                    ComputeExpr::ShortagePoints {
                        trump_suit_binding: "suit".to_string(),
                    },
                ],
            },
        };
        let facts = make_facts(&[
            ("hand.hcp", 10.0),
            ("hand.suitLength.spades", 5.0),
            ("hand.suitLength.hearts", 4.0),
            ("hand.suitLength.diamonds", 3.0),
            ("hand.suitLength.clubs", 1.0), // singleton = 2 pts
        ]);
        let mut bindings = HashMap::new();
        bindings.insert("suit".to_string(), "hearts".to_string());
        let result = evaluate_composition(&comp, &empty_hand(), &facts, Some(&bindings));
        // HCP 10 + shortage: clubs singleton = 2
        assert_eq!(result, FactData::Number(12.0));
    }
}
