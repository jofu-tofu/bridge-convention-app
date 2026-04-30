//! Protocol adapter — bridges ConventionSpec → ConventionStrategy.
//!
//! Mirrors TS from `conventions/adapter/protocol-adapter.ts`.

use std::collections::HashMap;

use bridge_engine::types::{Call, Hand};

use crate::types::system_config::SystemConfig;

use crate::adapter::practical_scorer::build_practical_recommendation;
use crate::adapter::strategy_evaluation::StrategyEvaluation;
use crate::adapter::tree_evaluation::ResolvedCandidateDTO;
use crate::fact_dsl::types::EvaluatedFacts;
use crate::pipeline::observation::committed_step::AuctionContext;
use crate::pipeline::observation::public_commitments::derive_public_commitments;
use crate::pipeline::observation::rule_interpreter::ModuleSurfaceResult;
use crate::pipeline::run_pipeline::{run_pipeline, PipelineInput};
use crate::pipeline::types::PipelineResult;
use crate::teaching::projection_builder::project_teaching;
use crate::teaching::teaching_types::SurfaceGroup;
use crate::types::meaning::{BidMeaning, ConstraintDimension};
use crate::types::spec_types::ConventionSpec;

/// A bid result from the strategy.
#[derive(Debug, Clone)]
pub struct BidResult {
    pub call: Call,
    pub resolved_candidates: Vec<ResolvedCandidateDTO>,
}

/// Convention strategy — wraps a ConventionSpec and produces bid suggestions.
pub struct ConventionStrategy {
    pub spec: ConventionSpec,
    pub surface_groups: Vec<SurfaceGroup>,
}

impl ConventionStrategy {
    /// Create a new convention strategy from a spec.
    pub fn new(spec: ConventionSpec, surface_groups: Vec<SurfaceGroup>) -> Self {
        Self {
            spec,
            surface_groups,
        }
    }

    /// Suggest using pre-collected surfaces. The caller provides surfaces
    /// and the module-level surface results.
    #[allow(clippy::too_many_arguments)]
    pub fn suggest_from_surfaces(
        &self,
        surfaces: &[BidMeaning],
        surface_results: &[ModuleSurfaceResult],
        context: &AuctionContext,
        facts: &EvaluatedFacts,
        is_legal: &dyn Fn(&Call) -> bool,
        inherited_dimensions: &HashMap<String, Vec<ConstraintDimension>>,
        hand: Option<&Hand>,
        system_config: Option<&SystemConfig>,
    ) -> (Option<BidResult>, StrategyEvaluation) {
        let public_commitments = derive_public_commitments(&context.log);
        let public_commitments_ref: Option<&[_]> = if public_commitments.is_empty() {
            None
        } else {
            Some(&public_commitments)
        };
        let pipeline_result = run_pipeline(PipelineInput {
            surfaces,
            facts,
            inherited_dimensions,
            is_legal,
            hand,
            system_config,
            public_commitments: public_commitments_ref,
        });

        self.build_evaluation(context, facts, pipeline_result, surface_results)
    }

    /// Assemble bid result and evaluation from a pipeline result.
    fn build_evaluation(
        &self,
        context: &AuctionContext,
        facts: &EvaluatedFacts,
        pipeline_result: PipelineResult,
        _surface_results: &[ModuleSurfaceResult],
    ) -> (Option<BidResult>, StrategyEvaluation) {
        let mut teaching_projection =
            project_teaching(&pipeline_result, Some(&self.surface_groups));
        teaching_projection.parse_tree = Some(
            crate::teaching::parse_tree_builder::build_parse_tree(&pipeline_result),
        );

        let hcp = facts
            .facts
            .get("hand.hcp")
            .map(|fv| fv.value.as_number())
            .unwrap_or(0.0);
        let practical_recommendation =
            build_practical_recommendation(&pipeline_result.truth_set, hcp);

        let resolved_candidates = build_resolved_candidates(&pipeline_result);

        let bid_result = pipeline_result.selected.as_ref().map(|carrier| BidResult {
            call: carrier.call().clone(),
            resolved_candidates,
        });

        let evaluation = StrategyEvaluation {
            practical_recommendation,
            surface_groups: Some(self.surface_groups.clone()),
            pipeline_result: Some(pipeline_result),
            teaching_projection: Some(teaching_projection),
            facts: Some(facts.clone()),
            auction_context: Some(context.clone()),
        };

        (bid_result, evaluation)
    }
}

/// Build resolved candidates from the pipeline truth_set.
///
/// Maps each `PipelineCarrier` to a `ResolvedCandidateDTO` with eligibility,
/// conditions, and encodings.
fn build_resolved_candidates(pipeline_result: &PipelineResult) -> Vec<ResolvedCandidateDTO> {
    use std::collections::HashSet;

    let mut candidates = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();

    for carrier in &pipeline_result.truth_set {
        let p = carrier.proposal();
        let meaning_id = p.meaning_id.clone();
        if seen.contains(&meaning_id) {
            continue;
        }
        seen.insert(meaning_id);
        candidates.push(carrier_to_candidate(carrier, true));
    }

    candidates
}

/// Convert a PipelineCarrier to a ResolvedCandidateDTO.
fn carrier_to_candidate(
    carrier: &crate::pipeline::types::PipelineCarrier,
    is_matched: bool,
) -> ResolvedCandidateDTO {
    use crate::adapter::tree_evaluation::{CandidatePriority, EncodingOptionDTO};

    let p = carrier.proposal();
    let encoded = &carrier.encoded;

    ResolvedCandidateDTO {
        bid_name: p.teaching_label.name.as_str().to_string(),
        meaning: p.teaching_label.summary.as_str().to_string(),
        call: p.encoding.default_call.clone(),
        resolved_call: encoded.call.clone(),
        is_default_call: encoded.is_default_encoding,
        legal: encoded.legal,
        is_matched,
        priority: if is_matched {
            Some(CandidatePriority::Preferred)
        } else {
            Some(CandidatePriority::Alternative)
        },
        intent_type: p.source_intent.intent_type.clone(),
        failed_conditions: encoded.eligibility.hand.failed_conditions.clone(),
        eligibility: Some(encoded.eligibility.clone()),
        order_key: Some(p.ranking.declaration_order as i32),
        all_encodings: Some(
            encoded
                .all_encodings
                .iter()
                .map(|e| EncodingOptionDTO {
                    call: e.call.clone(),
                    legal: e.legal,
                })
                .collect(),
        ),
        module_id: Some(p.module_id.clone()),
        semantic_class_id: Some(p.semantic_class_id.clone()),
        recommendation_band: Some(p.ranking.recommendation_band),
    }
}
