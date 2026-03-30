//! Convention-independent bidding and play heuristics.
//!
//! Pure bridge heuristics with no convention pipeline dependency. These are
//! convention-independent strategies that work with any bidding system.
//!
//! The strategy chain pattern tries strategies in order; first non-None wins.
//! Play heuristics follow the same pattern: first Some(card) wins.

pub mod natural_fallback;
pub mod pass_strategy;
pub mod strategy_chain;

pub mod play_types;
pub mod opening_leads;
pub mod heuristic_play;
pub mod random_play;
pub mod play_profiles;

use bridge_engine::{Auction, Call, Hand, HandEvaluation, Seat, Vulnerability};
use serde::{Deserialize, Serialize};

// ── Core types ─────────────────────────────────────────────────────────

/// Context passed to bidding strategies for bid selection.
#[derive(Debug, Clone)]
pub struct BiddingContext {
    pub hand: Hand,
    pub auction: Auction,
    pub seat: Seat,
    pub evaluation: HandEvaluation,
    pub vulnerability: Option<Vulnerability>,
    pub dealer: Option<Seat>,
}

/// Result of a strategy suggestion.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BidResult {
    pub call: Call,
    /// Convention rule that produced this bid (None for heuristic bids).
    pub rule_name: Option<String>,
    /// Human-readable explanation of why this bid was chosen.
    pub explanation: String,
}

/// Trait for bidding strategies. Each strategy inspects the context and either
/// returns a suggested bid or declines (None).
pub trait BiddingStrategy: Send + Sync {
    /// Unique identifier for this strategy.
    fn id(&self) -> &str;

    /// Human-readable name.
    fn name(&self) -> &str;

    /// Suggest a bid given the current context, or return None to decline.
    fn suggest_bid(&self, context: &BiddingContext) -> Option<BidResult>;
}

// ── Re-exports ─────────────────────────────────────────────────────────

pub use natural_fallback::NaturalFallbackStrategy;
pub use pass_strategy::PassStrategy;
pub use strategy_chain::StrategyChain;

pub use play_types::{PlayContext, PlayHeuristic, PlayResult};
pub use heuristic_play::suggest_play;
pub use random_play::RandomPlayStrategy;
pub use play_profiles::{PlayProfileId, PlayProfile, get_profile, suggest_play_with_profile};
