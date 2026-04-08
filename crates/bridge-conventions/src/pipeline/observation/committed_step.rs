//! CommittedStep — one adjudicated auction action in the observation log.
//!
//! Mirrors TS types from `conventions/core/committed-step.ts`.

use bridge_engine::types::{Call, Seat};
use serde::{Deserialize, Serialize};

use crate::types::bid_action::BidAction;
use crate::types::meaning::SourceIntent;
use crate::types::negotiation::{
    Captain, Competition, CompetitionSimple, ForcingLevel, NegotiationDelta, NegotiationState,
};

/// Minimal identifying info from the winning arbitration proposal.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaimRef {
    pub module_id: String,
    pub meaning_id: String,
    pub semantic_class_id: String,
    pub source_intent: SourceIntent,
}

/// Status of a committed step.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CommittedStepStatus {
    Resolved,
    RawOnly,
    Ambiguous,
    OffSystem,
}

/// One adjudicated auction action in the observation log.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommittedStep {
    pub actor: Seat,
    pub call: Call,
    pub resolved_claim: Option<ClaimRef>,
    pub public_actions: Vec<BidAction>,
    pub negotiation_delta: NegotiationDelta,
    pub state_after: NegotiationState,
    pub status: CommittedStepStatus,
}

/// Composite wrapper for auction context.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AuctionContext {
    pub log: Vec<CommittedStep>,
}

/// Initial negotiation state.
pub fn initial_negotiation() -> NegotiationState {
    NegotiationState {
        fit_agreed: None,
        forcing: ForcingLevel::None,
        captain: Captain::Undecided,
        competition: Competition::Simple(CompetitionSimple::Uncontested),
    }
}
