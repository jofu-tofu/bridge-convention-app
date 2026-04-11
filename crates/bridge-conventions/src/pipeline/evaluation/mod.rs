//! Evaluation layer: surface evaluation, arbitration, encoding.
//!
//! Evaluates surface clauses against facts, resolves encodings,
//! runs gates, and arbitrates the winning meaning.

pub mod alert;
pub mod arbitration_helpers;
pub mod binding_resolver;
pub mod clause_derivation;
pub mod encoder_resolver;
pub mod meaning_arbitrator;
pub mod meaning_evaluator;
pub mod provenance;
pub mod specificity_deriver;
pub mod types;
