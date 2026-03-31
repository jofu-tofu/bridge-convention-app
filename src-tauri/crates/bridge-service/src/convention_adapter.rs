//! ConventionStrategyAdapter — bridges ConventionStrategy into BiddingStrategy.
//!
//! Wraps the convention pipeline (bridge-conventions) so it can be used by the
//! session bidding controller (bridge-session) for bid grading and AI bidding.

use std::collections::HashMap;

use bridge_conventions::adapter::protocol_adapter::{
    build_observation_log_via_rules, ConventionStrategy,
};
use bridge_conventions::adapter::strategy_evaluation::StrategyEvaluation;
use bridge_conventions::fact_dsl::evaluator::evaluate_facts;
use bridge_conventions::fact_dsl::types::{FactData, FactValue};
use bridge_conventions::pipeline::observation::committed_step::AuctionContext;
use bridge_conventions::pipeline::run_pipeline::{run_pipeline, PipelineInput};
use bridge_conventions::pipeline::observation::rule_interpreter::{
    collect_matching_claims, flatten_surfaces,
};
use bridge_conventions::teaching::teaching_types::SurfaceGroup;
use bridge_conventions::types::fact_types::FactDefinition;
use bridge_conventions::types::module_types::ConventionModule;
use bridge_conventions::types::spec_types::ConventionSpec;
use bridge_conventions::types::system_config::SystemConfig;
use bridge_engine::hand_evaluator::evaluate_hand_hcp;
use bridge_engine::types::{Hand, Seat, Vulnerability};

use bridge_session::heuristics::{BidResult, BiddingContext, BiddingStrategy};

/// Adapter that implements BiddingStrategy by delegating to ConventionStrategy.
pub struct ConventionStrategyAdapter {
    strategy: ConventionStrategy,
    modules: Vec<ConventionModule>,
    fact_definitions: Vec<FactDefinition>,
    system_config: Option<SystemConfig>,
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
        let result = bid.map(|br| BidResult {
            call: br.call,
            rule_name: None,
            explanation: "Convention bid".to_string(),
        });
        (result, evaluation)
    }

    /// Core pipeline execution.
    ///
    /// Replays the full auction through the convention pipeline so each prior bid
    /// gets a proper PipelineResult. Without this, build_observation_log_via_rules
    /// treats all prior bids as OffSystem and FSMs never advance to response states.
    fn run_pipeline(
        &self,
        ctx: &BiddingContext,
        all_hands: Option<&HashMap<Seat, Hand>>,
    ) -> (
        Option<bridge_conventions::adapter::protocol_adapter::BidResult>,
        StrategyEvaluation,
    ) {
        // Incrementally replay auction: run the pipeline at each step so prior
        // bids get proper PipelineResults and FSMs advance correctly.
        let mut steps: Vec<(
            Seat,
            bridge_engine::types::Call,
            Option<bridge_conventions::pipeline::types::PipelineResult>,
        )> = Vec::new();

        for (i, entry) in ctx.auction.entries.iter().enumerate() {
            // Build observation log from steps so far
            let log = build_observation_log_via_rules(&self.modules, &steps);
            let step_context = AuctionContext { log };

            // Collect surfaces for this step's seat
            let surface_results = collect_matching_claims(
                &self.modules,
                &step_context,
                Some(entry.seat),
            );
            let surfaces = flatten_surfaces(&surface_results);

            // Build partial auction for legality check
            let partial_auction = bridge_engine::types::Auction {
                entries: ctx.auction.entries[..i].to_vec(),
                is_complete: false,
            };
            let step_seat = entry.seat;
            let is_legal = move |call: &bridge_engine::types::Call| -> bool {
                bridge_engine::auction::is_legal_call(&partial_auction, call, step_seat)
            };

            // Evaluate facts for the step's seat (use all_hands if available,
            // fall back to ctx.hand for the user's seat)
            let step_hand = all_hands
                .and_then(|h| h.get(&entry.seat))
                .or_else(|| if entry.seat == ctx.seat { Some(&ctx.hand) } else { None });

            let pipeline_result = if !surfaces.is_empty() {
                if let Some(hand) = step_hand {
                    let evaluation = evaluate_hand_hcp(hand);
                    let vuln_facts = self.vulnerability_facts(ctx.vulnerability);
                    let facts = evaluate_facts(
                        hand,
                        &evaluation,
                        &self.fact_definitions,
                        self.system_config.as_ref(),
                        None,
                        vuln_facts.as_ref(),
                    );
                    Some(run_pipeline(PipelineInput {
                        surfaces: &surfaces,
                        facts: &facts,
                        is_legal: &is_legal,
                        inherited_dimensions: &[],
                    }))
                } else {
                    None
                }
            } else {
                None
            };

            steps.push((entry.seat, entry.call.clone(), pipeline_result));
        }

        // Now build the final observation log with all pipeline results
        let log = build_observation_log_via_rules(&self.modules, &steps);
        let auction_context = AuctionContext { log };

        let vuln_facts = self.vulnerability_facts(ctx.vulnerability);

        // Evaluate facts for the current (user) hand
        let facts = evaluate_facts(
            &ctx.hand,
            &ctx.evaluation,
            &self.fact_definitions,
            self.system_config.as_ref(),
            None,
            vuln_facts.as_ref(),
        );

        // Build legality check for current position
        let auction = ctx.auction.clone();
        let seat = ctx.seat;
        let is_legal = |call: &bridge_engine::types::Call| -> bool {
            bridge_engine::auction::is_legal_call(&auction, call, seat)
        };

        self.strategy
            .suggest(&auction_context, Some(ctx.seat), &facts, &is_legal, &[])
    }

    fn vulnerability_facts(
        &self,
        vulnerability: Option<Vulnerability>,
    ) -> Option<HashMap<String, FactValue>> {
        match vulnerability {
            Some(v) if v != Vulnerability::None => {
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

impl BiddingStrategy for ConventionStrategyAdapter {
    fn id(&self) -> &str {
        "convention-adapter"
    }

    fn name(&self) -> &str {
        &self.strategy.spec.name
    }

    fn suggest_bid(&self, ctx: &BiddingContext) -> Option<BidResult> {
        // BiddingStrategy doesn't have access to all hands — use simple path
        let (convention_bid, _evaluation) = self.run_pipeline(ctx, None);
        convention_bid.map(|br| BidResult {
            call: br.call,
            rule_name: None,
            explanation: "Convention bid".to_string(),
        })
    }
}
