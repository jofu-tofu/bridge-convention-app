//! ConventionStrategyAdapter — bridges ConventionStrategy into BiddingStrategy.
//!
//! Wraps the convention pipeline (bridge-conventions) so it can be used by the
//! session bidding controller (bridge-session) for bid grading and AI bidding.

use std::collections::HashMap;
use std::sync::RwLock;

use bridge_conventions::adapter::protocol_adapter::ConventionStrategy;
use bridge_conventions::adapter::strategy_evaluation::StrategyEvaluation;
use bridge_conventions::fact_dsl::evaluator::evaluate_facts;
use bridge_conventions::fact_dsl::types::{FactData, FactValue};
use bridge_conventions::pipeline::observation::committed_step::initial_negotiation;
use bridge_conventions::pipeline::observation::committed_step::{
    AuctionContext, ClaimRef, CommittedStep, CommittedStepStatus,
};
use bridge_conventions::pipeline::observation::local_fsm::advance_local_fsm;
use bridge_conventions::pipeline::observation::negotiation_extractor::{
    apply_negotiation_actions, compute_kernel_delta,
};
use bridge_conventions::pipeline::observation::normalize_intent::normalize_intent;
use bridge_conventions::pipeline::observation::rule_interpreter::{
    collect_matching_claims_with_phases, flatten_surfaces,
};
use bridge_conventions::pipeline::run_pipeline::{run_pipeline, PipelineInput};
use bridge_conventions::pipeline::types::PipelineResult;
use bridge_conventions::teaching::teaching_types::SurfaceGroup;
use bridge_conventions::types::fact_types::FactDefinition;
use bridge_conventions::types::meaning::BidMeaning;
use bridge_conventions::types::module_types::ConventionModule;
use bridge_conventions::types::spec_types::ConventionSpec;
use bridge_conventions::types::system_config::SystemConfig;
use bridge_engine::hand_evaluator::evaluate_hand_hcp;
use bridge_engine::scoring::is_vulnerable;
use bridge_engine::types::{Call, Hand, Seat, Vulnerability};

use bridge_engine::strategy::Disclosure as EngineDisclosure;
use bridge_session::heuristics::{BidResult, BiddingContext, BiddingStrategy};

/// Convert convention-crate Disclosure to engine-crate Disclosure.
fn to_engine_disclosure(d: bridge_conventions::types::meaning::Disclosure) -> EngineDisclosure {
    match d {
        bridge_conventions::types::meaning::Disclosure::Alert => EngineDisclosure::Alert,
        bridge_conventions::types::meaning::Disclosure::Announcement => {
            EngineDisclosure::Announcement
        }
        bridge_conventions::types::meaning::Disclosure::Natural => EngineDisclosure::Natural,
        bridge_conventions::types::meaning::Disclosure::Standard => EngineDisclosure::Standard,
    }
}

/// Extract the teaching label from the evaluation's selected carrier.
fn extract_explanation(evaluation: &StrategyEvaluation) -> String {
    evaluation
        .pipeline_result
        .as_ref()
        .and_then(|pr| pr.selected.as_ref())
        .map(|c| c.proposal().teaching_label.name.to_string())
        .unwrap_or_else(|| "Convention bid".to_string())
}

/// Adapter that implements BiddingStrategy by delegating to ConventionStrategy.
pub struct ConventionStrategyAdapter {
    strategy: ConventionStrategy,
    modules: Vec<ConventionModule>,
    fact_definitions: Vec<FactDefinition>,
    system_config: Option<SystemConfig>,
    // INVARIANT: last_evaluation is read via as_any() downcast in
    // service_impl.rs::get_convention_adapter(). Safety depends on each seat
    // having its own adapter instance — sharing adapters across seats would
    // break this. The stash is cloned (not taken) so debug snapshot reads
    // remain valid.
    last_evaluation: RwLock<Option<StrategyEvaluation>>,
}

impl ConventionStrategyAdapter {
    /// Create a new adapter from a convention spec and surface groups.
    pub fn new(spec: ConventionSpec, surface_groups: Vec<SurfaceGroup>) -> Self {
        let fact_definitions: Vec<FactDefinition> = spec
            .modules
            .iter()
            .flat_map(|m| m.facts.definitions.iter().cloned())
            .collect();
        let modules = spec.modules.clone();
        let system_config = spec.system_config.clone();
        let strategy = ConventionStrategy::new(spec, surface_groups);

        Self {
            strategy,
            modules,
            fact_definitions,
            system_config,
            last_evaluation: RwLock::new(None),
        }
    }

    /// Run the convention pipeline and return both the bid result and full evaluation.
    /// `all_hands` provides hands for all seats so prior bids can be properly evaluated
    /// (FSMs advance when they see resolved convention bids in the observation log).
    pub fn suggest_with_evaluation(
        &self,
        ctx: &BiddingContext,
        all_hands: Option<&HashMap<Seat, Hand>>,
    ) -> (Option<BidResult>, StrategyEvaluation) {
        let (bid, evaluation) = self.run_pipeline(ctx, all_hands);
        let result = bid.map(|br| {
            let truth_set_calls = Self::extract_truth_set_calls(&evaluation, &br.call);
            let near_miss_calls = Self::extract_near_miss_calls(&evaluation, &br.call);
            let disclosure = evaluation
                .pipeline_result
                .as_ref()
                .and_then(|pr| pr.selected.as_ref())
                .map(|c| to_engine_disclosure(c.proposal().disclosure));
            BidResult {
                call: br.call,
                rule_name: None,
                explanation: extract_explanation(&evaluation),
                disclosure,
                truth_set_calls,
                near_miss_calls,
                trace: None,
            }
        });
        (result, evaluation)
    }

    /// Core pipeline execution.
    ///
    /// Replays the full auction through the convention pipeline so each prior bid
    /// gets a proper PipelineResult. Without this, build_observation_log_via_rules
    /// treats all prior bids as OffSystem and FSMs never advance to response states.
    ///
    /// When `all_hands` is None (the BiddingStrategy path), prior bids from other
    /// seats can't be fact-evaluated. In that case, we infer the bid's meaning by
    /// matching the actual call against available surfaces' default_call. This
    /// "call-inferred" path creates enough observation log context for
    /// find_opener_seat and local FSM transitions to work correctly.
    fn run_pipeline(
        &self,
        ctx: &BiddingContext,
        all_hands: Option<&HashMap<Seat, Hand>>,
    ) -> (
        Option<bridge_conventions::adapter::protocol_adapter::BidResult>,
        StrategyEvaluation,
    ) {
        // Build the observation log incrementally, supporting both full-pipeline
        // and call-inferred steps.
        let mut log: Vec<CommittedStep> = Vec::new();
        let mut local_phases: HashMap<String, String> = HashMap::new();
        for module in &self.modules {
            local_phases.insert(module.module_id.clone(), module.local.initial.clone());
        }

        // Always build observation log incrementally so we can mix full-pipeline
        // steps with call-inferred steps (needed when hands aren't available).

        for (i, entry) in ctx.auction.entries.iter().enumerate() {
            // Build context from current log
            let step_context = AuctionContext { log: log.clone() };

            // Collect surfaces for this step's seat
            let surface_results = collect_matching_claims_with_phases(
                &self.modules,
                &step_context,
                Some(entry.seat),
                &local_phases,
            );
            let surfaces = flatten_surfaces(&surface_results);

            // Build partial auction for legality check
            let partial_auction = bridge_engine::types::Auction {
                entries: ctx.auction.entries[..i].to_vec(),
                is_complete: false,
            };
            let step_seat = entry.seat;
            let is_legal = move |call: &Call| -> bool {
                bridge_engine::auction::is_legal_call(&partial_auction, call, step_seat)
            };

            let step_hand = all_hands.and_then(|h| h.get(&entry.seat)).or_else(|| {
                if entry.seat == ctx.seat {
                    Some(&ctx.hand)
                } else {
                    None
                }
            });

            let pipeline_result = if !surfaces.is_empty() {
                if let Some(hand) = step_hand {
                    let evaluation = evaluate_hand_hcp(hand);
                    let vuln_facts = self.vulnerability_facts(ctx.vulnerability, entry.seat);

                    // Derive relational context from previous kernel state
                    let prev_kernel = log
                        .last()
                        .map(|s| s.state_after.clone())
                        .unwrap_or_else(initial_negotiation);
                    let relational_ctx = prev_kernel.fit_agreed.as_ref().map(|fa| {
                        bridge_conventions::fact_dsl::types::RelationalFactContext {
                            bindings: None,
                            public_commitments: None,
                            fit_agreed: Some(
                                bridge_conventions::fact_dsl::types::FitAgreedContext {
                                    strain: format!("{:?}", fa.strain).to_lowercase(),
                                    confidence: fa.confidence,
                                },
                            ),
                        }
                    });

                    let facts = evaluate_facts(
                        hand,
                        &evaluation,
                        &self.fact_definitions,
                        self.system_config.as_ref(),
                        relational_ctx.as_ref(),
                        vuln_facts.as_ref(),
                    );
                    Some(run_pipeline(PipelineInput {
                        surfaces: &surfaces,
                        facts: &facts,
                        is_legal: &is_legal,
                        inherited_dimensions: &std::collections::HashMap::new(),
                        hand: step_hand,
                        system_config: self.system_config.as_ref(),
                    }))
                } else {
                    None
                }
            } else {
                None
            };

            // Build the observation log step for this auction entry.
            // During replay, we need the step to reflect the ACTUAL call's semantics
            // (not whatever the pipeline would recommend). Three paths:
            // 1. Pipeline ran and has a carrier matching the actual call → use it
            // 2. No hand available but surfaces exist → call-infer from surfaces
            // 3. No surfaces or no match → OffSystem
            let step = if let Some(ref pr) = pipeline_result {
                // Find the carrier matching the actual call (might not be "selected")
                let matching_carrier = Self::find_carrier_for_call(pr, &entry.call);
                if matching_carrier.is_some() {
                    Self::build_step_from_carrier(entry.seat, &entry.call, matching_carrier, &log)
                } else {
                    // Pipeline ran but actual call doesn't match any carrier → call-infer
                    Self::build_call_inferred_step(entry.seat, &entry.call, &surfaces, &log)
                }
            } else if !surfaces.is_empty() {
                // No hand → call-infer from surfaces
                Self::build_call_inferred_step(entry.seat, &entry.call, &surfaces, &log)
            } else {
                // No surfaces → OffSystem
                Self::build_step_from_carrier(entry.seat, &entry.call, None, &log)
            };

            // Advance local FSMs
            for module in &self.modules {
                let current = local_phases
                    .get(&module.module_id)
                    .cloned()
                    .unwrap_or_else(|| module.local.initial.clone());
                let next = advance_local_fsm(&current, &step, &module.local.transitions);
                local_phases.insert(module.module_id.clone(), next);
            }

            log.push(step);
        }

        let auction_context = AuctionContext { log: log.clone() };

        // Collect surfaces for the user's turn using pre-computed local_phases.
        // This avoids the O(N×M) FSM replay that strategy.suggest() would do —
        // the adapter already tracked local_phases incrementally above.
        let surface_results = collect_matching_claims_with_phases(
            &self.modules,
            &auction_context,
            Some(ctx.seat),
            &local_phases,
        );
        let surfaces = flatten_surfaces(&surface_results);

        // Derive fit_agreed from the observation log — if partner accepted a suit,
        // that's the agreed fit for total-point threshold evaluation.
        let fit_agreed = Self::derive_fit_from_log(&log, ctx.seat);
        let relational_ctx = fit_agreed.as_ref().map(|fa| {
            bridge_conventions::fact_dsl::types::RelationalFactContext {
                bindings: None,
                public_commitments: None,
                fit_agreed: Some(fa.clone()),
            }
        });

        let vuln_facts = self.vulnerability_facts(ctx.vulnerability, ctx.seat);

        // Evaluate facts for the current (user) hand
        let facts = evaluate_facts(
            &ctx.hand,
            &ctx.evaluation,
            &self.fact_definitions,
            self.system_config.as_ref(),
            relational_ctx.as_ref(),
            vuln_facts.as_ref(),
        );

        // Build legality check for current position
        let auction = ctx.auction.clone();
        let seat = ctx.seat;
        let is_legal =
            |call: &Call| -> bool { bridge_engine::auction::is_legal_call(&auction, call, seat) };

        // Run pipeline directly with pre-collected surfaces — no redundant FSM replay.
        self.strategy.suggest_from_surfaces(
            &surfaces,
            &surface_results,
            &auction_context,
            &facts,
            &is_legal,
            &std::collections::HashMap::new(),
            Some(&ctx.hand),
            self.system_config.as_ref(),
            None, // partner_context — populated by session layer when available
        )
    }

    /// Find the carrier in a pipeline result that matches the actual call.
    /// Searches selected, truth_set, and recommended in that order.
    fn find_carrier_for_call<'a>(
        result: &'a PipelineResult,
        actual_call: &Call,
    ) -> Option<&'a bridge_conventions::pipeline::types::PipelineCarrier> {
        // Check selected first
        if let Some(ref sel) = result.selected {
            if sel.call() == actual_call {
                return Some(sel);
            }
        }
        // Then truth_set
        if let Some(found) = result.truth_set.iter().find(|c| c.call() == actual_call) {
            return Some(found);
        }
        // Then recommended
        result.recommended.iter().find(|c| c.call() == actual_call)
    }

    /// Build a CommittedStep from a specific carrier (or None for off-system).
    fn build_step_from_carrier(
        actor: Seat,
        call: &Call,
        carrier: Option<&bridge_conventions::pipeline::types::PipelineCarrier>,
        prev_log: &[CommittedStep],
    ) -> CommittedStep {
        let resolved_claim = carrier.map(|c| ClaimRef {
            module_id: c.proposal().module_id.clone(),
            meaning_id: c.proposal().meaning_id.clone(),
            semantic_class_id: c.proposal().semantic_class_id.clone(),
            source_intent: c.proposal().source_intent.clone(),
        });

        let public_actions = carrier
            .map(|c| normalize_intent(&c.proposal().source_intent))
            .unwrap_or_default();

        let status = if carrier.is_some() {
            CommittedStepStatus::Resolved
        } else {
            CommittedStepStatus::OffSystem
        };

        let prev_kernel = prev_log
            .last()
            .map(|s| s.state_after.clone())
            .unwrap_or_else(initial_negotiation);
        let state_after = apply_negotiation_actions(&prev_kernel, &public_actions, actor);
        let negotiation_delta = compute_kernel_delta(&prev_kernel, &state_after);

        CommittedStep {
            actor,
            call: call.clone(),
            resolved_claim,
            public_actions,
            negotiation_delta,
            state_after,
            status,
        }
    }

    /// Build a CommittedStep by matching the actual call against available surfaces'
    /// default_call. This enables the observation log to track opener/responder roles
    /// even when hands aren't available for prior bidders.
    fn build_call_inferred_step(
        actor: Seat,
        call: &Call,
        surfaces: &[BidMeaning],
        prev_log: &[CommittedStep],
    ) -> CommittedStep {
        // Find the surface whose default_call matches the actual call
        let matched = surfaces.iter().find(|s| &s.encoding.default_call == call);

        let (resolved_claim, public_actions, status) = match matched {
            Some(surface) => {
                let claim = ClaimRef {
                    module_id: surface.module_id.clone().unwrap_or_default(),
                    meaning_id: surface.meaning_id.clone(),
                    semantic_class_id: surface.semantic_class_id.clone(),
                    source_intent: surface.source_intent.clone(),
                };
                let actions = normalize_intent(&surface.source_intent);
                (Some(claim), actions, CommittedStepStatus::Resolved)
            }
            None => {
                // No surface matches the call — check alternate encodings
                let alt_match = surfaces.iter().find(|s| {
                    s.encoding
                        .alternate_encodings
                        .as_ref()
                        .map(|alts| alts.iter().any(|a| &a.call == call))
                        .unwrap_or(false)
                });
                match alt_match {
                    Some(surface) => {
                        let claim = ClaimRef {
                            module_id: surface.module_id.clone().unwrap_or_default(),
                            meaning_id: surface.meaning_id.clone(),
                            semantic_class_id: surface.semantic_class_id.clone(),
                            source_intent: surface.source_intent.clone(),
                        };
                        let actions = normalize_intent(&surface.source_intent);
                        (Some(claim), actions, CommittedStepStatus::Resolved)
                    }
                    None => (None, Vec::new(), CommittedStepStatus::OffSystem),
                }
            }
        };

        let prev_kernel = prev_log
            .last()
            .map(|s| s.state_after.clone())
            .unwrap_or_else(initial_negotiation);
        let state_after = apply_negotiation_actions(&prev_kernel, &public_actions, actor);
        let negotiation_delta = compute_kernel_delta(&prev_kernel, &state_after);

        CommittedStep {
            actor,
            call: call.clone(),
            resolved_claim,
            public_actions,
            negotiation_delta,
            state_after,
            status,
        }
    }

    /// Derive an agreed fit from the observation log by looking for Accept actions
    /// from partner. If partner accepted a suit (e.g., transfer acceptance), that
    /// suit is the agreed fit for total-point threshold evaluation.
    fn derive_fit_from_log(
        log: &[CommittedStep],
        user_seat: Seat,
    ) -> Option<bridge_conventions::fact_dsl::types::FitAgreedContext> {
        use bridge_conventions::types::bid_action::BidActionType;
        let partner = bridge_engine::constants::partner_seat(user_seat);

        // Look for Accept/Raise actions from partner
        for step in log.iter().rev() {
            if step.actor != partner {
                continue;
            }
            for action in &step.public_actions {
                match action.act() {
                    BidActionType::Accept => {
                        if let Some(suit) = action.suit() {
                            let suit_name = format!("{:?}", suit).to_lowercase();
                            return Some(bridge_conventions::fact_dsl::types::FitAgreedContext {
                                strain: suit_name,
                                confidence: bridge_conventions::types::ConfidenceLevel::Tentative,
                            });
                        }
                    }
                    BidActionType::Raise => {
                        if let Some(strain) = action.strain() {
                            let strain_name = format!("{:?}", strain).to_lowercase();
                            return Some(bridge_conventions::fact_dsl::types::FitAgreedContext {
                                strain: strain_name,
                                confidence: bridge_conventions::types::ConfidenceLevel::Tentative,
                            });
                        }
                    }
                    _ => {}
                }
            }
        }
        None
    }

    /// Extract truth-set alternative calls (excluding the selected bid).
    fn extract_truth_set_calls(
        evaluation: &StrategyEvaluation,
        selected_call: &Call,
    ) -> Vec<Call> {
        let pr = match &evaluation.pipeline_result {
            Some(pr) => pr,
            None => return Vec::new(),
        };
        pr.truth_set
            .iter()
            .map(|c| c.call().clone())
            .filter(|c| c != selected_call)
            .collect()
    }

    /// Extract near-miss calls: delegates to the testable free function in
    /// bridge-conventions arbitration_helpers.
    fn extract_near_miss_calls(evaluation: &StrategyEvaluation, selected_call: &Call) -> Vec<Call> {
        let pr = match &evaluation.pipeline_result {
            Some(pr) => pr,
            None => return Vec::new(),
        };
        let groups = match &evaluation.surface_groups {
            Some(g) => g,
            None => return Vec::new(),
        };
        bridge_conventions::pipeline::evaluation::arbitration_helpers::extract_near_miss_calls(
            pr, groups, selected_call,
        )
    }

    fn vulnerability_facts(
        &self,
        vulnerability: Option<Vulnerability>,
        seat: Seat,
    ) -> Option<HashMap<String, FactValue>> {
        match vulnerability {
            Some(v) if is_vulnerable(seat, v) => {
                let mut map = HashMap::new();
                map.insert(
                    "bridge.isVulnerable".to_string(),
                    FactValue {
                        fact_id: "bridge.isVulnerable".to_string(),
                        value: FactData::Boolean(true),
                    },
                );
                Some(map)
            }
            _ => None,
        }
    }
}

impl ConventionStrategyAdapter {
    /// Retrieve the last stashed evaluation (cloned, not taken).
    /// Returns None if no evaluation has been stashed yet.
    pub fn last_evaluation(&self) -> Option<StrategyEvaluation> {
        self.last_evaluation
            .read()
            .ok()
            .and_then(|guard| guard.clone())
    }

    /// Extract FactConstraints from a StrategyEvaluation's selected carrier.
    /// Maps satisfied MeaningClause entries 1:1 to FactConstraint (same fields).
    /// Returns empty Vec if no pipeline result, no selected carrier, or no satisfied clauses.
    pub fn extract_constraints_from_evaluation(
        eval: &StrategyEvaluation,
    ) -> Vec<bridge_conventions::types::meaning::FactConstraint> {
        use bridge_conventions::types::meaning::FactConstraint;

        let selected = match eval
            .pipeline_result
            .as_ref()
            .and_then(|pr| pr.selected.as_ref())
        {
            Some(s) => s,
            None => return Vec::new(),
        };

        selected
            .proposal()
            .clauses
            .iter()
            .filter(|clause| clause.satisfied)
            .map(|clause| FactConstraint {
                fact_id: clause.fact_id.clone(),
                operator: clause.operator.clone(),
                value: clause.value.clone(),
                is_public: clause.is_public,
            })
            .collect()
    }
}

impl BiddingStrategy for ConventionStrategyAdapter {
    fn id(&self) -> &str {
        "convention-adapter"
    }

    fn name(&self) -> &str {
        &self.strategy.spec.name
    }

    fn suggest_bid(&self, ctx: &BiddingContext) -> Option<BidResult> {
        // BiddingStrategy doesn't have access to all hands — use simple path
        let (convention_bid, evaluation) = self.run_pipeline(ctx, None);

        // Stash evaluation for retrieval via as_any() downcast
        if let Ok(mut guard) = self.last_evaluation.write() {
            *guard = Some(evaluation.clone());
        }

        convention_bid.map(|br| {
            let truth_set_calls = Self::extract_truth_set_calls(&evaluation, &br.call);
            let near_miss_calls = Self::extract_near_miss_calls(&evaluation, &br.call);
            let disclosure = evaluation
                .pipeline_result
                .as_ref()
                .and_then(|pr| pr.selected.as_ref())
                .map(|c| to_engine_disclosure(c.proposal().disclosure));
            BidResult {
                call: br.call,
                rule_name: None,
                explanation: extract_explanation(&evaluation),
                disclosure,
                truth_set_calls,
                near_miss_calls,
                trace: None,
            }
        })
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }

    fn stashed_evaluation(&self) -> Option<Box<dyn std::any::Any + Send>> {
        self.last_evaluation()
            .map(|e| Box::new(e) as Box<dyn std::any::Any + Send>)
    }
}
