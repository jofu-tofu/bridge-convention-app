//! Reference-prose invariants for authored learn-page fixtures.

use std::path::PathBuf;
use std::sync::OnceLock;

use regex::Regex;

const MODULE_FIXTURE_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/fixtures/modules");

fn digits_allowed(path: &str) -> bool {
    path == "reference.summaryCard.bid"
        || (path.contains(".workedAuctions[") && path.ends_with("].calls[].call"))
        || (path.contains(".workedAuctions[") && path.ends_with("].calls[].rationale"))
        || (path.contains(".workedAuctions[") && path.contains("].responderHand."))
}

fn machine_field(path: &str) -> bool {
    path == "reference.summaryCard.definingMeaningId"
        || (path.contains(".relatedLinks[") && path.ends_with("].moduleId"))
        || path.contains(".predicate")
        || path.contains(".reason")
        || path == "reference.quickReference.axis.fact"
        || path == "reference.quickReference.rowAxis.fact"
        || path == "reference.quickReference.colAxis.fact"
        || path == "reference.quickReference.axis.facts[]"
        || path == "reference.quickReference.rowAxis.facts[]"
        || path == "reference.quickReference.colAxis.facts[]"
        || (path.contains(".cells[") && path.ends_with("].id"))
}

fn normalize_indexed_path(path: &str) -> String {
    let mut normalized = String::with_capacity(path.len());
    let mut chars = path.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '[' {
            normalized.push('[');
            if matches!(chars.peek(), Some(next) if next.is_ascii_digit()) {
                while matches!(chars.peek(), Some(next) if next.is_ascii_digit()) {
                    chars.next();
                }
                normalized.push(']');
                let Some(next) = chars.next() else {
                    break;
                };
                assert_eq!(next, ']');
                continue;
            }
        }
        normalized.push(ch);
    }
    normalized
}

fn system_name_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?i)\b(SAYC|Acol|Precision)\b|2/1").expect("valid system-name regex")
    })
}

fn walk_reference_strings(value: &serde_json::Value, path: &str, failures: &mut Vec<String>) {
    match value {
        serde_json::Value::String(text) => {
            let normalized_path = normalize_indexed_path(path);
            if machine_field(&normalized_path) {
                return;
            }
            if text.chars().any(|c| c.is_ascii_digit()) {
                if !digits_allowed(&normalized_path) {
                    failures.push(format!("{path}: {:?}", text));
                }
            }
        }
        serde_json::Value::Array(items) => {
            for (index, item) in items.iter().enumerate() {
                walk_reference_strings(item, &format!("{path}[{index}]"), failures);
            }
        }
        serde_json::Value::Object(map) => {
            for (key, item) in map {
                walk_reference_strings(item, &format!("{path}.{key}"), failures);
            }
        }
        serde_json::Value::Null | serde_json::Value::Bool(_) | serde_json::Value::Number(_) => {}
    }
}

fn walk_reference_system_names(value: &serde_json::Value, path: &str, failures: &mut Vec<String>) {
    match value {
        serde_json::Value::String(text) => {
            let normalized_path = normalize_indexed_path(path);
            if machine_field(&normalized_path) {
                return;
            }
            if let Some(m) = system_name_regex().find(text) {
                failures.push(format!("{path}: {:?} (matched {:?})", text, m.as_str()));
            }
        }
        serde_json::Value::Array(items) => {
            for (index, item) in items.iter().enumerate() {
                walk_reference_system_names(item, &format!("{path}[{index}]"), failures);
            }
        }
        serde_json::Value::Object(map) => {
            for (key, item) in map {
                walk_reference_system_names(item, &format!("{path}.{key}"), failures);
            }
        }
        serde_json::Value::Null | serde_json::Value::Bool(_) | serde_json::Value::Number(_) => {}
    }
}

#[test]
fn authored_reference_prose_contains_no_digits_outside_whitelisted_fields() {
    let dir = PathBuf::from(MODULE_FIXTURE_DIR);
    let mut failures: Vec<String> = Vec::new();

    for entry in std::fs::read_dir(&dir).expect("Failed to read module fixture directory") {
        let entry = entry.expect("Failed to read directory entry");
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
            continue;
        }

        let filename = path.file_name().unwrap().to_string_lossy().into_owned();
        let json_str = std::fs::read_to_string(&path)
            .unwrap_or_else(|err| panic!("Failed to read {filename}: {err}"));
        let raw: serde_json::Value = serde_json::from_str(&json_str)
            .unwrap_or_else(|err| panic!("Failed to parse {filename}: {err}"));

        let reference = raw
            .get("reference")
            .unwrap_or_else(|| panic!("{filename}: missing required reference block"));

        let mut module_failures = Vec::new();
        walk_reference_strings(reference, "reference", &mut module_failures);
        failures.extend(
            module_failures
                .into_iter()
                .map(|failure| format!("  {filename}: {failure}")),
        );
    }

    if !failures.is_empty() {
        panic!(
            "\n\nReference prose digit invariant failures ({} failures):\n{}\n",
            failures.len(),
            failures.join("\n")
        );
    }
}

/// `reference.whenNotToUse` must not be authored — the viewport derives it from
/// `teaching.commonMistakes`. See reference-page-template.md § "Large smells".
#[test]
fn authored_reference_block_does_not_author_when_not_to_use() {
    let dir = PathBuf::from(MODULE_FIXTURE_DIR);
    let mut failures: Vec<String> = Vec::new();

    for entry in std::fs::read_dir(&dir).expect("Failed to read module fixture directory") {
        let entry = entry.expect("Failed to read directory entry");
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
            continue;
        }

        let filename = path.file_name().unwrap().to_string_lossy().into_owned();
        let json_str = std::fs::read_to_string(&path)
            .unwrap_or_else(|err| panic!("Failed to read {filename}: {err}"));
        let raw: serde_json::Value = serde_json::from_str(&json_str)
            .unwrap_or_else(|err| panic!("Failed to parse {filename}: {err}"));

        if raw
            .get("reference")
            .and_then(|r| r.get("whenNotToUse"))
            .is_some()
        {
            failures.push(filename);
        }
    }

    if !failures.is_empty() {
        panic!(
            "\n\nFixtures author reference.whenNotToUse (must be derived from teaching.commonMistakes):\n  {}\n",
            failures.join("\n  ")
        );
    }
}

/// `reference.summaryCard` is authored as `{ trigger, definingMeaningId,
/// partnership }` (+ optional `peers`, optional `guidingIdea` override). All
/// other fields — `bid`, `promises`, `denies` — are derived from the defining
/// meaning. Extra authored keys open a drift channel with the rule data.
#[test]
fn authored_summary_card_only_contains_expected_keys() {
    const ALLOWED: &[&str] = &[
        "trigger",
        "definingMeaningId",
        "partnership",
        "peers",
        "guidingIdea",
    ];

    let dir = PathBuf::from(MODULE_FIXTURE_DIR);
    let mut failures: Vec<String> = Vec::new();

    for entry in std::fs::read_dir(&dir).expect("Failed to read module fixture directory") {
        let entry = entry.expect("Failed to read directory entry");
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
            continue;
        }

        let filename = path.file_name().unwrap().to_string_lossy().into_owned();
        let json_str = std::fs::read_to_string(&path)
            .unwrap_or_else(|err| panic!("Failed to read {filename}: {err}"));
        let raw: serde_json::Value = serde_json::from_str(&json_str)
            .unwrap_or_else(|err| panic!("Failed to parse {filename}: {err}"));

        let Some(summary_card) = raw
            .get("reference")
            .and_then(|r| r.get("summaryCard"))
            .and_then(|s| s.as_object())
        else {
            continue;
        };

        let unexpected: Vec<&str> = summary_card
            .keys()
            .map(String::as_str)
            .filter(|k| !ALLOWED.contains(k))
            .collect();

        if !unexpected.is_empty() {
            failures.push(format!("{filename}: {:?}", unexpected));
        }
    }

    if !failures.is_empty() {
        panic!(
            "\n\nFixtures author unexpected summaryCard keys (expected a subset of {ALLOWED:?}):\n  {}\nbid/promises/denies are derived from definingMeaningId; do not author them.\n",
            failures.join("\n  ")
        );
    }
}

#[test]
fn authored_reference_prose_contains_no_system_names() {
    let dir = PathBuf::from(MODULE_FIXTURE_DIR);
    let mut failures: Vec<String> = Vec::new();

    for entry in std::fs::read_dir(&dir).expect("Failed to read module fixture directory") {
        let entry = entry.expect("Failed to read directory entry");
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
            continue;
        }

        let filename = path.file_name().unwrap().to_string_lossy().into_owned();
        let json_str = std::fs::read_to_string(&path)
            .unwrap_or_else(|err| panic!("Failed to read {filename}: {err}"));
        let raw: serde_json::Value = serde_json::from_str(&json_str)
            .unwrap_or_else(|err| panic!("Failed to parse {filename}: {err}"));

        let reference = raw
            .get("reference")
            .unwrap_or_else(|| panic!("{filename}: missing required reference block"));

        let mut module_failures = Vec::new();
        walk_reference_system_names(reference, "reference", &mut module_failures);
        failures.extend(
            module_failures
                .into_iter()
                .map(|failure| format!("  {filename}: {failure}")),
        );
    }

    if !failures.is_empty() {
        panic!(
            "\n\nReference prose system-name invariant failures ({} failures):\nSystem names (SAYC / 2/1 / Acol / Precision) must not appear in authored reference prose — per-system nuance is rendered from the active SystemConfig.\n{}\n",
            failures.len(),
            failures.join("\n")
        );
    }
}
