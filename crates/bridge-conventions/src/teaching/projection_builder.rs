//! Projection builder — builds TeachingProjection from PipelineResult.
//!
//! Mirrors TS from `conventions/teaching/teaching-projection-builder.ts`.

use std::collections::HashMap;

use crate::pipeline::evaluation::types::MeaningClause;
use crate::pipeline::types::{PipelineCarrier, PipelineResult};
use crate::teaching::teaching_types::*;
use bridge_engine::types::{BidSuit, Call};

/// Build a TeachingProjection from a PipelineResult.
pub fn project_teaching(
    result: &PipelineResult,
    surface_groups: Option<&[SurfaceGroup]>,
) -> TeachingProjection {
    let call_views = build_call_views(result);
    let meaning_views = build_meaning_views(result);
    let primary_explanation = build_primary_explanation(result);
    let why_not = build_why_not(result, surface_groups);
    let conventions_applied = build_conventions_applied(result);
    let hand_space = build_hand_space(result);

    let encoder_kind = result
        .selected
        .as_ref()
        .map(|c| c.traces.encoding.encoder_kind.clone());

    TeachingProjection {
        call_views,
        meaning_views,
        primary_explanation,
        why_not,
        conventions_applied,
        hand_space,
        parse_tree: None, // Built separately via parse_tree_builder
        evaluation_exhaustive: result
            .evidence_bundle
            .as_ref()
            .map(|eb| eb.exhaustive)
            .unwrap_or(true),
        fallback_reached: result
            .evidence_bundle
            .as_ref()
            .map(|eb| eb.fallback_reached)
            .unwrap_or(result.selected.is_none()),
        encoder_kind,
    }
}

fn build_call_views(result: &PipelineResult) -> Vec<CallProjection> {
    let mut call_map: HashMap<String, CallProjection> = HashMap::new();

    // Add truth set calls
    for carrier in &result.truth_set {
        let call_key = format!("{:?}", carrier.call());
        let entry = call_map.entry(call_key).or_insert_with(|| CallProjection {
            call: carrier.call().clone(),
            status: CallStatus::Truth,
            supporting_meanings: Vec::new(),
            primary_meaning: None,
            projection_kind: ProjectionKind::SingleRationale,
        });
        entry
            .supporting_meanings
            .push(carrier.proposal().meaning_id.clone());
    }

    // Set primary meaning
    if let Some(ref selected) = result.selected {
        let call_key = format!("{:?}", selected.call());
        if let Some(view) = call_map.get_mut(&call_key) {
            view.primary_meaning = Some(selected.proposal().meaning_id.clone());
        }
    }

    // Update projection kind for multi-meaning calls
    for view in call_map.values_mut() {
        if view.supporting_meanings.len() > 1 {
            view.projection_kind = ProjectionKind::MultiRationaleSameCall;
        }
    }

    call_map.into_values().collect()
}

fn build_meaning_views(result: &PipelineResult) -> Vec<MeaningView> {
    let mut views = Vec::new();

    // Truth set meanings are "live"
    for carrier in &result.truth_set {
        views.push(MeaningView {
            meaning_id: carrier.proposal().meaning_id.clone(),
            semantic_class_id: Some(carrier.proposal().semantic_class_id.clone()),
            display_label: format_feedback_label(carrier.call()),
            status: MeaningStatus::Live,
            elimination_reason: None,
            supporting_evidence: Vec::new(),
        });
    }

    // Eliminated meanings
    for carrier in &result.eliminated {
        let elimination_reason = carrier
            .traces
            .elimination
            .as_ref()
            .map(|e| e.reason.clone());
        views.push(MeaningView {
            meaning_id: carrier.proposal().meaning_id.clone(),
            semantic_class_id: Some(carrier.proposal().semantic_class_id.clone()),
            display_label: format_feedback_label(carrier.call()),
            status: MeaningStatus::Eliminated,
            elimination_reason,
            supporting_evidence: Vec::new(),
        });
    }

    views
}

fn build_primary_explanation(result: &PipelineResult) -> Vec<ExplanationNode> {
    let mut nodes = Vec::new();

    if let Some(ref selected) = result.selected {
        let proposal = selected.proposal();
        let summary = proposal.teaching_label.summary.as_str().trim();
        let satisfied_desc: Vec<String> = proposal
            .clauses
            .iter()
            .filter(|c| c.satisfied)
            .filter_map(|c| {
                c.description
                    .as_deref()
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                    .map(|s| s.to_string())
            })
            .collect();

        let text = if !summary.is_empty() {
            if satisfied_desc.is_empty() {
                summary.to_string()
            } else {
                format!(
                    "{} — your hand has {}.",
                    summary,
                    join_clauses(&satisfied_desc)
                )
            }
        } else if !satisfied_desc.is_empty() {
            format!("Your hand fits: {}.", join_clauses(&satisfied_desc))
        } else {
            // Last-resort fallback. Never surface the raw internal label here —
            // authored labels (e.g. "Partner opens 1C", "Opponent's 1NT") are
            // context anchors, not user-facing feedback.
            "Your hand satisfies every requirement for this call.".to_string()
        };

        nodes.push(ExplanationNode {
            kind: ExplanationKind::Text,
            content: text,
            passed: None,
            explanation_id: None,
            template_key: None,
        });

        for clause in &proposal.clauses {
            nodes.push(clause_to_explanation_node(clause, Some(clause.satisfied)));
        }
    }

    nodes
}

fn join_clauses(items: &[String]) -> String {
    match items.len() {
        0 => String::new(),
        1 => items[0].clone(),
        2 => format!("{} and {}", items[0], items[1]),
        _ => {
            let (last, head) = items.split_last().unwrap();
            format!("{}, and {}", head.join(", "), last)
        }
    }
}

pub fn format_feedback_label(call: &Call) -> String {
    match call {
        Call::Pass => "Pass".to_string(),
        Call::Double => "Double".to_string(),
        Call::Redouble => "Redouble".to_string(),
        Call::Bid { level, strain } => format!("Bid {}{}", level, format_strain(strain)),
    }
}

fn format_strain(strain: &BidSuit) -> &'static str {
    match strain {
        BidSuit::Clubs => "C",
        BidSuit::Diamonds => "D",
        BidSuit::Hearts => "H",
        BidSuit::Spades => "S",
        BidSuit::NoTrump => "NT",
    }
}

fn build_why_not(
    result: &PipelineResult,
    surface_groups: Option<&[SurfaceGroup]>,
) -> Vec<WhyNotEntry> {
    let mut entries = Vec::new();

    // Find the surface group containing the selected meaning (if any)
    let selected_group = result.selected.as_ref().and_then(|selected| {
        let selected_id = &selected.proposal().meaning_id;
        surface_groups.and_then(|groups| {
            groups
                .iter()
                .find(|g| g.members.iter().any(|m| m == selected_id.as_str()))
        })
    });

    for carrier in &result.eliminated {
        let failed_clauses: Vec<&_> = carrier
            .proposal()
            .clauses
            .iter()
            .filter(|c| !c.satisfied)
            .collect();

        let explanation: Vec<ExplanationNode> = failed_clauses
            .iter()
            .map(|c| clause_to_explanation_node(c, Some(false)))
            .collect();

        if !explanation.is_empty() {
            // Near miss: in the same surface group as selected, with at most 1 failed clause
            let grade = if failed_clauses.len() <= 1 {
                if let Some(group) = selected_group {
                    if group
                        .members
                        .iter()
                        .any(|m| m == &carrier.proposal().meaning_id)
                    {
                        WhyNotGrade::NearMiss
                    } else {
                        WhyNotGrade::Wrong
                    }
                } else {
                    WhyNotGrade::Wrong
                }
            } else {
                WhyNotGrade::Wrong
            };

            entries.push(WhyNotEntry {
                call: carrier.call().clone(),
                grade,
                explanation,
                elimination_stage: carrier
                    .traces
                    .elimination
                    .as_ref()
                    .map(|e| e.gate_id.clone())
                    .unwrap_or_else(|| "unknown".into()),
            });
        }
    }

    entries
}

fn clause_to_explanation_node(clause: &MeaningClause, passed: Option<bool>) -> ExplanationNode {
    ExplanationNode {
        kind: ExplanationKind::Condition,
        content: clause
            .description
            .clone()
            .unwrap_or_else(|| clause.fact_id.clone()),
        passed,
        explanation_id: clause.clause_id.clone(),
        template_key: None,
    }
}

fn build_conventions_applied(result: &PipelineResult) -> Vec<ConventionContribution> {
    let mut module_meanings: HashMap<String, Vec<String>> = HashMap::new();

    let all_carriers: Vec<&PipelineCarrier> = result
        .truth_set
        .iter()
        .chain(result.eliminated.iter())
        .collect();

    for carrier in &all_carriers {
        module_meanings
            .entry(carrier.proposal().module_id.clone())
            .or_default()
            .push(carrier.proposal().meaning_id.clone());
    }

    let selected_module = result
        .selected
        .as_ref()
        .map(|c| c.proposal().module_id.clone());

    module_meanings
        .into_iter()
        .map(|(module_id, meanings)| {
            let role = if Some(&module_id) == selected_module.as_ref() {
                ContributionRole::Primary
            } else if result
                .truth_set
                .iter()
                .any(|c| c.proposal().module_id == module_id)
            {
                ContributionRole::Alternative
            } else {
                ContributionRole::Suppressed
            };

            ConventionContribution {
                module_id,
                role,
                meanings_proposed: meanings,
            }
        })
        .collect()
}

fn build_hand_space(_result: &PipelineResult) -> HandSpaceSummary {
    // Basic hand space summary — enriched in Phase 4 with posterior engine data
    HandSpaceSummary {
        seat_label: "South".into(),
        hcp_range: (0.0, 40.0),
        shape_description: "any".into(),
        partner_summary: None,
    }
}

#[cfg(test)]
mod tests {
    use super::project_teaching;
    use crate::adapter::tree_evaluation::{
        CandidateEligibility, EncodingEligibility, HandEligibility, PedagogicalEligibility,
    };
    use crate::pipeline::evaluation::provenance::{
        ApplicabilityEvidence, EncoderKind, EncodingTrace, LegalityTrace,
    };
    use crate::pipeline::evaluation::types::{MeaningProposal, RankingMetadata};
    use crate::pipeline::types::{CarrierTraces, EncodedProposal, PipelineCarrier, PipelineResult};
    use crate::types::authored_text::{BidName, BidSummary, TeachingLabel};
    use crate::types::meaning::{BidEncoding, Disclosure, RecommendationBand, SourceIntent};
    use bridge_engine::types::{BidSuit, Call};

    fn make_call_2c() -> Call {
        Call::Bid {
            level: 2,
            strain: BidSuit::Clubs,
        }
    }

    fn make_result(label_name: &str, summary: &str) -> PipelineResult {
        let proposal = MeaningProposal {
            meaning_id: "dont:clubs-and-higher".to_string(),
            semantic_class_id: "dont:clubs-and-higher".to_string(),
            module_id: "dont".to_string(),
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
                intent_type: "artificial".to_string(),
                params: std::collections::HashMap::new(),
            },
            teaching_label: TeachingLabel {
                name: BidName::new(label_name),
                summary: BidSummary::new(summary),
            },
            surface_bindings: None,
            encoding: BidEncoding {
                default_call: make_call_2c(),
                alternate_encodings: None,
            },
            evidence: None,
        };
        let carrier = PipelineCarrier {
            encoded: EncodedProposal {
                proposal,
                call: make_call_2c(),
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
        };

        PipelineResult {
            selected: Some(carrier.clone()),
            truth_set: vec![carrier],
            acceptable_set: vec![],
            recommended: vec![],
            eliminated: vec![],
            applicability: ApplicabilityEvidence {
                total_surfaces: 1,
                matched_count: 1,
                eliminated_count: 0,
            },
            activation: vec![],
            arbitration: vec![],
            handoffs: vec![],
            evidence_bundle: None,
        }
    }

    #[test]
    fn meaning_view_display_label_uses_safe_call_label_not_anchor_name() {
        let projection = project_teaching(
            &make_result("Opponent's 1NT", "Shows clubs plus a higher suit"),
            None,
        );

        assert_eq!(projection.meaning_views.len(), 1);
        assert_eq!(projection.meaning_views[0].display_label, "Bid 2C");
    }
}
