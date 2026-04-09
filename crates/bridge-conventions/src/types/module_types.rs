//! Convention module types.
//!
//! Mirrors TS types from `conventions/core/convention-module.ts`
//! and `conventions/core/explanation-catalog.ts`.

use serde::{Deserialize, Serialize};

use super::authored_text::{
    ModuleDescription, ModulePurpose, TeachingItem, TeachingPrinciple, TeachingTradeoff,
};
use super::fact_types::FactDefinitionSet;
use super::rule_types::{LocalFsm, StateEntry};

/// Role an explanation plays in a given context.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ExplanationRole {
    Supporting,
    Blocking,
    Inferential,
    Pedagogical,
}

/// Explanation level preference.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ExplanationLevel {
    Semantic,
    Mechanical,
}

/// Explains a fact (from fact catalog).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FactExplanationEntry {
    pub explanation_id: String,
    pub template_key: String,
    pub display_text: String,
    pub preferred_level: ExplanationLevel,
    pub roles: Vec<ExplanationRole>,
    pub fact_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contrastive_template_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contrastive_display_text: Option<String>,
}

/// Explains a meaning (from meaning vocabulary).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeaningExplanationEntry {
    pub explanation_id: String,
    pub template_key: String,
    pub display_text: String,
    pub preferred_level: ExplanationLevel,
    pub roles: Vec<ExplanationRole>,
    pub meaning_id: String,
}

/// A single explanation entry — either fact-linked or meaning-linked.
/// Discriminated by presence of `factId` vs `meaningId`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ExplanationEntry {
    Fact(FactExplanationEntry),
    Meaning(MeaningExplanationEntry),
}

/// Category for UI grouping of convention modules.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ModuleCategory {
    OpeningBids,
    NotrumpResponses,
    MajorRaises,
    WeakBids,
    Competitive,
    Constructive,
    Slam,
    Custom,
}

/// Teaching content orthogonal to module structure.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleTeaching {
    pub tradeoff: TeachingTradeoff,
    pub principle: TeachingPrinciple,
    pub common_mistakes: Vec<TeachingItem>,
}

/// A self-contained convention module.
/// Phase generic is always String at runtime (TS generic is compile-time only).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConventionModule {
    pub module_id: String,
    pub display_name: String,
    pub category: ModuleCategory,
    #[serde(default)]
    pub fixture_version: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variant_of: Option<String>,
    pub description: ModuleDescription,
    pub purpose: ModulePurpose,
    pub teaching: ModuleTeaching,

    // Declaration
    pub facts: FactDefinitionSet,
    pub explanation_entries: Vec<ExplanationEntry>,

    // Runtime
    pub local: LocalFsm,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub states: Option<Vec<StateEntry>>,

    // Host-attachment activation (optional)
    /// When non-empty, this module only activates when attachment conditions are met.
    /// Empty vec means always active (default behavior for existing modules).
    /// Used for Negative Doubles, Fourth Suit Forcing, Drury — conventions
    /// that activate in response to specific auction patterns or states.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<super::agreement::Attachment>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn explanation_role_serde() {
        assert_eq!(
            serde_json::to_string(&ExplanationRole::Supporting).unwrap(),
            "\"supporting\""
        );
        assert_eq!(
            serde_json::to_string(&ExplanationRole::Pedagogical).unwrap(),
            "\"pedagogical\""
        );
    }

    #[test]
    fn fact_explanation_entry_roundtrip() {
        let entry = FactExplanationEntry {
            explanation_id: "stayman.eligible".to_string(),
            template_key: "stayman.eligible.template".to_string(),
            display_text: "You have a 4-card major".to_string(),
            preferred_level: ExplanationLevel::Semantic,
            roles: vec![ExplanationRole::Supporting],
            fact_id: "module.stayman.eligible".to_string(),
            contrastive_template_key: None,
            contrastive_display_text: None,
        };
        let json = serde_json::to_string(&entry).unwrap();
        let back: FactExplanationEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(back, entry);
    }

    #[test]
    fn module_teaching_roundtrip() {
        let teaching = ModuleTeaching {
            tradeoff: TeachingTradeoff::new("Using 2C as Stayman means you can't play in 2C"),
            principle: TeachingPrinciple::new("Ask before telling — gather information first"),
            common_mistakes: vec![TeachingItem::new(
                "Don't use Stayman with 4-3-3-3 shape",
            )],
        };
        let json = serde_json::to_string(&teaching).unwrap();
        let back: ModuleTeaching = serde_json::from_str(&json).unwrap();
        assert_eq!(back, teaching);
    }
}
