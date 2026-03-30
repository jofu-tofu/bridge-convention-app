//! Flow tree builder — builds conversation flow trees for bundles and modules.
//!
//! Rust port of TS `src/session/flow-tree-builder.ts`. Reads convention module
//! FSM topology and produces FlowTreeNode hierarchies for UI consumption.

use std::collections::{HashMap, HashSet};

use bridge_conventions::pipeline::observation::normalize_intent::normalize_intent;
use bridge_conventions::pipeline::observation::route_matcher::match_obs;
use bridge_conventions::registry::{get_bundle_input, get_module};
use bridge_conventions::types::meaning::{Disclosure, RecommendationBand, SourceIntent};
use bridge_conventions::types::module_types::ConventionModule;
use bridge_conventions::types::rule_types::{
    ObsPattern, ObsPatternAct, PhaseRef, RouteExpr, TurnRole,
};
use bridge_conventions::types::system_config::BaseSystemId;
use bridge_engine::types::Call;
use serde::{Deserialize, Serialize};

use super::build_viewport::format_call;
use super::learning_viewport::{
    call_key, compute_post_fit_phases, derive_entry_condition, find_explanation_text,
    format_bid_references, format_module_name, map_clauses, EntryCondition, RelevantMetric,
    SurfaceClauseView,
};

// ── PhaseRef helper ─────────────────────────────────────────────────

fn phase_ref_to_vec(pr: &PhaseRef) -> Vec<&str> {
    match pr {
        PhaseRef::Single(s) => vec![s.as_str()],
        PhaseRef::Multiple(v) => v.iter().map(|s| s.as_str()).collect(),
    }
}

// ── Exported Types ──────────────────────────────────────────────────

/// A node in the unified conversation flow tree.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlowTreeNode {
    pub id: String,
    pub call: Option<Call>,
    pub call_display: Option<String>,
    pub turn: Option<String>,
    pub label: String,
    pub module_id: Option<String>,
    pub module_display_name: Option<String>,
    pub children: Vec<FlowTreeNode>,
    pub depth: usize,
    pub recommendation: Option<RecommendationBand>,
    pub disclosure: Option<Disclosure>,
    pub explanation_text: Option<String>,
    pub clauses: Vec<SurfaceClauseView>,
}

/// Unified conversation flow tree for a bundle.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BundleFlowTreeViewport {
    pub bundle_id: String,
    pub bundle_name: String,
    pub root: FlowTreeNode,
    pub node_count: usize,
    pub max_depth: usize,
}

/// Conversation flow tree scoped to a single module.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleFlowTreeViewport {
    pub module_id: String,
    pub module_name: String,
    pub root: FlowTreeNode,
    pub node_count: usize,
    pub max_depth: usize,
}

// ── Internal Types ──────────────────────────────────────────────────

struct TaggedSurface {
    meaning_id: String,
    ck: String,
    call: Call,
    teaching_label: String,
    module_id: String,
    source_intent: SourceIntent,
    recommendation: Option<RecommendationBand>,
    disclosure: Disclosure,
    explanation_text: Option<String>,
    clauses: Vec<SurfaceClauseView>,
}

#[allow(dead_code)] // phase is used during tree construction for identification
struct MutableNode {
    id: String,
    call_key: Option<String>,
    call: Option<Call>,
    turn: Option<String>,
    label: String,
    module_id: Option<String>,
    module_display_name: Option<String>,
    children: Vec<MutableNode>,
    depth: usize,
    phase: String,
    transition_obs: Option<ObsPattern>,
    recommendation: Option<RecommendationBand>,
    disclosure: Option<Disclosure>,
    explanation_text: Option<String>,
    clauses: Vec<SurfaceClauseView>,
}

struct ModulePhaseState {
    module_id: String,
    turn: Option<String>,
    route: Option<RouteExpr>,
    surfaces: Vec<TaggedSurface>,
}

#[derive(Clone)]
struct TransitionEntry {
    from: Vec<String>,
    to: String,
    on: ObsPattern,
}

struct NodeCounter {
    value: usize,
}

// ── Internal Helpers ────────────────────────────────────────────────

fn mk_node(
    surface: Option<&TaggedSurface>,
    phase: &str,
    turn: Option<&str>,
    depth: usize,
    counter: &mut NodeCounter,
    label_override: Option<&str>,
    trans_obs: Option<&ObsPattern>,
) -> MutableNode {
    let idx = counter.value;
    counter.value += 1;

    match surface {
        Some(s) => MutableNode {
            id: format!("{}:{}:{}", s.module_id, s.meaning_id, idx),
            call_key: Some(s.ck.clone()),
            call: Some(s.call.clone()),
            turn: turn.map(|t| t.to_string()),
            label: label_override
                .map(|l| l.to_string())
                .unwrap_or_else(|| s.teaching_label.clone()),
            module_id: Some(s.module_id.clone()),
            module_display_name: Some(format_module_name(&s.module_id)),
            children: Vec::new(),
            depth,
            phase: phase.to_string(),
            transition_obs: trans_obs.cloned(),
            recommendation: s.recommendation,
            disclosure: Some(s.disclosure),
            explanation_text: s.explanation_text.clone(),
            clauses: s.clauses.clone(),
        },
        None => MutableNode {
            id: format!("root:{}:{}", phase, idx),
            call_key: None,
            call: None,
            turn: turn.map(|t| t.to_string()),
            label: label_override
                .map(|l| l.to_string())
                .unwrap_or_else(|| phase.to_string()),
            module_id: None,
            module_display_name: None,
            children: Vec::new(),
            depth,
            phase: phase.to_string(),
            transition_obs: trans_obs.cloned(),
            recommendation: None,
            disclosure: None,
            explanation_text: None,
            clauses: Vec::new(),
        },
    }
}

fn mk_entry_condition_root(
    entry: &EntryCondition,
    phase: &str,
    counter: &mut NodeCounter,
) -> MutableNode {
    let idx = counter.value;
    counter.value += 1;
    MutableNode {
        id: format!("root:{}:{}", phase, idx),
        call_key: entry.call.as_ref().map(call_key),
        call: entry.call.clone(),
        turn: entry.turn.clone(),
        label: entry.label.clone(),
        module_id: None,
        module_display_name: None,
        children: Vec::new(),
        depth: 0,
        phase: phase.to_string(),
        transition_obs: None,
        recommendation: None,
        disclosure: None,
        explanation_text: None,
        clauses: Vec::new(),
    }
}

fn to_flow_tree_node(node: &MutableNode) -> FlowTreeNode {
    FlowTreeNode {
        id: node.id.clone(),
        call: node.call.clone(),
        call_display: node.call.as_ref().map(format_call),
        turn: node.turn.clone(),
        label: node.label.clone(),
        module_id: node.module_id.clone(),
        module_display_name: node.module_display_name.clone(),
        children: node.children.iter().map(to_flow_tree_node).collect(),
        depth: node.depth,
        recommendation: node.recommendation,
        disclosure: node.disclosure,
        explanation_text: node.explanation_text.clone(),
        clauses: node.clauses.clone(),
    }
}

fn max_depth_of(node: &MutableNode) -> usize {
    if node.children.is_empty() {
        return node.depth;
    }
    node.children
        .iter()
        .map(max_depth_of)
        .max()
        .unwrap_or(node.depth)
}

/// Check if a tree node's incoming observation matches the given ObsPattern step.
fn obs_matches_step(obs: Option<&ObsPattern>, step: &ObsPattern) -> bool {
    let obs = match obs {
        Some(o) => o,
        None => return false,
    };
    match &step.act {
        ObsPatternAct::Any => {}
        ObsPatternAct::Specific(step_act) => match &obs.act {
            ObsPatternAct::Any => return false,
            ObsPatternAct::Specific(obs_act) => {
                if obs_act != step_act {
                    return false;
                }
            }
        },
    }
    if step.feature.is_some() && obs.feature != step.feature {
        return false;
    }
    if step.suit.is_some() && obs.suit != step.suit {
        return false;
    }
    if step.strain.is_some() && obs.strain != step.strain {
        return false;
    }
    true
}

/// Check if a surface's sourceIntent produces observations that match a transition's `on` pattern.
fn surface_matches_transition(surface: &TaggedSurface, trans_on: &ObsPattern) -> bool {
    let actions = normalize_intent(&surface.source_intent);
    actions.iter().any(|action| match_obs(trans_on, action, None))
}

/// Build a subtree for one module starting from a given phase.
fn build_module_subtree(
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
    let normal_states: Vec<&ModulePhaseState> = states.iter().filter(|s| s.route.is_none()).collect();
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

/// Turn role to string for turn field.
fn turn_role_str(turn: Option<TurnRole>) -> Option<String> {
    turn.map(|t| match t {
        TurnRole::Opener => "opener".to_string(),
        TurnRole::Responder => "responder".to_string(),
        TurnRole::Opponent => "opponent".to_string(),
    })
}

/// Collect phase map and transitions for a single module.
fn collect_module_data(
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

            phase_map
                .entry(phase.to_string())
                .or_default()
                .push(state);
        }
    }

    (phase_map, transitions)
}

/// Attach route-constrained surfaces to the tree (second pass).
/// Only `RouteExpr::Subseq` is supported; other variants log a warning and attach at root.
fn attach_route_constrained(
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
                        let matched =
                            walk_subseq_route(root_node, steps, state, counter);
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
    // Collect matching node IDs for each step, then attach at the end.
    // We need to do a BFS through the tree following the steps sequence.

    // First, collect the path of node IDs we need to follow.
    // We'll do this non-mutably first, then mutate.
    let attach_id = find_subseq_attach_point(root, steps);

    if let Some(target_id) = attach_id {
        // Now find and mutate that node
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
    let mut current_ids: Vec<String> = vec![node.id.clone()];

    for step in steps {
        let mut next_ids: Vec<String> = Vec::new();
        let mut search_queue: Vec<String> = current_ids.clone();
        let mut searched: HashSet<String> = HashSet::new();

        while let Some(node_id) = search_queue.first().cloned() {
            search_queue.remove(0);
            if searched.contains(&node_id) {
                continue;
            }
            searched.insert(node_id.clone());

            if let Some(n) = find_node(node, &node_id) {
                for child in &n.children {
                    if obs_matches_step(child.transition_obs.as_ref(), step) {
                        next_ids.push(child.id.clone());
                    } else {
                        search_queue.push(child.id.clone());
                    }
                }
            }
        }

        if next_ids.is_empty() {
            return None;
        }
        current_ids = next_ids;
    }

    current_ids.into_iter().next()
}

/// Find a node by ID (immutable).
fn find_node<'a>(node: &'a MutableNode, id: &str) -> Option<&'a MutableNode> {
    if node.id == id {
        return Some(node);
    }
    for child in &node.children {
        if let Some(found) = find_node(child, id) {
            return Some(found);
        }
    }
    None
}

/// Find a node by ID (mutable).
fn find_node_mut<'a>(node: &'a mut MutableNode, id: &str) -> Option<&'a mut MutableNode> {
    if node.id == id {
        return Some(node);
    }
    for child in &mut node.children {
        if let Some(found) = find_node_mut(child, id) {
            return Some(found);
        }
    }
    None
}

// ── Bundle Flow Tree ────────────────────────────────────────────────

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

    let modules: Vec<&ConventionModule> = input
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
    let mut root_node: Option<MutableNode> = None;
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

// ── Module Flow Tree ────────────────────────────────────────────────

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
    let transitions_for_lookup = transitions.clone();
    module_transitions.insert(module_id.to_string(), transitions);

    // Find root: opener surface at initial phase
    let initial_states = module_phase_map
        .get(module_id)
        .and_then(|m| m.get(&module.local.initial));

    let mut root_node: Option<MutableNode> = None;

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
    let out_trans: Vec<&TransitionEntry> = transitions_for_lookup
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
    let modules_slice: Vec<&ConventionModule> = vec![module];
    attach_route_constrained(
        &mut root_node,
        &module_phase_map,
        &modules_slice,
        &mut counter,
    );

    Some(ModuleFlowTreeViewport {
        module_id: module_id.to_string(),
        module_name: format_module_name(module_id),
        root: to_flow_tree_node(&root_node),
        node_count: counter.value,
        max_depth: max_depth_of(&root_node),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_conventions::types::bid_action::{BidActionType, HandFeature};

    #[test]
    fn max_depth_of_leaf() {
        let mut counter = NodeCounter { value: 0 };
        let node = mk_node(None, "root", None, 0, &mut counter, Some("Root"), None);
        assert_eq!(max_depth_of(&node), 0);
    }

    #[test]
    fn max_depth_of_nested() {
        let mut counter = NodeCounter { value: 0 };
        let child2 = mk_node(None, "deep", None, 2, &mut counter, Some("Deep"), None);
        let mut child1 = mk_node(None, "mid", None, 1, &mut counter, Some("Mid"), None);
        child1.children.push(child2);
        let mut root = mk_node(None, "root", None, 0, &mut counter, Some("Root"), None);
        root.children.push(child1);
        assert_eq!(max_depth_of(&root), 2);
    }

    #[test]
    fn obs_matches_step_any_act() {
        let obs = ObsPattern {
            act: ObsPatternAct::Specific(BidActionType::Show),
            feature: Some(HandFeature::HeldSuit),
            suit: None,
            strain: None,
            strength: None,
            actor: None,
        };
        let step = ObsPattern {
            act: ObsPatternAct::Any,
            feature: None,
            suit: None,
            strain: None,
            strength: None,
            actor: None,
        };
        assert!(obs_matches_step(Some(&obs), &step));
    }

    #[test]
    fn obs_matches_step_specific_match() {
        let obs = ObsPattern {
            act: ObsPatternAct::Specific(BidActionType::Inquire),
            feature: Some(HandFeature::MajorSuit),
            suit: None,
            strain: None,
            strength: None,
            actor: None,
        };
        let step = ObsPattern {
            act: ObsPatternAct::Specific(BidActionType::Inquire),
            feature: Some(HandFeature::MajorSuit),
            suit: None,
            strain: None,
            strength: None,
            actor: None,
        };
        assert!(obs_matches_step(Some(&obs), &step));
    }

    #[test]
    fn obs_matches_step_mismatch() {
        let obs = ObsPattern {
            act: ObsPatternAct::Specific(BidActionType::Show),
            feature: Some(HandFeature::HeldSuit),
            suit: None,
            strain: None,
            strength: None,
            actor: None,
        };
        let step = ObsPattern {
            act: ObsPatternAct::Specific(BidActionType::Inquire),
            feature: None,
            suit: None,
            strain: None,
            strength: None,
            actor: None,
        };
        assert!(!obs_matches_step(Some(&obs), &step));
    }

    #[test]
    fn obs_matches_step_none_obs() {
        let step = ObsPattern {
            act: ObsPatternAct::Any,
            feature: None,
            suit: None,
            strain: None,
            strength: None,
            actor: None,
        };
        assert!(!obs_matches_step(None, &step));
    }

    #[test]
    fn obs_matches_step_feature_mismatch() {
        let obs = ObsPattern {
            act: ObsPatternAct::Specific(BidActionType::Show),
            feature: Some(HandFeature::HeldSuit),
            suit: None,
            strain: None,
            strength: None,
            actor: None,
        };
        let step = ObsPattern {
            act: ObsPatternAct::Specific(BidActionType::Show),
            feature: Some(HandFeature::MajorSuit),
            suit: None,
            strain: None,
            strength: None,
            actor: None,
        };
        assert!(!obs_matches_step(Some(&obs), &step));
    }

    #[test]
    fn build_module_flow_tree_stayman() {
        let result = build_module_flow_tree("stayman", BaseSystemId::Sayc);
        assert!(
            result.is_some(),
            "build_module_flow_tree('stayman') should return Some"
        );
        let viewport = result.unwrap();
        assert_eq!(viewport.module_id, "stayman");
        assert!(!viewport.module_name.is_empty());
        assert!(viewport.node_count > 0);
    }

    #[test]
    fn build_bundle_flow_tree_nt_bundle() {
        let result = build_bundle_flow_tree("nt-bundle", BaseSystemId::Sayc);
        assert!(
            result.is_some(),
            "build_bundle_flow_tree('nt-bundle') should return Some"
        );
        let viewport = result.unwrap();
        assert_eq!(viewport.bundle_id, "nt-bundle");
        assert!(viewport.node_count > 0);
        assert!(viewport.max_depth > 0);
    }
}
