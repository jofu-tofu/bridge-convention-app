//! Feedback assembler — transforms StrategyEvaluation into viewport-safe DTOs.
//!
//! Pure transformation functions — no state, no side effects.

use bridge_conventions::adapter::strategy_evaluation::StrategyEvaluation;
use bridge_conventions::teaching::teaching_types::{
    ContributionRole, ExplanationKind, WhyNotGrade,
};
use bridge_session::session::{format_call, BidFeedbackDTO, BidGrade};

use crate::response_types::*;

/// Assemble viewport bid feedback from grading output + optional evaluation.
pub fn assemble_viewport_feedback(
    feedback: &BidFeedbackDTO,
    evaluation: Option<&StrategyEvaluation>,
) -> ViewportBidFeedbackDTO {
    let user_call_display = format_call(&feedback.user_call);
    let correct_call_display = feedback.expected_call.as_ref().map(|c| format_call(c));

    let requires_retry = matches!(feedback.grade, BidGrade::NearMiss | BidGrade::Incorrect);

    // Extract teaching data from evaluation
    let (
        correct_bid_label,
        correct_bid_explanation,
        conditions,
        acceptable_alternatives,
        near_misses,
        partner_hand_space,
        conventions_applied,
    ) = match evaluation {
        Some(eval) => extract_viewport_fields(eval, feedback),
        None => (
            None,
            Some(feedback.explanation.clone()),
            None,
            None,
            None,
            None,
            None,
        ),
    };

    ViewportBidFeedbackDTO {
        grade: feedback.grade,
        user_call: feedback.user_call.clone(),
        user_call_display,
        correct_call: feedback.expected_call.clone(),
        correct_call_display,
        correct_bid_label,
        correct_bid_explanation,
        conditions,
        acceptable_alternatives,
        near_misses,
        partner_hand_space,
        conventions_applied,
        requires_retry,
    }
}

/// Assemble teaching detail from grading output + optional evaluation.
pub fn assemble_teaching_detail(
    feedback: &BidFeedbackDTO,
    evaluation: Option<&StrategyEvaluation>,
) -> Option<TeachingDetailDTO> {
    let eval = match evaluation {
        Some(e) => e,
        None => {
            // No evaluation — return minimal fallback
            return Some(TeachingDetailDTO {
                fallback_explanation: Some(feedback.explanation.clone()),
                ..default_teaching_detail()
            });
        }
    };

    let tp = eval.teaching_projection.as_ref();
    let pr = eval.pipeline_result.as_ref();

    // Primary explanation
    let primary_explanation = tp.map(|tp| {
        tp.primary_explanation
            .iter()
            .map(|n| ServiceExplanationNodeDTO {
                kind: format_explanation_kind(&n.kind),
                content: n.content.clone(),
                passed: n.passed,
                explanation_id: n.explanation_id.clone(),
                template_key: n.template_key.clone(),
            })
            .collect()
    });

    // Why not
    let why_not = tp.map(|tp| {
        tp.why_not
            .iter()
            .map(|e| ServiceWhyNotEntryDTO {
                call: e.call.clone(),
                grade: format_why_not_grade(&e.grade),
                explanation: e
                    .explanation
                    .iter()
                    .map(|n| ServiceExplanationNodeDTO {
                        kind: format_explanation_kind(&n.kind),
                        content: n.content.clone(),
                        passed: n.passed,
                        explanation_id: n.explanation_id.clone(),
                        template_key: n.template_key.clone(),
                    })
                    .collect(),
                elimination_stage: e.elimination_stage.clone(),
            })
            .collect()
    });

    // Conventions applied
    let conventions_applied = tp.map(|tp| {
        tp.conventions_applied
            .iter()
            .map(|c| ServiceConventionContributionDTO {
                module_id: c.module_id.clone(),
                role: format_contribution_role(&c.role),
                meanings_proposed: c.meanings_proposed.clone(),
            })
            .collect()
    });

    // Meaning views
    let meaning_views = tp.map(|tp| {
        tp.meaning_views
            .iter()
            .map(|m| ServiceMeaningViewDTO {
                meaning_id: m.meaning_id.clone(),
                semantic_class_id: m.semantic_class_id.clone(),
                display_label: m.display_label.clone(),
                status: format!("{:?}", m.status).to_lowercase().replace("_", "-"),
                elimination_reason: m.elimination_reason.clone(),
                supporting_evidence: m
                    .supporting_evidence
                    .iter()
                    .map(|e| serde_json::to_value(e).unwrap_or(serde_json::Value::Null))
                    .collect(),
            })
            .collect()
    });

    // Call views
    let call_views = tp.map(|tp| {
        tp.call_views
            .iter()
            .map(|c| ServiceCallProjectionDTO {
                call: c.call.clone(),
                status: format!("{:?}", c.status).to_lowercase(),
                supporting_meanings: c.supporting_meanings.clone(),
                primary_meaning: c.primary_meaning.clone(),
                projection_kind: serde_json::to_value(&c.projection_kind)
                    .ok()
                    .and_then(|v| v.as_str().map(|s| s.to_string()))
                    .unwrap_or_else(|| "single-rationale".to_string()),
            })
            .collect()
    });

    // Hand space
    let hand_summary = tp.map(|tp| {
        format!(
            "{}: {}-{} HCP, {}",
            tp.hand_space.seat_label,
            tp.hand_space.hcp_range.0,
            tp.hand_space.hcp_range.1,
            tp.hand_space.shape_description
        )
    });
    let partner_summary = tp.and_then(|tp| tp.hand_space.partner_summary.clone());

    // Encoder kind
    let encoder_kind = tp.and_then(|tp| tp.encoder_kind.as_ref()).map(|ek| {
        serde_json::to_value(ek)
            .ok()
            .and_then(|v| v.as_str().map(|s| s.to_string()))
            .unwrap_or_else(|| "default-call".to_string())
    });

    // Practical recommendation
    let practical_recommendation =
        eval.practical_recommendation
            .as_ref()
            .map(|pr| PracticalRecDTO {
                top_candidate_call: pr.call.clone(),
                rationale: pr.reason.clone(),
            });

    // Primary bid + acceptable bids from pipeline result
    let primary_bid = pr.and_then(|pr| pr.selected.as_ref().map(|c| c.call().clone()));

    let acceptable_bids = pr.map(|pr| {
        pr.acceptable_set
            .iter()
            .map(|c| AcceptableBidDTO {
                call: c.call().clone(),
                meaning: c.proposal().teaching_label.name.to_string(),
                reason: c.proposal().teaching_label.summary.to_string(),
                full_credit: true,
            })
            .collect()
    });

    // Near miss calls
    let near_miss_calls = tp.map(|tp| {
        tp.why_not
            .iter()
            .filter(|e| e.grade == WhyNotGrade::NearMiss)
            .map(|e| NearMissCallDTO {
                call: e.call.clone(),
                reason: e
                    .explanation
                    .first()
                    .map(|n| n.content.clone())
                    .unwrap_or_default(),
            })
            .collect()
    });

    // Ambiguity + grading type
    let alt_count = pr.map(|pr| pr.acceptable_set.len()).unwrap_or(0);
    let ambiguity_score = Some((alt_count as f64 * 0.3).clamp(0.0, 0.8));
    let grading_type = Some(if alt_count == 0 {
        "exact".to_string()
    } else {
        "primary_plus_acceptable".to_string()
    });

    // Evaluation completeness
    let evaluation_exhaustive = tp.map(|tp| tp.evaluation_exhaustive);
    let fallback_reached = tp.map(|tp| tp.fallback_reached);

    // Parse tree
    let parse_tree = tp
        .and_then(|tp| tp.parse_tree.as_ref())
        .map(|pt| ServiceParseTreeViewDTO {
            modules: pt
                .modules
                .iter()
                .map(|m| ServiceParseTreeModuleNodeDTO {
                    module_id: m.module_id.clone(),
                    display_label: m.display_label.clone(),
                    verdict: serde_json::to_value(&m.verdict)
                        .ok()
                        .and_then(|v| v.as_str().map(|s| s.to_string()))
                        .unwrap_or_else(|| "eliminated".to_string()),
                    conditions: m
                        .conditions
                        .iter()
                        .map(|c| serde_json::to_value(c).unwrap_or(serde_json::Value::Null))
                        .collect(),
                    meanings: m
                        .meanings
                        .iter()
                        .map(|me| serde_json::to_value(me).unwrap_or(serde_json::Value::Null))
                        .collect(),
                    elimination_reason: m.elimination_reason.clone(),
                })
                .collect(),
            selected_path: pt
                .selected_path
                .as_ref()
                .map(|sp| serde_json::to_value(sp).unwrap_or(serde_json::Value::Null)),
        });

    // Observation history
    let observation_history = eval.auction_context.as_ref().map(|ctx| {
        ctx.log
            .iter()
            .map(|step| {
                let observations: Vec<ObservationViewDTO> = step
                    .public_actions
                    .iter()
                    .map(|action| {
                        let act = serde_json::to_value(action.act())
                            .ok()
                            .and_then(|v| v.as_str().map(|s| s.to_string()))
                            .unwrap_or_else(|| format!("{:?}", action.act()));
                        // Build detail from serialized action (strip the act field)
                        let detail = serde_json::to_value(action)
                            .ok()
                            .and_then(|v| {
                                if let serde_json::Value::Object(map) = v {
                                    let fields: Vec<String> = map
                                        .iter()
                                        .filter(|(k, _)| k.as_str() != "act")
                                        .map(|(k, v)| {
                                            format!(
                                                "{}: {}",
                                                k,
                                                v.as_str()
                                                    .map(|s| s.to_string())
                                                    .unwrap_or_else(|| v.to_string())
                                            )
                                        })
                                        .collect();
                                    if fields.is_empty() {
                                        None
                                    } else {
                                        Some(fields.join(", "))
                                    }
                                } else {
                                    None
                                }
                            });
                        ObservationViewDTO { act, detail }
                    })
                    .collect();

                let kernel = project_kernel(&step.state_after);

                let status = match step.status {
                    bridge_conventions::pipeline::observation::committed_step::CommittedStepStatus::Resolved => "resolved",
                    bridge_conventions::pipeline::observation::committed_step::CommittedStepStatus::Ambiguous => "resolved",
                    bridge_conventions::pipeline::observation::committed_step::CommittedStepStatus::RawOnly => "raw-only",
                    bridge_conventions::pipeline::observation::committed_step::CommittedStepStatus::OffSystem => "off-system",
                };

                ObservationStepViewDTO {
                    actor: step.actor,
                    call: step.call.clone(),
                    observations,
                    kernel,
                    status: status.to_string(),
                }
            })
            .collect()
    });

    Some(TeachingDetailDTO {
        hand_summary,
        fallback_explanation: None,
        primary_explanation,
        why_not,
        conventions_applied,
        meaning_views,
        call_views,
        partner_summary,
        archetypes: None,
        encoder_kind,
        practical_recommendation,
        primary_bid,
        acceptable_bids,
        near_miss_calls,
        ambiguity_score,
        grading_type,
        practical_score_breakdown: None,
        evaluation_exhaustive,
        fallback_reached,
        parse_tree,
        observation_history,
    })
}

// ── Helpers ──────────────────────────────────────────────────────

fn default_teaching_detail() -> TeachingDetailDTO {
    TeachingDetailDTO {
        hand_summary: None,
        fallback_explanation: None,
        primary_explanation: None,
        why_not: None,
        conventions_applied: None,
        meaning_views: None,
        call_views: None,
        partner_summary: None,
        archetypes: None,
        encoder_kind: None,
        practical_recommendation: None,
        primary_bid: None,
        acceptable_bids: None,
        near_miss_calls: None,
        ambiguity_score: None,
        grading_type: None,
        practical_score_breakdown: None,
        evaluation_exhaustive: None,
        fallback_reached: None,
        parse_tree: None,
        observation_history: None,
    }
}

/// Extract viewport-level fields from a StrategyEvaluation.
fn extract_viewport_fields(
    eval: &StrategyEvaluation,
    feedback: &BidFeedbackDTO,
) -> (
    Option<TeachingLabelDTO>,
    Option<String>,
    Option<Vec<ConditionViewDTO>>,
    Option<Vec<AlternativeViewDTO>>,
    Option<Vec<NearMissViewDTO>>,
    Option<String>,
    Option<Vec<ConventionViewDTO>>,
) {
    let tp = eval.teaching_projection.as_ref();
    let pr = eval.pipeline_result.as_ref();

    // Correct bid label from selected carrier's teaching label
    let correct_bid_label = pr
        .and_then(|pr| pr.selected.as_ref())
        .map(|c| TeachingLabelDTO {
            name: c.proposal().teaching_label.name.to_string(),
            summary: c.proposal().teaching_label.summary.to_string(),
        });

    // Correct bid explanation from primary explanation text nodes
    let correct_bid_explanation = tp
        .map(|tp| {
            tp.primary_explanation
                .iter()
                .filter(|n| n.kind == ExplanationKind::Text)
                .map(|n| n.content.clone())
                .collect::<Vec<_>>()
                .join(" ")
        })
        .filter(|s| !s.is_empty())
        .or_else(|| Some(feedback.explanation.clone()));

    // Conditions from primary explanation
    let conditions = tp.map(|tp| {
        tp.primary_explanation
            .iter()
            .filter(|n| n.kind == ExplanationKind::Condition)
            .map(|n| ConditionViewDTO {
                description: n.content.clone(),
                passed: n.passed.unwrap_or(false),
            })
            .collect()
    });

    // Acceptable alternatives from truth_set carriers (excluding selected)
    let acceptable_alternatives = pr.map(|pr| {
        let selected_call = pr.selected.as_ref().map(|c| c.call().clone());
        pr.truth_set
            .iter()
            .filter(|c| Some(c.call().clone()) != selected_call)
            .map(|c| AlternativeViewDTO {
                call: c.call().clone(),
                call_display: format_call(c.call()),
                label: c.proposal().teaching_label.name.to_string(),
                reason: c.proposal().teaching_label.summary.to_string(),
                full_credit: true,
            })
            .collect()
    });

    // Near misses from why_not
    let near_misses = tp.map(|tp| {
        tp.why_not
            .iter()
            .filter(|e| e.grade == WhyNotGrade::NearMiss)
            .map(|e| NearMissViewDTO {
                call: e.call.clone(),
                call_display: format_call(&e.call),
                reason: e
                    .explanation
                    .first()
                    .map(|n| n.content.clone())
                    .unwrap_or_default(),
            })
            .collect()
    });

    // Partner hand space
    let partner_hand_space = tp.and_then(|tp| tp.hand_space.partner_summary.clone());

    // Conventions applied
    let conventions_applied = tp.map(|tp| {
        tp.conventions_applied
            .iter()
            .map(|c| ConventionViewDTO {
                module_id: c.module_id.clone(),
                role: format_contribution_role(&c.role),
            })
            .collect()
    });

    (
        correct_bid_label,
        correct_bid_explanation,
        conditions,
        acceptable_alternatives,
        near_misses,
        partner_hand_space,
        conventions_applied,
    )
}

fn format_explanation_kind(kind: &ExplanationKind) -> String {
    match kind {
        ExplanationKind::Text => "text".to_string(),
        ExplanationKind::Condition => "condition".to_string(),
    }
}

fn format_why_not_grade(grade: &WhyNotGrade) -> String {
    match grade {
        WhyNotGrade::NearMiss => "near-miss".to_string(),
        WhyNotGrade::Wrong => "wrong".to_string(),
    }
}

fn format_contribution_role(role: &ContributionRole) -> String {
    match role {
        ContributionRole::Primary => "primary".to_string(),
        ContributionRole::Alternative => "alternative".to_string(),
        ContributionRole::Suppressed => "suppressed".to_string(),
    }
}

fn project_kernel(
    state: &bridge_conventions::types::negotiation::NegotiationState,
) -> KernelViewDTO {
    let fit_agreed = state.fit_agreed.as_ref().map(|fa| {
        serde_json::json!({
            "strain": fa.strain,
            "confidence": serde_json::to_value(&fa.confidence).unwrap_or(serde_json::Value::Null)
        })
    });

    let forcing = serde_json::to_value(&state.forcing)
        .ok()
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "none".to_string());

    let captain = serde_json::to_value(&state.captain)
        .ok()
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "undecided".to_string());

    let competition = serde_json::to_value(&state.competition).unwrap_or(serde_json::Value::Null);

    KernelViewDTO {
        fit_agreed,
        forcing,
        captain,
        competition,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_conventions::adapter::strategy_evaluation::{
        PracticalRecommendation, StrategyEvaluation,
    };
    use bridge_conventions::adapter::tree_evaluation::{
        CandidateEligibility, EncodingEligibility, HandEligibility, PedagogicalEligibility,
    };
    use bridge_conventions::pipeline::evaluation::provenance::{
        ApplicabilityEvidence, EncoderKind, EncodingTrace, LegalityTrace,
    };
    use bridge_conventions::pipeline::evaluation::types::{MeaningProposal, RankingMetadata};
    use bridge_conventions::pipeline::types::{
        CarrierTraces, EncodedProposal, PipelineCarrier, PipelineResult,
    };
    use bridge_conventions::teaching::teaching_types::*;
    use bridge_conventions::types::authored_text::{BidName, BidSummary, TeachingLabel};
    use bridge_conventions::types::meaning::{
        BidEncoding, Disclosure, RecommendationBand, SourceIntent,
    };
    use bridge_engine::types::{BidSuit, Call};
    use bridge_session::session::BidGrade;

    // ── Helpers ──────────────────────────────────────────────────────

    fn make_call_1nt() -> Call {
        Call::Bid {
            level: 1,
            strain: BidSuit::NoTrump,
        }
    }

    fn make_call_2c() -> Call {
        Call::Bid {
            level: 2,
            strain: BidSuit::Clubs,
        }
    }

    fn make_call_2h() -> Call {
        Call::Bid {
            level: 2,
            strain: BidSuit::Hearts,
        }
    }

    fn make_teaching_label(name: &str, summary: &str) -> TeachingLabel {
        TeachingLabel {
            name: BidName::new(name),
            summary: BidSummary::new(summary),
        }
    }

    fn make_proposal(module_id: &str, meaning_id: &str, label: TeachingLabel) -> MeaningProposal {
        MeaningProposal {
            meaning_id: meaning_id.to_string(),
            semantic_class_id: format!("{module_id}:{meaning_id}"),
            module_id: module_id.to_string(),
            ranking: RankingMetadata {
                recommendation_band: RecommendationBand::Must,
                module_precedence: Some(0),
                declaration_order: 0,
                specificity: 1.0,
            },
            clauses: vec![],
            all_satisfied: true,
            disclosure: Disclosure::Standard,
            source_intent: SourceIntent {
                intent_type: "natural".to_string(),
                params: std::collections::HashMap::new(),
            },
            teaching_label: label,
            surface_bindings: None,
            encoding: BidEncoding {
                default_call: make_call_2c(),
                alternate_encodings: None,
            },
            evidence: None,
        }
    }

    fn make_carrier(call: Call, proposal: MeaningProposal) -> PipelineCarrier {
        PipelineCarrier {
            encoded: EncodedProposal {
                proposal,
                call,
                is_default_encoding: true,
                legal: true,
                all_encodings: vec![],
                eligibility: CandidateEligibility {
                    hand: HandEligibility {
                        satisfied: true,
                        failed_conditions: vec![],
                    },
                    encoding: EncodingEligibility {
                        legal: true,
                        reason: None,
                    },
                    pedagogical: PedagogicalEligibility {
                        acceptable: true,
                        reasons: vec![],
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

    fn make_pipeline_result(selected_call: Call, selected_label: TeachingLabel) -> PipelineResult {
        let proposal = make_proposal("stayman", "stayman:ask", selected_label);
        let carrier = make_carrier(selected_call, proposal);
        PipelineResult {
            selected: Some(carrier.clone()),
            truth_set: vec![carrier],
            acceptable_set: vec![],
            recommended: vec![],
            eliminated: vec![],
            applicability: ApplicabilityEvidence {
                total_surfaces: 5,
                matched_count: 1,
                eliminated_count: 4,
            },
            activation: vec![],
            arbitration: vec![],
            handoffs: vec![],
            evidence_bundle: None,
        }
    }

    fn make_teaching_projection() -> TeachingProjection {
        TeachingProjection {
            call_views: vec![CallProjection {
                call: make_call_2c(),
                status: CallStatus::Truth,
                supporting_meanings: vec!["stayman:ask".to_string()],
                primary_meaning: Some("stayman:ask".to_string()),
                projection_kind: ProjectionKind::SingleRationale,
            }],
            meaning_views: vec![MeaningView {
                meaning_id: "stayman:ask".to_string(),
                semantic_class_id: Some("stayman:stayman:ask".to_string()),
                display_label: "Stayman 2C".to_string(),
                status: MeaningStatus::Live,
                elimination_reason: None,
                supporting_evidence: vec![],
            }],
            primary_explanation: vec![
                ExplanationNode {
                    kind: ExplanationKind::Text,
                    content: "With 4+ hearts and invitational values".to_string(),
                    passed: None,
                    explanation_id: None,
                    template_key: None,
                },
                ExplanationNode {
                    kind: ExplanationKind::Condition,
                    content: "HCP >= 8".to_string(),
                    passed: Some(true),
                    explanation_id: None,
                    template_key: None,
                },
            ],
            why_not: vec![
                WhyNotEntry {
                    call: make_call_2h(),
                    grade: WhyNotGrade::NearMiss,
                    explanation: vec![ExplanationNode {
                        kind: ExplanationKind::Text,
                        content: "Transfer requires 5+ hearts".to_string(),
                        passed: None,
                        explanation_id: None,
                        template_key: None,
                    }],
                    elimination_stage: "clause-check".to_string(),
                },
                WhyNotEntry {
                    call: Call::Pass,
                    grade: WhyNotGrade::Wrong,
                    explanation: vec![ExplanationNode {
                        kind: ExplanationKind::Text,
                        content: "Too strong to pass".to_string(),
                        passed: None,
                        explanation_id: None,
                        template_key: None,
                    }],
                    elimination_stage: "natural-fallback".to_string(),
                },
            ],
            conventions_applied: vec![ConventionContribution {
                module_id: "stayman".to_string(),
                role: ContributionRole::Primary,
                meanings_proposed: vec!["stayman:ask".to_string()],
            }],
            hand_space: HandSpaceSummary {
                seat_label: "South".to_string(),
                hcp_range: (8.0, 14.0),
                shape_description: "4+ hearts, no 5-card major".to_string(),
                partner_summary: Some("15-17 HCP balanced".to_string()),
            },
            parse_tree: None,
            evaluation_exhaustive: true,
            fallback_reached: false,
            encoder_kind: Some(EncoderKind::DefaultCall),
        }
    }

    fn make_eval_with_projection() -> StrategyEvaluation {
        StrategyEvaluation {
            practical_recommendation: Some(PracticalRecommendation {
                call: make_call_2c(),
                reason: "Stayman is conventional here".to_string(),
                confidence: 0.95,
            }),
            surface_groups: None,
            pipeline_result: Some(make_pipeline_result(
                make_call_2c(),
                make_teaching_label("Stayman", "Asks opener for a 4-card major"),
            )),
            posterior_summary: None,
            explanation_catalog: None,
            teaching_projection: Some(make_teaching_projection()),
            facts: None,
            machine_snapshot: None,
            auction_context: None,
        }
    }

    fn make_feedback(grade: BidGrade, user_call: Call, expected: Option<Call>) -> BidFeedbackDTO {
        BidFeedbackDTO {
            grade,
            user_call,
            expected_call: expected,
            explanation: "Stayman asks opener for a 4-card major".to_string(),
        }
    }

    // ── assemble_viewport_feedback tests ─────────────────────────────

    #[test]
    fn correct_bid_feedback_no_retry() {
        let feedback = make_feedback(BidGrade::Correct, make_call_2c(), Some(make_call_2c()));
        let eval = make_eval_with_projection();
        let result = assemble_viewport_feedback(&feedback, Some(&eval));

        assert_eq!(result.grade, BidGrade::Correct);
        assert_eq!(result.user_call, make_call_2c());
        assert_eq!(result.user_call_display, "2C");
        assert_eq!(result.correct_call, Some(make_call_2c()));
        assert_eq!(result.correct_call_display, Some("2C".to_string()));
        assert!(!result.requires_retry);
    }

    #[test]
    fn correct_bid_has_teaching_label() {
        let feedback = make_feedback(BidGrade::Correct, make_call_2c(), Some(make_call_2c()));
        let eval = make_eval_with_projection();
        let result = assemble_viewport_feedback(&feedback, Some(&eval));

        let label = result.correct_bid_label.unwrap();
        assert_eq!(label.name, "Stayman");
        assert_eq!(label.summary, "Asks opener for a 4-card major");
    }

    #[test]
    fn correct_bid_has_explanation_from_text_nodes() {
        let feedback = make_feedback(BidGrade::Correct, make_call_2c(), Some(make_call_2c()));
        let eval = make_eval_with_projection();
        let result = assemble_viewport_feedback(&feedback, Some(&eval));

        // Only ExplanationKind::Text nodes contribute to the explanation string
        let explanation = result.correct_bid_explanation.unwrap();
        assert_eq!(explanation, "With 4+ hearts and invitational values");
    }

    #[test]
    fn incorrect_bid_requires_retry() {
        let feedback = make_feedback(BidGrade::Incorrect, Call::Pass, Some(make_call_2c()));
        let eval = make_eval_with_projection();
        let result = assemble_viewport_feedback(&feedback, Some(&eval));

        assert_eq!(result.grade, BidGrade::Incorrect);
        assert!(result.requires_retry);
        assert_eq!(result.user_call_display, "Pass");
    }

    #[test]
    fn near_miss_bid_requires_retry() {
        let feedback = make_feedback(BidGrade::NearMiss, make_call_2h(), Some(make_call_2c()));
        let eval = make_eval_with_projection();
        let result = assemble_viewport_feedback(&feedback, Some(&eval));

        assert_eq!(result.grade, BidGrade::NearMiss);
        assert!(result.requires_retry);
    }

    #[test]
    fn acceptable_bid_no_retry() {
        let feedback = make_feedback(BidGrade::Acceptable, make_call_1nt(), Some(make_call_2c()));
        let eval = make_eval_with_projection();
        let result = assemble_viewport_feedback(&feedback, Some(&eval));

        assert_eq!(result.grade, BidGrade::Acceptable);
        assert!(!result.requires_retry);
    }

    #[test]
    fn viewport_feedback_extracts_conditions() {
        let feedback = make_feedback(BidGrade::Correct, make_call_2c(), Some(make_call_2c()));
        let eval = make_eval_with_projection();
        let result = assemble_viewport_feedback(&feedback, Some(&eval));

        let conditions = result.conditions.unwrap();
        assert_eq!(conditions.len(), 1);
        assert_eq!(conditions[0].description, "HCP >= 8");
        assert!(conditions[0].passed);
    }

    #[test]
    fn viewport_feedback_extracts_near_misses() {
        let feedback = make_feedback(BidGrade::Correct, make_call_2c(), Some(make_call_2c()));
        let eval = make_eval_with_projection();
        let result = assemble_viewport_feedback(&feedback, Some(&eval));

        let near_misses = result.near_misses.unwrap();
        assert_eq!(near_misses.len(), 1);
        assert_eq!(near_misses[0].call, make_call_2h());
        assert_eq!(near_misses[0].call_display, "2H");
        assert_eq!(near_misses[0].reason, "Transfer requires 5+ hearts");
    }

    #[test]
    fn viewport_feedback_extracts_conventions_applied() {
        let feedback = make_feedback(BidGrade::Correct, make_call_2c(), Some(make_call_2c()));
        let eval = make_eval_with_projection();
        let result = assemble_viewport_feedback(&feedback, Some(&eval));

        let conventions = result.conventions_applied.unwrap();
        assert_eq!(conventions.len(), 1);
        assert_eq!(conventions[0].module_id, "stayman");
        assert_eq!(conventions[0].role, "primary");
    }

    #[test]
    fn viewport_feedback_extracts_partner_hand_space() {
        let feedback = make_feedback(BidGrade::Correct, make_call_2c(), Some(make_call_2c()));
        let eval = make_eval_with_projection();
        let result = assemble_viewport_feedback(&feedback, Some(&eval));

        assert_eq!(
            result.partner_hand_space,
            Some("15-17 HCP balanced".to_string())
        );
    }

    #[test]
    fn viewport_feedback_without_evaluation_uses_fallback_explanation() {
        let feedback = make_feedback(BidGrade::Correct, make_call_2c(), Some(make_call_2c()));
        let result = assemble_viewport_feedback(&feedback, None);

        assert_eq!(result.grade, BidGrade::Correct);
        assert!(result.correct_bid_label.is_none());
        assert_eq!(
            result.correct_bid_explanation,
            Some("Stayman asks opener for a 4-card major".to_string())
        );
        assert!(result.conditions.is_none());
        assert!(result.near_misses.is_none());
        assert!(result.conventions_applied.is_none());
        assert!(result.partner_hand_space.is_none());
    }

    // ── assemble_teaching_detail tests ──────────────────────────────

    #[test]
    fn teaching_detail_without_evaluation_returns_fallback() {
        let feedback = make_feedback(BidGrade::Correct, make_call_2c(), Some(make_call_2c()));
        let result = assemble_teaching_detail(&feedback, None).unwrap();

        assert_eq!(
            result.fallback_explanation,
            Some("Stayman asks opener for a 4-card major".to_string())
        );
        assert!(result.primary_explanation.is_none());
        assert!(result.why_not.is_none());
        assert!(result.conventions_applied.is_none());
        assert!(result.hand_summary.is_none());
        assert!(result.primary_bid.is_none());
    }

    #[test]
    fn teaching_detail_with_evaluation_has_primary_explanation() {
        let feedback = make_feedback(BidGrade::Correct, make_call_2c(), Some(make_call_2c()));
        let eval = make_eval_with_projection();
        let result = assemble_teaching_detail(&feedback, Some(&eval)).unwrap();

        assert!(result.fallback_explanation.is_none());

        let explanation = result.primary_explanation.unwrap();
        assert_eq!(explanation.len(), 2);
        assert_eq!(explanation[0].kind, "text");
        assert_eq!(
            explanation[0].content,
            "With 4+ hearts and invitational values"
        );
        assert_eq!(explanation[1].kind, "condition");
        assert_eq!(explanation[1].content, "HCP >= 8");
        assert_eq!(explanation[1].passed, Some(true));
    }

    #[test]
    fn teaching_detail_has_why_not_entries() {
        let feedback = make_feedback(BidGrade::Correct, make_call_2c(), Some(make_call_2c()));
        let eval = make_eval_with_projection();
        let result = assemble_teaching_detail(&feedback, Some(&eval)).unwrap();

        let why_not = result.why_not.unwrap();
        assert_eq!(why_not.len(), 2);

        assert_eq!(why_not[0].call, make_call_2h());
        assert_eq!(why_not[0].grade, "near-miss");
        assert_eq!(why_not[0].elimination_stage, "clause-check");

        assert_eq!(why_not[1].call, Call::Pass);
        assert_eq!(why_not[1].grade, "wrong");
    }

    #[test]
    fn teaching_detail_has_conventions_applied() {
        let feedback = make_feedback(BidGrade::Correct, make_call_2c(), Some(make_call_2c()));
        let eval = make_eval_with_projection();
        let result = assemble_teaching_detail(&feedback, Some(&eval)).unwrap();

        let conventions = result.conventions_applied.unwrap();
        assert_eq!(conventions.len(), 1);
        assert_eq!(conventions[0].module_id, "stayman");
        assert_eq!(conventions[0].role, "primary");
        assert_eq!(conventions[0].meanings_proposed, vec!["stayman:ask"]);
    }

    #[test]
    fn teaching_detail_has_hand_summary() {
        let feedback = make_feedback(BidGrade::Correct, make_call_2c(), Some(make_call_2c()));
        let eval = make_eval_with_projection();
        let result = assemble_teaching_detail(&feedback, Some(&eval)).unwrap();

        let summary = result.hand_summary.unwrap();
        assert!(summary.contains("South"));
        assert!(summary.contains("8"));
        assert!(summary.contains("14"));
        assert!(summary.contains("4+ hearts"));
    }

    #[test]
    fn teaching_detail_has_partner_summary() {
        let feedback = make_feedback(BidGrade::Correct, make_call_2c(), Some(make_call_2c()));
        let eval = make_eval_with_projection();
        let result = assemble_teaching_detail(&feedback, Some(&eval)).unwrap();

        assert_eq!(
            result.partner_summary,
            Some("15-17 HCP balanced".to_string())
        );
    }

    #[test]
    fn teaching_detail_has_primary_bid_from_pipeline() {
        let feedback = make_feedback(BidGrade::Correct, make_call_2c(), Some(make_call_2c()));
        let eval = make_eval_with_projection();
        let result = assemble_teaching_detail(&feedback, Some(&eval)).unwrap();

        assert_eq!(result.primary_bid, Some(make_call_2c()));
    }

    #[test]
    fn teaching_detail_has_acceptable_bids() {
        let feedback = make_feedback(BidGrade::Correct, make_call_2c(), Some(make_call_2c()));
        let eval = make_eval_with_projection();
        let result = assemble_teaching_detail(&feedback, Some(&eval)).unwrap();

        let bids = result.acceptable_bids.unwrap();
        assert!(bids.is_empty());
    }

    #[test]
    fn teaching_detail_has_near_miss_calls() {
        let feedback = make_feedback(BidGrade::Correct, make_call_2c(), Some(make_call_2c()));
        let eval = make_eval_with_projection();
        let result = assemble_teaching_detail(&feedback, Some(&eval)).unwrap();

        let near_misses = result.near_miss_calls.unwrap();
        assert_eq!(near_misses.len(), 1);
        assert_eq!(near_misses[0].call, make_call_2h());
        assert_eq!(near_misses[0].reason, "Transfer requires 5+ hearts");
    }

    #[test]
    fn teaching_detail_has_ambiguity_and_grading_type() {
        let feedback = make_feedback(BidGrade::Correct, make_call_2c(), Some(make_call_2c()));
        let eval = make_eval_with_projection();
        let result = assemble_teaching_detail(&feedback, Some(&eval)).unwrap();

        assert_eq!(result.ambiguity_score, Some(0.0));
        assert_eq!(result.grading_type, Some("exact".to_string()));
    }

    #[test]
    fn teaching_detail_has_evaluation_completeness() {
        let feedback = make_feedback(BidGrade::Correct, make_call_2c(), Some(make_call_2c()));
        let eval = make_eval_with_projection();
        let result = assemble_teaching_detail(&feedback, Some(&eval)).unwrap();

        assert_eq!(result.evaluation_exhaustive, Some(true));
        assert_eq!(result.fallback_reached, Some(false));
    }

    #[test]
    fn teaching_detail_has_encoder_kind() {
        let feedback = make_feedback(BidGrade::Correct, make_call_2c(), Some(make_call_2c()));
        let eval = make_eval_with_projection();
        let result = assemble_teaching_detail(&feedback, Some(&eval)).unwrap();

        assert_eq!(result.encoder_kind, Some("default-call".to_string()));
    }

    #[test]
    fn teaching_detail_has_practical_recommendation() {
        let feedback = make_feedback(BidGrade::Correct, make_call_2c(), Some(make_call_2c()));
        let eval = make_eval_with_projection();
        let result = assemble_teaching_detail(&feedback, Some(&eval)).unwrap();

        let rec = result.practical_recommendation.unwrap();
        assert_eq!(rec.top_candidate_call, make_call_2c());
        assert_eq!(rec.rationale, "Stayman is conventional here");
    }

    #[test]
    fn teaching_detail_has_meaning_views() {
        let feedback = make_feedback(BidGrade::Correct, make_call_2c(), Some(make_call_2c()));
        let eval = make_eval_with_projection();
        let result = assemble_teaching_detail(&feedback, Some(&eval)).unwrap();

        let views = result.meaning_views.unwrap();
        assert_eq!(views.len(), 1);
        assert_eq!(views[0].meaning_id, "stayman:ask");
        assert_eq!(views[0].display_label, "Stayman 2C");
        assert_eq!(views[0].status, "live");
    }

    #[test]
    fn teaching_detail_has_call_views() {
        let feedback = make_feedback(BidGrade::Correct, make_call_2c(), Some(make_call_2c()));
        let eval = make_eval_with_projection();
        let result = assemble_teaching_detail(&feedback, Some(&eval)).unwrap();

        let views = result.call_views.unwrap();
        assert_eq!(views.len(), 1);
        assert_eq!(views[0].call, make_call_2c());
        assert_eq!(views[0].status, "truth");
        assert_eq!(views[0].projection_kind, "single-rationale");
    }

    #[test]
    fn teaching_detail_with_acceptable_set_has_nonzero_ambiguity() {
        let feedback = make_feedback(BidGrade::Correct, make_call_2c(), Some(make_call_2c()));
        let mut eval = make_eval_with_projection();

        // Add an acceptable carrier to the pipeline result
        let alt_label = make_teaching_label("Transfer", "Shows 5+ hearts");
        let alt_proposal = make_proposal("transfers", "transfers:hearts", alt_label);
        let alt_carrier = make_carrier(make_call_2h(), alt_proposal);

        if let Some(ref mut pr) = eval.pipeline_result {
            pr.acceptable_set.push(alt_carrier);
        }

        let result = assemble_teaching_detail(&feedback, Some(&eval)).unwrap();

        // 1 acceptable entry => ambiguity_score = 0.3 * 1 = 0.3
        assert_eq!(result.ambiguity_score, Some(0.3));
        assert_eq!(
            result.grading_type,
            Some("primary_plus_acceptable".to_string())
        );
    }
}
