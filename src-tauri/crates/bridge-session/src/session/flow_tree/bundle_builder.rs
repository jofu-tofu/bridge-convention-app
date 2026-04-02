//! Bundle flow tree builder — merges all modules in a bundle into a unified
//! conversation flow tree with cross-module route attachment.

use std::collections::{HashMap, HashSet};

use bridge_conventions::pipeline::observation::normalize_intent::normalize_intent;
use bridge_conventions::pipeline::observation::route_matcher::match_obs;
use bridge_conventions::registry::{get_bundle_input, get_module};
use bridge_conventions::types::meaning::SourceIntent;
use bridge_conventions::types::system_config::BaseSystemId;

use super::super::learning_viewport::derive_entry_condition;

use super::surface_collector::collect_module_data;
use super::tree_assembler::{attach_route_constrained, build_module_subtree};
use super::tree_helpers::{
    max_depth_of, mk_entry_condition_root, mk_node, to_flow_tree_node,
};
use super::types::{BundleFlowTreeViewport, ModulePhaseState, NodeCounter, TransitionEntry};

/// Build a unified conversation flow tree for a bundle.
///
/// Algorithm:
/// 1. Resolve all modules in the bundle.
/// 2. For each module, read its LocalFsm (phases + transitions) and states.
/// 3. Build a tree by walking FSM topology:
///    - Root = the opening bid surface (from whichever module has phase=initial, turn="opener").
///    - Each PhaseTransition says "from phase X, on observation P, go to phase Y."
///      Surfaces at phase Y become children of whichever surface at phase X
///      emitted observation P (matched by the transition's `on` pattern).
/// 4. Merge across modules: deduplicate by callKey at the same auction point.
/// 5. Handle cross-module route constraints (e.g., Smolen under Stayman's denial)
///    in a second pass.
pub fn build_bundle_flow_tree(
    bundle_id: &str,
    system: BaseSystemId,
) -> Option<BundleFlowTreeViewport> {
    let input = get_bundle_input(bundle_id)?;

    let modules: Vec<&bridge_conventions::types::module_types::ConventionModule> = input
        .member_ids
        .iter()
        .filter_map(|id| get_module(id, system))
        .collect();
    if modules.is_empty() {
        return None;
    }

    let mut counter = NodeCounter { value: 0 };

    // Collect module data
    let mut module_phase_map: HashMap<String, HashMap<String, Vec<ModulePhaseState>>> =
        HashMap::new();
    let mut module_transitions: HashMap<String, Vec<TransitionEntry>> = HashMap::new();

    for module in &modules {
        let (phase_map, transitions) = collect_module_data(module, system);
        module_phase_map.insert(module.module_id.clone(), phase_map);
        module_transitions.insert(module.module_id.clone(), transitions);
    }

    // Find the root: opening bid at the initial phase (opener turn)
    let mut root_node = None;
    let mut root_module_id: Option<String> = None;

    for module in &modules {
        let ph_map = match module_phase_map.get(&module.module_id) {
            Some(m) => m,
            None => continue,
        };
        let states = match ph_map.get(&module.local.initial) {
            Some(s) => s,
            None => continue,
        };

        let opener_states: Vec<&ModulePhaseState> = states
            .iter()
            .filter(|s| s.turn.as_deref() == Some("opener") && s.route.is_none())
            .collect();
        if opener_states.is_empty() {
            continue;
        }

        if let Some(first_surface) = opener_states[0].surfaces.first() {
            let mut root = mk_node(
                Some(first_surface),
                &module.local.initial,
                Some("opener"),
                0,
                &mut counter,
                None,
                None,
            );

            // Attach R1 responder surfaces from this module first
            let resp_states: Vec<&ModulePhaseState> = states
                .iter()
                .filter(|s| s.turn.as_deref() == Some("responder") && s.route.is_none())
                .collect();

            struct R1Entry {
                node_idx: usize,
                source_intent: SourceIntent,
            }
            let mut opening_r1: Vec<R1Entry> = Vec::new();

            for state in &resp_states {
                for surface in &state.surfaces {
                    let node = mk_node(
                        Some(surface),
                        &module.local.initial,
                        Some("responder"),
                        1,
                        &mut counter,
                        None,
                        None,
                    );
                    let idx = root.children.len();
                    root.children.push(node);
                    opening_r1.push(R1Entry {
                        node_idx: idx,
                        source_intent: surface.source_intent.clone(),
                    });
                }
            }

            // Build the opening module's own subtree from initial phase
            let mut visited = HashSet::new();
            visited.insert(module.local.initial.clone());
            let empty_trans = Vec::new();
            let transitions = module_transitions
                .get(&module.module_id)
                .unwrap_or(&empty_trans);
            let out_trans: Vec<&TransitionEntry> = transitions
                .iter()
                .filter(|t| t.from.contains(&module.local.initial))
                .collect();

            for trans in out_trans {
                let child_nodes = build_module_subtree(
                    &module.module_id,
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

                // Find matching R1 surface
                let matching_r1 = opening_r1.iter().find(|r1| {
                    let actions = normalize_intent(&r1.source_intent);
                    actions.iter().any(|a| match_obs(&trans.on, a, None))
                });

                if let Some(r1) = matching_r1 {
                    root.children[r1.node_idx].children.extend(child_nodes);
                } else {
                    root.children.extend(child_nodes);
                }
            }

            root_module_id = Some(module.module_id.clone());
            root_node = Some(root);
            break;
        }
    }

    let mut root_node = match root_node {
        Some(r) => r,
        None => {
            // Derive entry condition from the first module's capability
            let first_module_id = modules.first().map(|m| m.module_id.as_str());
            let entry = first_module_id.and_then(derive_entry_condition);
            if let Some(entry) = entry {
                mk_entry_condition_root(&entry, "root", &mut counter)
            } else {
                mk_node(None, "root", None, 0, &mut counter, Some(&input.name), None)
            }
        }
    };

    let root_mod_id = root_module_id
        .or_else(|| root_node.module_id.clone())
        .unwrap_or_default();

    // Attach other modules' subtrees under root
    for module in &modules {
        if module.module_id == root_mod_id {
            continue;
        }
        let ph_map = match module_phase_map.get(&module.module_id) {
            Some(m) => m,
            None => continue,
        };
        let states = match ph_map.get(&module.local.initial) {
            Some(s) => s,
            None => continue,
        };

        let resp_states: Vec<&ModulePhaseState> = states
            .iter()
            .filter(|s| s.turn.as_deref() == Some("responder") && s.route.is_none())
            .collect();

        let mut r1_entries: Vec<(usize, SourceIntent)> = Vec::new();
        let mut seen_ck: HashSet<String> = HashSet::new();
        let transitions = module_transitions
            .get(&module.module_id)
            .cloned()
            .unwrap_or_default();
        let first_active_trans = transitions
            .iter()
            .find(|t| t.from.contains(&module.local.initial) && t.to != "inactive");

        for state in &resp_states {
            for surface in &state.surfaces {
                // Check if already exists as child of root
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
                let r1_node = mk_node(
                    Some(surface),
                    &module.local.initial,
                    Some("responder"),
                    1,
                    &mut counter,
                    None,
                    first_active_trans.map(|t| &t.on),
                );
                let idx = root_node.children.len();
                r1_entries.push((idx, surface.source_intent.clone()));
                root_node.children.push(r1_node);
            }
        }

        // Build the module subtree
        let mut visited = HashSet::new();
        visited.insert(module.local.initial.clone());
        let empty_mod_trans = Vec::new();
        let mod_trans = module_transitions
            .get(&module.module_id)
            .unwrap_or(&empty_mod_trans);
        let out_trans: Vec<&TransitionEntry> = mod_trans
            .iter()
            .filter(|t| t.from.contains(&module.local.initial))
            .collect();

        for trans in out_trans {
            let child_nodes = build_module_subtree(
                &module.module_id,
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

            let matching_r1 = r1_entries.iter().find(|(_, intent)| {
                let actions = normalize_intent(intent);
                actions.iter().any(|a| match_obs(&trans.on, a, None))
            });

            if let Some((idx, _)) = matching_r1 {
                root_node.children[*idx].children.extend(child_nodes);
            } else if let Some((idx, _)) = r1_entries.first() {
                root_node.children[*idx].children.extend(child_nodes);
            }
        }
    }

    // Second pass: route-constrained surfaces
    attach_route_constrained(
        &mut root_node,
        &module_phase_map,
        &modules,
        &mut counter,
    );

    Some(BundleFlowTreeViewport {
        bundle_id: input.id.clone(),
        bundle_name: input.name.clone(),
        root: to_flow_tree_node(&root_node),
        node_count: counter.value,
        max_depth: max_depth_of(&root_node),
    })
}
