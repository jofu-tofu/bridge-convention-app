//! Posterior inference engine -- STUB returning uniform distributions.
//!
//! The full posterior engine (~1,300 LOC in TS) uses Monte Carlo rejection sampling,
//! factor graph compilation, and probabilistic queries. This stub provides the interface
//! so that downstream consumers can be wired up, returning uniform/uninformative
//! distributions for all queries.

use bridge_engine::types::Seat;
use serde::{Deserialize, Serialize};

// ── Posterior query types ──────────────────────────────────────────

/// A posterior fact request — what fact to query for which seat.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PosteriorFactRequest {
    pub fact_id: String,
    pub seat_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conditioned_on: Option<Vec<String>>,
}

/// A posterior fact value — the result of a posterior query.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PosteriorFactValue {
    pub fact_id: String,
    pub seat_id: String,
    pub expected_value: f64,
    pub confidence: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conditioned_on: Option<Vec<String>>,
}

/// A belief view — posterior beliefs about a seat from an observer's perspective.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BeliefView {
    pub seat_id: String,
    pub observer_seat: String,
    pub facts: Vec<PosteriorFactValue>,
    pub staleness: f64,
}

// ── Uniform posterior stub ─────────────────────────────────────────

/// Stub posterior that returns uniform (uninformative) distributions for all queries.
/// Satisfies the posterior interface so downstream consumers can be wired up.
pub struct UniformPosterior;

impl UniformPosterior {
    pub fn new() -> Self {
        Self
    }

    /// Query a posterior fact — returns a uniform/uninformative result.
    pub fn query_fact(&self, request: &PosteriorFactRequest) -> PosteriorFactValue {
        let expected = match request.fact_id.as_str() {
            // HCP: uniform prior gives expected value of 10 (40 total / 4 hands)
            f if f.starts_with("hand.hcp") => 10.0,
            // Suit lengths: uniform prior gives expected value of 3.25 (13/4)
            f if f.starts_with("hand.suitLength") => 3.25,
            // Binary facts: uniform 0.5
            _ => 0.5,
        };

        PosteriorFactValue {
            fact_id: request.fact_id.clone(),
            seat_id: request.seat_id.clone(),
            expected_value: expected,
            confidence: 0.0, // Zero confidence = no information
            conditioned_on: request.conditioned_on.clone(),
        }
    }

    /// Get belief view for a seat — returns an empty (uninformative) belief view.
    pub fn get_belief_view(&self, seat_id: &str, observer_seat: &str) -> BeliefView {
        BeliefView {
            seat_id: seat_id.to_string(),
            observer_seat: observer_seat.to_string(),
            facts: Vec::new(),
            staleness: 1.0, // Maximum staleness = no information
        }
    }

    /// Marginal HCP query — returns uniform expected value.
    pub fn marginal_hcp(&self, _seat: Seat) -> (f64, f64) {
        // (expected_value, confidence)
        (10.0, 0.0)
    }

    /// Suit length query — returns uniform expected value.
    pub fn suit_length(&self, _seat: Seat, _suit: bridge_engine::types::Suit) -> (f64, f64) {
        (3.25, 0.0)
    }

    /// Fit probability query — returns uninformative 0.5.
    pub fn fit_probability(
        &self,
        _seats: &[Seat],
        _suit: bridge_engine::types::Suit,
        _min_combined: u32,
    ) -> f64 {
        0.5
    }
}

impl Default for UniformPosterior {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uniform_hcp_query() {
        let posterior = UniformPosterior::new();
        let (expected, confidence) = posterior.marginal_hcp(Seat::North);
        assert_eq!(expected, 10.0);
        assert_eq!(confidence, 0.0);
    }

    #[test]
    fn uniform_suit_length_query() {
        let posterior = UniformPosterior::new();
        let (expected, confidence) = posterior.suit_length(Seat::North, bridge_engine::types::Suit::Spades);
        assert_eq!(expected, 3.25);
        assert_eq!(confidence, 0.0);
    }

    #[test]
    fn uniform_fit_probability() {
        let posterior = UniformPosterior::new();
        let prob = posterior.fit_probability(
            &[Seat::North, Seat::South],
            bridge_engine::types::Suit::Hearts,
            8,
        );
        assert_eq!(prob, 0.5);
    }

    #[test]
    fn query_fact_hcp() {
        let posterior = UniformPosterior::new();
        let result = posterior.query_fact(&PosteriorFactRequest {
            fact_id: "hand.hcp".to_string(),
            seat_id: "N".to_string(),
            conditioned_on: None,
        });
        assert_eq!(result.expected_value, 10.0);
        assert_eq!(result.confidence, 0.0);
    }

    #[test]
    fn query_fact_suit_length() {
        let posterior = UniformPosterior::new();
        let result = posterior.query_fact(&PosteriorFactRequest {
            fact_id: "hand.suitLength.spades".to_string(),
            seat_id: "N".to_string(),
            conditioned_on: None,
        });
        assert_eq!(result.expected_value, 3.25);
        assert_eq!(result.confidence, 0.0);
    }

    #[test]
    fn belief_view_is_uninformative() {
        let posterior = UniformPosterior::new();
        let view = posterior.get_belief_view("N", "S");
        assert_eq!(view.seat_id, "N");
        assert_eq!(view.observer_seat, "S");
        assert!(view.facts.is_empty());
        assert_eq!(view.staleness, 1.0);
    }

    #[test]
    fn default_constructor() {
        let posterior = UniformPosterior::default();
        let (expected, _) = posterior.marginal_hcp(Seat::South);
        assert_eq!(expected, 10.0);
    }
}
