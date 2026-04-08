//! Specificity deriver — counts unique communicative constraint dimensions.
//!
//! Mirrors TS from `pipeline/evaluation/specificity-deriver.ts` and
//! `specificity-classifier.ts`.

use std::collections::{HashMap, HashSet};

use crate::pipeline::evaluation::binding_resolver::resolve_fact_id;
use crate::types::meaning::{BidMeaningClause, ConstraintDimension, ConstraintValue, FactOperator};

/// Well-known fact ID to dimension mappings.
fn fact_id_to_dimension(fact_id: &str) -> Option<ConstraintDimension> {
    // Suit identity facts
    if fact_id.starts_with("hand.suitLength.") {
        // suitLength contributes both suitIdentity (naming a specific suit)
        // and suitLength (length constraint)
        return Some(ConstraintDimension::SuitLength);
    }

    match fact_id {
        "hand.hcp" | "hand.totalPoints" => Some(ConstraintDimension::PointRange),
        "hand.isBalanced" => Some(ConstraintDimension::ShapeClass),
        "bridge.hasFourCardMajor" | "bridge.hasFiveCardMajor" | "bridge.majorPattern" => {
            Some(ConstraintDimension::ShapeClass)
        }
        "bridge.hasShortage" => Some(ConstraintDimension::ShapeClass),
        _ => None,
    }
}

/// Check if a clause contributes a specific suit identity dimension.
fn extracts_suit_identity(fact_id: &str) -> bool {
    fact_id.starts_with("hand.suitLength.") || fact_id.contains(".$suit")
}

/// Check if a clause is negative (boolean:false or lte on suit length with low threshold).
fn is_negative_clause(clause: &BidMeaningClause) -> bool {
    match clause.operator {
        FactOperator::Boolean => matches!(&clause.value, ConstraintValue::Bool(false)),
        FactOperator::Lte => {
            if clause.fact_id.starts_with("hand.suitLength.") {
                // Vacuous threshold: < 3 cards doesn't communicate much
                if let ConstraintValue::Number(n) = &clause.value {
                    n.as_f64().unwrap_or(0.0) < 3.0
                } else {
                    false
                }
            } else {
                false
            }
        }
        _ => false,
    }
}

/// Derive specificity from a set of clauses.
///
/// Returns a float representing the number of unique communicative dimensions.
pub fn derive_specificity(
    clauses: &[BidMeaningClause],
    bindings: &HashMap<String, String>,
    inherited_dimensions: &[ConstraintDimension],
) -> f64 {
    let mut dimensions: HashSet<ConstraintDimension> = HashSet::new();

    // Include inherited dimensions
    for dim in inherited_dimensions {
        dimensions.insert(*dim);
    }

    for clause in clauses {
        let resolved_id = resolve_fact_id(&clause.fact_id, bindings);

        // Skip negative clauses for specificity counting
        if is_negative_clause(clause) {
            continue;
        }

        // Check for suit identity contribution
        if extracts_suit_identity(&resolved_id) {
            dimensions.insert(ConstraintDimension::SuitIdentity);
        }

        // Check for dimension contribution from the fact
        if let Some(dim) = fact_id_to_dimension(&resolved_id) {
            dimensions.insert(dim);
        }

        // Module-derived facts that constrain dimensions
        if let Some(ref clause_id) = clause.clause_id {
            if clause_id.contains("suitQuality") {
                dimensions.insert(ConstraintDimension::SuitQuality);
            }
            if clause_id.contains("suitRelation") || clause_id.contains("longestSuit") {
                dimensions.insert(ConstraintDimension::SuitRelation);
            }
        }
    }

    dimensions.len() as f64
}

#[cfg(test)]
mod tests {
    use super::*;

    fn clause(fact_id: &str, op: FactOperator, value: ConstraintValue) -> BidMeaningClause {
        BidMeaningClause {
            fact_id: fact_id.into(),
            operator: op,
            value,
            clause_id: None,
            description: None,
            rationale: None,
            is_public: None,
        }
    }

    #[test]
    fn hcp_contributes_point_range() {
        let clauses = vec![clause("hand.hcp", FactOperator::Gte, ConstraintValue::int(8))];
        let spec = derive_specificity(&clauses, &HashMap::new(), &[]);
        assert!(spec >= 1.0);
    }

    #[test]
    fn suit_length_contributes_two_dimensions() {
        let clauses = vec![clause(
            "hand.suitLength.hearts",
            FactOperator::Gte,
            ConstraintValue::int(5),
        )];
        let spec = derive_specificity(&clauses, &HashMap::new(), &[]);
        // suitLength + suitIdentity
        assert!(spec >= 2.0);
    }

    #[test]
    fn inherited_dimensions_included() {
        let clauses = vec![clause("hand.hcp", FactOperator::Gte, ConstraintValue::int(8))];
        let spec = derive_specificity(
            &clauses,
            &HashMap::new(),
            &[ConstraintDimension::SuitIdentity],
        );
        assert!(spec >= 2.0);
    }
}
