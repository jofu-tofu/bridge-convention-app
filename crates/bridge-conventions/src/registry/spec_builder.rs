//! Spec builder — construct ConventionSpec from bundles + base modules.
//!
//! Merges a bundle's member modules with the provided base module IDs
//! using Set deduplication, producing a ConventionSpec for the strategy layer.

use std::collections::{HashMap, HashSet};

use crate::types::module_types::ConventionModule;
use crate::types::spec_types::ConventionSpec;
use crate::types::system_config::{BaseSystemId, SystemConfig};

use super::bundle_registry::get_bundle_input;
use super::module_registry::get_module;

/// Build a ConventionSpec from a bundle + provided base modules + system config.
///
/// Merges the bundle's `member_ids` with the provided `base_module_ids`
/// (deduplicating), then looks up each module from the registry.
/// Returns None if the bundle ID is unknown or no modules could be resolved.
///
/// `user_modules` contains user-forked modules (keyed by `"user:<uuid>"` IDs).
/// If a base_module_id starts with `"user:"` and its `variant_of` matches a
/// bundle member, the bundle member is replaced by the user fork.
///
/// The caller always provides the full config — same path for presets and
/// custom systems. The `system_id` from the config is used for module lookup.
pub fn spec_from_bundle(
    bundle_id: &str,
    system_config: &SystemConfig,
    base_module_ids: &[String],
    user_modules: &HashMap<String, ConventionModule>,
) -> Option<ConventionSpec> {
    let input = get_bundle_input(bundle_id)?;
    let system = system_config.system_id;

    // Build replacement map: bundle member_id -> user module ID
    // A user module in base_module_ids replaces the bundle member it forks.
    let mut replacements: HashMap<&str, &str> = HashMap::new();
    for id in base_module_ids {
        if id.starts_with("user:") {
            if let Some(user_mod) = user_modules.get(id.as_str()) {
                if let Some(ref parent_id) = user_mod.variant_of {
                    replacements.insert(parent_id.as_str(), id.as_str());
                }
            }
        }
    }

    // Use the bundle's own member modules + natural-bids only.
    // Convention base modules (stayman, jacoby-transfers, blackwood) are NOT
    // merged — they caused false activations in bundles where their auction
    // context doesn't arise (e.g., Jacoby Transfers firing after suit openings).
    // natural-bids is always included because it provides the observation
    // vocabulary (1NT opening, suit openings) that other modules' FSMs need.
    let mut seen = HashSet::new();
    let mut all_ids: Vec<&str> = Vec::new();

    for id in &input.member_ids {
        let effective_id = replacements
            .get(id.as_str())
            .copied()
            .unwrap_or(id.as_str());
        if seen.insert(effective_id) {
            all_ids.push(effective_id);
        }
    }
    // Merge natural-bids (observation vocabulary) and user-forked modules
    for id in base_module_ids {
        let dominated = id == "natural-bids" || id.starts_with("user:");
        if dominated && seen.insert(id.as_str()) {
            all_ids.push(id.as_str());
        }
    }

    // Custom systems use SAYC modules (multi-system module variants deferred)
    let lookup_system = match system {
        BaseSystemId::Custom => BaseSystemId::Sayc,
        other => other,
    };

    // Look up each module — user modules from the map, others from registry
    let modules: Vec<_> = all_ids
        .iter()
        .filter_map(|&id| {
            if id.starts_with("user:") {
                user_modules.get(id).cloned()
            } else {
                get_module(id, lookup_system).cloned()
            }
        })
        .collect();

    if modules.is_empty() {
        return None;
    }

    Some(ConventionSpec {
        id: input.id.clone(),
        name: input.name.clone(),
        modules,
        system_config: Some(system_config.clone()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::registry::module_registry::BASE_MODULE_IDS;
    use crate::registry::system_configs::get_system_config;

    fn default_base_module_ids() -> Vec<String> {
        BASE_MODULE_IDS.iter().map(|s| s.to_string()).collect()
    }

    fn sayc_config() -> SystemConfig {
        get_system_config(BaseSystemId::Sayc)
    }

    fn no_user_modules() -> HashMap<String, ConventionModule> {
        HashMap::new()
    }

    #[test]
    fn spec_from_bundle_nt_bundle() {
        let config = sayc_config();
        let base = default_base_module_ids();
        let spec = spec_from_bundle("nt-bundle", &config, &base, &no_user_modules());
        assert!(spec.is_some());
        let s = spec.unwrap();
        assert_eq!(s.id, "nt-bundle");

        let module_ids: Vec<&str> = s.modules.iter().map(|m| m.module_id.as_str()).collect();

        // Bundle members + natural-bids (observation vocabulary)
        assert!(module_ids.contains(&"stayman"));
        assert!(module_ids.contains(&"jacoby-transfers"));
        assert!(module_ids.contains(&"smolen"));
        assert!(module_ids.contains(&"natural-bids"));
        assert_eq!(module_ids.len(), 4);
    }

    #[test]
    fn spec_from_bundle_only_member_modules() {
        let config = sayc_config();
        let base = default_base_module_ids();
        let spec = spec_from_bundle("bergen-bundle", &config, &base, &no_user_modules());
        assert!(spec.is_some());
        let s = spec.unwrap();

        let module_ids: Vec<&str> = s.modules.iter().map(|m| m.module_id.as_str()).collect();
        // Bundle member + natural-bids only
        assert_eq!(module_ids, vec!["bergen", "natural-bids"]);
    }

    #[test]
    fn spec_from_bundle_deduplicates() {
        let config = sayc_config();
        let base = default_base_module_ids();
        let spec = spec_from_bundle("stayman-bundle", &config, &base, &no_user_modules());
        assert!(spec.is_some());
        let s = spec.unwrap();

        let stayman_count = s
            .modules
            .iter()
            .filter(|m| m.module_id == "stayman")
            .count();
        assert_eq!(stayman_count, 1);
    }

    #[test]
    fn spec_from_bundle_has_system_config() {
        let config = sayc_config();
        let base = default_base_module_ids();
        let spec = spec_from_bundle("nt-bundle", &config, &base, &no_user_modules()).unwrap();
        assert!(spec.system_config.is_some());
        let sc = spec.system_config.unwrap();
        assert_eq!(sc.system_id, BaseSystemId::Sayc);
    }

    #[test]
    fn spec_from_bundle_unknown_returns_none() {
        let config = sayc_config();
        let base = default_base_module_ids();
        assert!(spec_from_bundle("nonexistent", &config, &base, &no_user_modules()).is_none());
    }

    #[test]
    fn spec_from_bundle_member_order_preserved() {
        let config = sayc_config();
        let base = default_base_module_ids();
        let spec = spec_from_bundle("nt-bundle", &config, &base, &no_user_modules()).unwrap();
        let module_ids: Vec<&str> = spec.modules.iter().map(|m| m.module_id.as_str()).collect();

        // Bundle members in order, then natural-bids
        assert_eq!(module_ids[0], "stayman");
        assert_eq!(module_ids[1], "jacoby-transfers");
        assert_eq!(module_ids[2], "smolen");
        assert_eq!(module_ids[3], "natural-bids");
    }

    #[test]
    fn spec_from_bundle_convention_base_modules_not_merged() {
        let config = sayc_config();
        let base = vec!["natural-bids".to_string(), "blackwood".to_string()];
        let spec = spec_from_bundle("bergen-bundle", &config, &base, &no_user_modules()).unwrap();

        let module_ids: Vec<&str> = spec.modules.iter().map(|m| m.module_id.as_str()).collect();
        // Bundle member + natural-bids; blackwood NOT merged
        assert_eq!(module_ids, vec!["bergen", "natural-bids"]);
    }

    #[test]
    fn spec_from_bundle_uses_injected_config() {
        let mut config = sayc_config();
        config.nt_opening.min_hcp = 16;
        config.nt_opening.max_hcp = 18;
        let base = default_base_module_ids();
        let spec = spec_from_bundle("nt-bundle", &config, &base, &no_user_modules()).unwrap();

        let sc = spec.system_config.unwrap();
        assert_eq!(sc.nt_opening.min_hcp, 16);
        assert_eq!(sc.nt_opening.max_hcp, 18);
    }

    #[test]
    fn spec_from_bundle_custom_system_id() {
        let mut config = sayc_config();
        config.system_id = BaseSystemId::Custom;
        let base = default_base_module_ids();
        let spec = spec_from_bundle("nt-bundle", &config, &base, &no_user_modules()).unwrap();

        // Custom systems still resolve modules (via SAYC lookup)
        assert!(!spec.modules.is_empty());
        let sc = spec.system_config.unwrap();
        assert_eq!(sc.system_id, BaseSystemId::Custom);
    }
}
