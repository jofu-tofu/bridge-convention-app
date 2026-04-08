//! Clause derivation — derives clause IDs and descriptions from fact constraints.
//!
//! Mirrors TS from `pipeline/evaluation/clause-derivation.ts`.

use crate::types::meaning::{BidMeaningClause, ConstraintValue, FactOperator};

/// Derive a deterministic clause ID from a fact clause.
pub fn derive_clause_id(clause: &BidMeaningClause) -> String {
    let op_str = match clause.operator {
        FactOperator::Gte => "gte",
        FactOperator::Lte => "lte",
        FactOperator::Eq => "eq",
        FactOperator::Range => "range",
        FactOperator::Boolean => "bool",
        FactOperator::In => "in",
    };
    let val_str = constraint_value_to_string(&clause.value);
    format!("{}:{}:{}", clause.fact_id, op_str, val_str)
}

/// Derive a human-readable description for a clause.
pub fn derive_clause_description(clause: &BidMeaningClause) -> String {
    let name = display_name(&clause.fact_id);

    match clause.operator {
        FactOperator::Gte => format!("{}+", format_with_name(&name, &clause.value)),
        FactOperator::Lte => format!("{} or fewer", format_with_name(&name, &clause.value)),
        FactOperator::Eq => format!("exactly {}", format_with_name(&name, &clause.value)),
        FactOperator::Range => {
            if let ConstraintValue::Range { ref min, ref max } = clause.value {
                format!("{}-{} {}", min, max, name)
            } else {
                format!("{} in range", name)
            }
        }
        FactOperator::Boolean => {
            match &clause.value {
                ConstraintValue::Bool(true) => name.to_string(),
                ConstraintValue::Bool(false) => format!("not {}", name),
                _ => name.to_string(),
            }
        }
        FactOperator::In => format!("{} is one of {}", name, constraint_value_to_string(&clause.value)),
    }
}

/// Map well-known fact IDs to display names.
fn display_name(fact_id: &str) -> String {
    match fact_id {
        "hand.hcp" => "HCP".into(),
        "hand.isBalanced" => "balanced".into(),
        "hand.suitLength.spades" => "spades".into(),
        "hand.suitLength.hearts" => "hearts".into(),
        "hand.suitLength.diamonds" => "diamonds".into(),
        "hand.suitLength.clubs" => "clubs".into(),
        "bridge.hasFourCardMajor" => "4-card major".into(),
        "bridge.hasFiveCardMajor" => "5-card major".into(),
        "bridge.hasShortage" => "shortage".into(),
        _ => {
            // Extract last segment after the last dot
            fact_id
                .rsplit('.')
                .next()
                .unwrap_or(fact_id)
                .to_string()
        }
    }
}

fn format_with_name(name: &str, value: &ConstraintValue) -> String {
    match value {
        ConstraintValue::Number(n) => format!("{} {}", n, name),
        ConstraintValue::Bool(b) => format!("{} {}", b, name),
        ConstraintValue::String(s) => format!("{} {}", s, name),
        _ => name.to_string(),
    }
}

fn constraint_value_to_string(value: &ConstraintValue) -> String {
    match value {
        ConstraintValue::Number(n) => n.to_string(),
        ConstraintValue::Bool(b) => b.to_string(),
        ConstraintValue::String(s) => s.clone(),
        ConstraintValue::Range { min, max } => format!("{}-{}", min, max),
        ConstraintValue::List(items) => format!("[{}]", items.join(",")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derive_clause_id_gte() {
        let clause = BidMeaningClause {
            fact_id: "hand.hcp".into(),
            operator: FactOperator::Gte,
            value: ConstraintValue::int(8),
            clause_id: None,
            description: None,
            rationale: None,
            is_public: None,
        };
        assert_eq!(derive_clause_id(&clause), "hand.hcp:gte:8");
    }

    #[test]
    fn derive_description_gte() {
        let clause = BidMeaningClause {
            fact_id: "hand.hcp".into(),
            operator: FactOperator::Gte,
            value: ConstraintValue::int(8),
            clause_id: None,
            description: None,
            rationale: None,
            is_public: None,
        };
        assert_eq!(derive_clause_description(&clause), "8 HCP+");
    }
}
