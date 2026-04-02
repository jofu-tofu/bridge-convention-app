//! Convention-independent bidding and play heuristics.
//!
//! Pure bridge heuristics with no convention pipeline dependency. These are
//! convention-independent strategies that work with any bidding system.
//!
//! The strategy chain pattern tries strategies in order; first non-None wins.
//! Play heuristics follow the same pattern: first Some(card) wins.

pub mod natural_fallback;
pub mod pass_strategy;
pub mod pragmatic_strategy;
pub mod strategy_chain;

pub mod play_types;
pub mod opening_leads;
pub mod play;
pub mod random_play;
pub mod play_profiles;

pub use bridge_engine::strategy::{BiddingStrategy, BiddingContext, BidResult, Disclosure, ChainTrace, AttemptOutcome, StrategyAttempt};

// ── Re-exports ─────────────────────────────────────────────────────────

pub use natural_fallback::NaturalFallbackStrategy;
pub use pass_strategy::PassStrategy;
pub use pragmatic_strategy::PragmaticStrategy;
pub use strategy_chain::StrategyChain;

pub use play_types::{PlayContext, PlayHeuristic, PlayResult};
pub use random_play::RandomPlayStrategy;
pub use play_profiles::{PlayProfileId, PlayProfile, get_profile, suggest_play_with_profile};
