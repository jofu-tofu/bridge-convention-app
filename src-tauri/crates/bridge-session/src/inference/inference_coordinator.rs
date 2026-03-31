//! Inference coordinator -- manages NS and EW inference engine lifecycle,
//! bid processing, annotation production, and public belief accumulation.

use std::collections::HashMap;
use bridge_engine::types::{Auction, AuctionEntry, Seat};
use bridge_conventions::types::meaning::FactConstraint;
use bridge_conventions::types::system_config::SystemConfig;

use super::annotation_producer::produce_annotation;
use super::belief_accumulator::{apply_annotation, create_initial_belief_state};
use super::inference_engine::InferenceEngine;
use super::natural_inference::NaturalInferenceProvider;
use super::types::{
    InferenceExtractor, InferenceExtractorInput,
    InferenceSnapshot, NoopExtractor, PublicBeliefState, PublicBeliefs,
};

/// Adapt a bid result DTO to `InferenceExtractorInput`.
fn to_extractor_input(
    rule_name: &str,
    explanation: &str,
    meaning: Option<&str>,
    constraints: &[FactConstraint],
) -> InferenceExtractorInput {
    InferenceExtractorInput {
        rule: rule_name.to_string(),
        explanation: explanation.to_string(),
        meaning: meaning.map(|s| s.to_string()),
        constraints: constraints.to_vec(),
    }
}

/// Coordinates NS and EW inference engines for a drill.
/// Accepts optional `SystemConfig` for system-aware natural inference.
/// Adapts bid results to inference extractor input, manages belief state
/// accumulation per deal.
pub struct InferenceCoordinator {
    ns_engine: Option<InferenceEngine>,
    ew_engine: Option<InferenceEngine>,
    belief_state: PublicBeliefState,
    natural_provider: NaturalInferenceProvider,
    extractor: Box<dyn InferenceExtractor>,
}

impl InferenceCoordinator {
    /// Create with a noop extractor and optional system config.
    pub fn new(system_config: Option<&SystemConfig>) -> Self {
        let natural_provider = match system_config {
            Some(config) => NaturalInferenceProvider::new(config),
            None => NaturalInferenceProvider::default_sayc(),
        };
        Self {
            ns_engine: None,
            ew_engine: None,
            belief_state: create_initial_belief_state(),
            natural_provider,
            extractor: Box::new(NoopExtractor),
        }
    }

    /// Create with a custom extractor.
    pub fn with_extractor(
        system_config: Option<&SystemConfig>,
        extractor: Box<dyn InferenceExtractor>,
    ) -> Self {
        let natural_provider = match system_config {
            Some(config) => NaturalInferenceProvider::new(config),
            None => NaturalInferenceProvider::default_sayc(),
        };
        Self {
            ns_engine: None,
            ew_engine: None,
            belief_state: create_initial_belief_state(),
            natural_provider,
            extractor,
        }
    }

    /// Set the NS and EW inference engines for a new drill.
    pub fn initialize(
        &mut self,
        ns_engine: Option<InferenceEngine>,
        ew_engine: Option<InferenceEngine>,
    ) {
        self.ns_engine = ns_engine;
        self.ew_engine = ew_engine;
        self.belief_state = create_initial_belief_state();
    }

    /// Process a bid through both inference engines and update belief state.
    /// Returns the updated `PublicBeliefState` so the caller can store it reactively.
    #[allow(clippy::too_many_arguments)]
    pub fn process_bid(
        &mut self,
        entry: &AuctionEntry,
        auction_before: &Auction,
        rule_name: Option<&str>,
        explanation: Option<&str>,
        meaning: Option<&str>,
        constraints: &[FactConstraint],
        convention_id: Option<&str>,
    ) -> &PublicBeliefState {
        if let Some(ref mut ns) = self.ns_engine {
            ns.process_bid(entry, auction_before);
        }
        if let Some(ref mut ew) = self.ew_engine {
            ew.process_bid(entry, auction_before);
        }

        let extractor_input = rule_name.map(|rule| {
            to_extractor_input(
                rule,
                explanation.unwrap_or("unknown"),
                meaning,
                constraints,
            )
        });

        let effective_convention_id = if rule_name.is_some() {
            convention_id
        } else {
            None
        };

        let annotation = produce_annotation(
            entry,
            extractor_input.as_ref(),
            effective_convention_id,
            self.extractor.as_ref(),
            &self.natural_provider,
            auction_before,
        );

        self.belief_state = apply_annotation(&self.belief_state, &annotation);
        &self.belief_state
    }

    /// Capture inferences from both engines at auction end.
    /// Returns None if no engines are set.
    pub fn capture_play_inferences(&self) -> Option<HashMap<Seat, PublicBeliefs>> {
        if self.ns_engine.is_none() && self.ew_engine.is_none() {
            return None;
        }

        let mut beliefs = HashMap::new();
        if let Some(ref ns) = self.ns_engine {
            beliefs.extend(ns.get_beliefs());
        }
        if let Some(ref ew) = self.ew_engine {
            beliefs.extend(ew.get_beliefs());
        }
        Some(beliefs)
    }

    /// Current public belief state.
    pub fn get_public_belief_state(&self) -> &PublicBeliefState {
        &self.belief_state
    }

    /// NS inference timeline snapshots.
    pub fn get_ns_timeline(&self) -> &[InferenceSnapshot] {
        match &self.ns_engine {
            Some(engine) => engine.get_timeline(),
            None => &[],
        }
    }

    /// EW inference timeline snapshots.
    pub fn get_ew_timeline(&self) -> &[InferenceSnapshot] {
        match &self.ew_engine {
            Some(engine) => engine.get_timeline(),
            None => &[],
        }
    }

    /// Reset all inference state.
    pub fn reset(&mut self) {
        self.ns_engine = None;
        self.ew_engine = None;
        self.belief_state = create_initial_belief_state();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_engine::types::{BidSuit, Call};

    fn empty_auction() -> Auction {
        Auction { entries: vec![], is_complete: false }
    }

    #[test]
    fn coordinator_creates_with_initial_loose_beliefs() {
        let coord = InferenceCoordinator::new(None);
        let state = coord.get_public_belief_state();

        assert!(state.annotations.is_empty());
        for seat in &bridge_engine::SEATS {
            assert_eq!(state.beliefs[seat].ranges.hcp.min, 0);
            assert_eq!(state.beliefs[seat].ranges.hcp.max, 40);
        }
    }

    #[test]
    fn process_bid_without_engines_still_produces_annotations() {
        let mut coord = InferenceCoordinator::new(None);

        let entry = AuctionEntry {
            seat: Seat::North,
            call: Call::Bid { level: 1, strain: BidSuit::Hearts },
        };

        let state = coord.process_bid(
            &entry,
            &empty_auction(),
            None,   // no rule
            None,
            None,
            &[],
            None,
        );

        assert_eq!(state.annotations.len(), 1);
        assert_eq!(state.annotations[0].meaning, "Natural bid");
        // Natural inference should narrow North's HCP
        assert!(state.beliefs[&Seat::North].ranges.hcp.min > 0);
    }

    #[test]
    fn process_pass_produces_annotation() {
        let mut coord = InferenceCoordinator::new(None);

        let entry = AuctionEntry { seat: Seat::East, call: Call::Pass };

        let state = coord.process_bid(
            &entry,
            &empty_auction(),
            None,
            None,
            None,
            &[],
            None,
        );

        assert_eq!(state.annotations.len(), 1);
        assert_eq!(state.annotations[0].meaning, "Pass");
    }

    #[test]
    fn capture_play_inferences_none_without_engines() {
        let coord = InferenceCoordinator::new(None);
        assert!(coord.capture_play_inferences().is_none());
    }

    #[test]
    fn reset_clears_all_state() {
        let mut coord = InferenceCoordinator::new(None);

        let entry = AuctionEntry {
            seat: Seat::North,
            call: Call::Bid { level: 1, strain: BidSuit::NoTrump },
        };
        coord.process_bid(&entry, &empty_auction(), None, None, None, &[], None);
        assert_eq!(coord.get_public_belief_state().annotations.len(), 1);

        coord.reset();

        assert!(coord.get_public_belief_state().annotations.is_empty());
        assert!(coord.ns_engine.is_none());
        assert!(coord.ew_engine.is_none());
    }

    #[test]
    fn empty_timelines_without_engines() {
        let coord = InferenceCoordinator::new(None);
        assert!(coord.get_ns_timeline().is_empty());
        assert!(coord.get_ew_timeline().is_empty());
    }
}
