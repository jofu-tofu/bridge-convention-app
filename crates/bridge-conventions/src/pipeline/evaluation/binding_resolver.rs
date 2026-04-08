//! Binding resolver — resolves $-prefixed placeholders in fact IDs.
//!
//! Mirrors TS from `pipeline/evaluation/binding-resolver.ts`.

use std::collections::HashMap;

use crate::types::meaning::BidMeaningClause;

/// Resolve a fact ID by replacing $-prefixed placeholders with binding values.
pub fn resolve_fact_id(fact_id: &str, bindings: &HashMap<String, String>) -> String {
    let mut result = fact_id.to_string();
    for (key, value) in bindings {
        let placeholder = format!("${}", key);
        result = result.replace(&placeholder, value);
    }
    result
}

/// Resolve bindings in a BidMeaningClause, returning a new clause with resolved fact_id.
pub fn resolve_clause(
    clause: &BidMeaningClause,
    bindings: &HashMap<String, String>,
) -> BidMeaningClause {
    BidMeaningClause {
        fact_id: resolve_fact_id(&clause.fact_id, bindings),
        operator: clause.operator,
        value: clause.value.clone(),
        clause_id: clause.clause_id.clone(),
        description: clause.description.clone(),
        rationale: clause.rationale.clone(),
        is_public: clause.is_public,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_no_placeholders() {
        let bindings = HashMap::new();
        assert_eq!(resolve_fact_id("hand.hcp", &bindings), "hand.hcp");
    }

    #[test]
    fn resolve_single_placeholder() {
        let mut bindings = HashMap::new();
        bindings.insert("suit".into(), "hearts".into());
        assert_eq!(
            resolve_fact_id("hand.suitLength.$suit", &bindings),
            "hand.suitLength.hearts"
        );
    }
}
