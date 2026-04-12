//! Convention module types.
//!
//! Mirrors TS types from `conventions/core/convention-module.ts`
//! and `conventions/core/explanation-catalog.ts`.

use std::collections::BTreeMap;

use bridge_engine::types::Call;
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

/// Above-the-fold reference summary for a convention module.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleReferenceSummaryCard {
    pub trigger: String,
    pub bid: Call,
    pub promises: String,
    pub denies: String,
    pub guiding_idea: String,
    pub partnership: String,
}

/// "When not to use" item with a reason shown inline.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleReferenceWhenNotItem {
    pub text: String,
    pub reason: String,
}

/// One call inside an annotated worked auction.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleReferenceWorkedAuctionCall {
    pub seat: String,
    pub call: Call,
    pub rationale: String,
}

/// Authored worked auction example.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleReferenceWorkedAuction {
    pub label: String,
    pub calls: Vec<ModuleReferenceWorkedAuctionCall>,
    pub outcome_note: String,
}

/// Interference guidance row.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleReferenceInterferenceItem {
    pub opponent_action: String,
    pub our_action: String,
    pub note: String,
}

/// Optional 2-D decision grid for quick-reference classification.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleReferenceDecisionGrid {
    pub rows: Vec<String>,
    pub cols: Vec<String>,
    pub cells: Vec<Vec<String>>,
}

/// Compatibility note across supported bidding systems.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleReferenceSystemCompat {
    pub sayc: String,
    pub two_over_one: String,
    pub acol: String,
    pub custom_note: String,
}

/// Cross-link to a related module plus the discriminator users should see.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleReferenceRelatedLink {
    pub module_id: String,
    pub discriminator: String,
}

/// Optional authored override for a derived response-table cell.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleReferenceResponseTableOverride {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shape: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hcp: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub forcing: Option<String>,
}

/// Hand-authored reference content attached to a module fixture.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleReference {
    pub summary_card: ModuleReferenceSummaryCard,
    pub when_to_use: Vec<String>,
    pub when_not_to_use: Vec<ModuleReferenceWhenNotItem>,
    pub worked_auctions: Vec<ModuleReferenceWorkedAuction>,
    pub interference: Vec<ModuleReferenceInterferenceItem>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub decision_grid: Option<ModuleReferenceDecisionGrid>,
    pub system_compat: ModuleReferenceSystemCompat,
    pub related_links: Vec<ModuleReferenceRelatedLink>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub response_table_overrides: BTreeMap<String, ModuleReferenceResponseTableOverride>,
}

/// A self-contained convention module.
/// Phase generic is always String at runtime (TS generic is compile-time only).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConventionModule {
    pub module_id: String,
    pub display_name: String,
    pub category: ModuleCategory,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variant_of: Option<String>,
    pub description: ModuleDescription,
    pub purpose: ModulePurpose,
    pub teaching: ModuleTeaching,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reference: Option<ModuleReference>,

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
            common_mistakes: vec![TeachingItem::new("Don't use Stayman with 4-3-3-3 shape")],
        };
        let json = serde_json::to_string(&teaching).unwrap();
        let back: ModuleTeaching = serde_json::from_str(&json).unwrap();
        assert_eq!(back, teaching);
    }

    #[test]
    fn stayman_fixture_deserializes_with_reference_block() {
        let json = include_str!("../../fixtures/modules/stayman.json");
        let back: ConventionModule = serde_json::from_str(json).unwrap();
        let reference = back
            .reference
            .expect("stayman fixture should have reference");

        assert_eq!(
            reference.summary_card.trigger,
            "Partner opens 1NT, you respond"
        );
        assert_eq!(reference.when_not_to_use.len(), 5);
        assert!(reference.response_table_overrides.is_empty());
    }
}
