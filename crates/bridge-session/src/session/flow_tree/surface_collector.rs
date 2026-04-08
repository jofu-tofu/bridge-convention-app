//! Module data collection — reads convention module FSM topology and produces
//! phase maps and transition entries for tree construction.

use std::collections::HashMap;

use bridge_conventions::types::module_types::ConventionModule;
use bridge_conventions::types::system_config::BaseSystemId;

use super::super::learning_formatters::{
    call_key, find_explanation_text, format_bid_references, map_clauses,
};
use super::super::learning_types::RelevantMetric;
use super::super::learning_viewport::compute_post_fit_phases;
use super::tree_helpers::{phase_ref_to_vec, turn_role_str};
use super::types::{ModulePhaseState, TaggedSurface, TransitionEntry};

/// Collect phase map and transitions for a single module.
pub(crate) fn collect_module_data(
    module: &ConventionModule,
    _system: BaseSystemId,
) -> (HashMap<String, Vec<ModulePhaseState>>, Vec<TransitionEntry>) {
    let mut transitions: Vec<TransitionEntry> = Vec::new();
    for t in &module.local.transitions {
        let froms: Vec<String> = phase_ref_to_vec(&t.from)
            .into_iter()
            .map(|s| s.to_string())
            .collect();
        transitions.push(TransitionEntry {
            from: froms,
            to: t.to.clone(),
            on: t.on.clone(),
        });
    }

    let post_fit_phases = compute_post_fit_phases(module);
    let mut phase_map: HashMap<String, Vec<ModulePhaseState>> = HashMap::new();

    for entry in module.states.as_deref().unwrap_or(&[]) {
        let phases = phase_ref_to_vec(&entry.phase);
        for phase in phases {
            let metric = if post_fit_phases.contains(phase) {
                Some(RelevantMetric::TrumpTp)
            } else {
                Some(RelevantMetric::Hcp)
            };

            let surfaces: Vec<TaggedSurface> = entry
                .surfaces
                .iter()
                .map(|s| {
                    let raw_explanation =
                        find_explanation_text(&module.explanation_entries, &s.meaning_id);
                    TaggedSurface {
                        meaning_id: s.meaning_id.clone(),
                        ck: call_key(&s.encoding.default_call),
                        call: s.encoding.default_call.clone(),
                        teaching_label: s.teaching_label.name.as_str().to_string(),
                        module_id: module.module_id.clone(),
                        source_intent: s.source_intent.clone(),
                        recommendation: Some(s.ranking.recommendation_band),
                        disclosure: s.disclosure,
                        explanation_text: raw_explanation.map(|t| format_bid_references(&t)),
                        clauses: map_clauses(&s.clauses, metric),
                    }
                })
                .collect();

            let state = ModulePhaseState {
                module_id: module.module_id.clone(),
                turn: turn_role_str(entry.turn),
                route: entry.route.clone(),
                surfaces,
            };

            phase_map.entry(phase.to_string()).or_default().push(state);
        }
    }

    (phase_map, transitions)
}
