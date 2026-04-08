//! Projection builder — builds TeachingProjection from PipelineResult.
//!
//! Mirrors TS from `conventions/teaching/teaching-projection-builder.ts`.

use std::collections::HashMap;

use crate::pipeline::evaluation::types::MeaningClause;
use crate::pipeline::types::{PipelineCarrier, PipelineResult};
use crate::teaching::teaching_types::*;

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
            display_label: carrier.proposal().teaching_label.name.to_string(),
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
            display_label: carrier.proposal().teaching_label.name.to_string(),
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
        nodes.push(ExplanationNode {
            kind: ExplanationKind::Text,
            content: format!(
                "Your hand matches {}",
                selected.proposal().teaching_label.name
            ),
            passed: None,
            explanation_id: None,
            template_key: None,
        });

        for clause in &selected.proposal().clauses {
            nodes.push(clause_to_explanation_node(clause, Some(clause.satisfied)));
        }
    }

    nodes
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
