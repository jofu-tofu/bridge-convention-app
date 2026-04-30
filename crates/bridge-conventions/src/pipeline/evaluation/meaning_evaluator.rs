//! Meaning evaluator — evaluates surface clauses against facts.
//!
//! Mirrors TS from `pipeline/evaluation/meaning-evaluator.ts`.

use std::collections::HashMap;

use bridge_engine::types::Hand;

use crate::fact_dsl::bridge_derived::evaluate_bridge_relational;
use crate::fact_dsl::system_facts::evaluate_system_relational;
use crate::fact_dsl::types::{EvaluatedFacts, FactData, PublicConstraint, RelationalFactContext};
use crate::pipeline::evaluation::binding_resolver::resolve_clause;
use crate::pipeline::evaluation::specificity_deriver::derive_specificity;
use crate::pipeline::evaluation::types::{MeaningClause, MeaningProposal, RankingMetadata};
use crate::types::meaning::ConstraintDimension;
use crate::types::meaning::{BidMeaning, BidMeaningClause, ConstraintValue, FactOperator};
use crate::types::system_config::SystemConfig;

/// Evaluate a single clause against evaluated facts.
pub fn evaluate_clause(
    clause: &BidMeaningClause,
    facts: &EvaluatedFacts,
    bindings: &HashMap<String, String>,
) -> MeaningClause {
    let resolved = resolve_clause(clause, bindings);
    let fact_value = facts.facts.get(&resolved.fact_id);

    let (satisfied, observed_value) = match fact_value {
        None => (false, None),
        Some(fv) => {
            let sat = check_satisfaction(&resolved.operator, &resolved.value, &fv.value);
            let obs = fact_data_to_json(&fv.value);
            (sat, Some(obs))
        }
    };

    MeaningClause {
        fact_id: resolved.fact_id,
        operator: resolved.operator,
        value: resolved.value,
        satisfied,
        clause_id: resolved.clause_id,
        description: resolved.description,
        observed_value,
        is_public: resolved.is_public,
    }
}

/// Evaluate all clauses of a BidMeaning against pre-computed facts.
///
/// Relational facts (layers 5-6) should already be computed for this
/// surface's binding set via `precompute_binding_facts`. This avoids
/// per-surface cloning.
fn evaluate_bid_meaning_with_facts(
    surface: &BidMeaning,
    facts: &EvaluatedFacts,
    inherited_dimensions: &HashMap<String, Vec<ConstraintDimension>>,
) -> MeaningProposal {
    let bindings = surface.surface_bindings.clone().unwrap_or_default();

    let clauses: Vec<MeaningClause> = surface
        .clauses
        .iter()
        .map(|c| evaluate_clause(c, facts, &bindings))
        .collect();

    let all_satisfied = clauses.iter().all(|c| c.satisfied);

    let empty_dims: Vec<ConstraintDimension> = Vec::new();
    let per_meaning_dims = inherited_dimensions
        .get(&surface.meaning_id)
        .unwrap_or(&empty_dims);
    let specificity = derive_specificity(&surface.clauses, &bindings, per_meaning_dims);

    let ranking = RankingMetadata {
        recommendation_band: surface.ranking.recommendation_band,
        module_precedence: surface.ranking.module_precedence,
        declaration_order: surface.ranking.declaration_order,
        specificity,
    };

    MeaningProposal {
        meaning_id: surface.meaning_id.clone(),
        semantic_class_id: surface.semantic_class_id.clone(),
        module_id: surface.module_id.clone().unwrap_or_default(),
        ranking,
        clauses,
        all_satisfied,
        disclosure: surface.disclosure,
        source_intent: surface.source_intent.clone(),
        teaching_label: surface.teaching_label.clone(),
        surface_bindings: surface.surface_bindings.clone(),
        encoding: surface.encoding.clone(),
    }
}

/// Evaluate all bid meanings in a list.
///
/// Precomputes relational facts per unique binding set so we clone + re-evaluate
/// once per binding key (typically 0-3 keys) instead of once per surface.
pub fn evaluate_all_bid_meanings(
    surfaces: &[BidMeaning],
    facts: &EvaluatedFacts,
    inherited_dimensions: &HashMap<String, Vec<ConstraintDimension>>,
    hand: Option<&Hand>,
    system_config: Option<&SystemConfig>,
    public_commitments: Option<&[PublicConstraint]>,
) -> Vec<MeaningProposal> {
    // Precompute relational facts per unique binding set
    let binding_cache =
        precompute_binding_facts(surfaces, facts, hand, system_config, public_commitments);

    surfaces
        .iter()
        .map(|s| {
            let binding_key = binding_cache_key(&s.surface_bindings);
            let effective_facts = binding_cache.get(&binding_key).unwrap_or(facts);
            evaluate_bid_meaning_with_facts(s, effective_facts, inherited_dimensions)
        })
        .collect()
}

/// Cache key for a surface's bindings — None for no bindings, Some(sorted pairs) otherwise.
fn binding_cache_key(bindings: &Option<HashMap<String, String>>) -> Option<Vec<(String, String)>> {
    bindings.as_ref().map(|b| {
        let mut pairs: Vec<(String, String)> =
            b.iter().map(|(k, v)| (k.clone(), v.clone())).collect();
        pairs.sort();
        pairs
    })
}

/// Precompute relational facts for each unique binding set found in surfaces.
fn precompute_binding_facts(
    surfaces: &[BidMeaning],
    facts: &EvaluatedFacts,
    hand: Option<&Hand>,
    system_config: Option<&SystemConfig>,
    public_commitments: Option<&[PublicConstraint]>,
) -> HashMap<Option<Vec<(String, String)>>, EvaluatedFacts> {
    let mut cache: HashMap<Option<Vec<(String, String)>>, EvaluatedFacts> = HashMap::new();

    let h = match hand {
        Some(h) => h,
        None => return cache, // No hand → no relational facts to compute
    };

    for surface in surfaces {
        let key = binding_cache_key(&surface.surface_bindings);
        if key.is_none() || cache.contains_key(&key) {
            continue;
        }

        let bindings = surface.surface_bindings.as_ref().unwrap();
        let mut cloned = facts.clone();
        let fit_agreed =
            bindings
                .get("suit")
                .map(|suit| crate::fact_dsl::types::FitAgreedContext {
                    strain: suit.clone(),
                    confidence: crate::types::ConfidenceLevel::Tentative,
                });
        // public_commitments flow in from the caller (derived from the
        // observation log via
        // `pipeline::observation::public_commitments::derive_public_commitments`)
        // so CombinedAceCount / CombinedKingCount extended clauses see
        // partner's disclosed counts on this per-surface projection path.
        let ctx = RelationalFactContext {
            bindings: Some(bindings.clone()),
            public_commitments: public_commitments.map(|c| c.to_vec()),
            fit_agreed,
        };
        evaluate_bridge_relational(h, &mut cloned.facts, &ctx);
        if let Some(sys) = system_config {
            evaluate_system_relational(sys, &mut cloned.facts, &ctx);
        }

        cache.insert(key, cloned);
    }

    cache
}

/// Check if a fact value satisfies a constraint.
fn check_satisfaction(
    operator: &FactOperator,
    constraint: &ConstraintValue,
    actual: &FactData,
) -> bool {
    match operator {
        FactOperator::Gte => {
            if let (ConstraintValue::Number(threshold), FactData::Number(val)) =
                (constraint, actual)
            {
                *val >= threshold.as_f64().unwrap_or(0.0)
            } else {
                false
            }
        }
        FactOperator::Lte => {
            if let (ConstraintValue::Number(threshold), FactData::Number(val)) =
                (constraint, actual)
            {
                *val <= threshold.as_f64().unwrap_or(0.0)
            } else {
                false
            }
        }
        FactOperator::Eq => match (constraint, actual) {
            (ConstraintValue::Number(n), FactData::Number(val)) => {
                (*val - n.as_f64().unwrap_or(0.0)).abs() < f64::EPSILON
            }
            (ConstraintValue::String(s), FactData::Text(t)) => s == t,
            (ConstraintValue::Bool(b), FactData::Boolean(v)) => b == v,
            _ => false,
        },
        FactOperator::Range => {
            if let (ConstraintValue::Range { min, max }, FactData::Number(val)) =
                (constraint, actual)
            {
                *val >= min.as_f64().unwrap_or(0.0) && *val <= max.as_f64().unwrap_or(0.0)
            } else {
                false
            }
        }
        FactOperator::Boolean => {
            if let (ConstraintValue::Bool(expected), FactData::Boolean(val)) = (constraint, actual)
            {
                expected == val
            } else {
                false
            }
        }
        FactOperator::In => {
            if let (ConstraintValue::List(items), FactData::Text(val)) = (constraint, actual) {
                items.iter().any(|item| item == val)
            } else {
                false
            }
        }
    }
}

fn fact_data_to_json(data: &FactData) -> serde_json::Value {
    match data {
        FactData::Number(n) => serde_json::Value::Number(
            serde_json::Number::from_f64(*n).unwrap_or(serde_json::Number::from(0)),
        ),
        FactData::Boolean(b) => serde_json::Value::Bool(*b),
        FactData::Text(s) => serde_json::Value::String(s.clone()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn check_gte_satisfied() {
        assert!(check_satisfaction(
            &FactOperator::Gte,
            &ConstraintValue::int(8),
            &FactData::Number(10.0),
        ));
    }

    #[test]
    fn check_gte_not_satisfied() {
        assert!(!check_satisfaction(
            &FactOperator::Gte,
            &ConstraintValue::int(8),
            &FactData::Number(7.0),
        ));
    }

    #[test]
    fn check_range_satisfied() {
        assert!(check_satisfaction(
            &FactOperator::Range,
            &ConstraintValue::Range {
                min: serde_json::Number::from(15),
                max: serde_json::Number::from(17),
            },
            &FactData::Number(16.0),
        ));
    }

    #[test]
    fn check_boolean_satisfied() {
        assert!(check_satisfaction(
            &FactOperator::Boolean,
            &ConstraintValue::Bool(true),
            &FactData::Boolean(true),
        ));
    }
}
