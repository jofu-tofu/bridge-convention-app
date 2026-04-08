//! Meaning arbitrator — tiered selection producing PipelineResult.
//!
//! Mirrors TS from `pipeline/evaluation/meaning-arbitrator.ts`.

use std::collections::{BTreeMap, HashSet};

use bridge_engine::types::Call;
use serde::Serialize;

use crate::pipeline::evaluation::arbitration_helpers::{classify_into_sets, evaluate_proposal};
use crate::pipeline::evaluation::provenance::{
    ApplicabilityEvidence, ArbitrationTrace, HandoffTrace,
};
use crate::pipeline::evaluation::types::{compare_ranking, MeaningClause, MeaningProposal};
use crate::pipeline::evidence_bundle::{
    AlternativeEvidence, AlternativeRanking, ConditionEvidence, EvidenceBundle, MatchedEvidence,
    RejectionEvidence,
};
use crate::pipeline::types::{PipelineCarrier, PipelineResult};

/// Arbitrate meanings — main entry point.
///
/// Gates → classify → sort → deduplicate → select.
pub fn arbitrate_meanings(
    proposals: &[MeaningProposal],
    is_legal: &dyn Fn(&Call) -> bool,
) -> PipelineResult {
    if proposals.is_empty() {
        return PipelineResult::empty();
    }

    // Step 1: Evaluate all proposals through gates
    let carriers: Vec<PipelineCarrier> = proposals
        .iter()
        .map(|p| evaluate_proposal(p, is_legal))
        .collect();

    // Step 2: Classify into truth and acceptable sets
    let (mut truth_set, acceptable_set) = classify_into_sets(&carriers);

    // Step 3: Sort truth set by ranking
    truth_set
        .sort_by(|a, b| compare_ranking(&a.encoded.proposal.ranking, &b.encoded.proposal.ranking));

    // Step 4: Deduplicate by semantic class, then by content fingerprint.
    // Semantic class catches author-declared equivalences; content dedup
    // catches identical surfaces from different modules that happen to
    // share the same meaning (e.g., Jacoby Transfers and Four-Way Transfers
    // both defining 2D→H).
    let deduped = deduplicate_by_semantic_class(&truth_set);
    let deduped = deduplicate_by_content(&deduped);

    // Step 5: Select winner (first in sorted, deduplicated truth set)
    let selected = deduped.first().cloned();

    // Step 6: Identify eliminated carriers
    let truth_ids: HashSet<&str> = truth_set
        .iter()
        .map(|c| c.encoded.proposal.meaning_id.as_str())
        .collect();
    let eliminated: Vec<PipelineCarrier> = carriers
        .iter()
        .filter(|c| !truth_ids.contains(c.encoded.proposal.meaning_id.as_str()))
        .cloned()
        .collect();

    // Build arbitration traces
    let arbitration: Vec<ArbitrationTrace> = carriers
        .iter()
        .map(|c| {
            let outcome = if selected.as_ref().map(|s| &s.encoded.proposal.meaning_id)
                == Some(&c.encoded.proposal.meaning_id)
            {
                "selected"
            } else if truth_ids.contains(c.encoded.proposal.meaning_id.as_str()) {
                "truth-set"
            } else {
                "eliminated"
            };
            ArbitrationTrace {
                meaning_id: c.encoded.proposal.meaning_id.clone(),
                module_id: c.encoded.proposal.module_id.clone(),
                outcome: outcome.into(),
                reason: c.traces.elimination.as_ref().map(|e| e.reason.clone()),
            }
        })
        .collect();

    // Build handoff traces from selected carrier's negotiation delta
    let handoffs: Vec<HandoffTrace> = Vec::new(); // Populated by adapter layer

    let matched_count = truth_set.len();
    let eliminated_count = eliminated.len();

    // Build evidence bundle from carriers
    let evidence_bundle = build_evidence_bundle(&selected, &truth_set, &eliminated);

    PipelineResult {
        selected,
        truth_set,
        acceptable_set,
        recommended: deduped,
        eliminated,
        applicability: ApplicabilityEvidence {
            total_surfaces: proposals.len(),
            matched_count,
            eliminated_count,
        },
        activation: Vec::new(), // Populated by observation layer
        arbitration,
        handoffs,
        evidence_bundle: Some(evidence_bundle),
    }
}

/// Build an EvidenceBundle from the arbitration results.
fn build_evidence_bundle(
    selected: &Option<PipelineCarrier>,
    truth_set: &[PipelineCarrier],
    eliminated: &[PipelineCarrier],
) -> EvidenceBundle {
    // Matched: selected carrier's satisfied conditions
    let matched = selected.as_ref().map(|carrier| {
        let conditions = carrier
            .proposal()
            .clauses
            .iter()
            .filter(|c| c.satisfied)
            .map(|c| clause_to_condition_evidence(c, true))
            .collect();
        MatchedEvidence {
            meaning_id: carrier.proposal().meaning_id.clone(),
            satisfied_conditions: conditions,
        }
    });

    // Rejected: eliminated carriers' failed conditions
    let rejected: Vec<RejectionEvidence> = eliminated
        .iter()
        .map(|carrier| {
            let failed = carrier
                .proposal()
                .clauses
                .iter()
                .filter(|c| !c.satisfied)
                .map(|c| clause_to_condition_evidence(c, false))
                .collect();
            RejectionEvidence {
                meaning_id: carrier.proposal().meaning_id.clone(),
                failed_conditions: failed,
                module_id: carrier.proposal().module_id.clone(),
                negatable_failures: None,
            }
        })
        .collect();

    // Alternatives: truth set entries that weren't selected
    let selected_id = selected.as_ref().map(|c| c.proposal().meaning_id.as_str());
    let alternatives: Vec<AlternativeEvidence> = truth_set
        .iter()
        .filter(|c| Some(c.proposal().meaning_id.as_str()) != selected_id)
        .map(|carrier| {
            let p = carrier.proposal();
            AlternativeEvidence {
                meaning_id: p.meaning_id.clone(),
                call: format!("{:?}", carrier.call()),
                ranking: AlternativeRanking {
                    band: format!("{:?}", p.ranking.recommendation_band),
                    specificity: p.ranking.specificity,
                },
                reason: "Alternative in truth set".to_string(),
                condition_delta: None,
            }
        })
        .collect();

    EvidenceBundle {
        matched,
        rejected,
        alternatives,
        exhaustive: true,
        fallback_reached: selected.is_none(),
    }
}

fn clause_to_condition_evidence(clause: &MeaningClause, satisfied: bool) -> ConditionEvidence {
    ConditionEvidence {
        condition_id: clause
            .clause_id
            .clone()
            .unwrap_or_else(|| clause.fact_id.clone()),
        fact_id: Some(clause.fact_id.clone()),
        satisfied,
        description: clause.description.clone(),
        observed_value: clause.observed_value.clone(),
        threshold: None,
        params: None,
    }
}

/// Deduplicate carriers by semantic class — keep highest-ranked per class.
///
/// NOTE: Only checks raw `semantic_class_id`. Alias resolution (cross-module
/// equivalence via aliased class IDs) is not implemented — spike (2026-04-02)
/// found no alias data in module fixtures and no cross-module duplicate class
/// IDs in any of the 4 bundles. Revisit if alias fields are added to fixtures.
fn deduplicate_by_semantic_class(sorted_carriers: &[PipelineCarrier]) -> Vec<PipelineCarrier> {
    let mut seen_classes: HashSet<String> = HashSet::new();
    let mut result = Vec::new();

    for carrier in sorted_carriers {
        let class_id = &carrier.encoded.proposal.semantic_class_id;
        if class_id.is_empty() || seen_classes.insert(class_id.clone()) {
            result.push(carrier.clone());
        }
    }

    result
}

/// Semantic fingerprint — fields that define meaning identity independent of
/// module provenance. Two surfaces with the same fingerprint are semantically
/// identical even if they come from different modules.
#[derive(Serialize)]
struct SemanticFingerprint<'a> {
    encoding: &'a crate::types::meaning::BidEncoding,
    clauses: Vec<ClauseFingerprint<'a>>,
    source_intent: IntentFingerprint<'a>,
    disclosure: crate::types::meaning::Disclosure,
}

#[derive(Serialize)]
struct ClauseFingerprint<'a> {
    fact_id: &'a str,
    operator: crate::types::meaning::FactOperator,
    value: &'a crate::types::meaning::ConstraintValue,
}

#[derive(Serialize)]
struct IntentFingerprint<'a> {
    intent_type: &'a str,
    /// BTreeMap ensures deterministic key ordering for canonical serialization.
    params: BTreeMap<&'a String, &'a serde_json::Value>,
}

/// Compute a canonical JSON string from the semantic fields of a proposal.
/// Identical surfaces from different modules produce the same key.
fn compute_semantic_key(proposal: &MeaningProposal) -> String {
    let fingerprint = SemanticFingerprint {
        encoding: &proposal.encoding,
        clauses: proposal
            .clauses
            .iter()
            .map(|c| ClauseFingerprint {
                fact_id: &c.fact_id,
                operator: c.operator,
                value: &c.value,
            })
            .collect(),
        source_intent: IntentFingerprint {
            intent_type: &proposal.source_intent.intent_type,
            params: proposal.source_intent.params.iter().collect(),
        },
        disclosure: proposal.disclosure,
    };
    serde_json::to_string(&fingerprint).expect("semantic fingerprint serialization cannot fail")
}

/// Deduplicate carriers by content — collapse surfaces with identical semantic
/// meaning (same encoding, clauses, source intent, disclosure) regardless of
/// which module contributed them. Keeps the highest-ranked carrier per content
/// fingerprint (input must be pre-sorted by ranking).
fn deduplicate_by_content(sorted_carriers: &[PipelineCarrier]) -> Vec<PipelineCarrier> {
    let mut seen: HashSet<String> = HashSet::new();
    let mut result = Vec::new();

    for carrier in sorted_carriers {
        let key = compute_semantic_key(&carrier.encoded.proposal);
        if seen.insert(key) {
            result.push(carrier.clone());
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::adapter::tree_evaluation::{
        CandidateEligibility, EncodingEligibility, HandEligibility,
        PedagogicalEligibility,
    };
    use crate::pipeline::evaluation::provenance::{EncoderKind, EncodingTrace, LegalityTrace};
    use crate::pipeline::evaluation::types::{MeaningClause, RankingMetadata};
    use crate::pipeline::types::{CarrierTraces, EncodedProposal, EncodingOption};
    use crate::types::authored_text::{BidName, BidSummary, TeachingLabel};
    use crate::types::meaning::{
        BidEncoding, ConstraintValue, Disclosure, FactOperator, RecommendationBand, SourceIntent,
    };
    use bridge_engine::types::BidSuit;

    fn make_carrier_with_module(
        meaning_id: &str,
        module_id: &str,
        semantic_class_id: &str,
        call: Call,
        clauses: Vec<MeaningClause>,
        source_intent: SourceIntent,
        disclosure: Disclosure,
    ) -> PipelineCarrier {
        PipelineCarrier {
            encoded: EncodedProposal {
                proposal: MeaningProposal {
                    meaning_id: meaning_id.into(),
                    semantic_class_id: semantic_class_id.into(),
                    module_id: module_id.into(),
                    ranking: RankingMetadata {
                        recommendation_band: RecommendationBand::Must,
                        module_precedence: None,
                        declaration_order: 0,
                        specificity: 0.0,
                    },
                    clauses,
                    all_satisfied: true,
                    disclosure,
                    source_intent,
                    teaching_label: TeachingLabel {
                        name: BidName::new("test"),
                        summary: BidSummary::new("test"),
                    },
                    surface_bindings: None,
                    encoding: BidEncoding {
                        default_call: call.clone(),
                        alternate_encodings: None,
                    },
                    evidence: None,
                },
                call: call.clone(),
                is_default_encoding: true,
                legal: true,
                all_encodings: vec![EncodingOption {
                    call: call.clone(),
                    legal: true,
                }],
                eligibility: CandidateEligibility {
                    hand: HandEligibility {
                        satisfied: true,
                        failed_conditions: Vec::new(),
                    },
                    encoding: EncodingEligibility {
                        legal: true,
                        reason: None,
                    },
                    pedagogical: PedagogicalEligibility {
                        acceptable: true,
                        reasons: Vec::new(),
                    },
                },
            },
            traces: CarrierTraces {
                encoding: EncodingTrace {
                    encoder_kind: EncoderKind::DefaultCall,
                    considered_calls: None,
                    blocked_calls: None,
                },
                legality: LegalityTrace {
                    legal: true,
                    reason: None,
                },
                elimination: None,
            },
        }
    }

    fn transfer_intent() -> SourceIntent {
        SourceIntent {
            intent_type: "transfer".into(),
            params: std::collections::HashMap::from([(
                "target".into(),
                serde_json::Value::String("hearts".into()),
            )]),
        }
    }

    fn hcp_clause(min: i64) -> MeaningClause {
        MeaningClause {
            fact_id: "hand.hcp".into(),
            operator: FactOperator::Gte,
            value: ConstraintValue::int(min),
            satisfied: true,
            clause_id: None,
            description: None,
            observed_value: None,
            is_public: None,
        }
    }

    // ── deduplicate_by_semantic_class ─────────────────────────────────

    #[test]
    fn deduplicate_preserves_order() {
        let result = deduplicate_by_semantic_class(&[]);
        assert!(result.is_empty());
    }

    // ── deduplicate_by_content ───────────────────────────────────────

    #[test]
    fn content_dedup_collapses_identical_surfaces_from_different_modules() {
        let call = Call::Bid {
            level: 2,
            strain: BidSuit::Diamonds,
        };
        let clauses = vec![hcp_clause(0)];
        let intent = transfer_intent();

        let a = make_carrier_with_module(
            "jacoby:transfer-hearts",
            "jacoby-transfers",
            "",
            call.clone(),
            clauses.clone(),
            intent.clone(),
            Disclosure::Announcement,
        );
        let b = make_carrier_with_module(
            "fourway:transfer-hearts",
            "four-way-transfers",
            "",
            call,
            clauses,
            intent,
            Disclosure::Announcement,
        );

        let result = deduplicate_by_content(&[a, b]);
        assert_eq!(result.len(), 1, "identical content should collapse to one");
        assert_eq!(result[0].proposal().meaning_id, "jacoby:transfer-hearts");
    }

    #[test]
    fn content_dedup_preserves_different_surfaces() {
        let intent = transfer_intent();

        let a = make_carrier_with_module(
            "jacoby:transfer-hearts",
            "jacoby-transfers",
            "",
            Call::Bid {
                level: 2,
                strain: BidSuit::Diamonds,
            },
            vec![hcp_clause(0)],
            intent.clone(),
            Disclosure::Announcement,
        );
        let b = make_carrier_with_module(
            "fourway:transfer-clubs",
            "four-way-transfers",
            "",
            Call::Bid {
                level: 2,
                strain: BidSuit::Spades,
            },
            vec![hcp_clause(0)],
            intent,
            Disclosure::Alert,
        );

        let result = deduplicate_by_content(&[a, b]);
        assert_eq!(result.len(), 2, "different content should not collapse");
    }

    #[test]
    fn content_dedup_distinguishes_by_clauses() {
        let call = Call::Bid {
            level: 2,
            strain: BidSuit::Diamonds,
        };
        let intent = transfer_intent();

        let a = make_carrier_with_module(
            "mod-a:surface",
            "mod-a",
            "",
            call.clone(),
            vec![hcp_clause(0)],
            intent.clone(),
            Disclosure::Announcement,
        );
        let b = make_carrier_with_module(
            "mod-b:surface",
            "mod-b",
            "",
            call,
            vec![hcp_clause(6)],
            intent,
            Disclosure::Announcement,
        );

        let result = deduplicate_by_content(&[a, b]);
        assert_eq!(result.len(), 2, "different clause values should not collapse");
    }

    #[test]
    fn content_dedup_ignores_module_metadata() {
        let call = Call::Bid {
            level: 2,
            strain: BidSuit::Diamonds,
        };
        let clauses = vec![hcp_clause(0)];
        let intent = transfer_intent();

        // Same semantic content but different meaning_id, module_id, semantic_class_id, teaching_label
        let mut a = make_carrier_with_module(
            "mod-a:transfer",
            "module-alpha",
            "class-a",
            call.clone(),
            clauses.clone(),
            intent.clone(),
            Disclosure::Announcement,
        );
        a.encoded.proposal.teaching_label = TeachingLabel {
            name: BidName::new("Transfer (Jacoby)"),
            summary: BidSummary::new("Shows 5+ hearts"),
        };

        let mut b = make_carrier_with_module(
            "mod-b:transfer",
            "module-beta",
            "class-b",
            call,
            clauses,
            intent,
            Disclosure::Announcement,
        );
        b.encoded.proposal.teaching_label = TeachingLabel {
            name: BidName::new("Transfer (Four-Way)"),
            summary: BidSummary::new("Shows hearts"),
        };

        let result = deduplicate_by_content(&[a, b]);
        assert_eq!(
            result.len(),
            1,
            "different module metadata should not prevent dedup"
        );
    }

    // ── compute_semantic_key ─────────────────────────────────────────

    #[test]
    fn semantic_key_deterministic_for_identical_proposals() {
        let call = Call::Bid {
            level: 2,
            strain: BidSuit::Diamonds,
        };
        let clauses = vec![hcp_clause(0)];
        let intent = transfer_intent();

        let a = make_carrier_with_module(
            "a:x",
            "mod-a",
            "",
            call.clone(),
            clauses.clone(),
            intent.clone(),
            Disclosure::Announcement,
        );
        let b = make_carrier_with_module(
            "b:x",
            "mod-b",
            "",
            call,
            clauses,
            intent,
            Disclosure::Announcement,
        );

        let key_a = compute_semantic_key(&a.encoded.proposal);
        let key_b = compute_semantic_key(&b.encoded.proposal);
        assert_eq!(key_a, key_b);
    }
}
