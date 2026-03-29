//! Fact catalog types — definitions and composition.
//!
//! Mirrors TS types from `conventions/core/fact-catalog.ts` and `conventions/core/fact-layer.ts`.
//! Runtime evaluator functions are omitted — this is data only.

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
    Range { min: serde_json::Number, max: serde_json::Number },
}

/// A primitive clause that maps to a fact compiler call.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrimitiveClause {
    pub fact_id: String,
    pub operator: PrimitiveClauseOperator,
    pub value: PrimitiveClauseValue,
}

/// Composable tree describing the activation prerequisite of a module-derived fact.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum FactComposition {
    #[serde(rename = "primitive")]
    Primitive { clause: PrimitiveClause },
    #[serde(rename = "and")]
    And { operands: Vec<FactComposition> },
    #[serde(rename = "or")]
    Or { operands: Vec<FactComposition> },
    #[serde(rename = "not")]
    Not { operand: Box<FactComposition> },
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
