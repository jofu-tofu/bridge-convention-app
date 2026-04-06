//! Compute expression evaluation — numeric expressions against facts and bindings.

use std::collections::HashMap;

use crate::types::{ComputeExpr, FactOutput};

use super::primitives::{suit_name_to_index, SUIT_LENGTH_FACT_IDS};
use super::types::{get_num, FactData, FactValue};

/// Evaluate a ComputeExpr to a numeric value.
pub(super) fn evaluate_compute_expr(
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
pub(super) fn fact_output_to_data(output: &FactOutput) -> FactData {
    match output {
        FactOutput::Text(s) => FactData::Text(s.clone()),
        FactOutput::Number(n) => FactData::Number(*n),
        FactOutput::Boolean(b) => FactData::Boolean(*b),
    }
}
