/// BiddingStrategy trait and supporting types live in bridge-engine (not bridge-session
/// or bridge-conventions) so both crates can depend on it without circular deps.
/// bridge-session uses the trait; bridge-conventions/bridge-service implement it.

use serde::{Deserialize, Serialize};

use crate::{Auction, Call, Hand, HandEvaluation, Seat, Vulnerability};

// ── Chain trace types ─────────────────────────────────────────────

/// Outcome of a single strategy attempt within the chain.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum AttemptOutcome {
    Suggested,
    Declined,
    Error,
}

/// Record of a strategy attempt for debugging/tracing.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategyAttempt {
    pub strategy_id: String,
    pub outcome: AttemptOutcome,
}

/// Trace of the strategy chain evaluation.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ChainTrace {
    pub attempts: Vec<StrategyAttempt>,
}

/// How a bid's meaning is disclosed to opponents at the table.
///
/// Duplicated from `bridge_conventions::types::meaning::Disclosure` to keep
/// bridge-engine free of convention-crate dependencies while allowing
/// strategy types to carry disclosure information.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Disclosure {
    #[serde(rename = "alert")]
    Alert,
    #[serde(rename = "announcement")]
    Announcement,
    #[serde(rename = "natural")]
    Natural,
    #[serde(rename = "standard")]
    Standard,
}

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
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BidResult {
    pub call: Call,
    /// Convention rule that produced this bid (None for heuristic bids).
    pub rule_name: Option<String>,
    /// Human-readable explanation of why this bid was chosen.
    pub explanation: String,
    /// Disclosure level from the convention surface (None for heuristic/fallback bids).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disclosure: Option<Disclosure>,
    /// Other valid calls from the convention's "truth set" (correct but not preferred).
    #[serde(default)]
    pub truth_set_calls: Vec<Call>,
    /// Acceptable alternative calls (convention allows but not standard).
    #[serde(default)]
    pub acceptable_set_calls: Vec<Call>,
    /// Near-miss calls — bids on a considered surface with at most one unsatisfied condition.
    #[serde(default)]
    pub near_miss_calls: Vec<Call>,
    /// Strategy chain trace showing which strategies were attempted.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trace: Option<ChainTrace>,
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

    /// Downcast support — enables extracting concrete adapter types from
    /// `SeatStrategy::Ai(Box<dyn BiddingStrategy>)` without a separate field.
    fn as_any(&self) -> &dyn std::any::Any;

    /// Return the last evaluation data (if any) for constraint extraction.
    /// Default returns None. Convention-aware strategies override this to return
    /// a `StrategyEvaluation` boxed as Any, enabling the bidding controller to
    /// extract FactConstraints without importing the concrete adapter type.
    fn stashed_evaluation(&self) -> Option<Box<dyn std::any::Any + Send>> {
        None
    }
}
