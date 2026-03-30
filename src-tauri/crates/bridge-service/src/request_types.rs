//! Service request types — shapes the client provides to the service.

use bridge_engine::types::{Seat, Vulnerability};
use serde::{Deserialize, Serialize};

use bridge_session::types::{PracticeMode, PracticeRole, PlayPreference, OpponentMode};

/// Opaque session identifier.
pub type SessionHandle = String;

/// Configuration for creating a new drill session.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionConfig {
    pub convention_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_seat: Option<Seat>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub seed: Option<u64>,
    /// Base system for convention resolution (e.g. "sayc", "two-over-one").
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_system_id: Option<String>,
    /// Practice mode — controls auction entry point and play coupling.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub practice_mode: Option<PracticeMode>,
    /// Target module for practice focus derivation.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_module_id: Option<String>,
    /// Practice role — opener, responder, or both (random per deal).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub practice_role: Option<PracticeRole>,
    /// Play preference — whether to skip, prompt, or always play after bidding.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub play_preference: Option<PlayPreference>,
    /// Opponent behavior mode.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opponent_mode: Option<OpponentMode>,
    /// Vulnerability override.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vulnerability: Option<Vulnerability>,
}
