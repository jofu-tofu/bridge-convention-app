//! Structural invariant tests for convention module fixtures.
//!
//! These tests catch systematic authoring errors that are easy to introduce
//! and hard to spot in large JSON fixtures. Each test validates a single
//! invariant across ALL module fixtures.
//!
//! Invariants tested:
//! - Surface moduleId must match the file's top-level moduleId
//! - Every meaningId must be unique within a module
//! - Every state phase must be reachable via FSM transitions (or be initial)
//! - declarationOrder must be unique within each state
//! - Every clause factId must reference a plausible fact namespace
//! - Every module must have references.authority and references.discovery

use std::collections::HashSet;
use std::path::PathBuf;

use bridge_conventions::fact_dsl::inversion::{compose_surface_clauses, invert_composition};
use bridge_conventions::types::module_types::ConventionModule;
use bridge_conventions::types::rule_types::PhaseRef;

const MODULE_FIXTURE_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/fixtures/modules");

/// Load all module fixture files as deserialized ConventionModule structs.
fn load_all_modules() -> Vec<(String, ConventionModule)> {
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

        let module: ConventionModule = serde_json::from_str(&json_str)
            .unwrap_or_else(|e| panic!("Failed to deserialize {filename}: {e}"));

        results.push((filename, module));
    }

    assert!(
        !results.is_empty(),
        "No module fixture files found in {MODULE_FIXTURE_DIR}"
    );
    results
}

/// Every surface's moduleId must match the file's top-level moduleId
/// (or its variant_of parent moduleId for variant modules).
///
/// Catches: copy-paste from another module without updating moduleId
/// (e.g., jacoby-4way surfaces saying "jacoby-transfers").
#[test]
fn surface_module_id_matches_top_level() {
    let all_modules = load_all_modules();
    let mut failures: Vec<String> = Vec::new();

    for (filename, module) in &all_modules {
        let expected = &module.module_id;
        // Variant modules (e.g., stayman-garbage is variant_of stayman)
        // may intentionally use the parent module's ID on surfaces.
        let parent = module.variant_of.as_deref();

        if let Some(states) = &module.states {
            for state in states {
                for surface in &state.surfaces {
                    if let Some(surface_mid) = &surface.module_id {
                        let matches_self = surface_mid == expected;
                        let matches_parent = parent.map_or(false, |p| surface_mid == p);
                        if !matches_self && !matches_parent {
                            failures.push(format!(
                                "  {filename}: surface '{}' has moduleId '{}', expected '{}'{}",
                                surface.meaning_id,
                                surface_mid,
                                expected,
                                parent
                                    .map(|p| format!(" or parent '{}'", p))
                                    .unwrap_or_default()
                            ));
                        }
                    }
                }
            }
        }
    }

    if !failures.is_empty() {
        panic!(
            "\n\nSurface moduleId mismatches ({} failures):\n{}\n",
            failures.len(),
            failures.join("\n")
        );
    }
}

/// No two surfaces in the same state should share both meaningId AND
/// declarationOrder — that indicates an exact duplicate from copy-paste.
///
/// Same meaningId with different declarationOrder is valid (e.g., Stayman
/// ask-major for different hand patterns: 4-card major vs 5-4 majors).
/// Same meaningId in different states is also valid.
#[test]
fn no_exact_duplicate_surfaces_within_state() {
    let all_modules = load_all_modules();
    let mut failures: Vec<String> = Vec::new();

    for (filename, module) in &all_modules {
        if let Some(states) = &module.states {
            for state in states {
                let mut seen: HashSet<(&str, i32)> = HashSet::new();
                for surface in &state.surfaces {
                    let key = (
                        surface.meaning_id.as_str(),
                        surface.ranking.declaration_order,
                    );
                    if !seen.insert(key) {
                        failures.push(format!(
                            "  {filename}: state {:?} has duplicate surface '{}' with declarationOrder={}",
                            state.phase, surface.meaning_id, surface.ranking.declaration_order
                        ));
                    }
                }
            }
        }
    }

    if !failures.is_empty() {
        panic!(
            "\n\nExact duplicate surfaces within state ({} failures):\n{}\n",
            failures.len(),
            failures.join("\n")
        );
    }
}

/// Every phase referenced in states must be reachable from the FSM.
///
/// A state entry references a phase, but if no transition leads to that phase
/// and it's not the initial phase, the state is dead code.
#[test]
fn all_state_phases_reachable_from_fsm() {
    let all_modules = load_all_modules();
    let mut failures: Vec<String> = Vec::new();

    for (filename, module) in &all_modules {
        let mut reachable: HashSet<String> = HashSet::new();
        reachable.insert(module.local.initial.clone());
        for transition in &module.local.transitions {
            reachable.insert(transition.to.clone());
        }

        if let Some(states) = &module.states {
            for state in states {
                let phases = match &state.phase {
                    PhaseRef::Single(p) => vec![p.as_str()],
                    PhaseRef::Multiple(ps) => ps.iter().map(|p| p.as_str()).collect(),
                };
                for phase in phases {
                    if !reachable.contains(phase) {
                        failures.push(format!(
                            "  {filename}: state phase '{}' is not reachable from FSM (initial='{}', {} transitions)",
                            phase, module.local.initial, module.local.transitions.len()
                        ));
                    }
                }
            }
        }
    }

    if !failures.is_empty() {
        panic!(
            "\n\nUnreachable state phases ({} failures):\n{}\n",
            failures.len(),
            failures.join("\n")
        );
    }
}

/// Every clause factId must use a recognized namespace prefix.
///
/// Valid prefixes: hand.*, system.*, module.*
/// Catches: typos in fact IDs that would silently fail evaluation.
#[test]
fn clause_fact_ids_use_valid_namespace() {
    let all_modules = load_all_modules();
    let mut failures: Vec<String> = Vec::new();
    let valid_prefixes = ["hand.", "system.", "module.", "bridge."];

    for (filename, module) in &all_modules {
        if let Some(states) = &module.states {
            for state in states {
                for surface in &state.surfaces {
                    for clause in &surface.clauses {
                        if !valid_prefixes.iter().any(|p| clause.fact_id.starts_with(p)) {
                            failures.push(format!(
                                "  {filename}: surface '{}' clause factId '{}' has unknown namespace",
                                surface.meaning_id, clause.fact_id
                            ));
                        }
                    }
                }
            }
        }
    }

    if !failures.is_empty() {
        panic!(
            "\n\nInvalid clause factId namespaces ({} failures):\n{}\n",
            failures.len(),
            failures.join("\n")
        );
    }
}

/// Module fixture filename must match the top-level moduleId.
///
/// Catches: renaming a file without updating the moduleId field.
#[test]
fn filename_matches_module_id() {
    let all_modules = load_all_modules();
    let mut failures: Vec<String> = Vec::new();

    for (filename, module) in &all_modules {
        let expected_filename = format!("{}.json", module.module_id);
        if filename != &expected_filename {
            failures.push(format!(
                "  file '{}' has moduleId '{}' (expected filename '{}')",
                filename, module.module_id, expected_filename
            ));
        }
    }

    if !failures.is_empty() {
        panic!(
            "\n\nFilename/moduleId mismatches ({} failures):\n{}\n",
            failures.len(),
            failures.join("\n")
        );
    }
}

/// Every module must have `references.authority` and `references.discovery` fields.
///
/// `authority` is the authoritative source for this convention's rules.
/// `discovery` is the bridgebum.com URL for finding and overviewing the convention.
///
/// These fields are metadata-only (not deserialized into ConventionModule), so this
/// test reads the raw JSON to validate their presence.
///
/// Catches: new modules added without reference URLs, or stale fixtures missing
/// the required reference structure.
#[test]
fn modules_have_required_references() {
    let dir = PathBuf::from(MODULE_FIXTURE_DIR);
    let mut failures: Vec<String> = Vec::new();

    for entry in std::fs::read_dir(&dir).expect("Failed to read module fixture directory") {
        let entry = entry.expect("Failed to read directory entry");
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }

        let filename = path.file_name().unwrap().to_string_lossy().into_owned();
        let json_str = std::fs::read_to_string(&path)
            .unwrap_or_else(|e| panic!("Failed to read {filename}: {e}"));

        let raw: serde_json::Value = serde_json::from_str(&json_str)
            .unwrap_or_else(|e| panic!("Failed to parse {filename}: {e}"));

        let refs = raw.get("references");

        match refs {
            None => {
                failures.push(format!("  {filename}: missing `references` field entirely"));
            }
            Some(refs_obj) => {
                // authority: must exist with a non-empty url
                match refs_obj.get("authority") {
                    None => {
                        failures.push(format!("  {filename}: missing `references.authority`"));
                    }
                    Some(authority) => {
                        let url = authority.get("url").and_then(|v| v.as_str()).unwrap_or("");
                        if url.is_empty() {
                            failures
                                .push(format!("  {filename}: `references.authority.url` is empty"));
                        }
                        let label = authority
                            .get("label")
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        if label.is_empty() {
                            failures.push(format!(
                                "  {filename}: `references.authority.label` is empty"
                            ));
                        }
                    }
                }

                // discovery: must exist with a non-empty url containing bridgebum.com
                match refs_obj.get("discovery") {
                    None => {
                        failures.push(format!("  {filename}: missing `references.discovery`"));
                    }
                    Some(discovery) => {
                        let url = discovery.get("url").and_then(|v| v.as_str()).unwrap_or("");
                        if url.is_empty() {
                            failures
                                .push(format!("  {filename}: `references.discovery.url` is empty"));
                        } else if !url.contains("bridgebum.com") {
                            failures.push(format!(
                                "  {filename}: `references.discovery.url` should be a bridgebum.com URL, got '{url}'"
                            ));
                        }
                    }
                }
            }
        }
    }

    if !failures.is_empty() {
        panic!(
            "\n\nModule reference validation failures ({} failures):\n{}\n",
            failures.len(),
            failures.join("\n")
        );
    }
}

/// Every surface must have a non-empty teaching label.
///
/// Catches: placeholder or empty teaching text left from scaffolding.
#[test]
fn surfaces_have_teaching_labels() {
    let all_modules = load_all_modules();
    let mut failures: Vec<String> = Vec::new();

    for (filename, module) in &all_modules {
        if let Some(states) = &module.states {
            for state in states {
                for surface in &state.surfaces {
                    let name = surface.teaching_label.name.as_str();
                    let summary = surface.teaching_label.summary.as_str();
                    if name.is_empty() || summary.is_empty() {
                        failures.push(format!(
                            "  {filename}: surface '{}' has empty teaching label (name='{}', summary='{}')",
                            surface.meaning_id, name, summary
                        ));
                    }
                }
            }
        }
    }

    if !failures.is_empty() {
        panic!(
            "\n\nEmpty teaching labels ({} failures):\n{}\n",
            failures.len(),
            failures.join("\n")
        );
    }
}

/// Every surface across every module must be compose-and-invertible without panic.
///
/// Non-hand clauses silently produce default `InvertedConstraint` values; the
/// test asserts only that invocation does not panic.
#[test]
fn all_surface_clauses_are_invertible_without_panic() {
    let all_modules = load_all_modules();
    for (_filename, module) in &all_modules {
        let Some(states) = &module.states else {
            continue;
        };
        for state in states {
            for surface in &state.surfaces {
                let comp = compose_surface_clauses(&surface.clauses);
                let _ = invert_composition(&comp);
            }
        }
    }
}
