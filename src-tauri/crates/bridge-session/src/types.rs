//! Session domain types ported from `src/session/drill-types.ts`.

use serde::{Deserialize, Serialize};

use crate::heuristics::play_profiles::PlayProfileId;

// ── Game phase ────────────────────────────────────────────────────

/// Game phase state machine states.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum GamePhase {
    Bidding,
    DeclarerPrompt,
    Playing,
    Explanation,
}

// ── Opponent mode ─────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum OpponentMode {
    Natural,
    None,
}

// ── Practice role ─────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PracticeRole {
    Responder,
    Opener,
    Both,
}

// ── Practice mode ─────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PracticeMode {
    DecisionDrill,
    FullAuction,
    ContinuationDrill,
}

// ── Play preference ───────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PlayPreference {
    Always,
    Prompt,
    Skip,
}

// ── Prompt mode ───────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PromptMode {
    SouthDeclarer,
    DeclarerSwap,
    Defender,
}

// ── Practice focus ────────────────────────────────────────────────

/// Module roles relative to the practice target.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PracticeFocus {
    pub target_module_ids: Vec<String>,
    pub prerequisite_module_ids: Vec<String>,
    pub follow_up_module_ids: Vec<String>,
    pub background_module_ids: Vec<String>,
}

// ── Continuation target ───────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContinuationTarget {
    pub module_id: String,
    pub phase: String,
}

// ── Vulnerability distribution ────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VulnerabilityDistribution {
    pub none: f64,
    pub ours: f64,
    pub theirs: f64,
    pub both: f64,
}

impl Default for VulnerabilityDistribution {
    fn default() -> Self {
        Self {
            none: 1.0,
            ours: 0.0,
            theirs: 0.0,
            both: 0.0,
        }
    }
}

// ── Drill tuning ──────────────────────────────────────────────────

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DrillTuning {
    pub vulnerability_distribution: VulnerabilityDistribution,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub module_weights: Option<std::collections::HashMap<String, f64>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub include_off_convention: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub off_convention_rate: Option<f64>,
}

// ── Drill settings ────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DrillSettings {
    pub opponent_mode: OpponentMode,
    pub tuning: DrillTuning,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub play_profile_id: Option<PlayProfileId>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub practice_mode: Option<PracticeMode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub continuation_target: Option<ContinuationTarget>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub play_preference: Option<PlayPreference>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub practice_role: Option<PracticeRole>,
}

impl Default for DrillSettings {
    fn default() -> Self {
        Self {
            opponent_mode: OpponentMode::None,
            tuning: DrillTuning::default(),
            play_profile_id: Some(PlayProfileId::WorldClass),
            practice_mode: None,
            continuation_target: None,
            play_preference: None,
            practice_role: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn game_phase_serialization() {
        assert_eq!(
            serde_json::to_string(&GamePhase::Bidding).unwrap(),
            r#""BIDDING""#
        );
        assert_eq!(
            serde_json::to_string(&GamePhase::DeclarerPrompt).unwrap(),
            r#""DECLARER_PROMPT""#
        );
        assert_eq!(
            serde_json::to_string(&GamePhase::Playing).unwrap(),
            r#""PLAYING""#
        );
        assert_eq!(
            serde_json::to_string(&GamePhase::Explanation).unwrap(),
            r#""EXPLANATION""#
        );
    }

    #[test]
    fn practice_mode_serialization() {
        assert_eq!(
            serde_json::to_string(&PracticeMode::DecisionDrill).unwrap(),
            r#""decision-drill""#
        );
        assert_eq!(
            serde_json::to_string(&PracticeMode::FullAuction).unwrap(),
            r#""full-auction""#
        );
        assert_eq!(
            serde_json::to_string(&PracticeMode::ContinuationDrill).unwrap(),
            r#""continuation-drill""#
        );
    }

    #[test]
    fn play_preference_serialization() {
        assert_eq!(
            serde_json::to_string(&PlayPreference::Always).unwrap(),
            r#""always""#
        );
        assert_eq!(
            serde_json::to_string(&PlayPreference::Skip).unwrap(),
            r#""skip""#
        );
    }

    #[test]
    fn drill_settings_default() {
        let settings = DrillSettings::default();
        assert_eq!(settings.opponent_mode, OpponentMode::None);
        assert_eq!(settings.play_profile_id, Some(PlayProfileId::WorldClass));
    }

    #[test]
    fn drill_settings_round_trip() {
        let settings = DrillSettings {
            opponent_mode: OpponentMode::Natural,
            tuning: DrillTuning::default(),
            play_profile_id: Some(PlayProfileId::Beginner),
            practice_mode: Some(PracticeMode::FullAuction),
            continuation_target: None,
            play_preference: Some(PlayPreference::Always),
            practice_role: Some(PracticeRole::Opener),
        };
        let json = serde_json::to_string(&settings).unwrap();
        let roundtrip: DrillSettings = serde_json::from_str(&json).unwrap();
        assert_eq!(settings, roundtrip);
    }
}
