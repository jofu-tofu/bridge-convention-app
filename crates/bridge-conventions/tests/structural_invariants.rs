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
//! - Teaching HCP prose must match authored `hand.hcp` clauses
//! - Authored fact definitions must be referenced unless marked teaching-only
//! - Opted-in symmetric state pairs must stay aligned
//! - Reachable fixture states must declare explicit scope in source JSON

use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

use bridge_conventions::fact_catalog::{get_fact_catalog_entry, partition_discriminants, FactKind};
use bridge_conventions::fact_dsl::evaluate_facts;
use bridge_conventions::fact_dsl::inversion::{compose_surface_clauses, invert_composition};
use bridge_conventions::types::meaning::{
    BidMeaning, BidMeaningClause, ConstraintValue, FactOperator,
};
use bridge_conventions::types::module_types::{
    CellBinding, ConventionModule, ModuleReferenceInterference, ModuleReferenceQuickReference,
    PracticeRole, QuickReferenceAxis,
};
use bridge_conventions::types::rule_types::{PhaseRef, StateEntry};
use bridge_conventions::BaseSystemId;
use bridge_engine::types::{BidSuit, Call};
use bridge_engine::{evaluate_hand_hcp, Card, Hand, Rank, Suit};
use regex::Regex;

const MODULE_FIXTURE_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/fixtures/modules");

#[derive(Debug)]
struct HcpBounds {
    min: Option<i64>,
    max: Option<i64>,
}

fn reachable_phases(module: &ConventionModule) -> HashSet<String> {
    let mut reachable = HashSet::from([module.local.initial.clone()]);
    let mut changed = true;

    while changed {
        changed = false;
        for transition in &module.local.transitions {
            if phase_ref_intersects(&transition.from, &reachable)
                && reachable.insert(transition.to.clone())
            {
                changed = true;
            }
        }
    }

    reachable
}

fn phase_ref_intersects(phase: &PhaseRef, reachable: &HashSet<String>) -> bool {
    match phase {
        PhaseRef::Single(name) => reachable.contains(name),
        PhaseRef::Multiple(names) => names.iter().any(|name| reachable.contains(name)),
    }
}

fn phase_names(phase: &PhaseRef) -> Vec<&str> {
    match phase {
        PhaseRef::Single(name) => vec![name.as_str()],
        PhaseRef::Multiple(names) => names.iter().map(String::as_str).collect(),
    }
}

fn phase_label(phase: &PhaseRef) -> String {
    match phase {
        PhaseRef::Single(name) => name.clone(),
        PhaseRef::Multiple(names) => names.join(", "),
    }
}

fn state_for_phase<'a>(states: &'a [StateEntry], phase_id: &str) -> Option<&'a StateEntry> {
    states.iter().find(|state| {
        phase_names(&state.phase)
            .into_iter()
            .any(|name| name == phase_id)
    })
}

fn parse_hcp_bounds(teaching: &str) -> HcpBounds {
    let text = teaching.replace('−', "-").replace('–', "-");
    let range = Regex::new(r"(?i)\b(\d+)\s*-\s*(\d+)\s*HCP\b").unwrap();
    let plus = Regex::new(r"(?i)\b(\d+)\+\s*HCP\b").unwrap();
    let at_most = Regex::new(r"(?i)(?:\bat most\s+|≤\s*)(\d+)\s*HCP\b").unwrap();
    let at_least = Regex::new(r"(?i)\bat least\s+(\d+)\s*HCP\b").unwrap();

    let mut earliest: Option<(usize, HcpBounds)> = None;

    let mut consider = |start: usize, bounds: HcpBounds| match &earliest {
        Some((existing_start, _)) if *existing_start <= start => {}
        _ => earliest = Some((start, bounds)),
    };

    if let Some(captures) = range.captures(&text) {
        let start = captures.get(0).unwrap().start();
        consider(
            start,
            HcpBounds {
                min: Some(captures[1].parse().unwrap()),
                max: Some(captures[2].parse().unwrap()),
            },
        );
    }
    if let Some(captures) = plus.captures(&text) {
        let start = captures.get(0).unwrap().start();
        consider(
            start,
            HcpBounds {
                min: Some(captures[1].parse().unwrap()),
                max: None,
            },
        );
    }
    if let Some(captures) = at_least.captures(&text) {
        let start = captures.get(0).unwrap().start();
        consider(
            start,
            HcpBounds {
                min: Some(captures[1].parse().unwrap()),
                max: None,
            },
        );
    }
    if let Some(captures) = at_most.captures(&text) {
        let start = captures.get(0).unwrap().start();
        consider(
            start,
            HcpBounds {
                min: None,
                max: Some(captures[1].parse().unwrap()),
            },
        );
    }

    earliest.map(|(_, bounds)| bounds).unwrap_or(HcpBounds {
        min: None,
        max: None,
    })
}

fn clause_number(value: &ConstraintValue) -> Option<i64> {
    match value {
        ConstraintValue::Number(number) => number.as_i64(),
        _ => None,
    }
}

fn clause_range(value: &ConstraintValue) -> Option<(i64, i64)> {
    match value {
        ConstraintValue::Range { min, max } => Some((min.as_i64()?, max.as_i64()?)),
        _ => None,
    }
}

fn surface_hcp_bounds(clauses: &[BidMeaningClause]) -> HcpBounds {
    let mut bounds = HcpBounds {
        min: None,
        max: None,
    };

    for clause in clauses {
        if clause.fact_id != "hand.hcp" {
            continue;
        }
        match clause.operator {
            FactOperator::Gte => bounds.min = clause_number(&clause.value),
            FactOperator::Lte => bounds.max = clause_number(&clause.value),
            FactOperator::Eq => {
                let value = clause_number(&clause.value);
                bounds.min = value;
                bounds.max = value;
            }
            FactOperator::Range => {
                let range = clause_range(&clause.value);
                bounds.min = range.map(|(min, _)| min);
                bounds.max = range.map(|(_, max)| max);
            }
            _ => {}
        }
    }

    bounds
}

fn normalize_symmetric_text(text: &str) -> String {
    text.replace("hearts", "$major")
        .replace("spades", "$major")
        .replace("Hearts", "$Major")
        .replace("Spades", "$Major")
}

fn normalized_meaning_signature(surface: &BidMeaning) -> String {
    normalize_symmetric_text(surface.meaning_id.as_str())
}

fn normalized_call_shape(surface: &BidMeaning) -> String {
    match surface.encoding.default_call {
        Call::Pass => "pass".to_string(),
        Call::Double => "double".to_string(),
        Call::Redouble => "redouble".to_string(),
        Call::Bid { level, strain } => {
            let family = match strain {
                BidSuit::Clubs | BidSuit::Diamonds => "minor",
                BidSuit::Hearts | BidSuit::Spades => "major",
                BidSuit::NoTrump => "notrump",
            };
            format!("bid:{level}:{family}")
        }
    }
}

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
        let reachable = reachable_phases(module);

        if let Some(states) = &module.states {
            for state in states {
                for phase in phase_names(&state.phase) {
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

/// Every module must have `references.authority` and `references.discovery` fields,
/// plus a frozen `references.authority.snapshot` that Verify sessions compare against
/// instead of re-fetching the authority URL.
///
/// `authority.url` / `authority.label` — canonical source URL + label.
/// `authority.snapshot.text` — captured authority prose, frozen at Build time.
/// `authority.snapshot.fetchedAt` — ISO-8601 `YYYY-MM-DD` date.
/// `discovery.url` — bridgebum.com overview URL.
///
/// This test reads raw JSON (so the error messages point at exactly which field
/// is missing) and also loads the file through `ConventionModule` to ensure the
/// typed deserializer agrees.
///
/// Catches: new modules added without reference URLs or snapshots, stale
/// fixtures missing the required reference structure, and malformed
/// `fetchedAt` values.
#[test]
fn modules_have_required_references() {
    let dir = PathBuf::from(MODULE_FIXTURE_DIR);
    let mut failures: Vec<String> = Vec::new();

    let iso_date_re =
        Regex::new(r"^\d{4}-\d{2}-\d{2}$").expect("static regex should compile");

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
                // authority: must exist with a non-empty url, label, and frozen snapshot
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
                        match authority.get("snapshot") {
                            None => {
                                failures.push(format!(
                                    "  {filename}: missing `references.authority.snapshot` (required — captures authority prose at Build time for deterministic Verify)"
                                ));
                            }
                            Some(snapshot) => {
                                let text = snapshot
                                    .get("text")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("");
                                if text.trim().is_empty() {
                                    failures.push(format!(
                                        "  {filename}: `references.authority.snapshot.text` is empty"
                                    ));
                                }
                                let fetched_at = snapshot
                                    .get("fetchedAt")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("");
                                if fetched_at.is_empty() {
                                    failures.push(format!(
                                        "  {filename}: `references.authority.snapshot.fetchedAt` is missing or empty"
                                    ));
                                } else if !iso_date_re.is_match(fetched_at) {
                                    failures.push(format!(
                                        "  {filename}: `references.authority.snapshot.fetchedAt` '{fetched_at}' is not ISO-8601 YYYY-MM-DD"
                                    ));
                                }
                            }
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

/// Every module must declare an intentional-scope exclusion note.
///
/// `scopeNote` is free text (1–4 sentences) naming what this module
/// intentionally does not cover — e.g. "Stops at the 4-level. Ogust
/// continuations not supported. Smolen is handled in a separate module."
///
/// ConventionForge Verify reads this first and does not flag anything listed
/// here as missing. Missing/empty values fail loudly so an author must decide
/// on scope before the fixture lands.
#[test]
fn modules_declare_scope_note() {
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

        match raw.get("scopeNote").and_then(|v| v.as_str()) {
            Some(value) if !value.trim().is_empty() => {}
            Some(_) => failures.push(format!(
                "  {filename}: `scopeNote` is present but empty/whitespace"
            )),
            None => failures.push(format!(
                "  {filename}: missing required top-level `scopeNote` (free-text note describing what is intentionally out of scope)"
            )),
        }
    }

    if !failures.is_empty() {
        panic!(
            "\n\nModule scopeNote failures ({} failures):\n{}\n",
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

/// If a teaching label names an HCP bound, the surface clauses must author the
/// same `hand.hcp` bound explicitly.
#[test]
fn teaching_hcp_labels_match_surface_clauses() {
    let all_modules = load_all_modules();
    let mut failures: Vec<String> = Vec::new();

    for (filename, module) in &all_modules {
        let Some(states) = &module.states else {
            continue;
        };

        for state in states {
            for surface in &state.surfaces {
                let teaching = format!(
                    "{} {}",
                    surface.teaching_label.name, surface.teaching_label.summary
                );
                let expected = parse_hcp_bounds(&teaching);
                if expected.min.is_none() && expected.max.is_none() {
                    continue;
                }

                let actual = surface_hcp_bounds(&surface.clauses);
                if let Some(min) = expected.min {
                    if actual.min != Some(min) {
                        failures.push(format!(
                            "  {filename}: module '{}' surface '{}' teaching='{}' missing hand.hcp >= {}",
                            module.module_id, surface.meaning_id, teaching, min
                        ));
                    }
                }
                if let Some(max) = expected.max {
                    if actual.max != Some(max) {
                        failures.push(format!(
                            "  {filename}: module '{}' surface '{}' teaching='{}' missing hand.hcp <= {}",
                            module.module_id, surface.meaning_id, teaching, max
                        ));
                    }
                }
            }
        }
    }

    if !failures.is_empty() {
        panic!(
            "\n\nTeaching HCP labels without matching clauses ({} failures):\n{}\n",
            failures.len(),
            failures.join("\n")
        );
    }
}

/// Every authored fact definition must be referenced by at least one surface
/// clause unless it is explicitly marked as teaching-only metadata.
#[test]
fn fact_extensions_are_referenced_by_surfaces() {
    let all_modules = load_all_modules();
    let mut failures: Vec<String> = Vec::new();

    for (_filename, module) in &all_modules {
        let mut referenced: HashSet<&str> = HashSet::new();
        if let Some(states) = &module.states {
            for state in states {
                for surface in &state.surfaces {
                    for clause in &surface.clauses {
                        referenced.insert(clause.fact_id.as_str());
                    }
                }
            }
        }

        for definition in &module.facts.definitions {
            if definition.for_teaching_only {
                continue;
            }
            if !referenced.contains(definition.id.as_str()) {
                failures.push(format!(
                    "  module '{}': fact '{}' is defined but never referenced by any surface clause",
                    module.module_id, definition.id
                ));
            }
        }
    }

    if !failures.is_empty() {
        panic!(
            "\n\nUnreferenced fact extensions ({} failures):\n{}\n",
            failures.len(),
            failures.join("\n")
        );
    }
}

/// Symmetric state pairs are author-opted. Today the hard invariant is parity
/// of authored surfaces; normalized meaning/call signatures provide extra diff
/// context without requiring full structural equivalence machinery.
#[test]
fn symmetric_state_pairs_have_matching_surface_counts() {
    let all_modules = load_all_modules();
    let mut failures: Vec<String> = Vec::new();

    for (_filename, module) in &all_modules {
        let Some(states) = module.states.as_deref() else {
            continue;
        };

        for (left_id, right_id) in &module.symmetric_pairs {
            let Some(left) = state_for_phase(states, left_id) else {
                failures.push(format!(
                    "  module '{}': symmetric pair references missing state '{}'",
                    module.module_id, left_id
                ));
                continue;
            };
            let Some(right) = state_for_phase(states, right_id) else {
                failures.push(format!(
                    "  module '{}': symmetric pair references missing state '{}'",
                    module.module_id, right_id
                ));
                continue;
            };

            if left.surfaces.len() != right.surfaces.len() {
                failures.push(format!(
                    "  module '{}': symmetric states '{}' ({}) and '{}' ({}) have different surface counts",
                    module.module_id,
                    left_id,
                    left.surfaces.len(),
                    right_id,
                    right.surfaces.len()
                ));
                continue;
            }

            let left_meanings: Vec<String> = left
                .surfaces
                .iter()
                .map(normalized_meaning_signature)
                .collect();
            let right_meanings: Vec<String> = right
                .surfaces
                .iter()
                .map(normalized_meaning_signature)
                .collect();
            if left_meanings != right_meanings {
                failures.push(format!(
                    "  module '{}': symmetric states '{}' and '{}' differ in normalized meaning sequence: left={left_meanings:?} right={right_meanings:?}",
                    module.module_id, left_id, right_id
                ));
                continue;
            }

            let left_shapes: Vec<String> =
                left.surfaces.iter().map(normalized_call_shape).collect();
            let right_shapes: Vec<String> =
                right.surfaces.iter().map(normalized_call_shape).collect();
            if left_shapes != right_shapes {
                failures.push(format!(
                    "  module '{}': symmetric states '{}' and '{}' differ in normalized action shape: left={left_shapes:?} right={right_shapes:?}",
                    module.module_id, left_id, right_id
                ));
            }
        }
    }

    if !failures.is_empty() {
        panic!(
            "\n\nSymmetric state mismatches ({} failures):\n{}\n",
            failures.len(),
            failures.join("\n")
        );
    }
}

/// `scope` defaults only exist for migration. Reachable states must still
/// declare the key explicitly in fixture JSON.
#[test]
fn reachable_states_declare_scope_in_source() {
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
        let module: ConventionModule = serde_json::from_str(&json_str)
            .unwrap_or_else(|e| panic!("Failed to deserialize {filename}: {e}"));
        let reachable = reachable_phases(&module);

        let Some(raw_states) = raw.get("states").and_then(|states| states.as_array()) else {
            continue;
        };
        let Some(parsed_states) = module.states.as_ref() else {
            continue;
        };

        assert_eq!(
            raw_states.len(),
            parsed_states.len(),
            "{filename}: raw states count {} != parsed states count {}",
            raw_states.len(),
            parsed_states.len()
        );

        for (raw_state, parsed_state) in raw_states.iter().zip(parsed_states.iter()) {
            if !phase_ref_intersects(&parsed_state.phase, &reachable) {
                continue;
            }
            if raw_state.get("scope").is_none() {
                failures.push(format!(
                    "  module '{}': reachable state '{}' is missing explicit `scope` in source",
                    module.module_id,
                    phase_label(&parsed_state.phase)
                ));
            }
        }
    }

    if !failures.is_empty() {
        panic!(
            "\n\nReachable states missing explicit scope ({} failures):\n{}\n",
            failures.len(),
            failures.join("\n")
        );
    }
}

#[test]
fn all_module_fixtures_declare_default_role_in_source_and_samples_match() {
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

        match raw.get("defaultRole").and_then(|value| value.as_str()) {
            Some("opener" | "responder" | "both") => {}
            Some(other) => failures.push(format!(
                "  {filename}: defaultRole must be opener|responder|both, got '{other}'"
            )),
            None => failures.push(format!(
                "  {filename}: missing required top-level defaultRole"
            )),
        }
    }

    let all_modules = load_all_modules();
    let by_id: HashMap<&str, PracticeRole> = all_modules
        .iter()
        .map(|(_, module)| (module.module_id.as_str(), module.default_role))
        .collect();

    let expected_samples = [
        ("stayman", PracticeRole::Responder),
        ("jacoby-transfers", PracticeRole::Responder),
        ("jacoby-4way", PracticeRole::Responder),
        ("weak-twos", PracticeRole::Opener),
        ("strong-2c", PracticeRole::Responder),
        ("negative-doubles", PracticeRole::Both),
        ("blackwood", PracticeRole::Both),
        ("michaels-unusual", PracticeRole::Opener),
        ("bergen", PracticeRole::Responder),
        ("dont", PracticeRole::Opener),
        ("new-minor-forcing", PracticeRole::Responder),
        ("smolen", PracticeRole::Responder),
        ("stayman-garbage", PracticeRole::Responder),
        ("natural-bids", PracticeRole::Opener),
    ];

    for (module_id, expected_role) in expected_samples {
        match by_id.get(module_id).copied() {
            Some(actual_role) if actual_role == expected_role => {}
            Some(actual_role) => failures.push(format!(
                "  module '{module_id}': expected {:?}, got {:?}",
                expected_role, actual_role
            )),
            None => failures.push(format!("  missing sample module '{module_id}'")),
        }
    }

    if !failures.is_empty() {
        panic!(
            "\n\ndefaultRole fixture failures ({} failures):\n{}\n",
            failures.len(),
            failures.join("\n")
        );
    }
}

/// Modules in the reference-block allowlist must satisfy the full reference-block
/// schema contract: all required fields present and lint-clean.
#[test]
fn reference_blocks_are_well_formed() {
    const ALLOWLIST: &[&str] = &["stayman"];
    const SYSTEM_FACT_IDS: &[&str] = &[
        "system.responder.weakHand",
        "system.responder.inviteValues",
        "system.responder.gameValues",
        "system.responder.slamValues",
        "system.opener.notMinimum",
        "system.responderTwoLevelNewSuit",
        "system.suitResponseIsGameForcing",
        "system.oneNtForcingAfterMajor",
        "system.responder.oneNtRange",
        "system.dontOvercall.inRange",
        "system.opening.weakTwoRange",
        "system.opening.strong2cRange",
    ];

    let all_modules = load_all_modules();
    let mut failures: Vec<String> = Vec::new();

    for (filename, module) in &all_modules {
        if !ALLOWLIST.contains(&module.module_id.as_str()) {
            continue;
        }
        let reference = &module.reference;

        // --- Summary card ---
        let sc = &reference.summary_card;
        if sc.trigger.is_empty() {
            failures.push(format!("  {filename}: summary_card.trigger is empty"));
        }
        if sc.partnership.is_empty() {
            failures.push(format!("  {filename}: summary_card.partnership is empty"));
        }
        if sc.defining_meaning_id.is_empty() {
            failures.push(format!(
                "  {filename}: summary_card.defining_meaning_id is empty"
            ));
        } else {
            let mut found = false;
            if let Some(states) = &module.states {
                'outer: for state in states {
                    for surface in &state.surfaces {
                        if surface.meaning_id == sc.defining_meaning_id {
                            found = true;
                            break 'outer;
                        }
                    }
                }
            }
            if !found {
                failures.push(format!(
                    "  {filename}: summary_card.defining_meaning_id '{}' does not resolve to any surface meaning_id",
                    sc.defining_meaning_id
                ));
            }
        }

        // --- Teaching ---
        if module.teaching.principle.as_str().is_empty() {
            failures.push(format!("  {filename}: teaching.principle is empty"));
        }
        if module.teaching.common_mistakes.len() < 3 {
            failures.push(format!(
                "  {filename}: teaching.common_mistakes.len() = {} < 3",
                module.teaching.common_mistakes.len()
            ));
        }
        for (i, mistake) in module.teaching.common_mistakes.iter().enumerate() {
            if mistake.text.is_empty() {
                failures.push(format!(
                    "  {filename}: teaching.common_mistakes[{i}].text is empty"
                ));
            }
            if mistake.reason.is_empty() {
                failures.push(format!(
                    "  {filename}: teaching.common_mistakes[{i}].reason is empty"
                ));
            }
        }

        // --- When to use ---
        if reference.when_to_use.len() < 2 {
            failures.push(format!(
                "  {filename}: when_to_use.len() = {} < 2",
                reference.when_to_use.len()
            ));
        }

        // --- Worked auctions ---
        if reference.worked_auctions.len() < 2 {
            failures.push(format!(
                "  {filename}: worked_auctions.len() = {} < 2",
                reference.worked_auctions.len()
            ));
        }
        for (i, auction) in reference.worked_auctions.iter().enumerate() {
            if auction.calls.len() < 2 {
                failures.push(format!(
                    "  {filename}: worked_auctions[{i}].calls.len() = {} < 2",
                    auction.calls.len()
                ));
            }
            for (j, call) in auction.calls.iter().enumerate() {
                if call.rationale.is_empty() {
                    failures.push(format!(
                        "  {filename}: worked_auctions[{i}].calls[{j}].rationale is empty"
                    ));
                }
            }
        }

        // --- Interference ---
        match &reference.interference {
            ModuleReferenceInterference::Applicable { items } => {
                // NonEmptyInterferenceItems enforces >=1 at deserialize; check fields.
                for (i, item) in items.iter().enumerate() {
                    if item.opponent_action.is_empty() {
                        failures.push(format!(
                            "  {filename}: interference.items[{i}].opponent_action is empty"
                        ));
                    }
                    if item.our_action.is_empty() {
                        failures.push(format!(
                            "  {filename}: interference.items[{i}].our_action is empty"
                        ));
                    }
                }
            }
            ModuleReferenceInterference::NotApplicable { reason } => {
                if reason.is_empty() {
                    failures.push(format!(
                        "  {filename}: interference.notApplicable.reason is empty"
                    ));
                }
            }
        }

        // --- Related links ---
        if reference.related_links.is_empty() {
            failures.push(format!("  {filename}: related_links is empty"));
        }
        for (i, link) in reference.related_links.iter().enumerate() {
            if link.discriminator.is_empty() {
                failures.push(format!(
                    "  {filename}: related_links[{i}].discriminator is empty"
                ));
            }
        }

        // --- Quick reference ---
        // Build module fact catalog for SystemFactLadder validation.
        let module_fact_ids: HashSet<&str> = module
            .facts
            .definitions
            .iter()
            .map(|d| d.id.as_str())
            .collect();
        let axis_len = |axis: &QuickReferenceAxis| match axis {
            QuickReferenceAxis::SystemFactLadder { facts, .. } => facts.len(),
            QuickReferenceAxis::PartitionLadder { fact, .. } => partition_discriminants(fact)
                .map(|discriminants| discriminants.len())
                .unwrap_or(0),
        };
        let check_axis = |axis: &QuickReferenceAxis, loc: &str, failures: &mut Vec<String>| {
            match axis {
                QuickReferenceAxis::SystemFactLadder { label, facts } => {
                    if label.is_empty() {
                        failures.push(format!("  {filename}: {loc} SystemFactLadder label empty"));
                    }
                    if facts.len() < 2 {
                        failures.push(format!(
                            "  {filename}: {loc} SystemFactLadder facts.len() = {} < 2",
                            facts.len()
                        ));
                    }
                    for fact in facts {
                        let known = SYSTEM_FACT_IDS.contains(&fact.as_str())
                            || module_fact_ids.contains(fact.as_str());
                        if !known {
                            failures.push(format!(
                                "  {filename}: {loc} SystemFactLadder fact '{fact}' not in module catalog or global system-facts catalog"
                            ));
                        }
                    }
                }
                QuickReferenceAxis::PartitionLadder { label, fact } => {
                    if label.is_empty() {
                        failures.push(format!("  {filename}: {loc} PartitionLadder label empty"));
                    }
                    match get_fact_catalog_entry(fact.as_str()) {
                        Some(entry) if entry.kind == FactKind::Partition => {
                            let discriminant_count = entry
                                .partition
                                .as_ref()
                                .map(|partition| partition.discriminants.len())
                                .unwrap_or(0);
                            if discriminant_count < 2 {
                                failures.push(format!(
                                    "  {filename}: {loc} PartitionLadder fact '{}' has {} discriminants < 2",
                                    fact.as_str(),
                                    discriminant_count
                                ));
                            }
                        }
                        Some(entry) => failures.push(format!(
                            "  {filename}: {loc} PartitionLadder fact '{}' has non-partition kind {:?}",
                            fact.as_str(),
                            entry.kind
                        )),
                        None => failures.push(format!(
                            "  {filename}: {loc} PartitionLadder fact '{}' is unknown",
                            fact.as_str()
                        )),
                    }
                }
            }
        };

        match &reference.quick_reference {
            ModuleReferenceQuickReference::Grid {
                row_axis,
                col_axis,
                cells,
            } => {
                check_axis(row_axis, "quick_reference.rowAxis", &mut failures);
                check_axis(col_axis, "quick_reference.colAxis", &mut failures);
                let row_len = axis_len(row_axis);
                let col_len = axis_len(col_axis);
                if cells.len() != row_len {
                    failures.push(format!(
                        "  {filename}: quick_reference grid row count {} != rowAxis length {}",
                        cells.len(),
                        row_len
                    ));
                }
                for (i, row) in cells.iter().enumerate() {
                    if row.len() != col_len {
                        failures.push(format!(
                            "  {filename}: quick_reference grid cells[{i}] length {} != colAxis length {}",
                            row.len(),
                            col_len
                        ));
                    }
                    for (j, cell) in row.iter().enumerate() {
                        match cell {
                            CellBinding::Auto => {}
                            CellBinding::Surface { id } => {
                                if id.is_empty() {
                                    failures.push(format!(
                                        "  {filename}: quick_reference cells[{i}][{j}] surface id is empty"
                                    ));
                                }
                            }
                            CellBinding::NotApplicable { .. } => {}
                        }
                    }
                }
            }
            ModuleReferenceQuickReference::List { axis, items } => {
                check_axis(axis, "quick_reference.axis", &mut failures);
                let resolved_axis_len = axis_len(axis);
                if items.len() != resolved_axis_len {
                    failures.push(format!(
                        "  {filename}: quick_reference list items.len() {} != axis length {}",
                        items.len(),
                        resolved_axis_len
                    ));
                }
                for (i, item) in items.iter().enumerate() {
                    if item.recommendation.is_empty() {
                        failures.push(format!(
                            "  {filename}: quick_reference items[{i}].recommendation is empty"
                        ));
                    }
                }
            }
        }
    }

    if !failures.is_empty() {
        panic!(
            "\n\nReference-block well-formedness failures ({} failures):\n{}\n",
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

#[test]
fn partition_facts_are_total_and_mutually_exclusive_on_representative_hands() {
    fn hand_from_cards(cards: &[(&str, &str)]) -> Hand {
        Hand {
            cards: cards
                .iter()
                .map(|(suit, rank)| Card {
                    suit: match *suit {
                        "S" => Suit::Spades,
                        "H" => Suit::Hearts,
                        "D" => Suit::Diamonds,
                        "C" => Suit::Clubs,
                        _ => panic!("invalid suit {suit}"),
                    },
                    rank: match *rank {
                        "2" => Rank::Two,
                        "3" => Rank::Three,
                        "4" => Rank::Four,
                        "5" => Rank::Five,
                        "6" => Rank::Six,
                        "7" => Rank::Seven,
                        "8" => Rank::Eight,
                        "9" => Rank::Nine,
                        "T" => Rank::Ten,
                        "J" => Rank::Jack,
                        "Q" => Rank::Queen,
                        "K" => Rank::King,
                        "A" => Rank::Ace,
                        _ => panic!("invalid rank {rank}"),
                    },
                })
                .collect(),
        }
    }

    fn assert_partition_case(fact_id: &str, expected: &str, hand_label: &str, hand: Hand) {
        let entry = get_fact_catalog_entry(fact_id).expect("catalog entry should exist");
        assert_eq!(
            entry.kind,
            FactKind::Partition,
            "{fact_id} must be a partition"
        );
        let discriminants = entry
            .partition
            .as_ref()
            .expect("partition fact should carry discriminants");
        let system =
            bridge_conventions::registry::system_configs::get_system_config(BaseSystemId::Sayc);
        let evaluated = evaluate_facts(
            &hand,
            &evaluate_hand_hcp(&hand),
            &[],
            Some(&system),
            None,
            None,
        );
        let matched: Vec<&str> = discriminants
            .discriminants
            .iter()
            .filter_map(|discriminant| {
                let result = bridge_conventions::fact_dsl::composition::evaluate_composition(
                    &discriminant.predicate,
                    &hand,
                    &evaluated.facts,
                    None,
                );
                result.as_bool().then_some(discriminant.id)
            })
            .collect();
        assert_eq!(
            matched,
            vec![expected],
            "{fact_id} representative hand {hand_label} should map to {expected}, got {matched:?}"
        );
    }

    let major_shape_cases = vec![
        (
            "noFourCardMajor",
            "3=3=3=4",
            hand_from_cards(&[
                ("S", "A"),
                ("S", "K"),
                ("S", "Q"),
                ("H", "A"),
                ("H", "K"),
                ("H", "Q"),
                ("D", "A"),
                ("D", "K"),
                ("D", "Q"),
                ("C", "A"),
                ("C", "K"),
                ("C", "Q"),
                ("C", "J"),
            ]),
        ),
        (
            "flatFourCardMajor",
            "4=3=3=3",
            hand_from_cards(&[
                ("S", "A"),
                ("S", "K"),
                ("S", "Q"),
                ("S", "J"),
                ("H", "A"),
                ("H", "K"),
                ("H", "Q"),
                ("D", "A"),
                ("D", "K"),
                ("D", "Q"),
                ("C", "A"),
                ("C", "K"),
                ("C", "Q"),
            ]),
        ),
        (
            "oneFourCardMajor",
            "5=3=3=2",
            hand_from_cards(&[
                ("S", "A"),
                ("S", "K"),
                ("S", "Q"),
                ("S", "J"),
                ("S", "T"),
                ("H", "A"),
                ("H", "K"),
                ("H", "Q"),
                ("D", "A"),
                ("D", "K"),
                ("D", "Q"),
                ("C", "A"),
                ("C", "K"),
            ]),
        ),
        (
            "fiveFourMajors",
            "5=4=2=2",
            hand_from_cards(&[
                ("S", "A"),
                ("S", "K"),
                ("S", "Q"),
                ("S", "J"),
                ("S", "T"),
                ("H", "A"),
                ("H", "K"),
                ("H", "Q"),
                ("H", "J"),
                ("D", "A"),
                ("D", "K"),
                ("C", "A"),
                ("C", "K"),
            ]),
        ),
        (
            "oneFourCardMajor",
            "3=5=3=2",
            hand_from_cards(&[
                ("S", "A"),
                ("S", "K"),
                ("S", "Q"),
                ("H", "A"),
                ("H", "K"),
                ("H", "Q"),
                ("H", "J"),
                ("H", "T"),
                ("D", "A"),
                ("D", "K"),
                ("D", "Q"),
                ("C", "A"),
                ("C", "K"),
            ]),
        ),
    ];
    for (expected, hand_label, hand) in major_shape_cases {
        assert_partition_case("responder.majorShape", expected, hand_label, hand);
    }

    let classic_ace_cases = vec![
        (
            "zero",
            "0 aces",
            hand_from_cards(&[
                ("S", "K"),
                ("S", "Q"),
                ("S", "J"),
                ("S", "9"),
                ("H", "K"),
                ("H", "Q"),
                ("H", "J"),
                ("D", "K"),
                ("D", "Q"),
                ("D", "J"),
                ("C", "K"),
                ("C", "Q"),
                ("C", "J"),
            ]),
        ),
        (
            "one",
            "1 ace",
            hand_from_cards(&[
                ("S", "A"),
                ("S", "Q"),
                ("S", "J"),
                ("S", "9"),
                ("H", "K"),
                ("H", "Q"),
                ("H", "J"),
                ("D", "K"),
                ("D", "Q"),
                ("D", "J"),
                ("C", "K"),
                ("C", "Q"),
                ("C", "J"),
            ]),
        ),
        (
            "two",
            "2 aces",
            hand_from_cards(&[
                ("S", "A"),
                ("S", "Q"),
                ("S", "J"),
                ("S", "9"),
                ("H", "A"),
                ("H", "Q"),
                ("H", "J"),
                ("D", "K"),
                ("D", "Q"),
                ("D", "J"),
                ("C", "K"),
                ("C", "Q"),
                ("C", "J"),
            ]),
        ),
        (
            "three",
            "3 aces",
            hand_from_cards(&[
                ("S", "A"),
                ("S", "Q"),
                ("S", "J"),
                ("S", "9"),
                ("H", "A"),
                ("H", "Q"),
                ("H", "J"),
                ("D", "A"),
                ("D", "Q"),
                ("D", "J"),
                ("C", "K"),
                ("C", "Q"),
                ("C", "J"),
            ]),
        ),
        (
            "four",
            "4 aces",
            hand_from_cards(&[
                ("S", "A"),
                ("S", "Q"),
                ("S", "J"),
                ("S", "9"),
                ("H", "A"),
                ("H", "Q"),
                ("H", "J"),
                ("D", "A"),
                ("D", "Q"),
                ("D", "J"),
                ("C", "A"),
                ("C", "Q"),
                ("C", "J"),
            ]),
        ),
    ];
    for (expected, hand_label, hand) in classic_ace_cases {
        assert_partition_case("responder.classicAceCount", expected, hand_label, hand);
    }

    let king_count_cases = vec![
        (
            "zero",
            "0 kings",
            hand_from_cards(&[
                ("S", "A"),
                ("S", "Q"),
                ("S", "J"),
                ("S", "9"),
                ("H", "A"),
                ("H", "Q"),
                ("H", "J"),
                ("D", "A"),
                ("D", "Q"),
                ("D", "J"),
                ("C", "A"),
                ("C", "Q"),
                ("C", "J"),
            ]),
        ),
        (
            "one",
            "1 king",
            hand_from_cards(&[
                ("S", "K"),
                ("S", "Q"),
                ("S", "J"),
                ("S", "9"),
                ("H", "A"),
                ("H", "Q"),
                ("H", "J"),
                ("D", "A"),
                ("D", "Q"),
                ("D", "J"),
                ("C", "A"),
                ("C", "Q"),
                ("C", "J"),
            ]),
        ),
        (
            "two",
            "2 kings",
            hand_from_cards(&[
                ("S", "K"),
                ("S", "Q"),
                ("S", "J"),
                ("S", "9"),
                ("H", "K"),
                ("H", "Q"),
                ("H", "J"),
                ("D", "A"),
                ("D", "Q"),
                ("D", "J"),
                ("C", "A"),
                ("C", "Q"),
                ("C", "J"),
            ]),
        ),
        (
            "three",
            "3 kings",
            hand_from_cards(&[
                ("S", "K"),
                ("S", "Q"),
                ("S", "J"),
                ("S", "9"),
                ("H", "K"),
                ("H", "Q"),
                ("H", "J"),
                ("D", "K"),
                ("D", "Q"),
                ("D", "J"),
                ("C", "A"),
                ("C", "Q"),
                ("C", "J"),
            ]),
        ),
        (
            "four",
            "4 kings",
            hand_from_cards(&[
                ("S", "K"),
                ("S", "Q"),
                ("S", "J"),
                ("S", "9"),
                ("H", "K"),
                ("H", "Q"),
                ("H", "J"),
                ("D", "K"),
                ("D", "Q"),
                ("D", "J"),
                ("C", "K"),
                ("C", "Q"),
                ("C", "J"),
            ]),
        ),
    ];
    for (expected, hand_label, hand) in king_count_cases {
        assert_partition_case("responder.kingCount", expected, hand_label, hand);
    }

    let transfer_target_cases = vec![
        (
            "hearts",
            "5 hearts only",
            hand_from_cards(&[
                ("S", "K"),
                ("S", "Q"),
                ("S", "J"),
                ("H", "A"),
                ("H", "K"),
                ("H", "Q"),
                ("H", "J"),
                ("H", "9"),
                ("D", "A"),
                ("D", "K"),
                ("D", "Q"),
                ("C", "A"),
                ("C", "K"),
            ]),
        ),
        (
            "spades",
            "5 spades only",
            hand_from_cards(&[
                ("S", "A"),
                ("S", "K"),
                ("S", "Q"),
                ("S", "J"),
                ("S", "9"),
                ("H", "K"),
                ("H", "Q"),
                ("H", "J"),
                ("D", "A"),
                ("D", "K"),
                ("D", "Q"),
                ("C", "A"),
                ("C", "K"),
            ]),
        ),
        (
            "spades",
            "5-5 majors prefer spades",
            hand_from_cards(&[
                ("S", "A"),
                ("S", "K"),
                ("S", "Q"),
                ("S", "J"),
                ("S", "9"),
                ("H", "A"),
                ("H", "K"),
                ("H", "Q"),
                ("H", "J"),
                ("H", "9"),
                ("D", "K"),
                ("C", "Q"),
                ("C", "J"),
            ]),
        ),
    ];
    for (expected, hand_label, hand) in transfer_target_cases {
        assert_partition_case("transfer.targetSuit", expected, hand_label, hand);
    }
}

/// Summary-card peers invariant (applies to all modules).
///
/// When `summaryCard.peers` is authored (non-empty), every peer's
/// `definingMeaningId` must resolve to a surface on the same module, the
/// top-level `definingMeaningId` must be one of the peers (the hero within
/// the peer set), and `peers.len() >= 2` (one peer is a hero). When `peers`
/// is empty, the module uses the hero-only layout and no validation applies.
///
/// The discriminator-label digit / no-digits rule is enforced by
/// `reference_prose_invariants` (walks all authored string fields).
#[test]
fn summary_card_peers_are_well_formed() {
    let all_modules = load_all_modules();
    let mut failures: Vec<String> = Vec::new();

    for (filename, module) in &all_modules {
        let sc = &module.reference.summary_card;
        if sc.peers.is_empty() {
            continue;
        }

        if sc.peers.len() < 2 {
            failures.push(format!(
                "  {filename}: summary_card.peers.len() = {} < 2 (authoring invariant: peers must contain at least two entries when authored)",
                sc.peers.len()
            ));
        }

        // Collect all surface meaning ids for this module.
        let mut surface_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
        if let Some(states) = &module.states {
            for state in states {
                for surface in &state.surfaces {
                    surface_ids.insert(surface.meaning_id.clone());
                }
            }
        }

        let mut peer_ids: Vec<&str> = Vec::new();
        for (i, peer) in sc.peers.iter().enumerate() {
            if peer.discriminator_label.trim().is_empty() {
                failures.push(format!(
                    "  {filename}: summary_card.peers[{i}].discriminator_label is empty"
                ));
            }
            if peer.defining_meaning_id.trim().is_empty() {
                failures.push(format!(
                    "  {filename}: summary_card.peers[{i}].defining_meaning_id is empty"
                ));
                continue;
            }
            if !surface_ids.contains(peer.defining_meaning_id.as_str()) {
                failures.push(format!(
                    "  {filename}: summary_card.peers[{i}].defining_meaning_id '{}' does not resolve to any surface meaning_id",
                    peer.defining_meaning_id
                ));
            }
            peer_ids.push(peer.defining_meaning_id.as_str());
        }

        if !peer_ids.iter().any(|id| *id == sc.defining_meaning_id) {
            failures.push(format!(
                "  {filename}: summary_card.defining_meaning_id '{}' must appear in summary_card.peers[] when peers is authored",
                sc.defining_meaning_id
            ));
        }
    }

    if !failures.is_empty() {
        panic!(
            "\n\nSummary-card peers invariant failures ({} failures):\n{}\n",
            failures.len(),
            failures.join("\n")
        );
    }
}
