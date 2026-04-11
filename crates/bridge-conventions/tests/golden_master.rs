//! Golden-master tests: Load exported JSON fixtures → deserialize in Rust →
//! re-serialize → JSON-compare (ignore key ordering).
//!
//! Bundle JSON no longer contains `modules` (runtime-derived from module registry).
//! The roundtrip comparison strips `modules` from both sides, then separately
//! verifies module population via `resolve_bundle()`.

use bridge_conventions::bundle_types::ConventionBundle;
use bridge_conventions::registry::resolve_bundle;
use bridge_conventions::system_config::BaseSystemId;

const FIXTURE_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/fixtures");

fn load_fixture(name: &str) -> String {
    let path = format!("{}/{}.json", FIXTURE_DIR, name);
    std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("Failed to read {}: {}", path, e))
}

fn roundtrip_fixture(name: &str) {
    let json_str = load_fixture(name);

    let bundle: ConventionBundle = serde_json::from_str(&json_str)
        .unwrap_or_else(|e| panic!("Failed to deserialize {}.json: {}", name, e));
    assert_eq!(bundle.id, name, "Bundle ID mismatch");

    // Roundtrip non-module fields
    let reserialized = serde_json::to_string(&bundle).unwrap();
    let mut original_value: serde_json::Value = serde_json::from_str(&json_str).unwrap();
    let mut reserialized_value: serde_json::Value = serde_json::from_str(&reserialized).unwrap();
    // Strip modules — runtime-derived from module registry, not in fixture JSON
    original_value.as_object_mut().unwrap().remove("modules");
    reserialized_value
        .as_object_mut()
        .unwrap()
        .remove("modules");
    assert_eq!(
        original_value, reserialized_value,
        "Round-trip mismatch for {}.json",
        name
    );

    // Verify modules are populated correctly via resolve_bundle
    let resolved = resolve_bundle(name, BaseSystemId::Sayc)
        .unwrap_or_else(|| panic!("resolve_bundle('{}') returned None", name));
    assert!(
        !resolved.modules.is_empty(),
        "Bundle '{}' has no modules after resolution",
        name
    );
    assert_eq!(
        resolved.modules.len(),
        resolved.member_ids.len(),
        "Module count mismatch for '{}'",
        name
    );
    for (module, member_id) in resolved.modules.iter().zip(resolved.member_ids.iter()) {
        assert_eq!(
            &module.module_id, member_id,
            "Module ordering mismatch in '{}'",
            name
        );
    }
}

#[test]
fn nt_bundle_roundtrip() {
    roundtrip_fixture("nt-bundle");
}

#[test]
fn nt_stayman_roundtrip() {
    roundtrip_fixture("nt-stayman");
}

#[test]
fn nt_transfers_roundtrip() {
    roundtrip_fixture("nt-transfers");
}

#[test]
fn bergen_bundle_roundtrip() {
    roundtrip_fixture("bergen-bundle");
}

#[test]
fn weak_twos_bundle_roundtrip() {
    roundtrip_fixture("weak-twos-bundle");
}

#[test]
fn dont_bundle_roundtrip() {
    roundtrip_fixture("dont-bundle");
}
