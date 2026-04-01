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
    let (correct_bid_label, correct_bid_explanation, conditions, acceptable_alternatives, near_misses, partner_hand_space, conventions_applied) =
        match evaluation {
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
    let encoder_kind = tp
        .and_then(|tp| tp.encoder_kind.as_ref())
        .map(|ek| {
            serde_json::to_value(ek)
                .ok()
                .and_then(|v| v.as_str().map(|s| s.to_string()))
                .unwrap_or_else(|| "default-call".to_string())
        });

    // Practical recommendation
    let practical_recommendation = eval.practical_recommendation.as_ref().map(|pr| {
        PracticalRecDTO {
            top_candidate_call: pr.call.clone(),
            rationale: pr.reason.clone(),
        }
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
    let alt_count = pr
        .map(|pr| pr.acceptable_set.len())
        .unwrap_or(0);
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
        ExplanationKind::CallReference => "call-reference".to_string(),
        ExplanationKind::ConventionReference => "convention-reference".to_string(),
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

    let competition =
        serde_json::to_value(&state.competition).unwrap_or(serde_json::Value::Null);

    KernelViewDTO {
        fit_agreed,
        forcing,
        captain,
        competition,
    }
}
