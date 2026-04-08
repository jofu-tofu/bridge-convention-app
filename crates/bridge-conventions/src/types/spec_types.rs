//! Convention spec types.
//!
//! Mirrors TS types from `conventions/core/protocol/types.ts`.

use serde::{Deserialize, Serialize};

use super::module_types::ConventionModule;
use super::system_config::SystemConfig;

/// A fully composed convention specification.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConventionSpec {
    pub id: String,
    pub name: String,
    pub modules: Vec<ConventionModule>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_config: Option<SystemConfig>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn convention_spec_minimal_roundtrip() {
        let spec = ConventionSpec {
            id: "test-spec".to_string(),
            name: "Test Convention".to_string(),
            modules: vec![],
            system_config: None,
        };
        let json = serde_json::to_string(&spec).unwrap();
        let back: ConventionSpec = serde_json::from_str(&json).unwrap();
        assert_eq!(back, spec);
    }
}
