//! Bundle registry — lookup bundle definitions and resolve full bundles.
//!
//! Bundle-input manifests (authored metadata without modules) are embedded
//! as JSON. Full resolved bundles are loaded from pre-computed fixtures.

use std::collections::HashMap;
use std::sync::OnceLock;

use crate::types::bundle_types::{BundleInput, ConventionBundle};
use crate::types::system_config::BaseSystemId;

use super::module_registry::get_module;

// Embedded bundle-input manifest (all 8 bundles)
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

/// All known bundle IDs in definition order.
const BUNDLE_IDS: &[&str] = &[
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

// ── Bundle input manifest cache ────────────────────────────────────

static MANIFEST_CACHE: OnceLock<(Vec<BundleInput>, HashMap<String, usize>)> = OnceLock::new();

fn manifest_cache() -> &'static (Vec<BundleInput>, HashMap<String, usize>) {
    MANIFEST_CACHE.get_or_init(|| {
        let inputs: Vec<BundleInput> = serde_json::from_str(BUNDLE_MANIFESTS_JSON)
            .expect("Failed to deserialize bundle manifests");
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
        for &id in BUNDLE_IDS {
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
    fn list_bundle_inputs_returns_10() {
        let inputs = list_bundle_inputs();
        assert_eq!(inputs.len(), 10);
    }

    #[test]
    fn list_bundle_inputs_correct_ids() {
        let inputs = list_bundle_inputs();
        let ids: Vec<&str> = inputs.iter().map(|b| b.id.as_str()).collect();
        assert_eq!(ids, BUNDLE_IDS);
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
    fn resolve_bundle_all_10() {
        for &id in BUNDLE_IDS {
            let bundle = resolve_bundle(id, BaseSystemId::Sayc);
            assert!(bundle.is_some(), "Bundle '{}' should resolve", id);
        }
    }

    #[test]
    fn resolve_bundle_modules_match_member_ids() {
        for &id in BUNDLE_IDS {
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
}
