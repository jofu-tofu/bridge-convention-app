//! Teaching types — projection, parse tree.
//!
//! Mirrors TS types from `conventions/teaching/teaching-types.ts`.
//! Grading lives in `bridge-session::session::bid_feedback_builder`.

use bridge_engine::types::Call;
use serde::{Deserialize, Serialize};

use crate::pipeline::evaluation::provenance::EncoderKind;
use crate::pipeline::evidence_bundle::ConditionEvidence;

/// Discriminator for how members within a family are related.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SurfaceGroupRelationship {
    MutuallyExclusive,
    EquivalentEncoding,
    PolicyAlternative,
}

/// Surface group — conceptual family of related meaning surfaces.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SurfaceGroup {
    pub id: String,
    pub label: String,
    pub members: Vec<String>,
    pub relationship: SurfaceGroupRelationship,
    pub description: String,
}

// ── Teaching Projection Types ───────────────────────────────────────────

/// Teaching-optimized view of a bid decision.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeachingProjection {
    pub call_views: Vec<CallProjection>,
    pub meaning_views: Vec<MeaningView>,
    pub primary_explanation: Vec<ExplanationNode>,
    pub why_not: Vec<WhyNotEntry>,
    pub conventions_applied: Vec<ConventionContribution>,
    pub hand_space: HandSpaceSummary,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parse_tree: Option<ParseTreeView>,
    pub evaluation_exhaustive: bool,
    pub fallback_reached: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub encoder_kind: Option<EncoderKind>,
}

/// How a specific call appears in the teaching view.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CallProjection {
    pub call: Call,
    pub status: CallStatus,
    pub supporting_meanings: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub primary_meaning: Option<String>,
    pub projection_kind: ProjectionKind,
}

/// Call status in teaching view.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CallStatus {
    Truth,
    Acceptable,
    Wrong,
}

/// Projection kind.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ProjectionKind {
    SingleRationale,
    MergedEquivalent,
    MultiRationaleSameCall,
}

/// A meaning's status in the teaching view.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeaningView {
    pub meaning_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub semantic_class_id: Option<String>,
    pub display_label: String,
    pub status: MeaningStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub elimination_reason: Option<String>,
    pub supporting_evidence: Vec<ConditionEvidence>,
}

/// Meaning status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum MeaningStatus {
    Live,
    Eliminated,
    NotApplicable,
}

/// Explanation node for structured teaching text.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplanationNode {
    pub kind: ExplanationKind,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub passed: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub explanation_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub template_key: Option<String>,
}

/// Explanation node kind.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ExplanationKind {
    Text,
    Condition,
    CallReference,
    ConventionReference,
}

/// "Why not this call?" entry.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WhyNotEntry {
    pub call: Call,
    pub grade: WhyNotGrade,
    pub explanation: Vec<ExplanationNode>,
    pub elimination_stage: String,
}

/// Why-not grade.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum WhyNotGrade {
    NearMiss,
    Wrong,
}

/// How a convention contributed to the decision.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConventionContribution {
    pub module_id: String,
    pub role: ContributionRole,
    pub meanings_proposed: Vec<String>,
}

/// Convention contribution role.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ContributionRole {
    Primary,
    Alternative,
    Suppressed,
}

/// Hand space summary.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HandSpaceSummary {
    pub seat_label: String,
    pub hcp_range: (f64, f64),
    pub shape_description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub partner_summary: Option<String>,
}

// ── Parse Tree ──────────────────────────────────────────────────────

/// Verdict for a convention module in the parse tree.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ParseTreeModuleVerdict {
    Selected,
    Applicable,
    Eliminated,
}

/// One condition evaluated for a convention module.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParseTreeCondition {
    pub fact_id: String,
    pub description: String,
    pub satisfied: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub observed_value: Option<serde_json::Value>,
}

/// Parse tree meaning entry.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParseTreeMeaning {
    pub meaning_id: String,
    pub display_label: String,
    pub matched: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub call: Option<Call>,
}

/// A convention module node in the parse tree.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParseTreeModuleNode {
    pub module_id: String,
    pub display_label: String,
    pub verdict: ParseTreeModuleVerdict,
    pub conditions: Vec<ParseTreeCondition>,
    pub meanings: Vec<ParseTreeMeaning>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub elimination_reason: Option<String>,
}

/// The full parse-tree view of a bid decision.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParseTreeView {
    pub modules: Vec<ParseTreeModuleNode>,
    pub selected_path: Option<SelectedPath>,
}

/// The winning module + meaning path.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectedPath {
    pub module_id: String,
    pub meaning_id: String,
    pub call: Call,
}
