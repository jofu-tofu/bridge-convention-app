//! Protocol adapter — bridges ConventionSpec → ConventionStrategy.
//!
//! Mirrors TS from `conventions/adapter/protocol-adapter.ts`.

use std::collections::HashMap;

use bridge_engine::types::{Call, Hand, Seat};

use crate::types::system_config::SystemConfig;

use crate::adapter::strategy_evaluation::{
    MachineDebugSnapshot, DiagnosticEntry, StrategyEvaluation,
};
use crate::adapter::practical_scorer::{build_practical_recommendation, PartnerContext};
use crate::adapter::tree_evaluation::ResolvedCandidateDTO;
use crate::fact_dsl::types::EvaluatedFacts;
use crate::pipeline::observation::committed_step::{AuctionContext, CommittedStep, initial_negotiation};
use crate::pipeline::observation::local_fsm::advance_local_fsm;
use crate::pipeline::observation::normalize_intent::normalize_intent;
use crate::pipeline::observation::rule_interpreter::{
    collect_matching_claims, flatten_surfaces,
    ModuleSurfaceResult,
};
use crate::pipeline::run_pipeline::{run_pipeline, PipelineInput};
use crate::pipeline::types::PipelineResult;
use crate::teaching::projection_builder::project_teaching;
use crate::teaching::teaching_types::SurfaceGroup;
use crate::types::meaning::{BidMeaning, ConstraintDimension};
use crate::types::module_types::ConventionModule;
use crate::types::spec_types::ConventionSpec;

/// Result of a strategy suggestion.
pub struct SuggestResult {
    pub bid_result: Option<BidResult>,
    pub evaluation: StrategyEvaluation,
}

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
        Self { spec, surface_groups }
    }

    /// Suggest a bid given the current auction context and evaluated facts.
    ///
    /// Returns (Option<BidResult>, StrategyEvaluation) — strategy stays &self (immutable).
    pub fn suggest(
        &self,
        context: &AuctionContext,
        next_seat: Option<Seat>,
        facts: &EvaluatedFacts,
        is_legal: &dyn Fn(&Call) -> bool,
        inherited_dimensions: &[ConstraintDimension],
        partner_context: Option<&PartnerContext>,
    ) -> (Option<BidResult>, StrategyEvaluation) {
        self.suggest_with_hand(context, next_seat, facts, is_legal, inherited_dimensions, None, None, partner_context)
    }

    /// Suggest using pre-collected surfaces. Skips the FSM replay that
    /// `suggest`/`suggest_with_hand` perform — the caller provides surfaces
    /// and the module-level surface results (for the machine snapshot).
    pub fn suggest_from_surfaces(
        &self,
        surfaces: &[BidMeaning],
        surface_results: &[ModuleSurfaceResult],
        context: &AuctionContext,
        facts: &EvaluatedFacts,
        is_legal: &dyn Fn(&Call) -> bool,
        inherited_dimensions: &[ConstraintDimension],
        hand: Option<&Hand>,
        system_config: Option<&SystemConfig>,
        partner_context: Option<&PartnerContext>,
    ) -> (Option<BidResult>, StrategyEvaluation) {
        let pipeline_result = run_pipeline(PipelineInput {
            surfaces,
            facts,
            inherited_dimensions,
            is_legal,
            hand,
            system_config,
        });

        self.build_evaluation(context, facts, pipeline_result, surface_results, partner_context)
    }

    /// Suggest with an optional hand for per-surface relational fact evaluation.
    pub fn suggest_with_hand(
        &self,
        context: &AuctionContext,
        next_seat: Option<Seat>,
        facts: &EvaluatedFacts,
        is_legal: &dyn Fn(&Call) -> bool,
        inherited_dimensions: &[ConstraintDimension],
        hand: Option<&Hand>,
        system_config: Option<&SystemConfig>,
        partner_context: Option<&PartnerContext>,
    ) -> (Option<BidResult>, StrategyEvaluation) {
        // Step 1: Collect matching surfaces via observation layer
        let surface_results = collect_matching_claims(
            &self.spec.modules,
            context,
            next_seat,
        );
        let surfaces = flatten_surfaces(&surface_results);

        // Step 2: Run the pipeline
        let pipeline_result = run_pipeline(PipelineInput {
            surfaces: &surfaces,
            facts,
            inherited_dimensions,
            is_legal,
            hand,
            system_config,
        });

        self.build_evaluation(context, facts, pipeline_result, &surface_results, partner_context)
    }

    /// Assemble bid result and evaluation from a pipeline result.
    fn build_evaluation(
        &self,
        context: &AuctionContext,
        facts: &EvaluatedFacts,
        pipeline_result: PipelineResult,
        surface_results: &[ModuleSurfaceResult],
        partner_context: Option<&PartnerContext>,
    ) -> (Option<BidResult>, StrategyEvaluation) {
        let mut teaching_projection = project_teaching(&pipeline_result, Some(&self.surface_groups));
        teaching_projection.parse_tree =
            Some(crate::teaching::parse_tree_builder::build_parse_tree(&pipeline_result));

        let hcp = facts
            .facts
            .get("hand.hcp")
            .map(|fv| fv.value.as_number())
            .unwrap_or(0.0);
        let practical_recommendation =
            build_practical_recommendation(&pipeline_result.truth_set, hcp, partner_context);

        let machine_snapshot = build_machine_snapshot(surface_results);

        let bid_result = pipeline_result.selected.as_ref().map(|carrier| {
            BidResult {
                call: carrier.call().clone(),
                resolved_candidates: Vec::new(),
            }
        });

        let evaluation = StrategyEvaluation {
            practical_recommendation,
            surface_groups: Some(self.surface_groups.clone()),
            pipeline_result: Some(pipeline_result),
            posterior_summary: None,
            explanation_catalog: None,
            teaching_projection: Some(teaching_projection),
            facts: Some(facts.clone()),
            machine_snapshot: Some(machine_snapshot),
            auction_context: Some(context.clone()),
        };

        (bid_result, evaluation)
    }
}

/// Build observation log via rules — incremental observation log construction.
///
/// Replays the auction, collecting matching claims at each step and advancing
/// local FSMs incrementally to avoid O(N²×M) cost.
pub fn build_observation_log_via_rules(
    modules: &[ConventionModule],
    steps: &[(Seat, Call, Option<PipelineResult>)],
) -> Vec<CommittedStep> {
    let mut log: Vec<CommittedStep> = Vec::new();
    let mut local_phases: HashMap<String, String> = HashMap::new();

    // Initialize phases
    for module in modules {
        local_phases.insert(module.module_id.clone(), module.local.initial.clone());
    }

    let mut prev_kernel = initial_negotiation();

    for (actor, call, pipeline_result) in steps {
        let resolved_claim = pipeline_result
            .as_ref()
            .and_then(|r| r.selected.as_ref())
            .map(|carrier| crate::pipeline::observation::committed_step::ClaimRef {
                module_id: carrier.proposal().module_id.clone(),
                meaning_id: carrier.proposal().meaning_id.clone(),
                semantic_class_id: carrier.proposal().semantic_class_id.clone(),
                source_intent: carrier.proposal().source_intent.clone(),
            });

        let public_actions = pipeline_result
            .as_ref()
            .and_then(|r| r.selected.as_ref())
            .map(|carrier| normalize_intent(&carrier.proposal().source_intent))
            .unwrap_or_default();

        let state_after = crate::pipeline::observation::negotiation_extractor::apply_negotiation_actions(
            &prev_kernel, &public_actions, *actor,
        );

        let status = match pipeline_result {
            None => crate::pipeline::observation::committed_step::CommittedStepStatus::OffSystem,
            Some(r) if r.selected.is_some() => {
                crate::pipeline::observation::committed_step::CommittedStepStatus::Resolved
            }
            Some(r) if !r.truth_set.is_empty() => {
                crate::pipeline::observation::committed_step::CommittedStepStatus::Ambiguous
            }
            _ => crate::pipeline::observation::committed_step::CommittedStepStatus::OffSystem,
        };

        let negotiation_delta =
            crate::pipeline::observation::negotiation_extractor::compute_kernel_delta(
                &prev_kernel,
                &state_after,
            );

        let step = CommittedStep {
            actor: *actor,
            call: call.clone(),
            resolved_claim,
            public_actions,
            negotiation_delta,
            state_after: state_after.clone(),
            status,
        };

        // Advance local FSMs
        for module in modules {
            let current = local_phases
                .get(&module.module_id)
                .cloned()
                .unwrap_or_else(|| module.local.initial.clone());
            let next = advance_local_fsm(&current, &step, &module.local.transitions);
            local_phases.insert(module.module_id.clone(), next);
        }

        prev_kernel = step.state_after.clone();
        log.push(step);
    }

    log
}

/// Build a MachineDebugSnapshot from surface results.
fn build_machine_snapshot(surface_results: &[ModuleSurfaceResult]) -> MachineDebugSnapshot {
    let active_surface_group_ids: Vec<String> = surface_results
        .iter()
        .map(|r| r.module_id.clone())
        .collect();

    let diagnostics: Vec<DiagnosticEntry> = surface_results
        .iter()
        .map(|r| DiagnosticEntry {
            level: "info".into(),
            message: format!("{}: {} surfaces matched", r.module_id, r.resolved.len()),
            module_id: Some(r.module_id.clone()),
        })
        .collect();

    MachineDebugSnapshot {
        current_state_id: "rules-path".into(),
        active_surface_group_ids,
        diagnostics,
        state_history: None,
        transition_history: None,
        handoff_traces: None,
        submachine_stack: None,
        registers: None,
    }
}
