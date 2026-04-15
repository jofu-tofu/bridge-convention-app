//! DTO types for the learning viewport — struct/enum definitions consumed by
//! `learning_viewport.rs` and `learning_formatters.rs`.

use bridge_conventions::{
    ConstraintValue, Disclosure, FactComposition, FactOperator, HandSample, RecommendationBand,
};
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
    pub reference: ReferenceView,
    pub phases: Vec<PhaseGroupView>,
    pub bundle_ids: Vec<String>,
}

/// Reference content for the long-form convention page.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceView {
    pub summary_card: SummaryCard,
    pub when_to_use: Vec<ReferencePredicateBullet>,
    pub when_not_to_use: Vec<WhenNotItem>,
    pub response_table: ResponseTable,
    pub worked_auctions: Vec<WorkedAuction>,
    pub interference: ResolvedInterference,
    pub quick_reference: ResolvedQuickReference,
    pub related_links: Vec<RelatedLink>,
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
    /// Derived peer bids for peer-structured conventions. Empty for
    /// hierarchical conventions (Stayman, Puppet Stayman, Strong 2C).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub peers: Vec<SummaryCardPeer>,
}

/// One derived peer entry on the summary-card viewport. Derived from the
/// authored `AuthoredSummaryCardPeer` + the same clause-join pipeline used for
/// the top-level summary card promises/denies.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SummaryCardPeer {
    pub meaning_id: String,
    pub call: Call,
    pub call_display: String,
    pub promises: String,
    pub denies: String,
    pub discriminator_label: String,
}

/// Negative-space guidance item.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WhenNotItem {
    pub text: String,
    pub reason: String,
}

/// Typed "when to use" bullet carried through to the prerendered surface.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferencePredicateBullet {
    pub predicate: FactComposition,
    pub gloss: String,
}

/// Response table with dynamically discovered columns.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResponseTable {
    pub columns: Vec<ResponseTableColumn>,
    pub rows: Vec<ResponseTableRow>,
}

/// A single column in the derived response table.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResponseTableColumn {
    pub id: String,
    pub label: String,
}

/// A single cell within a response-table row.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResponseTableCell {
    pub column_id: String,
    pub column_label: String,
    pub text: String,
}

/// One row in the derived response table.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResponseTableRow {
    pub meaning_id: String,
    pub response: Call,
    pub meaning: String,
    pub cells: Vec<ResponseTableCell>,
}

/// Authored worked auction example.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkedAuction {
    pub kind: WorkedAuctionKind,
    pub label: String,
    pub calls: Vec<WorkedAuctionCall>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub responder_hand: Option<HandSample>,
}

/// Worked-auction discriminator for future UI styling.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum WorkedAuctionKind {
    Positive,
    Negative,
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

/// Resolved interference block — mirrors the authored tagged enum shape.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum ResolvedInterference {
    Applicable { items: Vec<InterferenceItem> },
    NotApplicable { reason: String },
}

/// Resolved axis descriptor used on the viewport side — both authored axis
/// variants flatten to `{ label, values }` with system facts resolved via
/// `describe_system_fact_value`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedAxis {
    pub label: String,
    pub values: Vec<String>,
}

/// One row of a quick-reference list variant.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedQuickReferenceListItem {
    pub recommendation: String,
    pub note: String,
}

/// Rendered quick-reference grid cell.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedCell {
    pub call: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gloss: Option<String>,
    pub kind: ResolvedCellKind,
}

/// Render kind for a quick-reference grid cell.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ResolvedCellKind {
    Action,
    NotApplicable,
    Empty,
}

/// Quick-reference viewport payload — either a 2-D grid or a flat list.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ResolvedQuickReference {
    Grid {
        #[serde(rename = "rowAxis")]
        row_axis: ResolvedAxis,
        #[serde(rename = "colAxis")]
        col_axis: ResolvedAxis,
        cells: Vec<Vec<ResolvedCell>>,
    },
    List {
        axis: ResolvedAxis,
        items: Vec<ResolvedQuickReferenceListItem>,
    },
}

/// Cross-link to a related module.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelatedLink {
    pub module_id: String,
    pub discriminator: String,
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
