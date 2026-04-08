//! Teaching types — surface groups for grading and teaching.
//!
//! Mirrors TS types from `conventions/teaching/teaching-types.ts`.
//! Only the data types reachable from ConventionBundle (SurfaceGroup,
//! SurfaceGroupRelationship). Teaching output types (TeachingProjection,
//! etc.) live in `teaching/teaching_types.rs`.

use serde::{Deserialize, Serialize};

/// Discriminator for how members within a group are related.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SurfaceGroupRelationship {
    #[serde(rename = "mutually_exclusive")]
    MutuallyExclusive,
    #[serde(rename = "equivalent_encoding")]
    EquivalentEncoding,
    #[serde(rename = "policy_alternative")]
    PolicyAlternative,
}

/// Declares that multiple meaning surfaces belong to the same conceptual family.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SurfaceGroup {
    pub id: String,
    pub label: String,
    pub members: Vec<String>,
    pub relationship: SurfaceGroupRelationship,
    pub description: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn surface_group_relationship_serde() {
        assert_eq!(
            serde_json::to_string(&SurfaceGroupRelationship::MutuallyExclusive).unwrap(),
            "\"mutually_exclusive\""
        );
        assert_eq!(
            serde_json::to_string(&SurfaceGroupRelationship::PolicyAlternative).unwrap(),
            "\"policy_alternative\""
        );
    }

    #[test]
    fn surface_group_roundtrip() {
        let group = SurfaceGroup {
            id: "stayman-responses".to_string(),
            label: "Stayman Responses".to_string(),
            members: vec![
                "show-hearts".to_string(),
                "show-spades".to_string(),
                "deny-major".to_string(),
            ],
            relationship: SurfaceGroupRelationship::MutuallyExclusive,
            description: "Opener's responses to Stayman 2C".to_string(),
        };
        let json = serde_json::to_string(&group).unwrap();
        let back: SurfaceGroup = serde_json::from_str(&json).unwrap();
        assert_eq!(back, group);
    }
}
