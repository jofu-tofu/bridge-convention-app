//! DTO types for the learning viewport — struct/enum definitions consumed by
//! `learning_viewport.rs` and `learning_formatters.rs`.

use bridge_conventions::{ConstraintValue, Disclosure, FactOperator, RecommendationBand};
use bridge_engine::types::Call;
use serde::{Deserialize, Serialize};

// ── DTOs ─────────────────────────────────────────────────────────────

/// Module catalog entry for list display.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleCatalogEntry {
    pub module_id: String,
    pub display_name: String,
    pub description: String,
    pub purpose: String,
    pub surface_count: usize,
    pub bundle_ids: Vec<String>,
}

/// Full learning viewport for a single module.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleLearningViewport {
    pub module_id: String,
    pub display_name: String,
    pub description: String,
    pub purpose: String,
    pub teaching: LearningTeachingView,
    pub phases: Vec<PhaseGroupView>,
    pub bundle_ids: Vec<String>,
}

/// Teaching content for learning display.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningTeachingView {
    pub tradeoff: Option<String>,
    pub principle: Option<String>,
    pub common_mistakes: Vec<String>,
}

/// Phase group for learning display.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhaseGroupView {
    pub phase: String,
    pub phase_display: String,
    pub turn: Option<String>,
    pub transition_label: Option<String>,
    pub surfaces: Vec<SurfaceDetailView>,
}

/// Clause system variant (per-system threshold descriptions).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClauseSystemVariant {
    pub system_label: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trump_tp_description: Option<String>,
}

/// Relevant metric for a clause context.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RelevantMetric {
    #[serde(rename = "hcp")]
    Hcp,
    #[serde(rename = "trumpTp")]
    TrumpTp,
}

/// Surface clause view for learning display.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SurfaceClauseView {
    pub fact_id: String,
    pub operator: FactOperator,
    pub value: ConstraintValue,
    pub description: String,
    pub is_public: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_variants: Option<Vec<ClauseSystemVariant>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub relevant_metric: Option<RelevantMetric>,
}

/// Service teaching label (plain strings, not branded).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceTeachingLabel {
    pub name: String,
    pub summary: String,
}

/// Surface detail view.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SurfaceDetailView {
    pub meaning_id: String,
    pub teaching_label: ServiceTeachingLabel,
    pub call: Call,
    pub call_display: String,
    pub disclosure: Disclosure,
    pub recommendation: Option<RecommendationBand>,
    pub explanation_text: Option<String>,
    pub clauses: Vec<SurfaceClauseView>,
}

/// Base module info for settings.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BaseModuleInfo {
    pub id: String,
    pub display_name: String,
    pub description: String,
}

/// Entry condition for module root.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryCondition {
    pub label: String,
    pub call: Option<Call>,
    pub turn: Option<String>,
}
