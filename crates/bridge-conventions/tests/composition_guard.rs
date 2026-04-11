//! Guard test: every module-derived fact must have a valid inline composition.
//!
//! Without a composition, the evaluator silently skips module-derived facts,
//! making the entire module non-functional. This test ensures that no fact
//! definition can be added or left without its composition field.
//!
//! NOTE: This guard will fail for any module-derived fact that still uses a
//! Rust-constructed composition instead of an inline JSON composition. As the
//! migration from rust_compositions/ to inline JSON completes, failures here
//! will resolve. Once all compositions are inline, this test becomes a
//! permanent regression guard.

use std::path::PathBuf;

use bridge_conventions::types::{FactDefinition, FactLayer};

const MODULE_FIXTURE_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/fixtures/modules");

/// Load all module fixture files and return (filename, definitions) pairs.
fn load_all_module_definitions() -> Vec<(String, Vec<FactDefinition>)> {
    let dir = PathBuf::from(MODULE_FIXTURE_DIR);
    assert!(dir.is_dir(), "Module fixture directory not found: {dir:?}");

    let mut results = Vec::new();

    for entry in std::fs::read_dir(&dir).expect("Failed to read module fixture directory") {
        let entry = entry.expect("Failed to read directory entry");
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }

        let filename = path.file_name().unwrap().to_string_lossy().into_owned();
        let json_str = std::fs::read_to_string(&path)
            .unwrap_or_else(|e| panic!("Failed to read {filename}: {e}"));

        let value: serde_json::Value = serde_json::from_str(&json_str)
            .unwrap_or_else(|e| panic!("Failed to parse {filename} as JSON: {e}"));

        let definitions_value = value
            .pointer("/facts/definitions")
            .unwrap_or_else(|| panic!("{filename} is missing facts.definitions"));

        let definitions: Vec<FactDefinition> = serde_json::from_value(definitions_value.clone())
            .unwrap_or_else(|e| {
                panic!("Failed to deserialize facts.definitions in {filename}: {e}")
            });

        results.push((filename, definitions));
    }

    assert!(
        !results.is_empty(),
        "No module fixture files found in {MODULE_FIXTURE_DIR}"
    );
    results
}

#[test]
fn all_module_derived_facts_have_valid_inline_composition() {
    let all_modules = load_all_module_definitions();
    let mut failures: Vec<String> = Vec::new();

    for (filename, definitions) in &all_modules {
        for def in definitions {
            if def.layer != FactLayer::ModuleDerived {
                continue;
            }

            // Posterior facts are computed by the inference system, not the fact DSL.
            // They intentionally have no composition.
            const POSTERIOR_FACTS: &[&str] = &[
                "module.stayman.nsHaveEightCardFitLikely",
                "module.stayman.openerStillBalancedLikely",
                "module.stayman.openerHasSecondMajorLikely",
            ];
            if POSTERIOR_FACTS.contains(&def.id.as_str()) {
                continue;
            }

            match &def.composition {
                None => {
                    failures.push(format!(
                        "  - '{id}' in '{filename}': missing composition field",
                        id = def.id
                    ));
                }
                Some(composition) => {
                    // Verify the composition round-trips through serde (i.e., is structurally valid).
                    // This catches malformed compositions that parse as Value but not as FactComposition.
                    let serialized = match serde_json::to_value(composition) {
                        Ok(v) => v,
                        Err(e) => {
                            failures.push(format!(
                                "  - '{id}' in '{filename}': failed to serialize composition: {e}",
                                id = def.id
                            ));
                            continue;
                        }
                    };
                    if let Err(e) = serde_json::from_value::<
                        bridge_conventions::types::FactComposition,
                    >(serialized)
                    {
                        failures.push(format!(
                            "  - '{id}' in '{filename}': composition is present but invalid: {e}",
                            id = def.id
                        ));
                    }
                }
            }
        }
    }

    if !failures.is_empty() {
        panic!(
            "\n\nModule-derived facts missing or invalid inline compositions ({} failures):\n\
             All module-derived facts must have a valid 'composition' field in their JSON definition.\n\n{}\n",
            failures.len(),
            failures.join("\n")
        );
    }
}
