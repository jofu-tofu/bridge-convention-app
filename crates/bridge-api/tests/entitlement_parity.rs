use std::collections::HashSet;
use std::path::PathBuf;

use bridge_api::billing::entitlements::FREE_BUNDLE_IDS;

/// Verifies that the free-bundle allowlist on the Rust server matches the
/// `FREE_PRACTICE_BUNDLES` set in `src/stores/entitlements.ts`. CI-only
/// textual check — the server never reads the TS file at runtime.
#[test]
fn free_bundle_ids_match_ts_allowlist() {
    let ts_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("src")
        .join("stores")
        .join("entitlements.ts");
    let contents = std::fs::read_to_string(&ts_path)
        .unwrap_or_else(|err| panic!("read {}: {err}", ts_path.display()));

    let ts: HashSet<String> = parse_free_practice_bundles(&contents);
    let rust: HashSet<String> = FREE_BUNDLE_IDS.iter().map(|s| (*s).to_string()).collect();

    assert_eq!(
        ts, rust,
        "TS FREE_PRACTICE_BUNDLES differs from Rust FREE_BUNDLE_IDS\n\
         missing in Rust: {:?}\nmissing in TS:   {:?}",
        ts.difference(&rust).collect::<Vec<_>>(),
        rust.difference(&ts).collect::<Vec<_>>(),
    );
}

fn parse_free_practice_bundles(source: &str) -> HashSet<String> {
    let needle = "FREE_PRACTICE_BUNDLES";
    let needle_pos = source
        .find(needle)
        .unwrap_or_else(|| panic!("entitlements.ts is missing the FREE_PRACTICE_BUNDLES symbol"));
    let after_needle = &source[needle_pos..];

    let array_open = after_needle
        .find('[')
        .unwrap_or_else(|| panic!("could not find opening [ after FREE_PRACTICE_BUNDLES"));
    let array_close = after_needle[array_open..]
        .find(']')
        .unwrap_or_else(|| panic!("could not find closing ] after FREE_PRACTICE_BUNDLES"));
    let body = &after_needle[array_open + 1..array_open + array_close];

    let mut out = HashSet::new();
    for raw in body.split(',') {
        let trimmed = raw.trim().trim_matches(|c: char| c == '"' || c == '\'');
        if trimmed.is_empty() {
            continue;
        }
        out.insert(trimmed.to_string());
    }
    out
}
