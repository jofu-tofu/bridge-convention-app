//! Arbitration helpers — gate pipeline and eligibility classification.
//!
//! Mirrors TS from `pipeline/evaluation/arbitration-helpers.ts`.

use bridge_engine::types::Call;

use crate::adapter::tree_evaluation::{
    CandidateEligibility, EncodingEligibility, EncodingFailureReason, HandEligibility,
    PedagogicalEligibility, SiblingConditionDetail,
};
use crate::pipeline::evaluation::encoder_resolver::resolve_encoding;
use crate::pipeline::evaluation::provenance::{
    EliminationTrace, LegalityTrace,
};
use crate::pipeline::evaluation::types::MeaningProposal;
use crate::pipeline::types::{CarrierTraces, EncodedProposal, PipelineCarrier};

/// Evaluate a proposal through the gate pipeline, producing an EncodedProposal + traces.
pub fn evaluate_proposal(
    proposal: &MeaningProposal,
    is_legal: &dyn Fn(&Call) -> bool,
) -> PipelineCarrier {
    let encoding_result = resolve_encoding(&proposal.encoding, is_legal);

    let hand_satisfied = proposal.all_satisfied;
    let encoding_legal = encoding_result.all_encodings.iter().any(|e| e.legal);

    // Build failed conditions for eligibility
    let failed_conditions: Vec<SiblingConditionDetail> = proposal
        .clauses
        .iter()
        .filter(|c| !c.satisfied)
        .map(|c| SiblingConditionDetail {
            name: c.fact_id.clone(),
            description: c.description.clone().unwrap_or_default(),
            condition_id: c.clause_id.clone(),
            fact_id: Some(c.fact_id.clone()),
            observed_value: c.observed_value.clone(),
            threshold: None,
        })
        .collect();

    let eligibility = CandidateEligibility {
        hand: HandEligibility {
            satisfied: hand_satisfied,
            failed_conditions,
        },
        encoding: EncodingEligibility {
            legal: encoding_legal,
            reason: if encoding_legal {
                None
            } else {
                Some(EncodingFailureReason::AllEncodingsIllegal)
            },
        },
        pedagogical: PedagogicalEligibility {
            acceptable: true, // Default — pedagogical gate is post-selection
            reasons: Vec::new(),
        },
    };

    let elimination = if !hand_satisfied {
        Some(EliminationTrace {
            gate_id: "semantic-applicability".into(),
            reason: "Hand does not satisfy all clauses".into(),
        })
    } else if !encoding_legal {
        Some(EliminationTrace {
            gate_id: "encoder-availability".into(),
            reason: "No legal encoding available".into(),
        })
    } else {
        None
    };

    PipelineCarrier {
        encoded: EncodedProposal {
            proposal: proposal.clone(),
            call: encoding_result.call,
            is_default_encoding: encoding_result.is_default,
            legal: encoding_legal,
            all_encodings: encoding_result.all_encodings,
            eligibility,
        },
        traces: CarrierTraces {
            encoding: encoding_result.trace,
            legality: LegalityTrace {
                legal: encoding_legal,
                reason: None,
            },
            elimination,
        },
    }
}

/// Classify carriers into truth set and acceptable set.
///
/// Truth set: hand satisfied AND legal encoding (fully correct bids).
/// Acceptable set: same as truth set — all conditions pass. These are bids
/// the player could correctly make, but weren't chosen because a higher-ranked
/// bid was preferred. Hand-failed carriers are NOT acceptable; they fall to
/// near-miss (≤1 failed condition, same surface group) or incorrect.
pub fn classify_into_sets(
    carriers: &[PipelineCarrier],
) -> (Vec<PipelineCarrier>, Vec<PipelineCarrier>) {
    let truth_set: Vec<PipelineCarrier> = carriers
        .iter()
        .filter(|c| {
            c.encoded.eligibility.hand.satisfied && c.encoded.eligibility.encoding.legal
        })
        .cloned()
        .collect();

    // Acceptable set equals truth set — only fully correct bids qualify.
    let acceptable_set = truth_set.clone();

    (truth_set, acceptable_set)
}

/// Extract near-miss calls from eliminated carriers.
///
/// A near miss is an eliminated carrier in the same surface group as the selected
/// bid with exactly one unsatisfied clause. These represent "close but not quite"
/// bids where the hand almost qualifies.
pub fn extract_near_miss_calls(
    pipeline_result: &crate::pipeline::types::PipelineResult,
    surface_groups: &[crate::teaching::teaching_types::SurfaceGroup],
    selected_call: &Call,
) -> Vec<Call> {
    let selected = match &pipeline_result.selected {
        Some(s) => s,
        None => return Vec::new(),
    };
    let selected_meaning_id = &selected.proposal().meaning_id;
    let group = surface_groups
        .iter()
        .find(|g| g.members.iter().any(|m| m == selected_meaning_id.as_str()));
    let group = match group {
        Some(g) => g,
        None => return Vec::new(),
    };

    let mut calls = Vec::new();
    for c in &pipeline_result.eliminated {
        let failed = c
            .proposal()
            .clauses
            .iter()
            .filter(|cl| !cl.satisfied)
            .count();
        if failed == 1
            && group.members.iter().any(|m| m == &c.proposal().meaning_id)
            && c.call() != selected_call
            && !calls.contains(c.call())
        {
            calls.push(c.call().clone());
        }
    }
    calls
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pipeline::evaluation::provenance::{EncoderKind, EncodingTrace};
    use crate::pipeline::evaluation::types::{MeaningClause, RankingMetadata};
    use crate::types::authored_text::{BidName, BidSummary};
    use crate::types::meaning::{
        BidEncoding, ConstraintValue, Disclosure, FactOperator,
        RecommendationBand, SourceIntent,
    };
    use crate::teaching::teaching_types::{SurfaceGroup, SurfaceGroupRelationship};
    use bridge_engine::types::BidSuit;

    fn make_carrier(
        meaning_id: &str,
        call: Call,
        hand_satisfied: bool,
        encoding_legal: bool,
        clauses: Vec<MeaningClause>,
    ) -> PipelineCarrier {
        PipelineCarrier {
            encoded: EncodedProposal {
                proposal: MeaningProposal {
                    meaning_id: meaning_id.into(),
                    semantic_class_id: String::new(),
                    module_id: "test-module".into(),
                    ranking: RankingMetadata {
                        recommendation_band: RecommendationBand::Must,
                        module_precedence: None,
                        declaration_order: 0,
                        specificity: 0.0,
                    },
                    clauses,
                    all_satisfied: hand_satisfied,
                    disclosure: Disclosure::Natural,
                    source_intent: SourceIntent {
                        intent_type: "conventional".into(),
                        params: std::collections::HashMap::new(),
                    },
                    teaching_label: crate::types::authored_text::TeachingLabel {
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
                legal: encoding_legal,
                all_encodings: vec![crate::pipeline::types::EncodingOption {
                    call: call.clone(),
                    legal: encoding_legal,
                }],
                eligibility: CandidateEligibility {
                    hand: HandEligibility {
                        satisfied: hand_satisfied,
                        failed_conditions: Vec::new(),
                    },
                    encoding: EncodingEligibility {
                        legal: encoding_legal,
                        reason: if encoding_legal {
                            None
                        } else {
                            Some(EncodingFailureReason::AllEncodingsIllegal)
                        },
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
                    legal: encoding_legal,
                    reason: None,
                },
                elimination: None,
            },
        }
    }

    fn satisfied_clause(fact_id: &str) -> MeaningClause {
        MeaningClause {
            fact_id: fact_id.into(),
            operator: FactOperator::Gte,
            value: ConstraintValue::int(10),
            satisfied: true,
            clause_id: None,
            description: None,
            observed_value: None,
            is_public: None,
        }
    }

    fn failed_clause(fact_id: &str) -> MeaningClause {
        MeaningClause {
            fact_id: fact_id.into(),
            operator: FactOperator::Gte,
            value: ConstraintValue::int(10),
            satisfied: false,
            clause_id: None,
            description: None,
            observed_value: None,
            is_public: None,
        }
    }

    // ── classify_into_sets ────────────────────────────────────────────

    #[test]
    fn truth_set_includes_fully_satisfied_legal_carriers() {
        let carriers = vec![
            make_carrier("stayman", Call::Bid { level: 2, strain: BidSuit::Clubs }, true, true, vec![]),
            make_carrier("transfer", Call::Bid { level: 2, strain: BidSuit::Hearts }, true, true, vec![]),
        ];
        let (truth, acceptable) = classify_into_sets(&carriers);
        assert_eq!(truth.len(), 2);
        assert_eq!(acceptable.len(), 2);
    }

    #[test]
    fn hand_failed_carrier_excluded_from_both_sets() {
        let carriers = vec![
            make_carrier("stayman", Call::Bid { level: 2, strain: BidSuit::Clubs }, true, true, vec![]),
            make_carrier("transfer", Call::Bid { level: 2, strain: BidSuit::Hearts }, false, true, vec![]),
        ];
        let (truth, acceptable) = classify_into_sets(&carriers);
        assert_eq!(truth.len(), 1, "hand-failed should not be in truth set");
        assert_eq!(acceptable.len(), 1, "hand-failed should not be in acceptable set");
        assert_eq!(truth[0].proposal().meaning_id, "stayman");
        assert_eq!(acceptable[0].proposal().meaning_id, "stayman");
    }

    #[test]
    fn encoding_illegal_excluded_from_both_sets() {
        let carriers = vec![
            make_carrier("stayman", Call::Bid { level: 2, strain: BidSuit::Clubs }, true, true, vec![]),
            make_carrier("blackwood", Call::Bid { level: 4, strain: BidSuit::NoTrump }, true, false, vec![]),
        ];
        let (truth, acceptable) = classify_into_sets(&carriers);
        assert_eq!(truth.len(), 1);
        assert_eq!(acceptable.len(), 1);
    }

    #[test]
    fn empty_carriers_produces_empty_sets() {
        let (truth, acceptable) = classify_into_sets(&[]);
        assert!(truth.is_empty());
        assert!(acceptable.is_empty());
    }

    #[test]
    fn all_failed_produces_empty_sets() {
        let carriers = vec![
            make_carrier("a", Call::Bid { level: 2, strain: BidSuit::Clubs }, false, true, vec![]),
            make_carrier("b", Call::Bid { level: 3, strain: BidSuit::Clubs }, false, false, vec![]),
        ];
        let (truth, acceptable) = classify_into_sets(&carriers);
        assert!(truth.is_empty());
        assert!(acceptable.is_empty());
    }

    // ── extract_near_miss_calls ───────────────────────────────────────

    fn make_pipeline_result_with_eliminated(
        selected: PipelineCarrier,
        eliminated: Vec<PipelineCarrier>,
    ) -> crate::pipeline::types::PipelineResult {
        crate::pipeline::types::PipelineResult {
            selected: Some(selected),
            truth_set: Vec::new(),
            acceptable_set: Vec::new(),
            recommended: Vec::new(),
            eliminated,
            applicability: crate::pipeline::evaluation::provenance::ApplicabilityEvidence::default(),
            activation: Vec::new(),
            arbitration: Vec::new(),
            handoffs: Vec::new(),
            evidence_bundle: None,
        }
    }

    #[test]
    fn near_miss_with_one_failed_clause_in_same_group() {
        let selected = make_carrier(
            "bergen:limit-raise",
            Call::Bid { level: 3, strain: BidSuit::Hearts },
            true, true,
            vec![satisfied_clause("hcp"), satisfied_clause("trump-length")],
        );
        let eliminated = make_carrier(
            "bergen:constructive-raise",
            Call::Bid { level: 2, strain: BidSuit::Hearts },
            false, true,
            vec![satisfied_clause("hcp"), failed_clause("trump-length")],
        );
        let pr = make_pipeline_result_with_eliminated(selected, vec![eliminated]);
        let groups = vec![SurfaceGroup {
            id: "bergen-raises".into(),
            label: "Bergen Raises".into(),
            members: vec!["bergen:limit-raise".into(), "bergen:constructive-raise".into()],
            relationship: SurfaceGroupRelationship::MutuallyExclusive,
            description: String::new(),
        }];
        let selected_call = Call::Bid { level: 3, strain: BidSuit::Hearts };
        let near = extract_near_miss_calls(&pr, &groups, &selected_call);
        assert_eq!(near.len(), 1);
        assert_eq!(near[0], Call::Bid { level: 2, strain: BidSuit::Hearts });
    }

    #[test]
    fn no_near_miss_with_two_failed_clauses() {
        let selected = make_carrier(
            "bergen:limit-raise",
            Call::Bid { level: 3, strain: BidSuit::Hearts },
            true, true,
            vec![satisfied_clause("hcp")],
        );
        let eliminated = make_carrier(
            "bergen:constructive-raise",
            Call::Bid { level: 2, strain: BidSuit::Hearts },
            false, true,
            vec![failed_clause("hcp"), failed_clause("trump-length")],
        );
        let pr = make_pipeline_result_with_eliminated(selected, vec![eliminated]);
        let groups = vec![SurfaceGroup {
            id: "bergen-raises".into(),
            label: "Bergen Raises".into(),
            members: vec!["bergen:limit-raise".into(), "bergen:constructive-raise".into()],
            relationship: SurfaceGroupRelationship::MutuallyExclusive,
            description: String::new(),
        }];
        let selected_call = Call::Bid { level: 3, strain: BidSuit::Hearts };
        let near = extract_near_miss_calls(&pr, &groups, &selected_call);
        assert!(near.is_empty(), "two failed clauses should not be a near miss");
    }

    #[test]
    fn no_near_miss_from_different_surface_group() {
        let selected = make_carrier(
            "bergen:limit-raise",
            Call::Bid { level: 3, strain: BidSuit::Hearts },
            true, true,
            vec![satisfied_clause("hcp")],
        );
        let eliminated = make_carrier(
            "stayman:ask",
            Call::Bid { level: 2, strain: BidSuit::Clubs },
            false, true,
            vec![failed_clause("four-card-major")],
        );
        let pr = make_pipeline_result_with_eliminated(selected, vec![eliminated]);
        let groups = vec![
            SurfaceGroup {
                id: "bergen-raises".into(),
                label: "Bergen Raises".into(),
                members: vec!["bergen:limit-raise".into()],
                relationship: SurfaceGroupRelationship::MutuallyExclusive,
                description: String::new(),
            },
            SurfaceGroup {
                id: "stayman".into(),
                label: "Stayman".into(),
                members: vec!["stayman:ask".into()],
                relationship: SurfaceGroupRelationship::MutuallyExclusive,
                description: String::new(),
            },
        ];
        let selected_call = Call::Bid { level: 3, strain: BidSuit::Hearts };
        let near = extract_near_miss_calls(&pr, &groups, &selected_call);
        assert!(near.is_empty(), "different surface group should not be a near miss");
    }

    #[test]
    fn near_miss_excludes_selected_call() {
        let selected = make_carrier(
            "bergen:limit-raise",
            Call::Bid { level: 3, strain: BidSuit::Hearts },
            true, true,
            vec![satisfied_clause("hcp")],
        );
        let eliminated = make_carrier(
            "bergen:game-raise",
            Call::Bid { level: 3, strain: BidSuit::Hearts },
            false, true,
            vec![failed_clause("hcp")],
        );
        let pr = make_pipeline_result_with_eliminated(selected, vec![eliminated]);
        let groups = vec![SurfaceGroup {
            id: "bergen-raises".into(),
            label: "Bergen Raises".into(),
            members: vec!["bergen:limit-raise".into(), "bergen:game-raise".into()],
            relationship: SurfaceGroupRelationship::MutuallyExclusive,
            description: String::new(),
        }];
        let selected_call = Call::Bid { level: 3, strain: BidSuit::Hearts };
        let near = extract_near_miss_calls(&pr, &groups, &selected_call);
        assert!(near.is_empty(), "selected call should be excluded from near misses");
    }

    #[test]
    fn near_miss_empty_when_no_selected() {
        let pr = crate::pipeline::types::PipelineResult::empty();
        let groups = vec![];
        let call = Call::Pass;
        let near = extract_near_miss_calls(&pr, &groups, &call);
        assert!(near.is_empty());
    }
}
