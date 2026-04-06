//! Rust-constructed FactComposition trees for module-derived facts.
//!
//! For TS facts that lack `composition` fields in their FactDefinition,
//! this module provides programmatically constructed FactComposition trees.
//! These are a Rust-only superset — they use ExtendedClause variants
//! (TopHonorCount, SuitCompare, etc.) not present in the TS type system.
//!
//! As TS definitions are updated to include compositions with expanded clause types,
//! entries here become redundant and can be removed.

mod bergen;
mod blackwood;
mod dont;
mod helpers;
mod stayman;
mod transfers;
mod weak_two;

use std::collections::HashMap;

use crate::types::FactComposition;

use bergen::add_bergen_compositions;
use blackwood::add_blackwood_compositions;
use dont::add_dont_compositions;
use stayman::add_stayman_compositions;
use transfers::add_transfer_compositions;
use weak_two::add_weak_two_compositions;

/// Build the map of fact ID -> Rust-constructed FactComposition.
/// Called once at evaluator initialization.
pub fn build_rust_compositions() -> HashMap<String, FactComposition> {
    let mut map = HashMap::new();

    // --- Stayman module ---
    add_stayman_compositions(&mut map);

    // --- Jacoby Transfers module ---
    add_transfer_compositions(&mut map);

    // --- Bergen module ---
    add_bergen_compositions(&mut map);

    // --- Blackwood module ---
    add_blackwood_compositions(&mut map);

    // --- DONT module ---
    add_dont_compositions(&mut map);

    // --- Weak Twos module ---
    add_weak_two_compositions(&mut map);

    map
}
