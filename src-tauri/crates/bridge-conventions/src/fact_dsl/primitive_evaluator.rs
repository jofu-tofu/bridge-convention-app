//! Primitive clause evaluation — JSON-serializable primitive clauses against the fact map.

use std::collections::HashMap;

use crate::types::{PrimitiveClause, PrimitiveClauseOperator, PrimitiveClauseValue};

use super::types::FactValue;

/// Evaluate a JSON-serializable primitive clause against the fact map.
pub(super) fn evaluate_primitive_clause(
    clause: &PrimitiveClause,
    facts: &HashMap<String, FactValue>,
) -> bool {
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

/// Extract f64 from a PrimitiveClauseValue (Single variant).
pub(super) fn clause_value_as_f64(value: &PrimitiveClauseValue) -> f64 {
    match value {
        PrimitiveClauseValue::Single(n) => number_to_f64(n),
        PrimitiveClauseValue::Range { min, .. } => number_to_f64(min),
    }
}

/// Convert serde_json::Number to f64.
pub(super) fn number_to_f64(n: &serde_json::Number) -> f64 {
    n.as_f64().unwrap_or(0.0)
}
