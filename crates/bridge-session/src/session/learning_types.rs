//! DTO types for the learning viewport — struct/enum definitions consumed by
//! `learning_viewport.rs` and `learning_formatters.rs`.

use std::collections::BTreeMap;

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
    pub reference: Option<ReferenceView>,
    pub phases: Vec<PhaseGroupView>,
    pub bundle_ids: Vec<String>,
}

/// Reference content for the long-form convention page.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceView {
    pub summary_card: SummaryCard,
    pub when_to_use: Vec<String>,
    pub when_not_to_use: Vec<WhenNotItem>,
    pub response_table_rows: Vec<ResponseTableRow>,
    pub worked_auctions: Vec<WorkedAuction>,
    pub interference: Vec<InterferenceItem>,
    pub decision_grid: Option<DecisionGrid>,
    pub system_compat: SystemCompat,
    pub related_links: Vec<RelatedLink>,
    pub response_table_overrides: BTreeMap<String, ResponseTableOverride>,
}

/// Above-the-fold summary card.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SummaryCard {
    pub trigger: String,
    pub bid: Call,
    pub promises: String,
    pub denies: String,
    pub guiding_idea: String,
    pub partnership: String,
}

/// Negative-space guidance item.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WhenNotItem {
    pub text: String,
    pub reason: String,
}

/// One row in the derived response table.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResponseTableRow {
    pub meaning_id: String,
    pub response: Call,
    pub meaning: String,
    pub shape: String,
    pub hcp: String,
    pub forcing: String,
}

/// Authored worked auction example.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkedAuction {
    pub label: String,
    pub calls: Vec<WorkedAuctionCall>,
    pub outcome_note: String,
}

/// One call inside a worked auction.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkedAuctionCall {
    pub seat: String,
    pub call: Call,
    pub rationale: String,
}

/// Interference guidance row.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InterferenceItem {
    pub opponent_action: String,
    pub our_action: String,
    pub note: String,
}

/// Optional 2-D decision grid.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecisionGrid {
    pub rows: Vec<String>,
    pub cols: Vec<String>,
    pub cells: Vec<Vec<String>>,
}

/// System compatibility notes.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemCompat {
    pub sayc: String,
    pub two_over_one: String,
    pub acol: String,
    pub custom_note: String,
}

/// Cross-link to a related module.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelatedLink {
    pub module_id: String,
    pub discriminator: String,
}

/// Optional authored override for a derived response-table cell.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResponseTableOverride {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shape: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hcp: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub forcing: Option<String>,
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
