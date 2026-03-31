//! Service-layer response DTOs that wrap bridge-session viewport types
//! with additional metadata for the UI/WASM boundary.

use bridge_session::session::{AiBidEntry, AiPlayEntry, BidFeedbackDTO, BidGrade, BiddingViewport};
use bridge_session::types::{GamePhase, PlayPreference, PracticeMode};
use serde::{Deserialize, Serialize};

// ── Drill start ───────────────────────────────────────────────────

/// Result from starting a drill.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DrillStartResult {
    pub viewport: BiddingViewport,
    pub is_off_convention: bool,
    pub ai_bids: Vec<AiBidEntryDTO>,
    pub auction_complete: bool,
    pub phase: GamePhase,
    pub practice_mode: PracticeMode,
    pub play_preference: PlayPreference,
}

// ── Bid submission ────────────────────────────────────────────────

/// Result from submitting a bid.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BidSubmitResult {
    pub accepted: bool,
    pub grade: Option<BidGrade>,
    pub feedback: Option<BidFeedbackDTO>,
    pub ai_bids: Vec<AiBidEntryDTO>,
    pub next_viewport: Option<BiddingViewport>,
    pub phase_transition: Option<PhaseTransition>,
}

/// Phase transition notification.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhaseTransition {
    pub from: GamePhase,
    pub to: GamePhase,
}

// ── Prompt accept ─────────────────────────────────────────────────

/// Result from accepting a prompt.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptAcceptResult {
    pub phase: GamePhase,
    pub ai_plays: Option<Vec<AiPlayEntryDTO>>,
}

// ── DDS ───────────────────────────────────────────────────────────

/// DDS solution result.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DDSolutionResult {
    pub solution: Option<serde_json::Value>,
    pub error: Option<String>,
}

// ── Catalog ───────────────────────────────────────────────────────

/// Convention info for catalog listing.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConventionInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub module_ids: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub module_descriptions: Option<std::collections::HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub teaching: Option<bridge_conventions::types::bundle_types::ConventionTeaching>,
}

// ── Inference ─────────────────────────────────────────────────────

/// Public belief state summary (inference).
/// Placeholder — posterior engine is stub in Phase 4.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServicePublicBeliefState {
    pub beliefs: serde_json::Value,
    pub annotations: Vec<serde_json::Value>,
}

// ── DTO wrappers for session types lacking Serialize ──────────────

/// Serializable DTO wrapper for AiBidEntry.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiBidEntryDTO {
    pub seat: bridge_engine::types::Seat,
    pub call: bridge_engine::types::Call,
}

impl From<AiBidEntry> for AiBidEntryDTO {
    fn from(e: AiBidEntry) -> Self {
        Self {
            seat: e.seat,
            call: e.call,
        }
    }
}

/// Serializable DTO wrapper for AiPlayEntry.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiPlayEntryDTO {
    pub seat: bridge_engine::types::Seat,
    pub card: bridge_engine::types::Card,
    pub reason: String,
    pub trick_complete: bool,
}

impl From<AiPlayEntry> for AiPlayEntryDTO {
    fn from(e: AiPlayEntry) -> Self {
        Self {
            seat: e.seat,
            card: e.card,
            reason: e.reason,
            trick_complete: e.trick_complete,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn phase_transition_serde_roundtrip() {
        let pt = PhaseTransition {
            from: GamePhase::Bidding,
            to: GamePhase::Explanation,
        };
        let json = serde_json::to_string(&pt).unwrap();
        let rt: PhaseTransition = serde_json::from_str(&json).unwrap();
        assert_eq!(rt.from, GamePhase::Bidding);
        assert_eq!(rt.to, GamePhase::Explanation);
    }

    #[test]
    fn convention_info_serde_roundtrip() {
        let ci = ConventionInfo {
            id: "nt-bundle".to_string(),
            name: "1NT Responses".to_string(),
            description: "Practice responding to 1NT openings".to_string(),
            category: "constructive".to_string(),
            module_ids: vec!["stayman".to_string(), "jacoby-transfers".to_string()],
            module_descriptions: None,
            teaching: None,
        };
        let json = serde_json::to_string(&ci).unwrap();
        let rt: ConventionInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(rt.id, "nt-bundle");
        assert_eq!(rt.module_ids.len(), 2);
    }

    #[test]
    fn service_public_belief_state_serde_roundtrip() {
        let state = ServicePublicBeliefState {
            beliefs: serde_json::json!({"north": {"hcp": [10, 15]}}),
            annotations: Vec::new(),
        };
        let json = serde_json::to_string(&state).unwrap();
        let rt: ServicePublicBeliefState = serde_json::from_str(&json).unwrap();
        assert_eq!(rt.beliefs["north"]["hcp"][0], 10);
    }

    #[test]
    fn dds_solution_result_serde_roundtrip() {
        let result = DDSolutionResult {
            solution: Some(serde_json::json!({"tricks": 9})),
            error: None,
        };
        let json = serde_json::to_string(&result).unwrap();
        let rt: DDSolutionResult = serde_json::from_str(&json).unwrap();
        assert!(rt.solution.is_some());
        assert!(rt.error.is_none());
    }
}
