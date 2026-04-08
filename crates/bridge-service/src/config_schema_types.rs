//! Types for module configuration schema views.

use bridge_conventions::types::module_types::ModuleCategory;
use serde::{Deserialize, Serialize};

/// Full configuration schema for a module — surfaces + parameters.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleConfigSchemaView {
    pub module_id: String,
    pub display_name: String,
    pub category: ModuleCategory,
    pub ownership: ModuleOwnership,
    pub forked_from: Option<String>,
    pub surfaces: Vec<ConfigurableSurfaceView>,
}

/// Whether the module is system-provided or user-created.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ModuleOwnership {
    System,
    User,
}

/// A single configurable surface within a module.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigurableSurfaceView {
    pub meaning_id: String,
    pub name: String,
    pub summary: String,
    pub call_display: String,
    pub disclosure: String,
    pub parameters: Vec<ConfigurableParameter>,
}

/// A single configurable parameter (derived from a clause).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigurableParameter {
    pub clause_index: usize,
    pub fact_id: String,
    pub description: String,
    pub current_value: ParameterValue,
    pub default_value: Option<ParameterValue>,
    pub value_type: ParameterType,
    pub valid_range: Option<ValidRange>,
}

/// Type of a configurable parameter.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ParameterType {
    Integer,
    Boolean,
}

/// Valid range for numeric parameters.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidRange {
    pub min: i32,
    pub max: i32,
}

/// Value of a parameter — integer or boolean.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ParameterValue {
    Integer(i32),
    Boolean(bool),
}

/// Result of validating a user module.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<ValidationError>,
}

/// A single validation error.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationError {
    pub field: String,
    pub message: String,
}
