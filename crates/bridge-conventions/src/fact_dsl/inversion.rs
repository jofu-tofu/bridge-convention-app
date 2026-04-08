//! Fact composition inversion — converts FactComposition trees to constraint bounds.
//!
//! Direct port of TS `fact-inversion.ts`. Produces `InvertedConstraint` with
//! HCP and suit length bounds usable for deal generation.

use std::collections::HashMap;

use bridge_engine::Suit;

use crate::types::{FactComposition, PrimitiveClause, PrimitiveClauseOperator, PrimitiveClauseValue};

/// Inverted constraint bounds extracted from a composition tree.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct InvertedConstraint {
    pub min_hcp: Option<u32>,
    pub max_hcp: Option<u32>,
    pub balanced: Option<bool>,
    /// AND semantics: all suits must meet their bounds.
    pub min_length: Option<HashMap<Suit, u8>>,
    pub max_length: Option<HashMap<Suit, u8>>,
    /// OR semantics: at least one suit must meet its bound.
    pub min_length_any: Option<HashMap<Suit, u8>>,
}

/// Invert a composition tree into constraint bounds.
pub fn invert_composition(comp: &FactComposition) -> InvertedConstraint {
    match comp {
        FactComposition::Primitive { clause } => invert_primitive(clause),
        FactComposition::And { operands } => {
            let constraints: Vec<InvertedConstraint> =
                operands.iter().map(invert_composition).collect();
            intersect_all(&constraints)
        }
        FactComposition::Or { operands } => {
            let constraints: Vec<InvertedConstraint> =
                operands.iter().map(invert_composition).collect();
            union_all(&constraints)
        }
        FactComposition::Not { .. } => InvertedConstraint::default(),
        // Extended, Match, Compute are not invertible for deal generation
        _ => InvertedConstraint::default(),
    }
}

fn invert_primitive(clause: &PrimitiveClause) -> InvertedConstraint {
    if clause.fact_id == "hand.hcp" {
        return invert_hcp(clause);
    }
    if clause.fact_id == "hand.isBalanced" || clause.fact_id == "bridge.isBalanced" {
        return InvertedConstraint {
            balanced: Some(true),
            ..Default::default()
        };
    }
    if let Some(suit) = suit_from_fact_id(&clause.fact_id) {
        return invert_suit_length(suit, clause);
    }
    InvertedConstraint::default()
}

fn invert_hcp(clause: &PrimitiveClause) -> InvertedConstraint {
    match &clause.operator {
        PrimitiveClauseOperator::Range => {
            if let PrimitiveClauseValue::Range { min, max } = &clause.value {
                InvertedConstraint {
                    min_hcp: min.as_u64().map(|v| v as u32),
                    max_hcp: max.as_u64().map(|v| v as u32),
                    ..Default::default()
                }
            } else {
                InvertedConstraint::default()
            }
        }
        _ => {
            let v = clause_value_as_u32(&clause.value);
            match clause.operator {
                PrimitiveClauseOperator::Gte => InvertedConstraint {
                    min_hcp: Some(v),
                    ..Default::default()
                },
                PrimitiveClauseOperator::Lte => InvertedConstraint {
                    max_hcp: Some(v),
                    ..Default::default()
                },
                PrimitiveClauseOperator::Eq => InvertedConstraint {
                    min_hcp: Some(v),
                    max_hcp: Some(v),
                    ..Default::default()
                },
                _ => InvertedConstraint::default(),
            }
        }
    }
}

fn invert_suit_length(suit: Suit, clause: &PrimitiveClause) -> InvertedConstraint {
    match &clause.operator {
        PrimitiveClauseOperator::Range => {
            if let PrimitiveClauseValue::Range { min, max } = &clause.value {
                let mut constraint = InvertedConstraint::default();
                if let Some(min_v) = min.as_u64() {
                    constraint.min_length = Some(HashMap::from([(suit, min_v as u8)]));
                }
                if let Some(max_v) = max.as_u64() {
                    constraint.max_length = Some(HashMap::from([(suit, max_v as u8)]));
                }
                constraint
            } else {
                InvertedConstraint::default()
            }
        }
        _ => {
            let v = clause_value_as_u8(&clause.value);
            match clause.operator {
                PrimitiveClauseOperator::Gte => InvertedConstraint {
                    min_length: Some(HashMap::from([(suit, v)])),
                    ..Default::default()
                },
                PrimitiveClauseOperator::Lte => InvertedConstraint {
                    max_length: Some(HashMap::from([(suit, v)])),
                    ..Default::default()
                },
                PrimitiveClauseOperator::Eq => InvertedConstraint {
                    min_length: Some(HashMap::from([(suit, v)])),
                    max_length: Some(HashMap::from([(suit, v)])),
                    ..Default::default()
                },
                _ => InvertedConstraint::default(),
            }
        }
    }
}

/// AND: take tightest bounds.
fn intersect_all(constraints: &[InvertedConstraint]) -> InvertedConstraint {
    if constraints.is_empty() {
        return InvertedConstraint::default();
    }
    if constraints.len() == 1 {
        return constraints[0].clone();
    }

    let mut result = InvertedConstraint::default();

    for c in constraints {
        // HCP: max of mins, min of maxes
        if let Some(min) = c.min_hcp {
            result.min_hcp = Some(result.min_hcp.map_or(min, |cur| cur.max(min)));
        }
        if let Some(max) = c.max_hcp {
            result.max_hcp = Some(result.max_hcp.map_or(max, |cur| cur.min(max)));
        }
        // Balanced: last wins
        if c.balanced.is_some() {
            result.balanced = c.balanced;
        }
        // MinLength AND: max per suit
        if let Some(ref ml) = c.min_length {
            let target = result.min_length.get_or_insert_with(HashMap::new);
            for (&suit, &len) in ml {
                let entry = target.entry(suit).or_insert(0);
                *entry = (*entry).max(len);
            }
        }
        // MaxLength AND: min per suit
        if let Some(ref ml) = c.max_length {
            let target = result.max_length.get_or_insert_with(HashMap::new);
            for (&suit, &len) in ml {
                let entry = target.entry(suit).or_insert(13);
                *entry = (*entry).min(len);
            }
        }
        // MinLengthAny: merge by max per suit
        if let Some(ref mla) = c.min_length_any {
            let target = result.min_length_any.get_or_insert_with(HashMap::new);
            for (&suit, &len) in mla {
                let entry = target.entry(suit).or_insert(0);
                *entry = (*entry).max(len);
            }
        }
    }

    result
}

/// OR: take loosest bounds.
fn union_all(constraints: &[InvertedConstraint]) -> InvertedConstraint {
    if constraints.is_empty() {
        return InvertedConstraint::default();
    }
    if constraints.len() == 1 {
        return constraints[0].clone();
    }

    let mut result = InvertedConstraint::default();
    let mut has_min_hcp = true;
    let mut has_max_hcp = true;

    for c in constraints {
        // HCP: min of mins (loosest), max of maxes
        match c.min_hcp {
            Some(min) => {
                result.min_hcp = Some(result.min_hcp.map_or(min, |cur| cur.min(min)));
            }
            None => has_min_hcp = false,
        }
        match c.max_hcp {
            Some(max) => {
                result.max_hcp = Some(result.max_hcp.map_or(max, |cur| cur.max(max)));
            }
            None => has_max_hcp = false,
        }

        // MinLength → MinLengthAny: merge by min per suit (loosest)
        if let Some(ref ml) = c.min_length {
            let target = result.min_length_any.get_or_insert_with(HashMap::new);
            for (&suit, &len) in ml {
                let entry = target.entry(suit).or_insert(len);
                *entry = (*entry).min(len);
            }
        }
        if let Some(ref mla) = c.min_length_any {
            let target = result.min_length_any.get_or_insert_with(HashMap::new);
            for (&suit, &len) in mla {
                let entry = target.entry(suit).or_insert(len);
                *entry = (*entry).min(len);
            }
        }
    }

    // If any branch lacks a bound, remove it (loosest = unconstrained)
    if !has_min_hcp {
        result.min_hcp = None;
    }
    if !has_max_hcp {
        result.max_hcp = None;
    }

    result
}

// --- Helpers ---

fn suit_from_fact_id(fact_id: &str) -> Option<Suit> {
    match fact_id {
        "hand.suitLength.spades" => Some(Suit::Spades),
        "hand.suitLength.hearts" => Some(Suit::Hearts),
        "hand.suitLength.diamonds" => Some(Suit::Diamonds),
        "hand.suitLength.clubs" => Some(Suit::Clubs),
        _ => None,
    }
}

fn clause_value_as_u32(value: &PrimitiveClauseValue) -> u32 {
    match value {
        PrimitiveClauseValue::Single(n) => n.as_u64().unwrap_or(0) as u32,
        PrimitiveClauseValue::Range { min, .. } => min.as_u64().unwrap_or(0) as u32,
    }
}

fn clause_value_as_u8(value: &PrimitiveClauseValue) -> u8 {
    clause_value_as_u32(value) as u8
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invert_hcp_gte() {
        let comp = FactComposition::Primitive {
            clause: PrimitiveClause {
                fact_id: "hand.hcp".to_string(),
                operator: PrimitiveClauseOperator::Gte,
                value: PrimitiveClauseValue::Single(serde_json::Number::from(12)),
            },
        };
        let result = invert_composition(&comp);
        assert_eq!(result.min_hcp, Some(12));
        assert_eq!(result.max_hcp, None);
    }

    #[test]
    fn invert_suit_length_range() {
        let comp = FactComposition::Primitive {
            clause: PrimitiveClause {
                fact_id: "hand.suitLength.spades".to_string(),
                operator: PrimitiveClauseOperator::Range,
                value: PrimitiveClauseValue::Range {
                    min: serde_json::Number::from(4),
                    max: serde_json::Number::from(6),
                },
            },
        };
        let result = invert_composition(&comp);
        assert_eq!(result.min_length.as_ref().unwrap().get(&Suit::Spades), Some(&4));
        assert_eq!(result.max_length.as_ref().unwrap().get(&Suit::Spades), Some(&6));
    }

    #[test]
    fn invert_and_tightens() {
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
                        fact_id: "hand.hcp".to_string(),
                        operator: PrimitiveClauseOperator::Lte,
                        value: PrimitiveClauseValue::Single(serde_json::Number::from(12)),
                    },
                },
            ],
        };
        let result = invert_composition(&comp);
        assert_eq!(result.min_hcp, Some(8));
        assert_eq!(result.max_hcp, Some(12));
    }

    #[test]
    fn invert_or_loosens() {
        let comp = FactComposition::Or {
            operands: vec![
                FactComposition::Primitive {
                    clause: PrimitiveClause {
                        fact_id: "hand.suitLength.spades".to_string(),
                        operator: PrimitiveClauseOperator::Gte,
                        value: PrimitiveClauseValue::Single(serde_json::Number::from(5)),
                    },
                },
                FactComposition::Primitive {
                    clause: PrimitiveClause {
                        fact_id: "hand.suitLength.hearts".to_string(),
                        operator: PrimitiveClauseOperator::Gte,
                        value: PrimitiveClauseValue::Single(serde_json::Number::from(4)),
                    },
                },
            ],
        };
        let result = invert_composition(&comp);
        // OR moves min_length → min_length_any
        assert!(result.min_length.is_none());
        let any = result.min_length_any.unwrap();
        assert_eq!(any.get(&Suit::Spades), Some(&5));
        assert_eq!(any.get(&Suit::Hearts), Some(&4));
    }

    #[test]
    fn invert_balanced() {
        let comp = FactComposition::Primitive {
            clause: PrimitiveClause {
                fact_id: "hand.isBalanced".to_string(),
                operator: PrimitiveClauseOperator::Eq,
                value: PrimitiveClauseValue::Single(serde_json::Number::from(1)),
            },
        };
        let result = invert_composition(&comp);
        assert_eq!(result.balanced, Some(true));
    }
}
