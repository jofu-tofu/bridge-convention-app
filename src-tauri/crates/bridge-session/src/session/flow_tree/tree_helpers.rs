//! Node construction and tree utility functions for flow tree building.

use bridge_conventions::pipeline::observation::normalize_intent::normalize_intent;
use bridge_conventions::pipeline::observation::route_matcher::match_obs;
use bridge_conventions::types::rule_types::{ObsPattern, ObsPatternAct, PhaseRef, TurnRole};

use super::super::build_viewport::format_call;
use super::super::learning_viewport::{
    call_key, format_module_name, EntryCondition,
};
use super::types::{
    FlowTreeNode, MutableNode, NodeCounter, TaggedSurface,
};

// ── PhaseRef helper ─────────────────────────────────────────────────

pub(crate) fn phase_ref_to_vec(pr: &PhaseRef) -> Vec<&str> {
    match pr {
        PhaseRef::Single(s) => vec![s.as_str()],
        PhaseRef::Multiple(v) => v.iter().map(|s| s.as_str()).collect(),
    }
}

// ── Node construction ───────────────────────────────────────────────

pub(crate) fn mk_node(
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

pub(crate) fn mk_entry_condition_root(
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

// ── Tree traversal / conversion ─────────────────────────────────────

pub(crate) fn to_flow_tree_node(node: &MutableNode) -> FlowTreeNode {
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

pub(crate) fn max_depth_of(node: &MutableNode) -> usize {
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
pub(crate) fn obs_matches_step(obs: Option<&ObsPattern>, step: &ObsPattern) -> bool {
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
pub(crate) fn surface_matches_transition(surface: &TaggedSurface, trans_on: &ObsPattern) -> bool {
    let actions = normalize_intent(&surface.source_intent);
    actions.iter().any(|action| match_obs(trans_on, action, None))
}

/// Find a node by ID (immutable).
pub(crate) fn find_node<'a>(node: &'a MutableNode, id: &str) -> Option<&'a MutableNode> {
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
pub(crate) fn find_node_mut<'a>(node: &'a mut MutableNode, id: &str) -> Option<&'a mut MutableNode> {
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

/// Turn role to string for turn field.
pub(crate) fn turn_role_str(turn: Option<TurnRole>) -> Option<String> {
    turn.map(|t| match t {
        TurnRole::Opener => "opener".to_string(),
        TurnRole::Responder => "responder".to_string(),
        TurnRole::Opponent => "opponent".to_string(),
    })
}
