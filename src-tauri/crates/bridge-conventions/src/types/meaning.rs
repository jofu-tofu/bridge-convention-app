//! Bid meaning types — what a bid means, independent of encoding.
//!
//! Mirrors TS types from `conventions/pipeline/evaluation/meaning.ts`
//! and `conventions/core/agreement-module.ts` (FactConstraint).

use bridge_engine::types::Call;
use serde::{Deserialize, Serialize};

use super::authored_text::TeachingLabel;

/// Meaning ID — string, colon-namespaced.
pub type MeaningId = String;

/// Semantic class ID — cross-module equivalence class.
pub type SemanticClassId = String;

/// How a bid's meaning is disclosed to opponents at the table.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Disclosure {
    #[serde(rename = "alert")]
    Alert,
    #[serde(rename = "announcement")]
    Announcement,
    #[serde(rename = "natural")]
    Natural,
    #[serde(rename = "standard")]
    Standard,
}

/// Recommendation band — authored semantic priority.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum RecommendationBand {
    #[serde(rename = "must")]
    Must,
    #[serde(rename = "should")]
    Should,
    #[serde(rename = "may")]
    May,
    #[serde(rename = "avoid")]
    Avoid,
}

/// Communicative constraint dimensions for specificity derivation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ConstraintDimension {
    #[serde(rename = "suitIdentity")]
    SuitIdentity,
    #[serde(rename = "suitLength")]
    SuitLength,
    #[serde(rename = "pointRange")]
    PointRange,
    #[serde(rename = "shapeClass")]
    ShapeClass,
    #[serde(rename = "suitRelation")]
    SuitRelation,
    #[serde(rename = "suitQuality")]
    SuitQuality,
}

/// Operator for fact-based clause evaluation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum FactOperator {
    #[serde(rename = "gte")]
    Gte,
    #[serde(rename = "lte")]
    Lte,
    #[serde(rename = "eq")]
    Eq,
    #[serde(rename = "range")]
    Range,
    #[serde(rename = "boolean")]
    Boolean,
    #[serde(rename = "in")]
    In,
}

/// Value for a fact constraint — union of possible types.
/// Uses `serde_json::Number` to preserve integer vs float distinction.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ConstraintValue {
    Number(serde_json::Number),
    Bool(bool),
    String(String),
    Range { min: serde_json::Number, max: serde_json::Number },
    List(Vec<String>),
}

impl ConstraintValue {
    /// Create a numeric constraint value from an integer.
    pub fn int(n: i64) -> Self {
        Self::Number(serde_json::Number::from(n))
    }

    /// Create a numeric constraint value from a float.
    pub fn float(n: f64) -> Self {
        Self::Number(serde_json::Number::from_f64(n).unwrap())
    }
}

/// A fact constraint (from agreement-module.ts).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FactConstraint {
    pub fact_id: String,
    pub operator: FactOperator,
    pub value: ConstraintValue,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_public: Option<bool>,
}

/// Authored ranking metadata — what convention authors write.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthoredRankingMetadata {
    pub recommendation_band: RecommendationBand,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub module_precedence: Option<i32>,
    pub declaration_order: i32,
}

/// A clause in a BidMeaning surface.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BidMeaningClause {
    pub fact_id: String,
    pub operator: FactOperator,
    pub value: ConstraintValue,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub clause_id: Option<String>,
    /// Auto-derived description (e.g., "8+ HCP").
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rationale: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_public: Option<bool>,
}

/// Source intent — what the bid is trying to communicate.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SourceIntent {
    #[serde(rename = "type")]
    pub intent_type: String,
    pub params: std::collections::HashMap<String, serde_json::Value>,
}

/// Alternate encoding for a bid meaning.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AlternateEncoding {
    pub call: Call,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub condition: Option<String>,
}

/// Encoding specification for a bid meaning.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BidEncoding {
    pub default_call: Call,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alternate_encodings: Option<Vec<AlternateEncoding>>,
}

/// A bid meaning surface — the complete specification of what a bid means.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BidMeaning {
    pub meaning_id: MeaningId,
    pub semantic_class_id: SemanticClassId,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub module_id: Option<String>,
    pub encoding: BidEncoding,
    pub clauses: Vec<BidMeaningClause>,
    pub ranking: AuthoredRankingMetadata,
    pub source_intent: SourceIntent,
    pub disclosure: Disclosure,
    pub teaching_label: TeachingLabel,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub surface_bindings: Option<std::collections::HashMap<String, String>>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_engine::types::BidSuit;

    #[test]
    fn disclosure_serde() {
        assert_eq!(
            serde_json::to_string(&Disclosure::Alert).unwrap(),
            "\"alert\""
        );
        assert_eq!(
            serde_json::to_string(&Disclosure::Natural).unwrap(),
            "\"natural\""
        );
    }

    #[test]
    fn fact_operator_serde() {
        assert_eq!(
            serde_json::to_string(&FactOperator::Gte).unwrap(),
            "\"gte\""
        );
        assert_eq!(
            serde_json::to_string(&FactOperator::In).unwrap(),
            "\"in\""
        );
    }

    #[test]
    fn constraint_value_number() {
        let v = ConstraintValue::int(15);
        let json = serde_json::to_string(&v).unwrap();
        assert_eq!(json, "15");
        let back: ConstraintValue = serde_json::from_str("15").unwrap();
        assert_eq!(back, v);
    }

    #[test]
    fn constraint_value_bool() {
        let v = ConstraintValue::Bool(true);
        let json = serde_json::to_string(&v).unwrap();
        assert_eq!(json, "true");
    }

    #[test]
    fn constraint_value_range() {
        let v = ConstraintValue::Range {
            min: serde_json::Number::from(8),
            max: serde_json::Number::from(10),
        };
        let json = serde_json::to_string(&v).unwrap();
        let back: ConstraintValue = serde_json::from_str(&json).unwrap();
        assert_eq!(back, v);
    }

    #[test]
    fn constraint_value_list() {
        let v = ConstraintValue::List(vec!["hearts".to_string(), "spades".to_string()]);
        let json = serde_json::to_string(&v).unwrap();
        let back: ConstraintValue = serde_json::from_str(&json).unwrap();
        assert_eq!(back, v);
    }

    #[test]
    fn fact_constraint_roundtrip() {
        let fc = FactConstraint {
            fact_id: "hand.hcp".to_string(),
            operator: FactOperator::Range,
            value: ConstraintValue::Range {
                min: serde_json::Number::from(15),
                max: serde_json::Number::from(17),
            },
            is_public: Some(true),
        };
        let json = serde_json::to_string(&fc).unwrap();
        let back: FactConstraint = serde_json::from_str(&json).unwrap();
        assert_eq!(back, fc);
    }

    #[test]
    fn bid_meaning_minimal_roundtrip() {
        let meaning = BidMeaning {
            meaning_id: "stayman:ask-major".to_string(),
            semantic_class_id: "bridge:stayman-ask".to_string(),
            module_id: Some("stayman".to_string()),
            encoding: BidEncoding {
                default_call: Call::Bid {
                    level: 2,
                    strain: BidSuit::Clubs,
                },
                alternate_encodings: None,
            },
            clauses: vec![BidMeaningClause {
                fact_id: "hand.hcp".to_string(),
                operator: FactOperator::Gte,
                value: ConstraintValue::int(8),
                clause_id: None,
                description: None,
                rationale: None,
                is_public: None,
            }],
            ranking: AuthoredRankingMetadata {
                recommendation_band: RecommendationBand::Should,
                module_precedence: None,
                declaration_order: 0,
            },
            source_intent: SourceIntent {
                intent_type: "StaymanAsk".to_string(),
                params: std::collections::HashMap::new(),
            },
            disclosure: Disclosure::Standard,
            teaching_label: TeachingLabel {
                name: super::super::authored_text::BidName::new("Stayman"),
                summary: super::super::authored_text::BidSummary::new(
                    "Asks opener for a 4-card major",
                ),
            },
            surface_bindings: None,
        };
        let json = serde_json::to_string(&meaning).unwrap();
        let back: BidMeaning = serde_json::from_str(&json).unwrap();
        assert_eq!(back, meaning);
    }
}
