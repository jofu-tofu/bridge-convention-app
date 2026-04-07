//! Learning viewport builders — projects convention module internals into
//! viewport response types for UI consumption.
//!
//! Type definitions live in `learning_types.rs`. Formatting/text helpers
//! live in `learning_formatters.rs`. This file contains only the viewport
//! builder functions and their supporting helpers.
//!
//! Ported from TS `src/session/learning-viewport.ts`.

use std::collections::{HashMap, HashSet, VecDeque};

use bridge_conventions::pipeline::observation::normalize_intent::normalize_intent;
use bridge_conventions::pipeline::observation::route_matcher::match_obs;
use bridge_conventions::registry::bundle_registry::list_bundle_inputs;
use bridge_conventions::registry::module_registry::{
    get_all_modules, get_base_module_ids, get_module,
};
use bridge_conventions::rule_types::TurnRole;
use bridge_conventions::{BaseSystemId, ConventionModule, LocalFsm, ObsPattern, PhaseRef};
use bridge_engine::types::{BidSuit, Call};

use super::build_viewport::format_call;
use super::format_obs_label::format_transition_label;
use super::learning_formatters::{
    find_explanation_text, format_bid_references, format_module_name, format_phase_display,
    map_clauses, module_surfaces,
};
use super::learning_types::{
    BaseModuleInfo, EntryCondition, LearningTeachingView, ModuleCatalogEntry,
    ModuleLearningViewport, PhaseGroupView, RelevantMetric, ServiceTeachingLabel,
    SurfaceDetailView,
};

// ── PhaseRef helpers ─────────────────────────────────────────────────

fn phase_ref_to_vec(pr: &PhaseRef) -> Vec<&str> {
    match pr {
        PhaseRef::Single(s) => vec![s.as_str()],
        PhaseRef::Multiple(v) => v.iter().map(|s| s.as_str()).collect(),
    }
}

// ── Module catalog ───────────────────────────────────────────────────

/// Build module catalog entries for all registered modules.
pub fn build_module_catalog(system: BaseSystemId) -> Vec<ModuleCatalogEntry> {
    let all_modules = get_all_modules(system);
    let bundle_inputs = list_bundle_inputs();

    // Build reverse map: moduleId → bundleIds that contain it
    let mut module_bundles: HashMap<&str, Vec<String>> = HashMap::new();
    for input in bundle_inputs {
        for member_id in &input.member_ids {
            module_bundles
                .entry(member_id.as_str())
                .or_default()
                .push(input.id.clone());
        }
    }

    all_modules
        .iter()
        .map(|m| ModuleCatalogEntry {
            module_id: m.module_id.clone(),
            display_name: format_module_name(&m.module_id),
            description: format_bid_references(m.description.as_str()),
            purpose: format_bid_references(m.purpose.as_str()),
            surface_count: module_surfaces(m).len(),
            bundle_ids: module_bundles
                .get(m.module_id.as_str())
                .cloned()
                .unwrap_or_default(),
        })
        .collect()
}

/// Build read-only metadata for base system modules (for settings display).
pub fn build_base_module_infos(base_system_id: BaseSystemId) -> Vec<BaseModuleInfo> {
    let ids = get_base_module_ids(base_system_id);
    ids.iter()
        .filter_map(|&id| {
            let m = get_module(id, base_system_id)?;
            Some(BaseModuleInfo {
                id: id.to_string(),
                display_name: format_module_name(id),
                description: m.description.as_str().to_string(),
            })
        })
        .collect()
}

// ── Module learning viewport ─────────────────────────────────────────

/// Build a full learning viewport for a single module.
pub fn build_module_learning_viewport(
    module_id: &str,
    system: BaseSystemId,
) -> Option<ModuleLearningViewport> {
    let m = get_module(module_id, system)?;

    let bundle_inputs = list_bundle_inputs();
    let bundle_ids: Vec<String> = bundle_inputs
        .iter()
        .filter(|b| b.member_ids.iter().any(|mid| mid == module_id))
        .map(|b| b.id.clone())
        .collect();

    let teaching = &m.teaching;
    let phases = build_phase_groups(m, system);

    Some(ModuleLearningViewport {
        module_id: m.module_id.clone(),
        display_name: format_module_name(&m.module_id),
        description: format_bid_references(m.description.as_str()),
        purpose: format_bid_references(m.purpose.as_str()),
        teaching: LearningTeachingView {
            tradeoff: {
                let s = teaching.tradeoff.as_str();
                if s.is_empty() {
                    None
                } else {
                    Some(format_bid_references(s))
                }
            },
            principle: {
                let s = teaching.principle.as_str();
                if s.is_empty() {
                    None
                } else {
                    Some(format_bid_references(s))
                }
            },
            common_mistakes: teaching
                .common_mistakes
                .iter()
                .map(|item| format_bid_references(item.as_str()))
                .collect(),
        },
        phases,
        bundle_ids,
    })
}

// ── Phase ordering ───────────────────────────────────────────────────

/// Derive topological phase order from LocalFsm transitions via BFS.
pub fn derive_phase_order(fsm: &LocalFsm) -> Vec<String> {
    let mut phases = vec![fsm.initial.clone()];
    let mut seen = HashSet::new();
    seen.insert(fsm.initial.as_str().to_string());

    // Build adjacency map
    let mut adjacency: HashMap<String, Vec<String>> = HashMap::new();
    for t in &fsm.transitions {
        let froms = phase_ref_to_vec(&t.from);
        for f in froms {
            let entry = adjacency.entry(f.to_string()).or_default();
            if !entry.contains(&t.to) {
                entry.push(t.to.clone());
            }
        }
    }

    let mut queue = VecDeque::new();
    queue.push_back(fsm.initial.clone());

    while let Some(current) = queue.pop_front() {
        if let Some(neighbors) = adjacency.get(&current) {
            for next in neighbors {
                if seen.insert(next.clone()) {
                    phases.push(next.clone());
                    queue.push_back(next.clone());
                }
            }
        }
    }

    phases
}

/// Compute the set of post-fit phases for a module.
/// A phase is post-fit if any StateEntry at that phase has `negotiationDelta.fitAgreed`
/// truthy, or if it's reachable downstream from such a phase via FSM transitions.
pub fn compute_post_fit_phases(module: &ConventionModule) -> HashSet<String> {
    let mut fit_phases = HashSet::new();

    for entry in module.states.as_deref().unwrap_or(&[]) {
        let has_fit = entry
            .negotiation_delta
            .as_ref()
            .and_then(|nd| nd.fit_agreed.as_ref())
            .is_some();

        if has_fit {
            for p in phase_ref_to_vec(&entry.phase) {
                fit_phases.insert(p.to_string());
            }
        }
    }

    // Build adjacency from transitions
    let mut adjacency: HashMap<String, Vec<String>> = HashMap::new();
    for t in &module.local.transitions {
        for f in phase_ref_to_vec(&t.from) {
            let entry = adjacency.entry(f.to_string()).or_default();
            if !entry.contains(&t.to) {
                entry.push(t.to.clone());
            }
        }
    }

    // BFS from fit-establishing phases
    let mut result = fit_phases.clone();
    let mut queue: VecDeque<String> = fit_phases.into_iter().collect();
    while let Some(current) = queue.pop_front() {
        if let Some(neighbors) = adjacency.get(&current) {
            for next in neighbors {
                if result.insert(next.clone()) {
                    queue.push_back(next.clone());
                }
            }
        }
    }

    result
}

// ── Entry condition ──────────────────────────────────────────────────

/// Capability → entry condition mapping.
fn cap_entry_conditions() -> HashMap<&'static str, EntryCondition> {
    let mut map = HashMap::new();
    map.insert(
        "opening.1nt",
        EntryCondition {
            label: "Partner opened 1NT".to_string(),
            call: Some(Call::Bid {
                level: 1,
                strain: BidSuit::NoTrump,
            }),
            turn: Some("opener".to_string()),
        },
    );
    map.insert(
        "opening.major",
        EntryCondition {
            label: "Partner opened a major".to_string(),
            call: None,
            turn: Some("opener".to_string()),
        },
    );
    map.insert(
        "opening.weak-two",
        EntryCondition {
            label: "Partner opened a weak two".to_string(),
            call: None,
            turn: Some("opener".to_string()),
        },
    );
    map.insert(
        "opponent.1nt",
        EntryCondition {
            label: "Opponent opened 1NT".to_string(),
            call: Some(Call::Bid {
                level: 1,
                strain: BidSuit::NoTrump,
            }),
            turn: None,
        },
    );
    map
}

/// Get the primary capability key from declared capabilities.
fn get_primary_capability(
    declared_capabilities: Option<&HashMap<String, String>>,
) -> Option<String> {
    let caps = declared_capabilities?;
    caps.keys().next().cloned()
}

/// Derive full entry condition from the module's host capability.
pub fn derive_entry_condition(module_id: &str) -> Option<EntryCondition> {
    let conditions = cap_entry_conditions();
    for input in list_bundle_inputs() {
        if !input.member_ids.iter().any(|id| id == module_id) {
            continue;
        }
        let cap_id = get_primary_capability(input.declared_capabilities.as_ref())?;
        if let Some(ec) = conditions.get(cap_id.as_str()) {
            return Some(ec.clone());
        }
    }
    None
}

/// Derive root phase label from the module's host capability.
fn derive_root_phase_label(module_id: &str) -> Option<String> {
    derive_entry_condition(module_id).map(|ec| ec.label)
}

/// Find the first surface at a given phase whose normalized intent matches a transition obs pattern.
fn find_trigger_call(
    module: &ConventionModule,
    from_phase: &str,
    obs: &ObsPattern,
) -> Option<Call> {
    for entry in module.states.as_deref().unwrap_or(&[]) {
        let entry_phases = phase_ref_to_vec(&entry.phase);
        if !entry_phases.contains(&from_phase) {
            continue;
        }
        for surface in &entry.surfaces {
            let actions = normalize_intent(&surface.source_intent);
            if actions.iter().any(|a| match_obs(obs, a, None)) {
                return Some(surface.encoding.default_call.clone());
            }
        }
    }
    None
}

/// Convert TurnRole to display string.
fn turn_role_display(role: TurnRole) -> &'static str {
    match role {
        TurnRole::Opener => "opener",
        TurnRole::Responder => "responder",
        TurnRole::Opponent => "opponent",
    }
}

/// Build PhaseGroupView[] from a module's states, ordered by FSM topology.
fn build_phase_groups(module: &ConventionModule, _system: BaseSystemId) -> Vec<PhaseGroupView> {
    let states = module.states.as_deref().unwrap_or(&[]);
    if states.is_empty() {
        return Vec::new();
    }

    let phase_order = derive_phase_order(&module.local);
    let post_fit_phases = compute_post_fit_phases(module);

    // Build incoming transition map
    let mut incoming_map: HashMap<String, Vec<(ObsPattern, String)>> = HashMap::new();
    for t in &module.local.transitions {
        for f in phase_ref_to_vec(&t.from) {
            incoming_map
                .entry(t.to.clone())
                .or_default()
                .push((t.on.clone(), f.to_string()));
        }
    }

    // Group states by phase string (flatten multi-phase entries)
    struct PhaseGroup {
        turn: Option<TurnRole>,
        surfaces: Vec<SurfaceDetailView>,
    }

    let mut phase_map: HashMap<String, PhaseGroup> = HashMap::new();

    for entry in states {
        let entry_phases = phase_ref_to_vec(&entry.phase);

        for phase in entry_phases {
            let metric = if post_fit_phases.contains(phase) {
                Some(RelevantMetric::TrumpTp)
            } else {
                Some(RelevantMetric::Hcp)
            };

            let group = phase_map
                .entry(phase.to_string())
                .or_insert_with(|| PhaseGroup {
                    turn: entry.turn,
                    surfaces: Vec::new(),
                });

            let seen: HashSet<String> = group
                .surfaces
                .iter()
                .map(|s| s.meaning_id.clone())
                .collect();

            for surface in &entry.surfaces {
                if seen.contains(&surface.meaning_id) {
                    continue;
                }

                let raw_explanation =
                    find_explanation_text(&module.explanation_entries, &surface.meaning_id);

                group.surfaces.push(SurfaceDetailView {
                    meaning_id: surface.meaning_id.clone(),
                    teaching_label: ServiceTeachingLabel {
                        name: format_bid_references(surface.teaching_label.name.as_str()),
                        summary: format_bid_references(surface.teaching_label.summary.as_str()),
                    },
                    call: surface.encoding.default_call.clone(),
                    call_display: format_call(&surface.encoding.default_call),
                    disclosure: surface.disclosure,
                    recommendation: Some(surface.ranking.recommendation_band),
                    explanation_text: raw_explanation.map(|t| format_bid_references(&t)),
                    clauses: map_clauses(&surface.clauses, metric),
                });
            }
        }
    }

    // Determine visible phases
    let visible_phases: Vec<&str> = phase_order
        .iter()
        .filter(|p| {
            phase_map
                .get(p.as_str())
                .map_or(false, |g| !g.surfaces.is_empty())
        })
        .map(|p| p.as_str())
        .collect();
    let suppress_labels = visible_phases.len() < 3;

    let mut result = Vec::new();
    for phase in &phase_order {
        let group = match phase_map.get(phase.as_str()) {
            Some(g) if !g.surfaces.is_empty() => g,
            _ => continue,
        };

        let transition_label = if suppress_labels {
            None
        } else if phase == &module.local.initial {
            derive_root_phase_label(&module.module_id)
        } else {
            incoming_map.get(phase.as_str()).and_then(|incoming| {
                let (obs, from_phase) = incoming.first()?;
                let trigger_call = find_trigger_call(module, from_phase, obs);
                let from_group = phase_map.get(from_phase.as_str());
                let source_turn = from_group.and_then(|g| g.turn);
                let turn_str = source_turn.map(turn_role_display);
                Some(format_transition_label(
                    obs,
                    trigger_call.as_ref(),
                    turn_str,
                ))
            })
        };

        let turn_str = group.turn.map(turn_role_display);
        result.push(PhaseGroupView {
            phase: phase.clone(),
            phase_display: format_phase_display(phase, turn_str),
            turn: turn_str.map(|s| s.to_string()),
            transition_label,
            surfaces: group.surfaces.clone(),
        });
    }

    result
}

// ── Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_conventions::{BidActionType, LocalFsm, ObsPatternAct, PhaseTransition};

    #[test]
    fn build_module_catalog_returns_10() {
        let catalog = build_module_catalog(BaseSystemId::Sayc);
        assert_eq!(catalog.len(), 10);
    }

    #[test]
    fn build_module_catalog_has_stayman() {
        let catalog = build_module_catalog(BaseSystemId::Sayc);
        let stayman = catalog.iter().find(|e| e.module_id == "stayman");
        assert!(stayman.is_some());
        let s = stayman.unwrap();
        assert_eq!(s.display_name, "Stayman");
        assert!(s.surface_count > 0);
    }

    #[test]
    fn build_module_learning_viewport_stayman() {
        let viewport = build_module_learning_viewport("stayman", BaseSystemId::Sayc);
        assert!(viewport.is_some());
        let v = viewport.unwrap();
        assert_eq!(v.module_id, "stayman");
        assert_eq!(v.display_name, "Stayman");
        assert!(!v.phases.is_empty());
    }

    #[test]
    fn build_module_learning_viewport_unknown() {
        let viewport = build_module_learning_viewport("nonexistent", BaseSystemId::Sayc);
        assert!(viewport.is_none());
    }

    #[test]
    fn derive_phase_order_simple_fsm() {
        let fsm = LocalFsm {
            initial: "idle".to_string(),
            transitions: vec![
                PhaseTransition {
                    from: PhaseRef::Single("idle".to_string()),
                    to: "asked".to_string(),
                    on: ObsPattern {
                        act: ObsPatternAct::Specific(BidActionType::Inquire),
                        feature: None,
                        suit: None,
                        strain: None,
                        strength: None,
                        actor: None,
                    },
                },
                PhaseTransition {
                    from: PhaseRef::Single("asked".to_string()),
                    to: "responded".to_string(),
                    on: ObsPattern {
                        act: ObsPatternAct::Specific(BidActionType::Show),
                        feature: None,
                        suit: None,
                        strain: None,
                        strength: None,
                        actor: None,
                    },
                },
            ],
        };
        let order = derive_phase_order(&fsm);
        assert_eq!(order, vec!["idle", "asked", "responded"]);
    }

    #[test]
    fn derive_phase_order_multi_from() {
        let fsm = LocalFsm {
            initial: "a".to_string(),
            transitions: vec![
                PhaseTransition {
                    from: PhaseRef::Single("a".to_string()),
                    to: "b".to_string(),
                    on: ObsPattern {
                        act: ObsPatternAct::Any,
                        feature: None,
                        suit: None,
                        strain: None,
                        strength: None,
                        actor: None,
                    },
                },
                PhaseTransition {
                    from: PhaseRef::Multiple(vec!["a".to_string(), "b".to_string()]),
                    to: "c".to_string(),
                    on: ObsPattern {
                        act: ObsPatternAct::Any,
                        feature: None,
                        suit: None,
                        strain: None,
                        strength: None,
                        actor: None,
                    },
                },
            ],
        };
        let order = derive_phase_order(&fsm);
        assert_eq!(order, vec!["a", "b", "c"]);
    }

    #[test]
    fn build_base_module_infos_returns_4() {
        let infos = build_base_module_infos(BaseSystemId::Sayc);
        assert_eq!(infos.len(), 4);
    }
}
