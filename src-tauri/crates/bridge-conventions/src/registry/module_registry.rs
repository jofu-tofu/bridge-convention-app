//! Module registry — lookup individual convention modules by ID.
//!
//! Modules are pre-baked as JSON and embedded via `include_str!()`.
//! Currently SAYC-only; multi-system support will add per-system variants.

use std::collections::HashMap;
use std::sync::OnceLock;

use crate::types::module_types::ConventionModule;
use crate::types::system_config::BaseSystemId;

/// All registered module IDs in definition order.
const MODULE_IDS: &[&str] = &[
    "natural-bids",
    "stayman",
    "jacoby-transfers",
    "smolen",
    "bergen",
    "dont",
    "weak-twos",
    "blackwood",
];

/// Base module IDs merged into every spec (strategy layer).
/// Mirrors TS `DEFAULT_BASE_MODULE_IDS` in system-registry.ts.
pub const BASE_MODULE_IDS: &[&str] = &[
    "natural-bids",
    "stayman",
    "jacoby-transfers",
    "blackwood",
];

// Embedded module JSON fixtures (SAYC)
const NATURAL_BIDS_JSON: &str =
    include_str!("../../fixtures/modules/natural-bids.json");
const STAYMAN_JSON: &str =
    include_str!("../../fixtures/modules/stayman.json");
const JACOBY_TRANSFERS_JSON: &str =
    include_str!("../../fixtures/modules/jacoby-transfers.json");
const SMOLEN_JSON: &str =
    include_str!("../../fixtures/modules/smolen.json");
const BERGEN_JSON: &str =
    include_str!("../../fixtures/modules/bergen.json");
const DONT_JSON: &str =
    include_str!("../../fixtures/modules/dont.json");
const WEAK_TWOS_JSON: &str =
    include_str!("../../fixtures/modules/weak-twos.json");
const BLACKWOOD_JSON: &str =
    include_str!("../../fixtures/modules/blackwood.json");

fn json_for_module(id: &str) -> Option<&'static str> {
    match id {
        "natural-bids" => Some(NATURAL_BIDS_JSON),
        "stayman" => Some(STAYMAN_JSON),
        "jacoby-transfers" => Some(JACOBY_TRANSFERS_JSON),
        "smolen" => Some(SMOLEN_JSON),
        "bergen" => Some(BERGEN_JSON),
        "dont" => Some(DONT_JSON),
        "weak-twos" => Some(WEAK_TWOS_JSON),
        "blackwood" => Some(BLACKWOOD_JSON),
        _ => None,
    }
}

/// Lazily deserialized module cache keyed by module ID.
/// Currently SAYC-only; when multi-system is added, key becomes (id, system).
static MODULE_CACHE: OnceLock<HashMap<String, ConventionModule>> = OnceLock::new();

fn module_cache() -> &'static HashMap<String, ConventionModule> {
    MODULE_CACHE.get_or_init(|| {
        let mut map = HashMap::new();
        for &id in MODULE_IDS {
            if let Some(json) = json_for_module(id) {
                match serde_json::from_str::<ConventionModule>(json) {
                    Ok(module) => {
                        map.insert(id.to_string(), module);
                    }
                    Err(e) => {
                        panic!("Failed to deserialize module '{}': {}", id, e);
                    }
                }
            }
        }
        map
    })
}

/// Look up a module by ID for a given system.
/// Currently returns SAYC modules for all systems (multi-system deferred).
pub fn get_module(module_id: &str, _system: BaseSystemId) -> Option<&'static ConventionModule> {
    module_cache().get(module_id)
}

/// Get all registered modules for a given system.
/// Returns modules in definition order.
pub fn get_all_modules(_system: BaseSystemId) -> Vec<&'static ConventionModule> {
    let cache = module_cache();
    MODULE_IDS
        .iter()
        .filter_map(|&id| cache.get(id))
        .collect()
}

/// Get modules by a list of IDs. Returns None if any ID is not found.
pub fn get_modules(
    module_ids: &[&str],
    system: BaseSystemId,
) -> Option<Vec<&'static ConventionModule>> {
    module_ids
        .iter()
        .map(|&id| get_module(id, system))
        .collect()
}

/// Get base module IDs for a system.
/// Currently all systems share the same base modules.
pub fn get_base_module_ids(_system: BaseSystemId) -> &'static [&'static str] {
    BASE_MODULE_IDS
}

/// Returns all registered module IDs in definition order.
pub fn all_module_ids() -> &'static [&'static str] {
    MODULE_IDS
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_module_stayman() {
        let module = get_module("stayman", BaseSystemId::Sayc);
        assert!(module.is_some());
        let m = module.unwrap();
        assert_eq!(m.module_id, "stayman");
    }

    #[test]
    fn get_module_unknown_returns_none() {
        assert!(get_module("nonexistent", BaseSystemId::Sayc).is_none());
    }

    #[test]
    fn get_all_modules_returns_8() {
        let modules = get_all_modules(BaseSystemId::Sayc);
        assert_eq!(modules.len(), 8);
    }

    #[test]
    fn get_all_modules_correct_order() {
        let modules = get_all_modules(BaseSystemId::Sayc);
        let ids: Vec<&str> = modules.iter().map(|m| m.module_id.as_str()).collect();
        assert_eq!(ids, MODULE_IDS);
    }

    #[test]
    fn get_modules_by_ids() {
        let ids = &["stayman", "blackwood"];
        let modules = get_modules(ids, BaseSystemId::Sayc);
        assert!(modules.is_some());
        let ms = modules.unwrap();
        assert_eq!(ms.len(), 2);
        assert_eq!(ms[0].module_id, "stayman");
        assert_eq!(ms[1].module_id, "blackwood");
    }

    #[test]
    fn get_modules_fails_on_unknown() {
        let ids = &["stayman", "nonexistent"];
        assert!(get_modules(ids, BaseSystemId::Sayc).is_none());
    }

    #[test]
    fn base_module_ids() {
        let ids = get_base_module_ids(BaseSystemId::Sayc);
        assert_eq!(ids.len(), 4);
        assert!(ids.contains(&"natural-bids"));
        assert!(ids.contains(&"stayman"));
        assert!(ids.contains(&"jacoby-transfers"));
        assert!(ids.contains(&"blackwood"));
    }

    #[test]
    fn no_module_has_broken_description_prefixes() {
        let bad_prefixes = ["Has a ", "No has "];
        for module in get_all_modules(BaseSystemId::Sayc) {
            if let Some(states) = &module.states {
                for state in states {
                    for surface in &state.surfaces {
                        for clause in &surface.clauses {
                            if let Some(desc) = &clause.description {
                                for prefix in &bad_prefixes {
                                    assert!(
                                        !desc.starts_with(prefix),
                                        "Module '{}' has bad description prefix '{}': '{}'",
                                        module.module_id, prefix, desc
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    #[test]
    fn all_modules_have_states() {
        let modules = get_all_modules(BaseSystemId::Sayc);
        for m in &modules {
            assert!(
                m.states.is_some(),
                "Module '{}' should have states",
                m.module_id
            );
        }
    }
}
