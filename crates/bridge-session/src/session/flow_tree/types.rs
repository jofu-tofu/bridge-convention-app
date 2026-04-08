//! Types for flow tree construction — both exported viewport types and internal
//! mutable tree representation.

use bridge_conventions::types::meaning::{Disclosure, RecommendationBand, SourceIntent};
use bridge_conventions::types::rule_types::{ObsPattern, RouteExpr};
use bridge_engine::types::Call;
use serde::{Deserialize, Serialize};

use super::super::learning_types::SurfaceClauseView;

// ── Exported Types ──────────────────────────────────────────────────

/// A node in the unified conversation flow tree.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlowTreeNode {
    pub id: String,
    pub call: Option<Call>,
    pub call_display: Option<String>,
    pub turn: Option<String>,
    pub label: String,
    pub module_id: Option<String>,
    pub module_display_name: Option<String>,
    pub children: Vec<FlowTreeNode>,
    pub depth: usize,
    pub recommendation: Option<RecommendationBand>,
    pub disclosure: Option<Disclosure>,
    pub explanation_text: Option<String>,
    pub clauses: Vec<SurfaceClauseView>,
}

/// Unified conversation flow tree for a bundle.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BundleFlowTreeViewport {
    pub bundle_id: String,
    pub bundle_name: String,
    pub root: FlowTreeNode,
    pub node_count: usize,
    pub max_depth: usize,
}

/// Conversation flow tree scoped to a single module.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleFlowTreeViewport {
    pub module_id: String,
    pub module_name: String,
    pub root: FlowTreeNode,
    pub node_count: usize,
    pub max_depth: usize,
}

// ── Internal Types ──────────────────────────────────────────────────

pub(crate) struct TaggedSurface {
    pub meaning_id: String,
    pub ck: String,
    pub call: Call,
    pub teaching_label: String,
    pub module_id: String,
    pub source_intent: SourceIntent,
    pub recommendation: Option<RecommendationBand>,
    pub disclosure: Disclosure,
    pub explanation_text: Option<String>,
    pub clauses: Vec<SurfaceClauseView>,
}

#[allow(dead_code)] // phase is used during tree construction for identification
pub(crate) struct MutableNode {
    pub id: String,
    pub call_key: Option<String>,
    pub call: Option<Call>,
    pub turn: Option<String>,
    pub label: String,
    pub module_id: Option<String>,
    pub module_display_name: Option<String>,
    pub children: Vec<MutableNode>,
    pub depth: usize,
    pub phase: String,
    pub transition_obs: Option<ObsPattern>,
    pub recommendation: Option<RecommendationBand>,
    pub disclosure: Option<Disclosure>,
    pub explanation_text: Option<String>,
    pub clauses: Vec<SurfaceClauseView>,
}

pub(crate) struct ModulePhaseState {
    pub module_id: String,
    pub turn: Option<String>,
    pub route: Option<RouteExpr>,
    pub surfaces: Vec<TaggedSurface>,
}

#[derive(Clone)]
pub(crate) struct TransitionEntry {
    pub from: Vec<String>,
    pub to: String,
    pub on: ObsPattern,
}

pub(crate) struct NodeCounter {
    pub value: usize,
}
