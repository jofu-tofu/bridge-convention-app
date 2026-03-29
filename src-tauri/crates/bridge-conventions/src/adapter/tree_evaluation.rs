//! Candidate eligibility and resolved candidate DTO types.
//!
//! Mirrors TS types from `pipeline/tree-evaluation.ts`.

use bridge_engine::types::Call;
use serde::{Deserialize, Serialize};

use crate::types::meaning::RecommendationBand;

/// Detail about a sibling condition that failed.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SiblingConditionDetail {
    pub name: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub condition_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fact_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub observed_value: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub threshold: Option<serde_json::Value>,
}

/// Hand eligibility.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HandEligibility {
    pub satisfied: bool,
    pub failed_conditions: Vec<SiblingConditionDetail>,
}

/// Encoding eligibility.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EncodingEligibility {
    pub legal: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<EncodingFailureReason>,
}

/// Why encoding failed.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EncodingFailureReason {
    AllEncodingsIllegal,
    IllegalInAuction,
}

/// Pedagogical eligibility.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PedagogicalEligibility {
    pub acceptable: bool,
    pub reasons: Vec<String>,
}

/// Unified eligibility model — all dimensions that gate candidate selectability.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CandidateEligibility {
    pub hand: HandEligibility,
    pub encoding: EncodingEligibility,
    pub pedagogical: PedagogicalEligibility,
}

/// Strategy-resolved candidate DTO.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedCandidateDTO {
    pub bid_name: String,
    pub meaning: String,
    pub call: Call,
    pub resolved_call: Call,
    pub is_default_call: bool,
    pub legal: bool,
    pub is_matched: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<CandidatePriority>,
    pub intent_type: String,
    pub failed_conditions: Vec<SiblingConditionDetail>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub eligibility: Option<CandidateEligibility>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order_key: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub all_encodings: Option<Vec<EncodingOptionDTO>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub module_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub semantic_class_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recommendation_band: Option<RecommendationBand>,
}

/// Candidate priority level.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CandidatePriority {
    Preferred,
    Alternative,
}

/// Encoding option in resolved candidate.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EncodingOptionDTO {
    pub call: Call,
    pub legal: bool,
}

/// Check eligibility dimensions for DTO — pedagogical is post-selection annotation, not a gate.
pub fn is_dto_selectable(c: &ResolvedCandidateDTO) -> bool {
    match &c.eligibility {
        Some(e) => e.hand.satisfied && e.encoding.legal,
        None => c.legal && c.failed_conditions.is_empty(),
    }
}

/// Check pedagogical acceptability on DTO.
pub fn is_dto_teaching_acceptable(c: &ResolvedCandidateDTO) -> bool {
    match &c.eligibility {
        Some(e) => e.pedagogical.acceptable,
        None => true,
    }
}
