//! Fact evaluation DSL — the Rust fact evaluation engine.
//!
//! Given a hand, convention context, and optionally relational context,
//! produces evaluated facts matching the TS `evaluateFacts()` output.
//!
//! ## Module Structure
//!
//! - `types` — Core output types (FactValue, FactData, EvaluatedFacts, RelationalFactContext)
//! - `primitives` — Layer 1: hardcoded primitive evaluators (HCP, suit lengths, balanced)
//! - `bridge_derived` — Layers 2/5: bridge-derived evaluators (standard + relational)
//! - `system_facts` — Layers 3/6: system config evaluators (standard + relational)
//! - `point_helpers` — Centralized `compute_total_points()` for formula-driven point computation
//! - `composition` — FactComposition tree interpreter (primitive, extended, compute evaluation)
//! - `topo_sort` — Topological sort for dependency ordering
//! - `inversion` — FactComposition → InvertedConstraint for deal generation
//! - `evaluator` — `evaluate_facts()` orchestrator combining all layers

pub mod bridge_derived;
pub mod composition;
pub mod evaluator;
pub mod inversion;
pub mod point_helpers;
pub mod primitives;
pub mod system_facts;
pub mod topo_sort;
pub mod types;

// Re-export primary public API
pub use evaluator::evaluate_facts;
pub use inversion::{invert_composition, InvertedConstraint};
pub use point_helpers::compute_total_points;
pub use types::{EvaluatedFacts, FactData, FactValue, FitAgreedContext, RelationalFactContext};
