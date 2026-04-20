//! Bundle registry — lookup bundle definitions and resolve full bundles.
//!
//! Bundle-input manifests (authored metadata without modules) are embedded
//! as JSON. Multi-module authored bundles are loaded from pre-computed
//! fixtures; single-module bundles are synthesized from module fixtures.
//!
//! Every module without a hand-authored bundle at its canonical single-module
//! ID gets a synthesized bundle at cache-init time. Multi-module authored
//! bundles do not suppress this. See `synthesize_single_module_bundle` for the
//! derivation rules. The `every_module_has_a_bundle` test enforces coverage.

use std::collections::{HashMap, HashSet};
use std::sync::OnceLock;

use crate::types::agreement::{ModuleEntry, ModuleKind, SystemProfile};
use crate::types::bundle_types::{
    BundleInput, ConventionBundle, ConventionCategory, ConventionTeaching, DerivedTeachingContent,
};
use crate::types::module_types::{ConventionModule, ModuleCategory};
use crate::types::rule_types::{PhaseRef, TurnRole};
use crate::types::system_config::BaseSystemId;
use crate::types::teaching::{SurfaceGroup, SurfaceGroupRelationship};

use super::module_registry::{get_all_modules, get_module};
use super::system_configs::sayc_system_config;

// Embedded bundle-input manifest (all authored bundles)
const BUNDLE_MANIFESTS_JSON: &str = include_str!("../../fixtures/bundle-manifests.json");

// Embedded full resolved bundles (SAYC)
const NT_BUNDLE_JSON: &str = include_str!("../../fixtures/nt-bundle.json");

fn json_for_bundle(id: &str) -> Option<&'static str> {
    match id {
        "nt-bundle" => Some(NT_BUNDLE_JSON),
        _ => None,
    }
}

/// Hand-authored bundle IDs in definition order.
const AUTHORED_BUNDLE_IDS: &[&str] = &["nt-bundle"];

/// Compute the auto-synthesized bundle ID for a module.
fn synthesized_bundle_id(module_id: &str) -> String {
    match module_id {
        "new-minor-forcing" => "nmf-bundle".to_string(),
        _ => format!("{}-bundle", module_id),
    }
}

/// Map a module's category to a bundle's UI category.
fn map_category(cat: ModuleCategory) -> ConventionCategory {
    match cat {
        ModuleCategory::Slam => ConventionCategory::Asking,
        ModuleCategory::Competitive => ConventionCategory::Competitive,
        ModuleCategory::OpeningBids
        | ModuleCategory::NotrumpResponses
        | ModuleCategory::MajorRaises
        | ModuleCategory::WeakBids
        | ModuleCategory::Constructive
        | ModuleCategory::Custom => ConventionCategory::Constructive,
    }
}

fn phase_ref_label(phase: &PhaseRef) -> String {
    match phase {
        PhaseRef::Single(s) => s.clone(),
        PhaseRef::Multiple(phases) => phases.join("+"),
    }
}

fn turn_role_label(turn: Option<TurnRole>) -> &'static str {
    match turn {
        Some(TurnRole::Opener) => "opener",
        Some(TurnRole::Responder) => "responder",
        Some(TurnRole::Opponent) => "opponent",
        None => "any",
    }
}

fn derive_surface_groups(module: &ConventionModule) -> Vec<SurfaceGroup> {
    module
        .states
        .as_deref()
        .unwrap_or(&[])
        .iter()
        .filter_map(|entry| {
            let members: Vec<String> = entry
                .surfaces
                .iter()
                .map(|surface| surface.meaning_id.clone())
                .collect();
            if members.len() < 2 {
                return None;
            }

            let phase = phase_ref_label(&entry.phase);
            let turn = turn_role_label(entry.turn);
            Some(SurfaceGroup {
                id: format!("{}/{}:{}", module.module_id, phase, turn),
                label: format!("{} {} ({})", module.module_id, phase, turn),
                members,
                relationship: SurfaceGroupRelationship::MutuallyExclusive,
                description: format!(
                    "Surfaces competing at {} in {} ({}'s turn)",
                    phase, module.module_id, turn
                ),
            })
        })
        .collect()
}

/// Fit-establishing modules auto-bundled with Slam-category modules so the
/// live spec has the tools to reach a trump fit before the slam tool fires.
/// Without this pairing, e.g., blackwood-bundle would only load natural-bids
/// + blackwood; natural-bids has no authored raise surfaces, so the bot
/// cannot establish a fit, and witness selection's kernel-gated path would
/// have no reachable fit-establishing prefix. Jacoby transfers + Stayman
/// cover the 1NT-origin fit paths; their own attachment sequence gating
/// (`1NT`) prevents spurious activation after non-1NT openings inside
/// kernel-gated drills.
const SLAM_FIT_DEPENDENCIES: &[&str] = &["jacoby-transfers", "stayman"];

/// Synthesize a single-module bundle from a module.
///
/// Fields derived from the module:
/// - name, member_ids, category, description, teaching, bundle metadata
/// - system_profile: SAYC default + one ModuleEntry using synthesis-only bundle metadata attachments
fn synthesize_single_module_bundle(module: &ConventionModule) -> ConventionBundle {
    let bundle_id = synthesized_bundle_id(&module.module_id);
    let bundle_teaching = module.bundle_metadata.teaching.as_ref();
    let teaching = Some(ConventionTeaching {
        purpose: bundle_teaching
            .and_then(|t| t.purpose.clone())
            .or_else(|| Some(module.purpose.to_string())),
        when_to_use: bundle_teaching.and_then(|t| t.when_to_use.clone()),
        when_not_to_use: bundle_teaching.and_then(|t| t.when_not_to_use.clone()),
        tradeoff: bundle_teaching
            .and_then(|t| t.tradeoff.clone())
            .or_else(|| Some(module.teaching.tradeoff.to_string())),
        principle: bundle_teaching
            .and_then(|t| t.principle.clone())
            .or_else(|| Some(module.teaching.principle.to_string())),
        roles: bundle_teaching.and_then(|t| t.roles.clone()),
    });

    // For Slam-category modules (blackwood today), pair with fit-establishing
    // base modules so the live spec can reach an agreed trump fit before the
    // slam tool fires.
    let extra_dep_ids: Vec<String> = if matches!(module.category, ModuleCategory::Slam) {
        SLAM_FIT_DEPENDENCIES
            .iter()
            .filter(|&&dep| dep != module.module_id)
            .map(|s| s.to_string())
            .collect()
    } else {
        Vec::new()
    };

    let mut member_ids = vec![module.module_id.clone()];
    member_ids.extend(extra_dep_ids.iter().cloned());

    let mut profile_modules = vec![ModuleEntry {
        module_id: module.module_id.clone(),
        kind: ModuleKind::AddOn,
        attachments: if module.bundle_metadata.attachments.is_empty() {
            module.attachments.clone()
        } else {
            module.bundle_metadata.attachments.clone()
        },
        options: None,
    }];
    for dep_id in &extra_dep_ids {
        if let Some(dep_module) = get_module(dep_id, BaseSystemId::Sayc) {
            profile_modules.push(ModuleEntry {
                module_id: dep_id.clone(),
                kind: ModuleKind::BaseSystem,
                attachments: if dep_module.bundle_metadata.attachments.is_empty() {
                    dep_module.attachments.clone()
                } else {
                    dep_module.bundle_metadata.attachments.clone()
                },
                options: None,
            });
        }
    }

    let system_profile = Some(SystemProfile {
        profile_id: format!("{}-synth", module.module_id),
        base_system: BaseSystemId::Sayc,
        system_config: Some(sayc_system_config()),
        modules: profile_modules,
    });

    let mut bundle_modules = vec![module.clone()];
    for dep_id in &extra_dep_ids {
        if let Some(dep_module) = get_module(dep_id, BaseSystemId::Sayc) {
            bundle_modules.push(dep_module.clone());
        }
    }

    ConventionBundle {
        id: bundle_id,
        name: module.display_name.clone(),
        member_ids,
        internal: None,
        system_profile,
        declared_capabilities: if module.bundle_metadata.declared_capabilities.is_empty() {
            None
        } else {
            Some(module.bundle_metadata.declared_capabilities.clone())
        },
        category: map_category(module.category),
        description: module.description.to_string(),
        teaching,
        modules: bundle_modules,
        derived_teaching: DerivedTeachingContent {
            surface_groups: derive_surface_groups(module),
        },
        allowed_dealers: module.bundle_metadata.allowed_dealers.clone(),
        supports_role_selection: Some(
            module
                .bundle_metadata
                .supports_role_selection
                .unwrap_or(true),
        ),
    }
}

/// Project a ConventionBundle back to its BundleInput (authored-subset) shape.
fn bundle_input_from(bundle: &ConventionBundle) -> BundleInput {
    BundleInput {
        id: bundle.id.clone(),
        name: bundle.name.clone(),
        member_ids: bundle.member_ids.clone(),
        internal: bundle.internal,
        system_profile: bundle.system_profile.clone(),
        declared_capabilities: bundle.declared_capabilities.clone(),
        category: bundle.category,
        description: bundle.description.clone(),
        teaching: bundle.teaching.clone(),
    }
}

// ── Bundle input manifest cache ────────────────────────────────────

static MANIFEST_CACHE: OnceLock<(Vec<BundleInput>, HashMap<String, usize>)> = OnceLock::new();

fn manifest_cache() -> &'static (Vec<BundleInput>, HashMap<String, usize>) {
    MANIFEST_CACHE.get_or_init(|| {
        let mut inputs: Vec<BundleInput> = serde_json::from_str(BUNDLE_MANIFESTS_JSON)
            .expect("Failed to deserialize bundle manifests");

        // Extend with synthesized single-module bundles. Multi-module authored
        // bundles (for example nt-bundle) do not suppress canonical
        // single-module bundle IDs such as stayman-bundle.
        let authored_ids: HashSet<String> = inputs.iter().map(|b| b.id.clone()).collect();
        for module in get_all_modules(BaseSystemId::Sayc) {
            if !authored_ids.contains(&synthesized_bundle_id(&module.module_id)) {
                inputs.push(bundle_input_from(&synthesize_single_module_bundle(module)));
            }
        }

        let index: HashMap<String, usize> = inputs
            .iter()
            .enumerate()
            .map(|(i, b)| (b.id.clone(), i))
            .collect();
        (inputs, index)
    })
}

/// Look up a bundle's authored definition (no modules, no derived fields).
pub fn get_bundle_input(id: &str) -> Option<&'static BundleInput> {
    let (inputs, index) = manifest_cache();
    index.get(id).map(|&i| &inputs[i])
}

/// List all bundle definitions.
pub fn list_bundle_inputs() -> &'static [BundleInput] {
    &manifest_cache().0
}

// ── Resolved bundle cache ──────────────────────────────────────────

static BUNDLE_CACHE: OnceLock<HashMap<String, ConventionBundle>> = OnceLock::new();

fn bundle_cache() -> &'static HashMap<String, ConventionBundle> {
    BUNDLE_CACHE.get_or_init(|| {
        let mut map = HashMap::new();
        for &id in AUTHORED_BUNDLE_IDS {
            if let Some(json) = json_for_bundle(id) {
                match serde_json::from_str::<ConventionBundle>(json) {
                    Ok(mut bundle) => {
                        // Populate modules from module registry (single source of truth).
                        // Uses Sayc — multi-system support is deferred (get_module ignores system).
                        if bundle.modules.is_empty() {
                            bundle.modules = bundle
                                .member_ids
                                .iter()
                                .map(|mid| {
                                    get_module(mid, BaseSystemId::Sayc).cloned().unwrap_or_else(
                                        || {
                                            panic!(
                                                "Bundle '{}' references unknown module '{}'",
                                                id, mid
                                            )
                                        },
                                    )
                                })
                                .collect();
                        }
                        map.insert(id.to_string(), bundle);
                    }
                    Err(e) => {
                        panic!("Failed to deserialize bundle '{}': {}", id, e);
                    }
                }
            }
        }

        // Synthesize canonical single-module bundles for every module that
        // does not already have an authored bundle at its canonical ID.
        for module in get_all_modules(BaseSystemId::Sayc) {
            let synthesized_id = synthesized_bundle_id(&module.module_id);
            if !map.contains_key(&synthesized_id) {
                let synthesized = synthesize_single_module_bundle(module);
                map.insert(synthesized.id.clone(), synthesized);
            }
        }

        map
    })
}

/// Resolve a bundle by ID for a given system.
/// Currently returns SAYC-resolved bundles (multi-system deferred).
pub fn resolve_bundle(id: &str, _system: BaseSystemId) -> Option<&'static ConventionBundle> {
    bundle_cache().get(id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::bundle_types::ConventionCategory;

    #[test]
    fn list_bundle_inputs_includes_authored_bundles() {
        let inputs = list_bundle_inputs();
        let ids: HashSet<&str> = inputs.iter().map(|b| b.id.as_str()).collect();
        for authored in AUTHORED_BUNDLE_IDS {
            assert!(ids.contains(authored), "missing authored bundle {authored}");
        }
    }

    #[test]
    fn get_bundle_input_nt_bundle() {
        let input = get_bundle_input("nt-bundle");
        assert!(input.is_some());
        let b = input.unwrap();
        assert_eq!(b.name, "1NT Responses");
        assert_eq!(b.category, ConventionCategory::Constructive);
        assert_eq!(b.member_ids, vec!["stayman", "jacoby-transfers", "smolen"]);
    }

    #[test]
    fn get_bundle_input_unknown_returns_none() {
        assert!(get_bundle_input("nonexistent").is_none());
    }

    #[test]
    fn resolve_bundle_nt_bundle() {
        let bundle = resolve_bundle("nt-bundle", BaseSystemId::Sayc);
        assert!(bundle.is_some());
        let b = bundle.unwrap();
        assert_eq!(b.id, "nt-bundle");
        assert_eq!(b.modules.len(), 3); // stayman, jacoby-transfers, smolen
        assert!(b.supports_role_selection.unwrap_or(false));
    }

    #[test]
    fn resolve_bundle_bergen() {
        let bundle = resolve_bundle("bergen-bundle", BaseSystemId::Sayc);
        assert!(bundle.is_some());
        let b = bundle.unwrap();
        assert_eq!(b.modules.len(), 1); // bergen
        assert_eq!(b.modules[0].module_id, "bergen");
    }

    #[test]
    fn resolve_authored_bundles() {
        for &id in AUTHORED_BUNDLE_IDS {
            let bundle = resolve_bundle(id, BaseSystemId::Sayc);
            assert!(bundle.is_some(), "Bundle '{}' should resolve", id);
        }
    }

    #[test]
    fn resolve_bundle_modules_match_member_ids() {
        for &id in AUTHORED_BUNDLE_IDS {
            let bundle = resolve_bundle(id, BaseSystemId::Sayc)
                .unwrap_or_else(|| panic!("Bundle '{}' not found", id));
            assert_eq!(
                bundle.modules.len(),
                bundle.member_ids.len(),
                "Bundle '{}': module count doesn't match member_ids",
                id
            );
            for (module, expected_id) in bundle.modules.iter().zip(&bundle.member_ids) {
                assert_eq!(
                    &module.module_id, expected_id,
                    "Bundle '{}': module ordering mismatch",
                    id
                );
            }
        }
    }

    #[test]
    fn resolve_bundle_has_derived_teaching() {
        let bundle = resolve_bundle("nt-bundle", BaseSystemId::Sayc).unwrap();
        assert!(
            !bundle.derived_teaching.surface_groups.is_empty(),
            "NT bundle should have derived surface groups"
        );
    }

    /// Coverage invariant: every registered module must be a `memberId` of
    /// some bundle (authored or synthesized). If this fails, a module was
    /// added without a matching bundle — extend `get_all_modules` or author
    /// a new bundle JSON fixture.
    #[test]
    fn every_module_has_a_bundle() {
        let modules = get_all_modules(BaseSystemId::Sayc);
        let bundles = list_bundle_inputs();
        let covered: HashSet<&str> = bundles
            .iter()
            .flat_map(|b| b.member_ids.iter().map(|s| s.as_str()))
            .collect();
        let uncovered: Vec<&str> = modules
            .iter()
            .map(|m| m.module_id.as_str())
            .filter(|mid| !covered.contains(mid))
            .collect();
        assert!(
            uncovered.is_empty(),
            "modules without any bundle: {:?}",
            uncovered
        );
    }

    #[test]
    fn synthesized_bundle_resolves_for_blackwood() {
        let bundle = resolve_bundle("blackwood-bundle", BaseSystemId::Sayc);
        assert!(bundle.is_some(), "blackwood-bundle should auto-synthesize");
        let b = bundle.unwrap();
        // Slam-category modules are auto-paired with fit-establishing
        // base modules so the live spec can reach an agreed trump fit
        // before the slam tool fires. See SLAM_FIT_DEPENDENCIES.
        assert_eq!(
            b.member_ids,
            vec!["blackwood", "jacoby-transfers", "stayman"]
        );
        assert_eq!(b.modules.len(), 3);
        assert_eq!(b.modules[0].module_id, "blackwood");
        assert_eq!(b.category, ConventionCategory::Asking);
    }

    #[test]
    fn synthesized_bundle_resolves_for_natural_bids() {
        let bundle = resolve_bundle("natural-bids-bundle", BaseSystemId::Sayc);
        assert!(bundle.is_some());
        assert_eq!(bundle.unwrap().category, ConventionCategory::Constructive);
    }

    #[test]
    fn synthesized_bundle_resolves_for_module_inside_multi_module_bundle() {
        let bundle = resolve_bundle("stayman-bundle", BaseSystemId::Sayc)
            .expect("stayman-bundle should auto-synthesize even though nt-bundle includes Stayman");

        assert_eq!(bundle.member_ids, vec!["stayman"]);
        assert_eq!(bundle.modules.len(), 1);
        assert_eq!(bundle.modules[0].module_id, "stayman");
    }

    #[test]
    fn synthesized_bundle_preserves_single_module_metadata() {
        let bundle = resolve_bundle("stayman-bundle", BaseSystemId::Sayc)
            .expect("stayman-bundle should resolve");

        assert_eq!(
            bundle
                .declared_capabilities
                .as_ref()
                .and_then(|caps| caps.get("opening.1nt")),
            Some(&"active".to_string())
        );
        assert!(
            bundle
                .system_profile
                .as_ref()
                .and_then(|profile| profile.modules.first())
                .map(|entry| !entry.attachments.is_empty())
                .unwrap_or(false),
            "synthesized bundle should carry module attachment triggers"
        );
        assert!(
            bundle.supports_role_selection.unwrap_or(false),
            "Stayman should preserve role selection support"
        );
        assert!(
            !bundle.derived_teaching.surface_groups.is_empty(),
            "synthesized bundle should derive surface groups from module states"
        );
    }

    #[test]
    fn synthesized_bundle_preserves_disabled_role_selection() {
        let bundle = resolve_bundle("dont-bundle", BaseSystemId::Sayc)
            .expect("dont-bundle should synthesize");

        assert_eq!(
            bundle.allowed_dealers,
            Some(vec![bridge_engine::types::Seat::East])
        );
        assert_eq!(bundle.supports_role_selection, Some(false));
    }
}
