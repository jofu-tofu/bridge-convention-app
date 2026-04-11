//! Rust-constructed FactComposition trees for module-derived facts.
//!
//! All module-derived fact compositions have been migrated to inline JSON
//! in the fixture files (fixtures/modules/*.json). This module is retained
//! only for the build_rust_compositions() entry point, which now returns
//! an empty map. It can be removed once the evaluator no longer calls it.

use std::collections::HashMap;

use crate::types::FactComposition;

/// Build the map of fact ID -> Rust-constructed FactComposition.
/// Called once at evaluator initialization.
///
/// Returns an empty map — all compositions are now inline in JSON fixtures.
pub fn build_rust_compositions() -> HashMap<String, FactComposition> {
    HashMap::new()
}
