//! Protocol adapter — bridges ConventionSpec → ConventionStrategy.
//!
//! Mirrors TS from `conventions/adapter/protocol-adapter.ts`.

use std::collections::HashMap;

use bridge_engine::types::{Call, Hand, Seat};

use crate::types::system_config::SystemConfig;

use crate::adapter::strategy_evaluation::{
    ExplanationCatalog, ExplanationCatalogEntry,
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
use crate::pipeline::evaluation::provenance::ActivationTrace;
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
        inherited_dimensions: &HashMap<String, Vec<ConstraintDimension>>,
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
        inherited_dimensions: &HashMap<String, Vec<ConstraintDimension>>,
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
        inherited_dimensions: &HashMap<String, Vec<ConstraintDimension>>,
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
        // Populate activation traces from surface results
        let mut pipeline_result = pipeline_result;
        pipeline_result.activation = build_activation_traces(surface_results);

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

        let resolved_candidates = build_resolved_candidates(&pipeline_result);

        let bid_result = pipeline_result.selected.as_ref().map(|carrier| {
            BidResult {
                call: carrier.call().clone(),
                resolved_candidates,
            }
        });

        // Build explanation catalog from surface groups
        let explanation_catalog = build_explanation_catalog(surface_results);

        let evaluation = StrategyEvaluation {
            practical_recommendation,
            surface_groups: Some(self.surface_groups.clone()),
            pipeline_result: Some(pipeline_result),
            posterior_summary: None,
            explanation_catalog: Some(explanation_catalog),
            teaching_projection: Some(teaching_projection),
            facts: Some(facts.clone()),
            machine_snapshot: Some(machine_snapshot),
            auction_context: Some(context.clone()),
        };

        (bid_result, evaluation)
    }
}

/// Build activation traces from module surface results.
///
/// Records which module/phase matched which surfaces during collect_matching_claims().
fn build_activation_traces(surface_results: &[ModuleSurfaceResult]) -> Vec<ActivationTrace> {
    surface_results.iter()
        .flat_map(|r| {
            r.resolved.iter().enumerate().map(move |(idx, surface)| {
                ActivationTrace {
                    module_id: r.module_id.clone(),
                    meaning_id: surface.surface.meaning_id.clone(),
                    phase: None, // Phase tracking not available in ModuleSurfaceResult
                    state_entry_index: Some(idx),
                }
            })
        })
        .collect()
}

/// Build explanation catalog from module surface results.
fn build_explanation_catalog(surface_results: &[ModuleSurfaceResult]) -> ExplanationCatalog {
    let entries: Vec<ExplanationCatalogEntry> = surface_results.iter()
        .map(|r| ExplanationCatalogEntry {
            module_id: r.module_id.clone(),
            surface_count: r.resolved.len(),
            explanation: format!("{} matched {} surfaces", r.module_id, r.resolved.len()),
        })
        .collect();
    ExplanationCatalog { entries }
}

/// Build resolved candidates from pipeline truth_set and acceptable_set.
///
/// Maps each `PipelineCarrier` to a `ResolvedCandidateDTO` with eligibility,
/// conditions, and encodings.
fn build_resolved_candidates(pipeline_result: &PipelineResult) -> Vec<ResolvedCandidateDTO> {
    use std::collections::HashSet;

    let mut candidates = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();

    // Truth set carriers — fully matched
    for carrier in &pipeline_result.truth_set {
        let p = carrier.proposal();
        let meaning_id = p.meaning_id.clone();
        if seen.contains(&meaning_id) {
            continue;
        }
        seen.insert(meaning_id);
        candidates.push(carrier_to_candidate(carrier, true));
    }

    // Acceptable set carriers — may include hand-gate-failed-but-legal
    for carrier in &pipeline_result.acceptable_set {
        let p = carrier.proposal();
        let meaning_id = p.meaning_id.clone();
        if seen.contains(&meaning_id) {
            continue;
        }
        seen.insert(meaning_id);
        candidates.push(carrier_to_candidate(carrier, false));
    }

    candidates
}

/// Convert a PipelineCarrier to a ResolvedCandidateDTO.
fn carrier_to_candidate(carrier: &crate::pipeline::types::PipelineCarrier, is_matched: bool) -> ResolvedCandidateDTO {
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
        priority: if is_matched { Some(CandidatePriority::Preferred) } else { Some(CandidatePriority::Alternative) },
        intent_type: p.source_intent.intent_type.clone(),
        failed_conditions: encoded.eligibility.hand.failed_conditions.clone(),
        eligibility: Some(encoded.eligibility.clone()),
        order_key: Some(p.ranking.declaration_order as i32),
        all_encodings: Some(
            encoded.all_encodings.iter()
                .map(|e| EncodingOptionDTO {
                    call: e.call.clone(),
                    legal: e.legal,
                })
                .collect()
        ),
        module_id: Some(p.module_id.clone()),
        semantic_class_id: Some(p.semantic_class_id.clone()),
        recommendation_band: Some(p.ranking.recommendation_band),
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
