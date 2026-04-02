//! Module flow tree builder — builds a standalone conversation flow tree
//! for a single module's FSM topology.

use std::collections::{HashMap, HashSet};

use bridge_conventions::pipeline::observation::normalize_intent::normalize_intent;
use bridge_conventions::pipeline::observation::route_matcher::match_obs;
use bridge_conventions::registry::get_module;
use bridge_conventions::types::meaning::SourceIntent;
use bridge_conventions::types::system_config::BaseSystemId;

use super::super::learning_viewport::{derive_entry_condition, format_module_name};

use super::surface_collector::collect_module_data;
use super::tree_assembler::{attach_route_constrained, build_module_subtree};
use super::tree_helpers::{
    max_depth_of, mk_entry_condition_root, mk_node, to_flow_tree_node,
};
use super::types::{ModuleFlowTreeViewport, ModulePhaseState, NodeCounter, TransitionEntry};

/// Build a conversation flow tree scoped to a single module.
///
/// Unlike `build_bundle_flow_tree` which merges all modules in a bundle,
/// this produces a standalone tree rooted at the module's own FSM topology.
/// Cross-module route attachments are intentionally excluded.
pub fn build_module_flow_tree(
    module_id: &str,
    system: BaseSystemId,
) -> Option<ModuleFlowTreeViewport> {
    let module = get_module(module_id, system)?;

    let mut counter = NodeCounter { value: 0 };
    let (phase_map, transitions) = collect_module_data(module, system);

    // Wrap in the same HashMap<moduleId, ...> shape expected by build_module_subtree
    let mut module_phase_map: HashMap<String, HashMap<String, Vec<ModulePhaseState>>> =
        HashMap::new();
    module_phase_map.insert(module_id.to_string(), phase_map);
    let mut module_transitions: HashMap<String, Vec<TransitionEntry>> = HashMap::new();
    module_transitions.insert(module_id.to_string(), transitions);

    // Find root: opener surface at initial phase
    let initial_states = module_phase_map
        .get(module_id)
        .and_then(|m| m.get(&module.local.initial));

    let mut root_node = None;

    if let Some(states) = initial_states {
        let opener_states: Vec<&ModulePhaseState> = states
            .iter()
            .filter(|s| s.turn.as_deref() == Some("opener") && s.route.is_none())
            .collect();
        if let Some(first_surface) = opener_states.first().and_then(|s| s.surfaces.first()) {
            root_node = Some(mk_node(
                Some(first_surface),
                &module.local.initial,
                Some("opener"),
                0,
                &mut counter,
                None,
                None,
            ));
        }
    }

    // If no opener surface, create synthetic root from entry condition
    let mut root_node = match root_node {
        Some(r) => r,
        None => {
            let entry = derive_entry_condition(module_id);
            if let Some(entry) = entry {
                mk_entry_condition_root(&entry, &module.local.initial, &mut counter)
            } else {
                let name = format_module_name(module_id);
                mk_node(
                    None,
                    &module.local.initial,
                    None,
                    0,
                    &mut counter,
                    Some(&name),
                    None,
                )
            }
        }
    };

    // Attach R1 responder surfaces from initial phase
    struct R1NodeEntry {
        node_idx: usize,
        source_intent: SourceIntent,
    }
    let mut r1_nodes: Vec<R1NodeEntry> = Vec::new();

    if let Some(states) = module_phase_map
        .get(module_id)
        .and_then(|m| m.get(&module.local.initial))
    {
        let resp_states: Vec<&ModulePhaseState> = states
            .iter()
            .filter(|s| s.turn.as_deref() == Some("responder") && s.route.is_none())
            .collect();
        let mut seen_ck: HashSet<String> = HashSet::new();

        for state in &resp_states {
            for surface in &state.surfaces {
                // Check for existing child with same call key
                if let Some(existing) = root_node
                    .children
                    .iter_mut()
                    .find(|c| c.call_key.as_deref() == Some(&surface.ck))
                {
                    if !existing.label.contains(&surface.teaching_label) {
                        existing.label = format!("{} / {}", existing.label, surface.teaching_label);
                    }
                    continue;
                }
                if seen_ck.contains(&surface.ck) {
                    continue;
                }
                seen_ck.insert(surface.ck.clone());
                let node = mk_node(
                    Some(surface),
                    &module.local.initial,
                    Some("responder"),
                    1,
                    &mut counter,
                    None,
                    None,
                );
                let idx = root_node.children.len();
                root_node.children.push(node);
                r1_nodes.push(R1NodeEntry {
                    node_idx: idx,
                    source_intent: surface.source_intent.clone(),
                });
            }
        }
    }

    // Build subtrees from initial phase transitions
    let mut visited = HashSet::new();
    visited.insert(module.local.initial.clone());
    let empty_trans = Vec::new();
    let out_trans: Vec<&TransitionEntry> = module_transitions
        .get(module_id)
        .unwrap_or(&empty_trans)
        .iter()
        .filter(|t| t.from.contains(&module.local.initial))
        .collect();

    for trans in out_trans {
        let child_nodes = build_module_subtree(
            module_id,
            &trans.to,
            1,
            &mut visited,
            &module_phase_map,
            &module_transitions,
            &mut counter,
            Some(&trans.on),
        );
        if child_nodes.is_empty() {
            continue;
        }

        let matching_r1 = r1_nodes.iter().find(|r1| {
            let actions = normalize_intent(&r1.source_intent);
            actions.iter().any(|a| match_obs(&trans.on, a, None))
        });

        if let Some(r1) = matching_r1 {
            root_node.children[r1.node_idx].children.extend(child_nodes);
        } else {
            root_node.children.extend(child_nodes);
        }
    }

    // Route-constrained surfaces (within same module)
    let modules_slice: Vec<&bridge_conventions::types::module_types::ConventionModule> = vec![module];
    attach_route_constrained(
        &mut root_node,
        &module_phase_map,
        &modules_slice,
        &mut counter,
    );

    let max_depth = max_depth_of(&root_node);
    Some(ModuleFlowTreeViewport {
        module_id: module_id.to_string(),
        module_name: format_module_name(module_id),
        root: to_flow_tree_node(root_node),
        node_count: counter.value,
        max_depth,
    })
}
