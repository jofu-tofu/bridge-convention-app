//! Convention bundle types.
//!
//! Mirrors TS types from `conventions/core/bundle/bundle-types.ts`
//! and `conventions/core/convention-types.ts`.

use bridge_engine::types::{DealConstraints, Seat};
use serde::{Deserialize, Serialize};

use super::agreement::SystemProfile;
use super::module_types::ConventionModule;
use super::teaching::SurfaceGroup;

/// Convention category for UI grouping.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ConventionCategory {
    Asking,
    Defensive,
    Constructive,
    Competitive,
}

/// Convention-level teaching metadata.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConventionTeaching {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub purpose: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub when_to_use: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub when_not_to_use: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tradeoff: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub principle: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub roles: Option<String>,
}

/// What convention authors hand-write when defining a bundle.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BundleInput {
    pub id: String,
    pub name: String,
    pub member_ids: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub internal: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_profile: Option<SystemProfile>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub declared_capabilities: Option<std::collections::HashMap<String, String>>,
    pub category: ConventionCategory,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub teaching: Option<ConventionTeaching>,
}

/// Teaching/grading metadata derived from module content at bundle build time.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DerivedTeachingContent {
    pub surface_groups: Vec<SurfaceGroup>,
}

/// Complete convention bundle: authored input + derived constraints + derived teaching.
/// Function fields (defaultAuction) are omitted — data only.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConventionBundle {
    // BundleInput fields
    pub id: String,
    pub name: String,
    pub member_ids: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub internal: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_profile: Option<SystemProfile>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub declared_capabilities: Option<std::collections::HashMap<String, String>>,
    pub category: ConventionCategory,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub teaching: Option<ConventionTeaching>,

    // Derived fields — populated at runtime from module registry, not in fixture JSON
    #[serde(default)]
    pub modules: Vec<ConventionModule>,
    pub derived_teaching: DerivedTeachingContent,
    pub deal_constraints: DealConstraints,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub off_convention_constraints: Option<DealConstraints>,
    // defaultAuction omitted — function field
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allowed_dealers: Option<Vec<Seat>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_role_selection: Option<bool>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn convention_category_serde() {
        assert_eq!(
            serde_json::to_string(&ConventionCategory::Asking).unwrap(),
            "\"Asking\""
        );
        assert_eq!(
            serde_json::to_string(&ConventionCategory::Defensive).unwrap(),
            "\"Defensive\""
        );
    }

    #[test]
    fn convention_teaching_roundtrip() {
        let teaching = ConventionTeaching {
            purpose: Some("Find a 4-4 major fit".to_string()),
            when_to_use: Some("After partner opens 1NT".to_string()),
            when_not_to_use: Some(vec!["With 4-3-3-3 shape".to_string()]),
            tradeoff: Some("Can't play in 2C".to_string()),
            principle: None,
            roles: None,
        };
        let json = serde_json::to_string(&teaching).unwrap();
        let back: ConventionTeaching = serde_json::from_str(&json).unwrap();
        assert_eq!(back, teaching);
    }
}
