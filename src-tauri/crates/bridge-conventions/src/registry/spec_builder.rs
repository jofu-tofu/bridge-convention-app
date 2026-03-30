//! Spec builder — construct ConventionSpec from bundles + base modules.
//!
//! Mirrors TS `specFromBundle()` in system-registry.ts.
//! Merges a bundle's member modules with the base system modules
//! (natural-bids, stayman, jacoby-transfers, blackwood) using Set
//! deduplication, producing a ConventionSpec for the strategy layer.

use std::collections::HashSet;

use crate::types::spec_types::ConventionSpec;
use crate::types::system_config::BaseSystemId;

use super::bundle_registry::get_bundle_input;
use super::module_registry::{get_base_module_ids, get_module};
use super::system_configs::get_system_config;

/// Build a ConventionSpec from a bundle + base system modules.
///
/// Merges the bundle's `member_ids` with the system's base module IDs
/// (deduplicating), then looks up each module from the registry.
/// Returns None if the bundle ID is unknown or no modules could be resolved.
pub fn spec_from_bundle(bundle_id: &str, system: BaseSystemId) -> Option<ConventionSpec> {
    let input = get_bundle_input(bundle_id)?;
    let base_ids = get_base_module_ids(system);

    // Merge member IDs + base IDs with deduplication (preserving order)
    let mut seen = HashSet::new();
    let mut all_ids: Vec<&str> = Vec::new();

    for id in &input.member_ids {
        if seen.insert(id.as_str()) {
            all_ids.push(id.as_str());
        }
    }
    for &id in base_ids {
        if seen.insert(id) {
            all_ids.push(id);
        }
    }

    // Look up each module
    let modules: Vec<_> = all_ids
        .iter()
        .filter_map(|&id| get_module(id, system).cloned())
        .collect();

    if modules.is_empty() {
        return None;
    }

    Some(ConventionSpec {
        id: input.id.clone(),
        name: input.name.clone(),
        modules,
        system_config: Some(get_system_config(system)),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spec_from_bundle_nt_bundle() {
        let spec = spec_from_bundle("nt-bundle", BaseSystemId::Sayc);
        assert!(spec.is_some());
        let s = spec.unwrap();
        assert_eq!(s.id, "nt-bundle");

        let module_ids: Vec<&str> = s.modules.iter().map(|m| m.module_id.as_str()).collect();

        // Bundle members: stayman, jacoby-transfers, smolen
        // Base modules: natural-bids, stayman (dedup), jacoby-transfers (dedup), blackwood
        // Expected: stayman, jacoby-transfers, smolen, natural-bids, blackwood
        assert!(module_ids.contains(&"stayman"));
        assert!(module_ids.contains(&"jacoby-transfers"));
        assert!(module_ids.contains(&"smolen"));
        assert!(module_ids.contains(&"natural-bids"));
        assert!(module_ids.contains(&"blackwood"));
        assert_eq!(module_ids.len(), 5);
    }

    #[test]
    fn spec_from_bundle_includes_base_modules() {
        // Bergen bundle has memberIds: ["bergen"]
        // Spec should also include the 4 base modules
        let spec = spec_from_bundle("bergen-bundle", BaseSystemId::Sayc);
        assert!(spec.is_some());
        let s = spec.unwrap();

        let module_ids: Vec<&str> = s.modules.iter().map(|m| m.module_id.as_str()).collect();
        assert!(module_ids.contains(&"bergen"));
        assert!(module_ids.contains(&"natural-bids"));
        assert!(module_ids.contains(&"stayman"));
        assert!(module_ids.contains(&"jacoby-transfers"));
        assert!(module_ids.contains(&"blackwood"));
        assert_eq!(module_ids.len(), 5);
    }

    #[test]
    fn spec_from_bundle_deduplicates() {
        // nt-stayman has memberIds: ["stayman"]
        // Base modules also include "stayman" — should appear only once
        let spec = spec_from_bundle("nt-stayman", BaseSystemId::Sayc);
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
        let spec = spec_from_bundle("nt-bundle", BaseSystemId::Sayc).unwrap();
        assert!(spec.system_config.is_some());
        let config = spec.system_config.unwrap();
        assert_eq!(config.system_id, BaseSystemId::Sayc);
    }

    #[test]
    fn spec_from_bundle_unknown_returns_none() {
        assert!(spec_from_bundle("nonexistent", BaseSystemId::Sayc).is_none());
    }

    #[test]
    fn spec_from_bundle_member_order_preserved() {
        // Members come first, then base modules not already present
        let spec = spec_from_bundle("nt-bundle", BaseSystemId::Sayc).unwrap();
        let module_ids: Vec<&str> = spec.modules.iter().map(|m| m.module_id.as_str()).collect();

        // Bundle members first: stayman, jacoby-transfers, smolen
        assert_eq!(module_ids[0], "stayman");
        assert_eq!(module_ids[1], "jacoby-transfers");
        assert_eq!(module_ids[2], "smolen");
        // Then remaining base: natural-bids, blackwood
        // (stayman and jacoby-transfers already included from members)
        assert_eq!(module_ids[3], "natural-bids");
        assert_eq!(module_ids[4], "blackwood");
    }
}
