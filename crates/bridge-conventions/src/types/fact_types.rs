//! Fact catalog types — definitions and composition.
//!
//! Mirrors TS types from `conventions/core/fact-catalog.ts` and `conventions/core/fact-layer.ts`.
//! Runtime evaluator functions are omitted — this is data only.

use bridge_engine::Suit;
use serde::{Deserialize, Serialize};

use super::meaning::ConstraintDimension;

/// Stratification of fact definitions — four layers with strict ownership.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum FactLayer {
    #[serde(rename = "primitive")]
    Primitive,
    #[serde(rename = "bridge-derived")]
    BridgeDerived,
    #[serde(rename = "system-derived")]
    SystemDerived,
    #[serde(rename = "module-derived")]
    ModuleDerived,
}

/// World scope for fact evaluation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum EvaluationWorld {
    #[serde(rename = "public")]
    Public,
    #[serde(rename = "acting-hand")]
    ActingHand,
    #[serde(rename = "full-deal")]
    FullDeal,
}

/// Value type for a fact definition.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FactValueType {
    Number,
    Boolean,
    String,
}

/// Operator subset for primitive clauses within a FactComposition.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PrimitiveClauseOperator {
    #[serde(rename = "gte")]
    Gte,
    #[serde(rename = "lte")]
    Lte,
    #[serde(rename = "eq")]
    Eq,
    #[serde(rename = "range")]
    Range,
}

/// Value for a primitive clause — either a single number or a range.
/// Uses `serde_json::Number` to preserve integer vs float distinction.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum PrimitiveClauseValue {
    Single(serde_json::Number),
    Range {
        min: serde_json::Number,
        max: serde_json::Number,
    },
}

/// A primitive clause that maps to a fact compiler call.
/// This is the JSON-serializable clause used in TS convention definitions.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimitiveClause {
    pub fact_id: String,
    pub operator: PrimitiveClauseOperator,
    pub value: PrimitiveClauseValue,
}

/// Comparison operator for cross-suit length comparisons.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum CompareOp {
    #[serde(rename = "gt")]
    Gt,
    #[serde(rename = "gte")]
    Gte,
    #[serde(rename = "eq")]
    Eq,
}

/// Extended primitive clause types — Rust-only additions beyond what TS defines.
/// These enable declarative expression of card-rank inspection, cross-suit comparison,
/// and vulnerability checks without per-ID built-in evaluators.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "clauseKind")]
pub enum ExtendedClause {
    /// Count of A/K/Q in a suit (0-3).
    #[serde(rename = "topHonorCount")]
    TopHonorCount {
        suit: Suit,
        #[serde(skip_serializing_if = "Option::is_none")]
        min: Option<u8>,
        #[serde(skip_serializing_if = "Option::is_none")]
        max: Option<u8>,
    },
    /// Aces held across all suits (0-4).
    #[serde(rename = "aceCount")]
    AceCount {
        #[serde(skip_serializing_if = "Option::is_none")]
        min: Option<u8>,
        #[serde(skip_serializing_if = "Option::is_none")]
        max: Option<u8>,
    },
    /// Kings held across all suits (0-4).
    #[serde(rename = "kingCount")]
    KingCount {
        #[serde(skip_serializing_if = "Option::is_none")]
        min: Option<u8>,
        #[serde(skip_serializing_if = "Option::is_none")]
        max: Option<u8>,
    },
    /// Compare lengths of two suits.
    #[serde(rename = "suitCompare")]
    SuitCompare { a: Suit, op: CompareOp, b: Suit },
    /// Check if longest suit is the specified suit (tie-break by rank priority: S>H>D>C).
    #[serde(rename = "longestSuitIs")]
    LongestSuitIs { suit: Suit },
    /// Check vulnerability flag from pre-seeded context fact.
    #[serde(rename = "vulnerabilityIs")]
    VulnerabilityIs { vulnerable: bool },
    /// Boolean fact lookup — checks a previously evaluated boolean fact.
    #[serde(rename = "booleanFact")]
    BooleanFact { fact_id: String, expected: bool },
    /// Numeric fact comparison — checks a previously evaluated numeric fact.
    #[serde(rename = "numericFact")]
    NumericFact {
        fact_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        min: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        max: Option<f64>,
    },
}

/// Value produced by a Match case or Compute expression.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum FactOutput {
    Text(String),
    Number(f64),
    Boolean(bool),
}

/// A case in a Match composition — first matching predicate wins.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MatchCase {
    pub when: FactComposition,
    pub then: FactOutput,
}

/// Arithmetic/computation expression for numeric facts.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "exprKind")]
pub enum ComputeExpr {
    /// Literal numeric value.
    #[serde(rename = "literal")]
    Literal { value: f64 },
    /// Reference a previously evaluated numeric fact.
    #[serde(rename = "factRef")]
    FactRef { fact_id: String },
    /// Sum of sub-expressions.
    #[serde(rename = "add")]
    Add { operands: Vec<ComputeExpr> },
    /// Shortage points (3/2/1 for void/singleton/doubleton) excluding trump suit.
    /// The `trump_suit_binding` is a binding key (e.g., "$suit") resolved from RelationalFactContext.
    #[serde(rename = "shortagePoints")]
    ShortagePoints { trump_suit_binding: String },
}

/// Composable tree describing the activation prerequisite of a module-derived fact.
/// Phase 2 adds Match and Compute variants for non-boolean facts (Rust-only).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum FactComposition {
    /// JSON-serializable primitive clause (from TS convention definitions).
    #[serde(rename = "primitive")]
    Primitive { clause: PrimitiveClause },
    /// Rust-only extended primitive clause (card-rank, cross-suit, vulnerability).
    #[serde(rename = "extended")]
    Extended { clause: ExtendedClause },
    #[serde(rename = "and")]
    And { operands: Vec<FactComposition> },
    #[serde(rename = "or")]
    Or { operands: Vec<FactComposition> },
    #[serde(rename = "not")]
    Not { operand: Box<FactComposition> },
    /// First-match classifier producing string/number/boolean output.
    #[serde(rename = "match")]
    Match {
        cases: Vec<MatchCase>,
        default: FactOutput,
    },
    /// Arithmetic computation producing numeric output.
    #[serde(rename = "compute")]
    Compute { expr: ComputeExpr },
}

/// A fact definition in the catalog.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FactDefinition {
    pub id: String,
    pub layer: FactLayer,
    pub world: EvaluationWorld,
    pub description: String,
    pub value_type: FactValueType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub derives_from: Option<Vec<String>>,
    pub constrains_dimensions: Vec<ConstraintDimension>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub composition: Option<FactComposition>,
}

/// Data-only subset of TS `FactCatalogExtension`.
/// Named differently to signal no evaluator functions.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FactDefinitionSet {
    pub definitions: Vec<FactDefinition>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fact_layer_serde() {
        assert_eq!(
            serde_json::to_string(&FactLayer::BridgeDerived).unwrap(),
            "\"bridge-derived\""
        );
        assert_eq!(
            serde_json::to_string(&FactLayer::ModuleDerived).unwrap(),
            "\"module-derived\""
        );
    }

    #[test]
    fn evaluation_world_serde() {
        assert_eq!(
            serde_json::to_string(&EvaluationWorld::ActingHand).unwrap(),
            "\"acting-hand\""
        );
    }

    #[test]
    fn fact_composition_primitive_roundtrip() {
        let comp = FactComposition::Primitive {
            clause: PrimitiveClause {
                fact_id: "hand.hcp".to_string(),
                operator: PrimitiveClauseOperator::Gte,
                value: PrimitiveClauseValue::Single(serde_json::Number::from(15)),
            },
        };
        let json = serde_json::to_string(&comp).unwrap();
        let back: FactComposition = serde_json::from_str(&json).unwrap();
        assert_eq!(back, comp);
    }

    #[test]
    fn fact_composition_nested_roundtrip() {
        let comp = FactComposition::And {
            operands: vec![
                FactComposition::Primitive {
                    clause: PrimitiveClause {
                        fact_id: "hand.hcp".to_string(),
                        operator: PrimitiveClauseOperator::Gte,
                        value: PrimitiveClauseValue::Single(serde_json::Number::from(12)),
                    },
                },
                FactComposition::Not {
                    operand: Box::new(FactComposition::Primitive {
                        clause: PrimitiveClause {
                            fact_id: "hand.isBalanced".to_string(),
                            operator: PrimitiveClauseOperator::Eq,
                            value: PrimitiveClauseValue::Single(serde_json::Number::from(1)),
                        },
                    }),
                },
            ],
        };
        let json = serde_json::to_string(&comp).unwrap();
        let back: FactComposition = serde_json::from_str(&json).unwrap();
        assert_eq!(back, comp);
    }

    #[test]
    fn fact_definition_roundtrip() {
        let def = FactDefinition {
            id: "module.stayman.eligible".to_string(),
            layer: FactLayer::ModuleDerived,
            world: EvaluationWorld::ActingHand,
            description: "Responder is eligible for Stayman".to_string(),
            value_type: FactValueType::Boolean,
            derives_from: Some(vec!["hand.hcp".to_string()]),
            constrains_dimensions: vec![ConstraintDimension::SuitLength],
            composition: None,
        };
        let json = serde_json::to_string(&def).unwrap();
        let back: FactDefinition = serde_json::from_str(&json).unwrap();
        assert_eq!(back, def);
    }
}
