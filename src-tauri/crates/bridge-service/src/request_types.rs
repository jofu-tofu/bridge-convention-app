//! Service request types — shapes the client provides to the service.

use bridge_conventions::types::system_config::SystemConfig;
use bridge_engine::types::{Seat, Vulnerability};
use serde::{Deserialize, Serialize};

use bridge_session::types::{OpponentMode, PlayPreference, PracticeMode, PracticeRole};

/// Opaque session identifier.
pub type DrillHandle = String;

/// Configuration for creating a new drill session.
///
/// `system_config` and `base_module_ids` are always provided by the caller.
/// Presets and custom systems use the same path — Rust never looks up configs by ID.
/// The TS layer resolves the selected system via `resolveSystemForSession()`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionConfig {
    pub convention_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_seat: Option<Seat>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub seed: Option<u64>,
    /// Full system configuration — always provided by the caller.
    /// Presets and custom systems use the same path: the TS layer resolves
    /// the selected system to a full config before sending.
    pub system_config: SystemConfig,
    /// Base module IDs for this session. Presets use the standard 4;
    /// custom systems may differ.
    pub base_module_ids: Vec<String>,
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
