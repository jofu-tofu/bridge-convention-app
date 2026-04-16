//! Bundle registry — lookup bundle definitions and resolve full bundles.
//!
//! Bundle-input manifests (authored metadata without modules) are embedded
//! as JSON. Full resolved bundles are loaded from pre-computed fixtures.
//!
//! Any module without a hand-authored bundle gets a single-module bundle
//! synthesized at cache-init time (id `{module_id}-bundle`). See
//! `synthesize_single_module_bundle` for the derivation rules. The
//! `every_module_has_a_bundle` test enforces coverage.

use std::collections::{HashMap, HashSet};
use std::sync::OnceLock;

use crate::types::agreement::{ModuleEntry, ModuleKind, SystemProfile};
use crate::types::bundle_types::{
    BundleInput, ConventionBundle, ConventionCategory, ConventionTeaching, DerivedTeachingContent,
};
use crate::types::module_types::{ConventionModule, ModuleCategory};
use crate::types::system_config::BaseSystemId;

use super::module_registry::{get_all_modules, get_module};
use super::system_configs::sayc_system_config;

// Embedded bundle-input manifest (all authored bundles)
const BUNDLE_MANIFESTS_JSON: &str = include_str!("../../fixtures/bundle-manifests.json");

// Embedded full resolved bundles (SAYC)
const NT_BUNDLE_JSON: &str = include_str!("../../fixtures/nt-bundle.json");
const NT_STAYMAN_JSON: &str = include_str!("../../fixtures/nt-stayman.json");
const NT_TRANSFERS_JSON: &str = include_str!("../../fixtures/nt-transfers.json");
const BERGEN_BUNDLE_JSON: &str = include_str!("../../fixtures/bergen-bundle.json");
const WEAK_TWOS_BUNDLE_JSON: &str = include_str!("../../fixtures/weak-twos-bundle.json");
const DONT_BUNDLE_JSON: &str = include_str!("../../fixtures/dont-bundle.json");
const MICHAELS_UNUSUAL_BUNDLE_JSON: &str =
    include_str!("../../fixtures/michaels-unusual-bundle.json");
const STRONG_2C_BUNDLE_JSON: &str = include_str!("../../fixtures/strong-2c-bundle.json");
const NEGATIVE_DOUBLES_BUNDLE_JSON: &str =
    include_str!("../../fixtures/negative-doubles-bundle.json");
const NMF_BUNDLE_JSON: &str = include_str!("../../fixtures/nmf-bundle.json");

fn json_for_bundle(id: &str) -> Option<&'static str> {
    match id {
        "nt-bundle" => Some(NT_BUNDLE_JSON),
        "nt-stayman" => Some(NT_STAYMAN_JSON),
        "nt-transfers" => Some(NT_TRANSFERS_JSON),
        "bergen-bundle" => Some(BERGEN_BUNDLE_JSON),
        "weak-twos-bundle" => Some(WEAK_TWOS_BUNDLE_JSON),
        "dont-bundle" => Some(DONT_BUNDLE_JSON),
        "michaels-unusual-bundle" => Some(MICHAELS_UNUSUAL_BUNDLE_JSON),
        "strong-2c-bundle" => Some(STRONG_2C_BUNDLE_JSON),
        "negative-doubles-bundle" => Some(NEGATIVE_DOUBLES_BUNDLE_JSON),
        "nmf-bundle" => Some(NMF_BUNDLE_JSON),
        _ => None,
    }
}

/// Hand-authored bundle IDs in definition order.
const AUTHORED_BUNDLE_IDS: &[&str] = &[
    "nt-bundle",
    "nt-stayman",
    "nt-transfers",
    "bergen-bundle",
    "dont-bundle",
    "weak-twos-bundle",
    "michaels-unusual-bundle",
    "strong-2c-bundle",
    "negative-doubles-bundle",
    "nmf-bundle",
];

/// Compute the auto-synthesized bundle ID for a module.
fn synthesized_bundle_id(module_id: &str) -> String {
    format!("{}-bundle", module_id)
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

/// Synthesize a single-module bundle from a module.
///
/// Fields derived from the module:
/// - name, member_ids, category, description, teaching
/// - system_profile: SAYC default + one ModuleEntry using the module's own attachments
///
/// Fields left empty/None:
/// - declared_capabilities, allowed_dealers, supports_role_selection
/// - derived_teaching.surface_groups (empty; matches nmf-bundle precedent)
fn synthesize_single_module_bundle(module: &ConventionModule) -> ConventionBundle {
    let bundle_id = synthesized_bundle_id(&module.module_id);
    let teaching = Some(ConventionTeaching {
        purpose: Some(module.purpose.to_string()),
        when_to_use: None,
        when_not_to_use: None,
        tradeoff: Some(module.teaching.tradeoff.to_string()),
        principle: Some(module.teaching.principle.to_string()),
        roles: None,
    });
    let system_profile = Some(SystemProfile {
        profile_id: format!("{}-synth", module.module_id),
        base_system: BaseSystemId::Sayc,
        system_config: Some(sayc_system_config()),
        modules: vec![ModuleEntry {
            module_id: module.module_id.clone(),
            kind: ModuleKind::AddOn,
            attachments: module.attachments.clone(),
            options: None,
        }],
    });

    ConventionBundle {
        id: bundle_id,
        name: module.display_name.clone(),
        member_ids: vec![module.module_id.clone()],
        internal: None,
        system_profile,
        declared_capabilities: None,
        category: map_category(module.category),
        description: module.description.to_string(),
        teaching,
        modules: vec![module.clone()],
        derived_teaching: DerivedTeachingContent {
            surface_groups: Vec::new(),
        },
        allowed_dealers: None,
        supports_role_selection: Some(true),
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

        // Extend with synthesized single-module bundles for any module not
        // already covered by an authored bundle's memberIds.
        let covered: HashSet<String> = inputs
            .iter()
            .flat_map(|b| b.member_ids.iter().cloned())
            .collect();
        for module in get_all_modules(BaseSystemId::Sayc) {
            if !covered.contains(&module.module_id) {
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

        // Synthesize single-module bundles for any module not already covered.
        let covered: HashSet<String> = map
            .values()
            .flat_map(|b| b.member_ids.iter().cloned())
            .collect();
        for module in get_all_modules(BaseSystemId::Sayc) {
            if !covered.contains(&module.module_id) {
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
        assert_eq!(b.member_ids, vec!["blackwood"]);
        assert_eq!(b.modules.len(), 1);
        assert_eq!(b.modules[0].module_id, "blackwood");
        assert_eq!(b.category, ConventionCategory::Asking);
    }

    #[test]
    fn synthesized_bundle_resolves_for_natural_bids() {
        let bundle = resolve_bundle("natural-bids-bundle", BaseSystemId::Sayc);
        assert!(bundle.is_some());
        assert_eq!(bundle.unwrap().category, ConventionCategory::Constructive);
    }
}
