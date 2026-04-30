//! Strategy evaluation — unified debug container.
//!
//! Mirrors TS from `pipeline/strategy-evaluation.ts`.

use serde::{Deserialize, Serialize};

use crate::fact_dsl::types::EvaluatedFacts;
use crate::pipeline::observation::committed_step::AuctionContext;
use crate::pipeline::types::PipelineResult;
use crate::teaching::teaching_types::{SurfaceGroup, TeachingProjection};

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
    /// Teaching projection. Null when not produced.
    pub teaching_projection: Option<TeachingProjection>,
    /// Evaluated facts. Null before first evaluation.
    pub facts: Option<EvaluatedFacts>,
    /// Auction context. Null when not produced.
    pub auction_context: Option<AuctionContext>,
}

/// Practical recommendation — what an experienced player might prefer.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PracticalRecommendation {
    pub call: bridge_engine::types::Call,
    pub reason: String,
    pub confidence: f64,
}
