//! Core output types for fact evaluation.
//!
//! These types represent the results of evaluating facts against a hand.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::types::{ConfidenceLevel, ConstraintValue, FactOperator};

/// A fact's evaluated value — number, boolean, or string.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum FactData {
    Number(f64),
    Boolean(bool),
    Text(String),
}

impl FactData {
    /// Extract as f64, returning 0.0 if not a number.
    pub fn as_number(&self) -> f64 {
        match self {
            FactData::Number(n) => *n,
            _ => 0.0,
        }
    }

    /// Extract as bool, returning false if not a boolean.
    pub fn as_bool(&self) -> bool {
        match self {
            FactData::Boolean(b) => *b,
            _ => false,
        }
    }

    /// Extract as string reference, returning "" if not text.
    pub fn as_text(&self) -> &str {
        match self {
            FactData::Text(s) => s,
            _ => "",
        }
    }
}

/// A single evaluated fact: ID + value.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FactValue {
    pub fact_id: String,
    pub value: FactData,
}

/// The result of evaluating all facts for a hand.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EvaluatedFacts {
    pub world: crate::types::EvaluationWorld,
    pub facts: HashMap<String, FactValue>,
}

/// Context for relational fact evaluation (layers 5-6).
#[derive(Debug, Clone, Default)]
pub struct RelationalFactContext {
    /// Variable bindings (e.g., "$suit" → "hearts").
    pub bindings: Option<HashMap<String, String>>,
    /// Partner's publicly committed constraints from prior bids.
    pub public_commitments: Option<Vec<PublicConstraint>>,
    /// Agreed trump fit information.
    pub fit_agreed: Option<FitAgreedContext>,
}

/// Agreed fit for relational evaluation — uses string strain to match TS interface.
#[derive(Debug, Clone, PartialEq)]
pub struct FitAgreedContext {
    pub strain: String,
    pub confidence: ConfidenceLevel,
}

/// A public constraint from partner's prior bidding.
#[derive(Debug, Clone, PartialEq)]
pub struct PublicConstraint {
    pub subject: String,
    pub constraint: PublicFactConstraint,
}

/// A fact constraint within a public commitment.
#[derive(Debug, Clone, PartialEq)]
pub struct PublicFactConstraint {
    pub fact_id: String,
    pub operator: FactOperator,
    pub value: ConstraintValue,
}

// --- Helper constructors ---

/// Create a FactValue with a numeric value.
pub fn fv_num(fact_id: &str, value: f64) -> FactValue {
    FactValue {
        fact_id: fact_id.to_string(),
        value: FactData::Number(value),
    }
}

/// Create a FactValue with a boolean value.
pub fn fv_bool(fact_id: &str, value: bool) -> FactValue {
    FactValue {
        fact_id: fact_id.to_string(),
        value: FactData::Boolean(value),
    }
}

/// Create a FactValue with a text value.
pub fn fv_text(fact_id: &str, value: &str) -> FactValue {
    FactValue {
        fact_id: fact_id.to_string(),
        value: FactData::Text(value.to_string()),
    }
}

/// Get a numeric fact value from the evaluated facts map.
pub fn get_num(facts: &HashMap<String, FactValue>, fact_id: &str) -> f64 {
    facts
        .get(fact_id)
        .map(|fv| fv.value.as_number())
        .unwrap_or(0.0)
}

/// Get a boolean fact value from the evaluated facts map.
pub fn get_bool(facts: &HashMap<String, FactValue>, fact_id: &str) -> bool {
    facts
        .get(fact_id)
        .map(|fv| fv.value.as_bool())
        .unwrap_or(false)
}
