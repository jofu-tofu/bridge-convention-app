//! Service-layer response DTOs that wrap bridge-session viewport types
//! with additional metadata for the UI/WASM boundary.

use bridge_conventions::types::meaning::FactConstraint;
use bridge_engine::strategy::ChainTrace;
use bridge_engine::types::{Call, Seat, Suit};
use bridge_session::inference::types::{
    BidAnnotation, DerivedRanges, DescriptiveConstraint, NumberRange, PublicBeliefState,
    PublicBeliefs,
};
use bridge_session::session::{
    AiBidEntry, AiPlayEntry, BidGrade, BidHistoryEntryView, BiddingViewport, DebugLogEntry,
};
use bridge_session::types::{GamePhase, PlayPreference, PracticeMode};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ── Drill start ───────────────────────────────────────────────────

/// Result from starting a drill.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DrillStartResult {
    pub viewport: BiddingViewport,
    pub is_off_convention: bool,
    pub ai_bids: Vec<AiBidEntryDTO>,
    pub auction_complete: bool,
    pub phase: GamePhase,
    pub practice_mode: PracticeMode,
    pub play_preference: PlayPreference,
}

// ── Bid submission ────────────────────────────────────────────────

/// Result from submitting a bid.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BidSubmitResult {
    pub accepted: bool,
    pub grade: Option<BidGrade>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub feedback: Option<ViewportBidFeedbackDTO>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub teaching: Option<TeachingDetailDTO>,
    pub ai_bids: Vec<AiBidEntryDTO>,
    pub next_viewport: Option<BiddingViewport>,
    pub phase_transition: Option<PhaseTransition>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_history_entry: Option<BidHistoryEntryView>,
}

/// Phase transition notification.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhaseTransition {
    pub from: GamePhase,
    pub to: GamePhase,
}

// ── Play entry ───────────────────────────────────────────────────

/// Result from entering or restarting the play phase.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayEntryResult {
    pub phase: GamePhase,
    pub ai_plays: Option<Vec<AiPlayEntryDTO>>,
}

// ── DDS ───────────────────────────────────────────────────────────

/// DDS solution result.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DDSolutionResult {
    pub solution: Option<serde_json::Value>,
    pub error: Option<String>,
}

// ── Catalog ───────────────────────────────────────────────────────

/// Convention info for catalog listing.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConventionInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub module_ids: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub module_descriptions: Option<std::collections::HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub teaching: Option<bridge_conventions::types::bundle_types::ConventionTeaching>,
}

// ── Inference ─────────────────────────────────────────────────────

/// Public belief state — typed DTO mirroring TS ServicePublicBeliefState.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServicePublicBeliefState {
    pub beliefs: HashMap<Seat, ServicePublicBeliefsDTO>,
    pub annotations: Vec<ServiceBidAnnotationDTO>,
}

/// Per-seat public beliefs DTO.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServicePublicBeliefsDTO {
    pub seat: Seat,
    pub constraints: Vec<ServiceFactConstraintDTO>,
    pub ranges: ServiceDerivedRangesDTO,
    pub qualitative: Vec<ServiceDescriptiveConstraintDTO>,
}

/// Fact constraint DTO.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceFactConstraintDTO {
    pub fact_id: String,
    pub operator: String,
    pub value: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_public: Option<bool>,
}

/// Derived ranges DTO.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceDerivedRangesDTO {
    pub hcp: NumberRangeDTO,
    pub suit_lengths: HashMap<Suit, NumberRangeDTO>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_balanced: Option<bool>,
}

/// Number range DTO.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NumberRangeDTO {
    pub min: u32,
    pub max: u32,
}

/// Descriptive constraint DTO.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceDescriptiveConstraintDTO {
    pub fact_id: String,
    pub label: String,
    pub operator: String,
    pub value: serde_json::Value,
}

/// Bid annotation DTO.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceBidAnnotationDTO {
    pub call: Call,
    pub seat: Seat,
    pub convention_id: Option<String>,
    pub meaning: String,
    pub constraints: Vec<ServiceFactConstraintDTO>,
}

impl From<&FactConstraint> for ServiceFactConstraintDTO {
    fn from(fc: &FactConstraint) -> Self {
        Self {
            fact_id: fc.fact_id.clone(),
            operator: serde_json::to_value(&fc.operator)
                .ok()
                .and_then(|v| v.as_str().map(String::from))
                .unwrap_or_else(|| format!("{:?}", fc.operator)),
            value: serde_json::to_value(&fc.value).unwrap_or(serde_json::Value::Null),
            is_public: fc.is_public,
        }
    }
}

impl From<&NumberRange> for NumberRangeDTO {
    fn from(r: &NumberRange) -> Self {
        Self {
            min: r.min,
            max: r.max,
        }
    }
}

impl From<&DerivedRanges> for ServiceDerivedRangesDTO {
    fn from(dr: &DerivedRanges) -> Self {
        Self {
            hcp: NumberRangeDTO::from(&dr.hcp),
            suit_lengths: dr
                .suit_lengths
                .iter()
                .map(|(s, r)| (*s, NumberRangeDTO::from(r)))
                .collect(),
            is_balanced: dr.is_balanced,
        }
    }
}

impl From<&DescriptiveConstraint> for ServiceDescriptiveConstraintDTO {
    fn from(qc: &DescriptiveConstraint) -> Self {
        Self {
            fact_id: qc.fact_id.clone(),
            label: qc.label.clone(),
            operator: qc.operator.clone(),
            value: qc.value.clone(),
        }
    }
}

impl From<&PublicBeliefs> for ServicePublicBeliefsDTO {
    fn from(pb: &PublicBeliefs) -> Self {
        Self {
            seat: pb.seat,
            constraints: pb
                .constraints
                .iter()
                .map(ServiceFactConstraintDTO::from)
                .collect(),
            ranges: ServiceDerivedRangesDTO::from(&pb.ranges),
            qualitative: pb
                .qualitative
                .iter()
                .map(ServiceDescriptiveConstraintDTO::from)
                .collect(),
        }
    }
}

impl From<&BidAnnotation> for ServiceBidAnnotationDTO {
    fn from(ba: &BidAnnotation) -> Self {
        Self {
            call: ba.call.clone(),
            seat: ba.seat,
            convention_id: ba.convention_id.clone(),
            meaning: ba.meaning.clone(),
            constraints: ba
                .constraints
                .iter()
                .map(ServiceFactConstraintDTO::from)
                .collect(),
        }
    }
}

impl From<&PublicBeliefState> for ServicePublicBeliefState {
    fn from(pbs: &PublicBeliefState) -> Self {
        Self {
            beliefs: pbs
                .beliefs
                .iter()
                .map(|(s, b)| (*s, ServicePublicBeliefsDTO::from(b)))
                .collect(),
            annotations: pbs
                .annotations
                .iter()
                .map(ServiceBidAnnotationDTO::from)
                .collect(),
        }
    }
}

// ── DTO wrappers for session types lacking Serialize ──────────────

/// Serializable DTO wrapper for AiBidEntry.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiBidEntryDTO {
    pub seat: bridge_engine::types::Seat,
    pub call: bridge_engine::types::Call,
    pub history_entry: BidHistoryEntryView,
}

impl From<AiBidEntry> for AiBidEntryDTO {
    fn from(e: AiBidEntry) -> Self {
        Self {
            seat: e.seat,
            call: e.call,
            history_entry: e.history_entry,
        }
    }
}

/// Serializable DTO wrapper for AiPlayEntry.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiPlayEntryDTO {
    pub seat: bridge_engine::types::Seat,
    pub card: bridge_engine::types::Card,
    pub reason: String,
    pub trick_complete: bool,
}

// ── Viewport bid feedback DTO ─────────────────────────────────────

/// Viewport-safe bid feedback shown to the player after bidding.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewportBidFeedbackDTO {
    pub grade: BidGrade,
    pub user_call: Call,
    pub user_call_display: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correct_call: Option<Call>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correct_call_display: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correct_bid_label: Option<TeachingLabelDTO>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correct_bid_explanation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conditions: Option<Vec<ConditionViewDTO>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub acceptable_alternatives: Option<Vec<AlternativeViewDTO>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub near_misses: Option<Vec<NearMissViewDTO>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub partner_hand_space: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conventions_applied: Option<Vec<ConventionViewDTO>>,
    pub requires_retry: bool,
}

/// Teaching label DTO.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeachingLabelDTO {
    pub name: String,
    pub summary: String,
}

/// Condition view DTO.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConditionViewDTO {
    pub description: String,
    pub passed: bool,
}

/// Alternative view DTO.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlternativeViewDTO {
    pub call: Call,
    pub call_display: String,
    pub label: String,
    pub reason: String,
    pub full_credit: bool,
}

/// Near-miss view DTO.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NearMissViewDTO {
    pub call: Call,
    pub call_display: String,
    pub reason: String,
}

/// Convention view DTO.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConventionViewDTO {
    pub module_id: String,
    pub role: String,
}

// ── Teaching detail DTO ──────────────────────────────────────────

/// Post-bid teaching data derived from the evaluation oracle.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeachingDetailDTO {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hand_summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fallback_explanation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub primary_explanation: Option<Vec<ServiceExplanationNodeDTO>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub why_not: Option<Vec<ServiceWhyNotEntryDTO>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conventions_applied: Option<Vec<ServiceConventionContributionDTO>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meaning_views: Option<Vec<ServiceMeaningViewDTO>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub call_views: Option<Vec<ServiceCallProjectionDTO>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub partner_summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub archetypes: Option<Vec<ArchetypeDTO>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub encoder_kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub practical_recommendation: Option<PracticalRecDTO>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub primary_bid: Option<Call>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub acceptable_bids: Option<Vec<AcceptableBidDTO>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub near_miss_calls: Option<Vec<NearMissCallDTO>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ambiguity_score: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub grading_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub practical_score_breakdown: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub evaluation_exhaustive: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fallback_reached: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parse_tree: Option<ServiceParseTreeViewDTO>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub observation_history: Option<Vec<ObservationStepViewDTO>>,
}

// ── Supporting DTO types ─────────────────────────────────────────

/// Explanation node DTO.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceExplanationNodeDTO {
    pub kind: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub passed: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub explanation_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub template_key: Option<String>,
}

/// Why-not entry DTO.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceWhyNotEntryDTO {
    pub call: Call,
    pub grade: String,
    pub explanation: Vec<ServiceExplanationNodeDTO>,
    pub elimination_stage: String,
    pub module_id: String,
    pub meaning_label: String,
}

/// Convention contribution DTO.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceConventionContributionDTO {
    pub module_id: String,
    pub role: String,
    pub meanings_proposed: Vec<String>,
}

/// Meaning view DTO.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceMeaningViewDTO {
    pub meaning_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub semantic_class_id: Option<String>,
    pub display_label: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub elimination_reason: Option<String>,
    pub supporting_evidence: Vec<serde_json::Value>,
}

/// Call projection DTO.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceCallProjectionDTO {
    pub call: Call,
    pub status: String,
    pub supporting_meanings: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub primary_meaning: Option<String>,
    pub projection_kind: String,
}

/// Parse tree view DTO.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceParseTreeViewDTO {
    pub modules: Vec<ServiceParseTreeModuleNodeDTO>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub selected_path: Option<serde_json::Value>,
}

/// Parse tree module node DTO.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceParseTreeModuleNodeDTO {
    pub module_id: String,
    pub display_label: String,
    pub verdict: String,
    pub conditions: Vec<serde_json::Value>,
    pub meanings: Vec<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub elimination_reason: Option<String>,
}

/// Observation step view DTO.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ObservationStepViewDTO {
    pub actor: Seat,
    pub call: Call,
    pub observations: Vec<ObservationViewDTO>,
    pub kernel: KernelViewDTO,
    pub status: String,
}

/// Observation view DTO.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ObservationViewDTO {
    pub act: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

/// Kernel view DTO.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KernelViewDTO {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fit_agreed: Option<serde_json::Value>,
    pub forcing: String,
    pub captain: String,
    pub competition: serde_json::Value,
}

/// Archetype DTO.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchetypeDTO {
    pub label: String,
    pub hcp_range: serde_json::Value,
    pub shape_pattern: String,
}

/// Practical recommendation DTO.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PracticalRecDTO {
    pub top_candidate_call: Call,
    pub rationale: String,
}

/// Acceptable bid DTO.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcceptableBidDTO {
    pub call: Call,
    pub meaning: String,
    pub reason: String,
    pub full_credit: bool,
}

/// Near-miss call DTO.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NearMissCallDTO {
    pub call: Call,
    pub reason: String,
}

// ── Debug DTOs (DevServicePort) ──────────────────────────────────

/// Debug log entry — typed wrapper with kind/turnIndex/seat + typed fields.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceDebugLogEntryDTO {
    pub kind: String,
    pub turn_index: usize,
    pub seat: Seat,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub call: Option<Call>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expected_call: Option<Call>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expected_explanation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub grade: Option<BidGrade>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trace: Option<ChainTrace>,

    /// Pipeline snapshot serialized as JSON.
    /// Shape matches TS DebugSnapshotBase: StrategyEvaluation fields (camelCase via serde)
    /// plus an injected `expectedBid` field built from the flat expected_call/expected_explanation.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub snapshot: Option<serde_json::Value>,

    /// Bid feedback serialized as JSON (user-bid entries only).
    /// Shape matches TS BidFeedbackDTO: grade, userCall, expectedCall, explanation.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub feedback: Option<serde_json::Value>,
}

impl From<&DebugLogEntry> for ServiceDebugLogEntryDTO {
    fn from(entry: &DebugLogEntry) -> Self {
        let snapshot = entry.evaluation_snapshot.as_ref().and_then(|eval| {
            let mut obj = match serde_json::to_value(eval).ok()? {
                serde_json::Value::Object(m) => m,
                _ => return None,
            };
            // Inject expectedBid to match TS DebugSnapshotBase shape
            let expected_bid = entry.expected_call.as_ref().map(|call| {
                serde_json::json!({
                    "call": call,
                    "explanation": entry.expected_explanation.as_deref().unwrap_or(""),
                    "ruleName": serde_json::Value::Null,
                })
            });
            obj.insert(
                "expectedBid".into(),
                expected_bid.unwrap_or(serde_json::Value::Null),
            );
            Some(serde_json::Value::Object(obj))
        });

        let feedback = entry
            .bid_feedback
            .as_ref()
            .and_then(|fb| serde_json::to_value(fb).ok());

        Self {
            kind: entry.kind.clone(),
            turn_index: entry.turn_index,
            seat: entry.seat,
            call: entry.call.clone(),
            expected_call: entry.expected_call.clone(),
            expected_explanation: entry.expected_explanation.clone(),
            grade: entry.grade,
            trace: entry.trace.clone(),
            snapshot,
            feedback,
        }
    }
}

/// Inference timeline entry — typed wrapper populated from InferenceSnapshot.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InferenceTimelineEntryDTO {
    pub turn_index: usize,
    pub seat: Seat,
    pub call: Call,
    pub new_constraints: Vec<ServiceFactConstraintDTO>,
    pub cumulative_beliefs: HashMap<Seat, ServicePublicBeliefsDTO>,
}

impl From<AiPlayEntry> for AiPlayEntryDTO {
    fn from(e: AiPlayEntry) -> Self {
        Self {
            seat: e.seat,
            card: e.card,
            reason: e.reason,
            trick_complete: e.trick_complete,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn phase_transition_serde_roundtrip() {
        let pt = PhaseTransition {
            from: GamePhase::Bidding,
            to: GamePhase::Explanation,
        };
        let json = serde_json::to_string(&pt).unwrap();
        let rt: PhaseTransition = serde_json::from_str(&json).unwrap();
        assert_eq!(rt.from, GamePhase::Bidding);
        assert_eq!(rt.to, GamePhase::Explanation);
    }

    #[test]
    fn convention_info_serde_roundtrip() {
        let ci = ConventionInfo {
            id: "nt-bundle".to_string(),
            name: "1NT Responses".to_string(),
            description: "Practice responding to 1NT openings".to_string(),
            category: "constructive".to_string(),
            module_ids: vec!["stayman".to_string(), "jacoby-transfers".to_string()],
            module_descriptions: None,
            teaching: None,
        };
        let json = serde_json::to_string(&ci).unwrap();
        let rt: ConventionInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(rt.id, "nt-bundle");
        assert_eq!(rt.module_ids.len(), 2);
    }

    #[test]
    fn service_public_belief_state_serde_roundtrip() {
        let mut suit_lengths = std::collections::HashMap::new();
        suit_lengths.insert(Suit::Spades, NumberRangeDTO { min: 0, max: 13 });
        suit_lengths.insert(Suit::Hearts, NumberRangeDTO { min: 0, max: 13 });
        suit_lengths.insert(Suit::Diamonds, NumberRangeDTO { min: 0, max: 13 });
        suit_lengths.insert(Suit::Clubs, NumberRangeDTO { min: 0, max: 13 });

        let mut beliefs_map = std::collections::HashMap::new();
        beliefs_map.insert(
            Seat::North,
            ServicePublicBeliefsDTO {
                seat: Seat::North,
                constraints: vec![ServiceFactConstraintDTO {
                    fact_id: "hcp".to_string(),
                    operator: "gte".to_string(),
                    value: serde_json::json!(12),
                    is_public: Some(true),
                }],
                ranges: ServiceDerivedRangesDTO {
                    hcp: NumberRangeDTO { min: 12, max: 40 },
                    suit_lengths,
                    is_balanced: None,
                },
                qualitative: Vec::new(),
            },
        );

        let state = ServicePublicBeliefState {
            beliefs: beliefs_map,
            annotations: Vec::new(),
        };
        let json = serde_json::to_string(&state).unwrap();
        let rt: ServicePublicBeliefState = serde_json::from_str(&json).unwrap();
        assert!(json.contains("\"factId\""));
        assert!(json.contains("\"suitLengths\""));
        assert_eq!(rt.beliefs[&Seat::North].ranges.hcp.min, 12);
    }

    #[test]
    fn dds_solution_result_serde_roundtrip() {
        let result = DDSolutionResult {
            solution: Some(serde_json::json!({"tricks": 9})),
            error: None,
        };
        let json = serde_json::to_string(&result).unwrap();
        let rt: DDSolutionResult = serde_json::from_str(&json).unwrap();
        assert!(rt.solution.is_some());
        assert!(rt.error.is_none());
    }

    #[test]
    fn debug_log_entry_dto_serde_roundtrip() {
        let dto = ServiceDebugLogEntryDTO {
            kind: "user-bid".to_string(),
            turn_index: 3,
            seat: Seat::South,
            call: Some(Call::Pass),
            expected_call: Some(Call::Pass),
            expected_explanation: Some("No convention applies".to_string()),
            grade: Some(BidGrade::Correct),
            trace: None,
            snapshot: None,
            feedback: None,
        };
        let json = serde_json::to_string(&dto).unwrap();
        assert!(
            json.contains("\"turnIndex\""),
            "Expected camelCase turnIndex: {}",
            json
        );
        assert!(json.contains("\"user-bid\""));
        let rt: ServiceDebugLogEntryDTO = serde_json::from_str(&json).unwrap();
        assert_eq!(rt.kind, "user-bid");
        assert_eq!(rt.turn_index, 3);
        assert_eq!(rt.seat, Seat::South);
        assert_eq!(rt.grade, Some(BidGrade::Correct));
    }
}
