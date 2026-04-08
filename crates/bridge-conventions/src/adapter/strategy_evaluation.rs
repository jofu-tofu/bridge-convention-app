//! Strategy evaluation — unified debug container.
//!
//! Mirrors TS from `pipeline/strategy-evaluation.ts`.

use serde::{Deserialize, Serialize};

use crate::fact_dsl::types::EvaluatedFacts;
use crate::pipeline::evaluation::provenance::HandoffTrace;
use crate::pipeline::observation::committed_step::AuctionContext;
use crate::pipeline::types::PipelineResult;
use crate::teaching::teaching_types::{SurfaceGroup, TeachingProjection};

/// Lightweight DTO for convention machine state.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MachineDebugSnapshot {
    /// Current state ID (populated from rules path).
    pub current_state_id: String,
    /// Active surface group IDs (populated from rules path).
    pub active_surface_group_ids: Vec<String>,
    /// Diagnostic messages (populated from rules path).
    pub diagnostics: Vec<DiagnosticEntry>,
    /// State history (legacy FSM — None from rules path).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state_history: Option<Vec<String>>,
    /// Transition history (legacy FSM — None from rules path).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transition_history: Option<Vec<String>>,
    /// Handoff traces (legacy FSM — None from rules path).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub handoff_traces: Option<Vec<HandoffTrace>>,
    /// Submachine stack (legacy FSM — None from rules path).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub submachine_stack: Option<Vec<SubmachineEntry>>,
    /// Machine registers (legacy FSM — None from rules path).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub registers: Option<serde_json::Value>,
}

/// A diagnostic entry.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticEntry {
    pub level: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub module_id: Option<String>,
}

/// Submachine stack entry.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmachineEntry {
    pub parent_machine_id: String,
    pub return_state_id: String,
}

/// Unified evaluation snapshot — all pipeline outputs from the most recent suggest() call.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StrategyEvaluation {
    /// Practical recommendation. Null when not produced.
    pub practical_recommendation: Option<PracticalRecommendation>,
    /// Convention-level surface groups. Null if not configured.
    pub surface_groups: Option<Vec<SurfaceGroup>>,
    /// Full pipeline result. Null when not produced.
    pub pipeline_result: Option<PipelineResult>,
    /// Posterior summary. Null when posterior engine not wired.
    pub posterior_summary: Option<serde_json::Value>,
    /// Explanation catalog — module-level explanation entries.
    pub explanation_catalog: Option<ExplanationCatalog>,
    /// Teaching projection. Null when not produced.
    pub teaching_projection: Option<TeachingProjection>,
    /// Evaluated facts. Null before first evaluation.
    pub facts: Option<EvaluatedFacts>,
    /// Machine/protocol state. Null when no machine is wired.
    pub machine_snapshot: Option<MachineDebugSnapshot>,
    /// Auction context. Null when not produced.
    pub auction_context: Option<AuctionContext>,
}

/// Explanation catalog — typed collection of module-level explanation entries.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplanationCatalog {
    pub entries: Vec<ExplanationCatalogEntry>,
}

/// A single explanation catalog entry.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplanationCatalogEntry {
    pub module_id: String,
    pub surface_count: usize,
    pub explanation: String,
}

/// Practical recommendation — what an experienced player might prefer.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PracticalRecommendation {
    pub call: bridge_engine::types::Call,
    pub reason: String,
    pub confidence: f64,
}
