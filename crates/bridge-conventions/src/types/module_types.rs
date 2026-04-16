//! Convention module types.
//!
//! Mirrors TS types from `conventions/core/convention-module.ts`
//! and `conventions/core/explanation-catalog.ts`.

use bridge_engine::types::Call;
use serde::{Deserialize, Serialize};

use crate::fact_catalog::partition_discriminants;

use super::authored_text::{
    ModuleDescription, ModulePurpose, TeachingItem, TeachingPrinciple, TeachingTradeoff,
};
use super::fact_id::FactId;
use super::fact_types::{FactComposition, FactDefinitionSet};
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

/// Above-the-fold reference summary for a convention module (authored side).
///
/// `bid` / `promises` / `denies` / `guidingIdea` are composed at viewport-build
/// time from the referenced meaning + teaching block, not authored here.
///
/// `peers` is an optional authored list of peer bids for peer-structured
/// conventions (Bergen, Jacoby transfers, DONT, etc.). When present, each peer
/// entry names another defining meaning on the same module plus a short
/// discriminator label. The top-level `defining_meaning_id` must be one of the
/// peers (canonical hero within the peer set). When absent, the reference page
/// renders the traditional hero layout.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleReferenceSummaryCard {
    pub trigger: String,
    pub defining_meaning_id: String,
    pub partnership: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub peers: Vec<AuthoredSummaryCardPeer>,
}

/// One authored peer entry inside `ModuleReferenceSummaryCard.peers`.
///
/// Per-peer bid / promises / denies derive from `defining_meaning_id` + the
/// same public-clause-join pipeline the top-level summary card uses. Authors
/// provide only the meaning-id reference and a short discriminator label.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthoredSummaryCardPeer {
    pub defining_meaning_id: String,
    pub discriminator_label: String,
}

/// Typed bullet for the authored positive-space usage list.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PredicateBullet {
    pub predicate: FactComposition,
    pub gloss: String,
}

/// One call inside an annotated worked auction.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleReferenceWorkedAuctionCall {
    pub seat: String,
    pub call: Call,
    pub rationale: String,
}

/// Worked-auction discriminator. Defaults to `positive` for existing fixtures.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ModuleReferenceWorkedAuctionKind {
    Positive,
    Negative,
}

impl Default for ModuleReferenceWorkedAuctionKind {
    fn default() -> Self {
        Self::Positive
    }
}

/// Compact authored hand sample shown alongside a worked auction.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HandSample {
    pub spades: String,
    pub hearts: String,
    pub diamonds: String,
    pub clubs: String,
}

/// Authored worked auction example.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleReferenceWorkedAuction {
    #[serde(default)]
    pub kind: ModuleReferenceWorkedAuctionKind,
    pub label: String,
    pub calls: Vec<ModuleReferenceWorkedAuctionCall>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub responder_hand: Option<HandSample>,
}

/// Interference guidance row.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleReferenceInterferenceItem {
    pub opponent_action: String,
    pub our_action: String,
    pub note: String,
}

/// Cross-link to a related module plus the discriminator users should see.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleReferenceRelatedLink {
    pub module_id: String,
    pub discriminator: String,
}

/// Interference status — tagged enum. Either a non-empty items list or an
/// explicit `NotApplicable` sentinel with a reason.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum ModuleReferenceInterference {
    Applicable { items: NonEmptyInterferenceItems },
    NotApplicable { reason: String },
}

/// Non-empty list of interference items. Serializes as a flat JSON array of
/// length ≥ 1; deserialize errors on an empty array.
#[derive(Debug, Clone, PartialEq)]
pub struct NonEmptyInterferenceItems {
    pub first: ModuleReferenceInterferenceItem,
    pub rest: Vec<ModuleReferenceInterferenceItem>,
}

impl NonEmptyInterferenceItems {
    pub fn iter(&self) -> impl Iterator<Item = &ModuleReferenceInterferenceItem> {
        std::iter::once(&self.first).chain(self.rest.iter())
    }
}

impl Serialize for NonEmptyInterferenceItems {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeSeq;
        let len = 1 + self.rest.len();
        let mut seq = s.serialize_seq(Some(len))?;
        seq.serialize_element(&self.first)?;
        for item in &self.rest {
            seq.serialize_element(item)?;
        }
        seq.end()
    }
}

impl<'de> Deserialize<'de> for NonEmptyInterferenceItems {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        use serde::de::Error;
        let mut items: Vec<ModuleReferenceInterferenceItem> = Vec::deserialize(d)?;
        if items.is_empty() {
            return Err(D::Error::custom(
                "interference items must be non-empty; use { status: \"notApplicable\", reason } instead",
            ));
        }
        let first = items.remove(0);
        Ok(NonEmptyInterferenceItems { first, rest: items })
    }
}

/// Axis descriptor for a quick-reference grid or list. Tagged.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum QuickReferenceAxis {
    // TODO: replace this transitional multi-fact variant with `ThresholdLadder { fact: FactId }`
    // after the Stayman MVP proves out the typed reference migration.
    SystemFactLadder { label: String, facts: Vec<String> },
    PartitionLadder { label: String, fact: FactId },
}

impl QuickReferenceAxis {
    fn label(&self) -> &str {
        match self {
            QuickReferenceAxis::SystemFactLadder { label, .. }
            | QuickReferenceAxis::PartitionLadder { label, .. } => label,
        }
    }
    fn length(&self) -> usize {
        match self {
            QuickReferenceAxis::SystemFactLadder { facts, .. } => facts.len(),
            QuickReferenceAxis::PartitionLadder { fact, .. } => partition_discriminants(fact)
                .map(|discriminants| discriminants.len())
                .unwrap_or(0),
        }
    }
}

impl<'de> Deserialize<'de> for QuickReferenceAxis {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        use serde::de::Error;

        #[derive(Deserialize)]
        #[serde(tag = "kind", rename_all = "camelCase")]
        enum Raw {
            SystemFactLadder { label: String, facts: Vec<String> },
            PartitionLadder { label: String, fact: FactId },
        }

        let raw = Raw::deserialize(d)?;
        let axis = match raw {
            Raw::SystemFactLadder { label, facts } => {
                QuickReferenceAxis::SystemFactLadder { label, facts }
            }
            Raw::PartitionLadder { label, fact } => {
                QuickReferenceAxis::PartitionLadder { label, fact }
            }
        };
        if axis.label().is_empty() {
            return Err(D::Error::custom(
                "quickReference axis label must be non-empty",
            ));
        }
        if axis.length() < 2 {
            return Err(D::Error::custom(
                "quickReference axis must have ≥ 2 entries",
            ));
        }
        Ok(axis)
    }
}

/// A single recommendation row in a `quickReference` list variant.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickReferenceListItem {
    pub recommendation: String,
    #[serde(default)]
    pub note: String,
}

/// Surface identifier for authored quick-reference bindings.
///
/// Phase 2 uses `meaning_id` as the stable surface id.
pub type SurfaceId = String;

/// Quick-reference grid cell binding.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CellBinding {
    /// Project the module entry surfaces onto this (row, col) point.
    Auto,
    /// Explicit reference to a surface when authored disambiguation is needed.
    Surface { id: SurfaceId },
    /// No entry surface applies at this point.
    NotApplicable { reason: FactComposition },
}

/// Quick-reference content — either a 2-D grid or a flat recommendation list.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ModuleReferenceQuickReference {
    Grid {
        #[serde(rename = "rowAxis")]
        row_axis: QuickReferenceAxis,
        #[serde(rename = "colAxis")]
        col_axis: QuickReferenceAxis,
        cells: Vec<Vec<CellBinding>>,
    },
    List {
        axis: QuickReferenceAxis,
        items: Vec<QuickReferenceListItem>,
    },
}

impl<'de> Deserialize<'de> for ModuleReferenceQuickReference {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        use serde::de::Error;

        #[derive(Deserialize)]
        #[serde(tag = "kind", rename_all = "camelCase")]
        enum Raw {
            Grid {
                #[serde(rename = "rowAxis")]
                row_axis: QuickReferenceAxis,
                #[serde(rename = "colAxis")]
                col_axis: QuickReferenceAxis,
                cells: Vec<Vec<CellBinding>>,
            },
            List {
                axis: QuickReferenceAxis,
                items: Vec<QuickReferenceListItem>,
            },
        }

        match Raw::deserialize(d)? {
            Raw::Grid {
                row_axis,
                col_axis,
                cells,
            } => {
                if cells.len() != row_axis.length() {
                    return Err(D::Error::custom(format!(
                        "quickReference grid cells row count {} != rowAxis length {}",
                        cells.len(),
                        row_axis.length()
                    )));
                }
                for (i, row) in cells.iter().enumerate() {
                    if row.len() != col_axis.length() {
                        return Err(D::Error::custom(format!(
                            "quickReference grid cells[{}] length {} != colAxis length {}",
                            i,
                            row.len(),
                            col_axis.length()
                        )));
                    }
                }
                Ok(ModuleReferenceQuickReference::Grid {
                    row_axis,
                    col_axis,
                    cells,
                })
            }
            Raw::List { axis, items } => Ok(ModuleReferenceQuickReference::List { axis, items }),
        }
    }
}

/// Hand-authored reference content attached to a module fixture.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleReference {
    pub summary_card: ModuleReferenceSummaryCard,
    pub when_to_use: Vec<PredicateBullet>,
    pub worked_auctions: Vec<ModuleReferenceWorkedAuction>,
    pub interference: ModuleReferenceInterference,
    pub quick_reference: ModuleReferenceQuickReference,
    pub related_links: Vec<ModuleReferenceRelatedLink>,
}

/// Author-opted symmetry check between two FSM state ids (phase names).
pub type SymmetricStatePair = (String, String);

/// Which partnership opened, relative to the module's user side.
///
/// `Partner` means "the module's user-side partner opened"; `Opponent` means
/// "an opponent opened." Partnership-scoped, not seat-scoped.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum OpenerRole {
    Partner,
    Opponent,
}

/// Structured trigger context for a convention module.
///
/// Complements the natural-language `ModuleReferenceSummaryCard.trigger` with
/// a machine-groupable tuple. Consumers include future auto-derived
/// `relatedLinks`, structured learn-page trigger rendering, and engine-side
/// module gating.
///
/// `opener_bids` is non-empty: usually one entry (e.g. `[1NT]` for Stayman),
/// but may be a set (e.g. Negative Doubles fires after any of
/// `[1C, 1D, 1H, 1S]`). Deserialization rejects the empty list.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BiddingContext {
    pub opener_bids: Vec<Call>,
    pub opener_role: OpenerRole,
    pub competitive: bool,
}

impl<'de> Deserialize<'de> for BiddingContext {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        use serde::de::Error;

        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct Raw {
            opener_bids: Vec<Call>,
            opener_role: OpenerRole,
            competitive: bool,
        }

        let raw = Raw::deserialize(d)?;
        if raw.opener_bids.is_empty() {
            return Err(D::Error::custom(
                "biddingContext.openerBids must be non-empty",
            ));
        }
        Ok(BiddingContext {
            opener_bids: raw.opener_bids,
            opener_role: raw.opener_role,
            competitive: raw.competitive,
        })
    }
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
    pub reference: ModuleReference,

    /// Structured trigger context. Optional during rollout; will become
    /// required once all module fixtures are backfilled.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bidding_context: Option<BiddingContext>,

    // Declaration
    pub facts: FactDefinitionSet,
    pub explanation_entries: Vec<ExplanationEntry>,

    // Runtime
    pub local: LocalFsm,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub states: Option<Vec<StateEntry>>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub symmetric_pairs: Vec<SymmetricStatePair>,

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
                "No ruffing value, so the major-suit fit adds no trick",
            )],
        };
        let json = serde_json::to_string(&teaching).unwrap();
        let back: ModuleTeaching = serde_json::from_str(&json).unwrap();
        assert_eq!(back, teaching);
    }

    #[test]
    fn stayman_fixture_deserializes_with_reference_block() {
        let json = include_str!("../../fixtures/modules/stayman.json");
        let module: ConventionModule = serde_json::from_str(json).unwrap();
        let reference = &module.reference;

        assert_eq!(
            reference.summary_card.trigger,
            "Partner opens one notrump, you respond"
        );
        assert_eq!(
            reference.summary_card.defining_meaning_id,
            "stayman:ask-major"
        );
        assert!(!reference.summary_card.partnership.is_empty());

        assert!(
            reference.when_to_use.len() >= 2,
            "expected >=2 when_to_use items, got {}",
            reference.when_to_use.len()
        );

        assert!(
            reference.worked_auctions.len() >= 4,
            "expected >=4 worked auctions"
        );
        assert!(
            reference
                .when_to_use
                .iter()
                .all(|item| !item.gloss.is_empty()),
            "when_to_use glosses must be non-empty"
        );
        for auction in &reference.worked_auctions {
            assert!(auction.calls.len() >= 2, "worked auction needs >=2 calls");
            for call in &auction.calls {
                assert!(!call.rationale.is_empty());
            }
        }
        assert!(
            reference
                .worked_auctions
                .iter()
                .any(|auction| matches!(auction.kind, ModuleReferenceWorkedAuctionKind::Negative)),
            "expected at least one negative worked auction"
        );
        assert!(
            reference
                .worked_auctions
                .iter()
                .any(|auction| auction.responder_hand.is_some()),
            "expected a worked auction with responder_hand sample"
        );

        match &reference.interference {
            ModuleReferenceInterference::Applicable { items } => {
                // NonEmptyInterferenceItems already guarantees >=1 at deserialize time.
                let count = items.iter().count();
                assert!(count >= 1);
                assert!(
                    count >= 3,
                    "stayman interference lists doubles + two tiers of overcalls"
                );
            }
            ModuleReferenceInterference::NotApplicable { .. } => {
                panic!("stayman interference should be applicable");
            }
        }

        match &reference.quick_reference {
            ModuleReferenceQuickReference::Grid {
                row_axis,
                col_axis,
                cells,
            } => {
                assert!(matches!(
                    row_axis,
                    QuickReferenceAxis::SystemFactLadder { .. }
                ));
                assert!(matches!(
                    col_axis,
                    QuickReferenceAxis::PartitionLadder { .. }
                ));
                assert_eq!(cells.len(), 3);
                for row in cells {
                    assert_eq!(row.len(), 4);
                }
                assert!(matches!(cells[0][0], CellBinding::NotApplicable { .. }));
                assert!(matches!(cells[1][1], CellBinding::Auto));
                assert!(matches!(cells[2][2], CellBinding::Surface { .. }));
            }
            ModuleReferenceQuickReference::List { .. } => {
                panic!("stayman quick_reference should be a grid");
            }
        }

        assert!(!reference.related_links.is_empty());
        for link in &reference.related_links {
            assert!(!link.discriminator.is_empty());
        }

        assert!(
            module.teaching.common_mistakes.len() >= 3,
            "stayman teaching.common_mistakes must have >=3 entries with reasons"
        );
        for mistake in &module.teaching.common_mistakes {
            assert!(!mistake.text.is_empty());
            assert!(!mistake.reason.is_empty());
        }
    }
}
