//! Pipeline orchestrator — runPipeline() entry point.
//!
//! Mirrors TS from `pipeline/run-pipeline.ts`.

use std::collections::HashMap;

use bridge_engine::types::{Call, Hand};

use crate::fact_dsl::types::EvaluatedFacts;
use crate::pipeline::evaluation::meaning_arbitrator::arbitrate_meanings;
use crate::pipeline::evaluation::meaning_evaluator::evaluate_all_bid_meanings;
use crate::pipeline::types::PipelineResult;
use crate::types::meaning::{BidMeaning, ConstraintDimension};
use crate::types::system_config::SystemConfig;

/// Input to the pipeline.
pub struct PipelineInput<'a> {
    /// Surfaces to evaluate (from observation layer).
    pub surfaces: &'a [BidMeaning],
    /// Pre-evaluated facts (from fact_dsl).
    pub facts: &'a EvaluatedFacts,
    /// Per-meaning inherited constraint dimensions from prior-round context.
    /// Key: meaning_id → inherited dimensions for that surface.
    pub inherited_dimensions: &'a HashMap<String, Vec<ConstraintDimension>>,
    /// Legality checker for the current auction.
    pub is_legal: &'a dyn Fn(&Call) -> bool,
    /// Hand for per-surface relational fact re-evaluation (optional).
    /// When provided, surfaces with bindings get relational facts recomputed.
    pub hand: Option<&'a Hand>,
    /// System config for per-surface system relational overrides (optional).
    pub system_config: Option<&'a SystemConfig>,
}

/// Run the meaning pipeline — the 4-step pure transformation.
///
/// 1. (Facts already evaluated by caller)
/// 2. Evaluate surfaces' clauses against facts
/// 3. Arbitrate (encode, gate-check, rank, select)
pub fn run_pipeline(input: PipelineInput) -> PipelineResult {
    if input.surfaces.is_empty() {
        return PipelineResult::empty();
    }

    // Step 1: Evaluate all surfaces' clauses
    let proposals = evaluate_all_bid_meanings(
        input.surfaces,
        input.facts,
        input.inherited_dimensions,
        input.hand,
        input.system_config,
    );

    // Step 2: Arbitrate — encode, gate-check, rank, select
    arbitrate_meanings(&proposals, input.is_legal)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fact_dsl::types::{FactData, FactValue};
    use crate::types::authored_text::*;
    use crate::types::fact_types::EvaluationWorld;
    use crate::types::meaning::*;
    use std::collections::HashMap;

    fn make_facts(hcp: f64, suit_len: f64) -> EvaluatedFacts {
        let mut facts = HashMap::new();
        facts.insert(
            "hand.hcp".into(),
            FactValue {
                fact_id: "hand.hcp".into(),
                value: FactData::Number(hcp),
            },
        );
        facts.insert(
            "hand.suitLength.hearts".into(),
            FactValue {
                fact_id: "hand.suitLength.hearts".into(),
                value: FactData::Number(suit_len),
            },
        );
        EvaluatedFacts {
            world: EvaluationWorld::ActingHand,
            facts,
        }
    }

    fn make_surface(meaning_id: &str, min_hcp: i64) -> BidMeaning {
        BidMeaning {
            meaning_id: meaning_id.into(),
            semantic_class_id: "".into(),
            module_id: Some("test".into()),
            encoding: BidEncoding {
                default_call: bridge_engine::types::Call::Bid {
                    level: 2,
                    strain: bridge_engine::types::BidSuit::Clubs,
                },
                alternate_encodings: None,
            },
            clauses: vec![BidMeaningClause {
                fact_id: "hand.hcp".into(),
                operator: FactOperator::Gte,
                value: ConstraintValue::int(min_hcp),
                clause_id: None,
                description: None,
                rationale: None,
                is_public: None,
            }],
            ranking: AuthoredRankingMetadata {
                recommendation_band: RecommendationBand::Should,
                module_precedence: None,
                declaration_order: 0,
            },
            source_intent: SourceIntent {
                intent_type: "Test".into(),
                params: HashMap::new(),
            },
            disclosure: Disclosure::Standard,
            teaching_label: TeachingLabel {
                name: BidName::new("Test"),
                summary: BidSummary::new("Test surface"),
            },
            surface_bindings: None,
        }
    }

    #[test]
    fn run_pipeline_empty_surfaces() {
        let facts = make_facts(12.0, 4.0);
        let result = run_pipeline(PipelineInput {
            surfaces: &[],
            facts: &facts,
            inherited_dimensions: &HashMap::new(),
            is_legal: &|_| true,
            hand: None,
            system_config: None,
        });
        assert!(result.selected.is_none());
        assert!(result.truth_set.is_empty());
    }

    #[test]
    fn run_pipeline_selects_matching() {
        let facts = make_facts(12.0, 4.0);
        let surfaces = vec![make_surface("test:bid", 8)];
        let result = run_pipeline(PipelineInput {
            surfaces: &surfaces,
            facts: &facts,
            inherited_dimensions: &HashMap::new(),
            is_legal: &|_| true,
            hand: None,
            system_config: None,
        });
        assert!(result.selected.is_some());
        assert_eq!(
            result.selected.unwrap().encoded.proposal.meaning_id,
            "test:bid"
        );
    }

    #[test]
    fn run_pipeline_rejects_unsatisfied() {
        let facts = make_facts(5.0, 4.0);
        let surfaces = vec![make_surface("test:bid", 8)];
        let result = run_pipeline(PipelineInput {
            surfaces: &surfaces,
            facts: &facts,
            inherited_dimensions: &HashMap::new(),
            is_legal: &|_| true,
            hand: None,
            system_config: None,
        });
        assert!(result.selected.is_none());
        assert!(result.truth_set.is_empty());
    }
}
