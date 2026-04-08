//! Tree structure assembly — recursive subtree building, route-constrained
//! surface attachment, and subsequence route walking.

use std::collections::{HashMap, HashSet};

use bridge_conventions::types::module_types::ConventionModule;
use bridge_conventions::types::rule_types::{ObsPattern, RouteExpr};

use super::tree_helpers::{
    find_node, find_node_mut, mk_node, obs_matches_step, surface_matches_transition,
};
use super::types::{ModulePhaseState, MutableNode, NodeCounter, TaggedSurface, TransitionEntry};

/// Build a subtree for one module starting from a given phase.
pub(crate) fn build_module_subtree(
    mod_id: &str,
    phase: &str,
    parent_depth: usize,
    visited: &mut HashSet<String>,
    module_phase_map: &HashMap<String, HashMap<String, Vec<ModulePhaseState>>>,
    module_transitions: &HashMap<String, Vec<TransitionEntry>>,
    counter: &mut NodeCounter,
    trans_obs: Option<&ObsPattern>,
) -> Vec<MutableNode> {
    if visited.contains(phase) {
        return Vec::new();
    }
    visited.insert(phase.to_string());

    let ph_map = match module_phase_map.get(mod_id) {
        Some(m) => m,
        None => return Vec::new(),
    };
    let states = match ph_map.get(phase) {
        Some(s) => s,
        None => return Vec::new(),
    };
    let transitions = module_transitions.get(mod_id);

    // Collect surfaces at this phase (excluding route-constrained ones)
    let normal_states: Vec<&ModulePhaseState> =
        states.iter().filter(|s| s.route.is_none()).collect();
    let mut nodes: Vec<MutableNode> = Vec::new();
    let mut node_surfaces: Vec<&TaggedSurface> = Vec::new();
    let mut seen_ck: HashSet<String> = HashSet::new();

    for state in &normal_states {
        for surface in &state.surfaces {
            if seen_ck.contains(&surface.ck) {
                continue;
            }
            seen_ck.insert(surface.ck.clone());
            let node = mk_node(
                Some(surface),
                phase,
                state.turn.as_deref(),
                parent_depth + 1,
                counter,
                None,
                trans_obs,
            );
            nodes.push(node);
            node_surfaces.push(surface);
        }
    }

    if let Some(trans_list) = transitions {
        let out_trans: Vec<&TransitionEntry> = trans_list
            .iter()
            .filter(|t| t.from.contains(&phase.to_string()))
            .collect();
        for trans in out_trans {
            let child_nodes = build_module_subtree(
                mod_id,
                &trans.to,
                parent_depth + 1,
                visited,
                module_phase_map,
                module_transitions,
                counter,
                Some(&trans.on),
            );
            if child_nodes.is_empty() {
                continue;
            }

            let match_idx = node_surfaces
                .iter()
                .position(|s| surface_matches_transition(s, &trans.on));
            let parent_idx = match_idx.unwrap_or(0);
            if let Some(parent) = nodes.get_mut(parent_idx) {
                parent.children.extend(child_nodes);
            }
        }
    }

    nodes
}

/// Attach route-constrained surfaces to the tree (second pass).
/// Only `RouteExpr::Subseq` is supported; other variants log a warning and attach at root.
pub(crate) fn attach_route_constrained(
    root_node: &mut MutableNode,
    module_phase_map: &HashMap<String, HashMap<String, Vec<ModulePhaseState>>>,
    modules: &[&ConventionModule],
    counter: &mut NodeCounter,
) {
    for module in modules {
        let ph_map = match module_phase_map.get(&module.module_id) {
            Some(m) => m,
            None => continue,
        };

        for states in ph_map.values() {
            for state in states {
                let route = match &state.route {
                    Some(r) => r,
                    None => continue,
                };

                match route {
                    RouteExpr::Subseq { steps } => {
                        let matched = walk_subseq_route(root_node, steps, state, counter);
                        if !matched {
                            eprintln!(
                                "[flow-tree] Route unresolved for module {} — attaching at root",
                                state.module_id
                            );
                            for surface in &state.surfaces {
                                root_node.children.push(mk_node(
                                    Some(surface),
                                    "route-fallback",
                                    state.turn.as_deref(),
                                    root_node.depth + 1,
                                    counter,
                                    None,
                                    None,
                                ));
                            }
                        }
                    }
                    _ => {
                        eprintln!(
                            "[flow-tree] Unsupported RouteExpr kind for module {} — attaching at root",
                            state.module_id
                        );
                        for surface in &state.surfaces {
                            root_node.children.push(mk_node(
                                Some(surface),
                                "route-fallback",
                                state.turn.as_deref(),
                                root_node.depth + 1,
                                counter,
                                None,
                                None,
                            ));
                        }
                    }
                }
            }
        }
    }
}

/// Walk a Subseq route through the tree, attaching surfaces at the matched point.
/// Returns true if attachment succeeded.
fn walk_subseq_route(
    root: &mut MutableNode,
    steps: &[ObsPattern],
    state: &ModulePhaseState,
    counter: &mut NodeCounter,
) -> bool {
    let attach_id = find_subseq_attach_point(root, steps);

    if let Some(target_id) = attach_id {
        if let Some(attach_point) = find_node_mut(root, &target_id) {
            let attach_depth = attach_point.depth;
            for surface in &state.surfaces {
                let already_exists = attach_point
                    .children
                    .iter()
                    .any(|c| c.call_key.as_deref() == Some(&surface.ck));
                if !already_exists {
                    attach_point.children.push(mk_node(
                        Some(surface),
                        "route-attached",
                        state.turn.as_deref(),
                        attach_depth + 1,
                        counter,
                        None,
                        None,
                    ));
                }
            }
            return true;
        }
    }
    false
}

/// Find the ID of the node where subseq route steps end up.
fn find_subseq_attach_point(node: &MutableNode, steps: &[ObsPattern]) -> Option<String> {
    let mut current_ids: Vec<&str> = vec![&node.id];

    for step in steps {
        let mut next_ids: Vec<&str> = Vec::new();
        let mut search_queue: Vec<&str> = current_ids.clone();
        let mut searched: HashSet<&str> = HashSet::new();

        while let Some(&node_id) = search_queue.first() {
            search_queue.remove(0);
            if !searched.insert(node_id) {
                continue;
            }

            if let Some(n) = find_node(node, node_id) {
                for child in &n.children {
                    if obs_matches_step(child.transition_obs.as_ref(), step) {
                        next_ids.push(&child.id);
                    } else {
                        search_queue.push(&child.id);
                    }
                }
            }
        }

        if next_ids.is_empty() {
            return None;
        }
        current_ids = next_ids;
    }

    current_ids.first().map(|s| s.to_string())
}
