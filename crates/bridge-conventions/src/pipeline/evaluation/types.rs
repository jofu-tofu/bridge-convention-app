//! Meaning evaluation types — MeaningProposal, MeaningClause, RankingMetadata.
//!
//! Mirrors TS types from `pipeline/evaluation/meaning.ts`.

use serde::{Deserialize, Serialize};
use std::cmp::Ordering;

use crate::types::meaning::{
    AuthoredRankingMetadata, ConstraintValue, Disclosure, FactOperator, RecommendationBand,
};
use crate::types::meaning::{MeaningId, SemanticClassId, SourceIntent};

/// Evaluated clause with satisfaction status.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeaningClause {
    pub fact_id: String,
    pub operator: FactOperator,
    pub value: ConstraintValue,
    pub satisfied: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub clause_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub observed_value: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_public: Option<bool>,
}

/// Computed ranking metadata (extends authored with derived specificity).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RankingMetadata {
    pub recommendation_band: RecommendationBand,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub module_precedence: Option<i32>,
    pub declaration_order: i32,
    pub specificity: f64,
}

impl RankingMetadata {
    /// Create from authored metadata with default specificity.
    pub fn from_authored(authored: &AuthoredRankingMetadata) -> Self {
        Self {
            recommendation_band: authored.recommendation_band,
            module_precedence: authored.module_precedence,
            declaration_order: authored.declaration_order,
            specificity: 0.0,
        }
    }
}

/// Band ordering for ranking comparison.
fn band_order(band: RecommendationBand) -> u8 {
    match band {
        RecommendationBand::Must => 0,
        RecommendationBand::Should => 1,
        RecommendationBand::May => 2,
        RecommendationBand::Avoid => 3,
    }
}

/// Compare two rankings using frozen lexicographic order:
/// band (must > should > may > avoid) → specificity (higher first) →
/// module_precedence (lower first) → declaration_order (lower first).
pub fn compare_ranking(a: &RankingMetadata, b: &RankingMetadata) -> Ordering {
    let band_cmp = band_order(a.recommendation_band).cmp(&band_order(b.recommendation_band));
    if band_cmp != Ordering::Equal {
        return band_cmp;
    }

    // Higher specificity ranks first
    let spec_cmp = b
        .specificity
        .partial_cmp(&a.specificity)
        .unwrap_or(Ordering::Equal);
    if spec_cmp != Ordering::Equal {
        return spec_cmp;
    }

    // Lower module_precedence ranks first (None treated as 0)
    let mp_a = a.module_precedence.unwrap_or(0);
    let mp_b = b.module_precedence.unwrap_or(0);
    let mp_cmp = mp_a.cmp(&mp_b);
    if mp_cmp != Ordering::Equal {
        return mp_cmp;
    }

    // Lower declaration_order ranks first
    a.declaration_order.cmp(&b.declaration_order)
}

/// A fully evaluated meaning proposal.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeaningProposal {
    pub meaning_id: MeaningId,
    pub semantic_class_id: SemanticClassId,
    pub module_id: String,
    pub ranking: RankingMetadata,
    pub clauses: Vec<MeaningClause>,
    pub all_satisfied: bool,
    pub disclosure: Disclosure,
    pub source_intent: SourceIntent,
    pub teaching_label: crate::types::authored_text::TeachingLabel,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub surface_bindings: Option<std::collections::HashMap<String, String>>,
    pub encoding: crate::types::meaning::BidEncoding,
}
