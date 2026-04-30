//! Agreement module types — system profiles, module entries, attachments.
//!
//! Mirrors TS types from `conventions/core/agreement-module.ts`.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::system_config::SystemConfig;

/// Auction pattern for attachment matching.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum AuctionPattern {
    #[serde(rename = "sequence")]
    Sequence { calls: Vec<String> },
    #[serde(rename = "contains")]
    Contains {
        call: String,
        #[serde(skip_serializing_if = "Option::is_none", rename = "byRole")]
        by_role: Option<String>,
    },
    #[serde(rename = "by-role")]
    ByRole {
        role: String,
        #[serde(rename = "lastCall")]
        last_call: String,
    },
}

/// Guard value for PublicGuard — typed from `unknown`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum GuardValue {
    Scalar(String),
    List(Vec<String>),
}

/// Public snapshot guard predicate.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PublicGuard {
    pub field: String,
    pub operator: GuardOperator,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<GuardValue>,
}

/// Guard operator.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum GuardOperator {
    #[serde(rename = "eq")]
    Eq,
    #[serde(rename = "neq")]
    Neq,
    #[serde(rename = "in")]
    In,
    #[serde(rename = "exists")]
    Exists,
}

/// Module classification.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ModuleKind {
    #[serde(rename = "base-system")]
    BaseSystem,
    #[serde(rename = "add-on")]
    AddOn,
}

/// Attachment contract for module activation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub when_auction: Option<AuctionPattern>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub when_public: Option<PublicGuard>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub requires_capabilities: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub requires_visible_meanings: Option<Vec<String>>,
}

/// A module entry in a system profile.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleEntry {
    pub module_id: String,
    pub kind: ModuleKind,
    pub attachments: Vec<Attachment>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<HashMap<String, serde_json::Value>>,
}

/// System profile — declares modules and their activation rules.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemProfile {
    pub profile_id: String,
    pub base_system: super::system_config::BaseSystemId,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_config: Option<SystemConfig>,
    pub modules: Vec<ModuleEntry>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn auction_pattern_sequence_roundtrip() {
        let pat = AuctionPattern::Sequence {
            calls: vec!["1NT".to_string(), "P".to_string()],
        };
        let json = serde_json::to_string(&pat).unwrap();
        let back: AuctionPattern = serde_json::from_str(&json).unwrap();
        assert_eq!(back, pat);
    }

    #[test]
    fn auction_pattern_by_role_roundtrip() {
        let pat = AuctionPattern::ByRole {
            role: "opener".to_string(),
            last_call: "1NT".to_string(),
        };
        let json = serde_json::to_string(&pat).unwrap();
        assert!(json.contains("\"lastCall\""));
        let back: AuctionPattern = serde_json::from_str(&json).unwrap();
        assert_eq!(back, pat);
    }

    #[test]
    fn public_guard_roundtrip() {
        let guard = PublicGuard {
            field: "forcingState".to_string(),
            operator: GuardOperator::Eq,
            value: Some(GuardValue::Scalar("game-forcing".to_string())),
        };
        let json = serde_json::to_string(&guard).unwrap();
        let back: PublicGuard = serde_json::from_str(&json).unwrap();
        assert_eq!(back, guard);
    }

    #[test]
    fn module_kind_serde() {
        assert_eq!(
            serde_json::to_string(&ModuleKind::BaseSystem).unwrap(),
            "\"base-system\""
        );
        assert_eq!(
            serde_json::to_string(&ModuleKind::AddOn).unwrap(),
            "\"add-on\""
        );
    }

    #[test]
    fn system_profile_roundtrip() {
        let profile = SystemProfile {
            profile_id: "test-profile".to_string(),
            base_system: super::super::system_config::BaseSystemId::Sayc,
            system_config: None,
            modules: vec![ModuleEntry {
                module_id: "stayman".to_string(),
                kind: ModuleKind::AddOn,
                attachments: vec![Attachment {
                    when_auction: None,
                    when_public: None,
                    requires_capabilities: Some(vec!["opening-1nt".to_string()]),
                    requires_visible_meanings: None,
                }],
                options: None,
            }],
        };
        let json = serde_json::to_string(&profile).unwrap();
        let back: SystemProfile = serde_json::from_str(&json).unwrap();
        assert_eq!(back, profile);
    }
}
