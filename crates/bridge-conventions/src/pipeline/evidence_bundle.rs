//! Evidence types for decision program representations.
//!
//! Mirrors TS types from `pipeline/evidence-bundle.ts`.

use serde::{Deserialize, Serialize};


/// Evidence for a single condition evaluation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConditionEvidence {
    pub condition_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fact_id: Option<String>,
    pub satisfied: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub observed_value: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub threshold: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<std::collections::HashMap<String, serde_json::Value>>,
}

/// Evidence for why a meaning was rejected.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RejectionEvidence {
    pub meaning_id: String,
    pub failed_conditions: Vec<ConditionEvidence>,
    pub module_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub negatable_failures: Option<Vec<ConditionEvidence>>,
}

/// Evidence for an alternative meaning that was considered.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlternativeEvidence {
    pub meaning_id: String,
    pub call: String,
    pub ranking: AlternativeRanking,
    pub reason: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub condition_delta: Option<Vec<ConditionEvidence>>,
}

/// Ranking info for alternative evidence.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AlternativeRanking {
    pub band: String,
    pub specificity: f64,
}

/// The evidence contract for decision program representations.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvidenceBundle {
    pub matched: Option<MatchedEvidence>,
    pub rejected: Vec<RejectionEvidence>,
    pub alternatives: Vec<AlternativeEvidence>,
    pub exhaustive: bool,
    pub fallback_reached: bool,
}

/// Evidence for the matched meaning.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchedEvidence {
    pub meaning_id: String,
    pub satisfied_conditions: Vec<ConditionEvidence>,
}
