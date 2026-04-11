//! Meaning pipeline: surfaces → facts → evaluation → arbitration → encoding.
//!
//! Convention-agnostic infrastructure that transforms `BidMeaning[]` surfaces
//! and hand facts into a ranked `PipelineResult`.

pub mod evaluation;
pub mod evidence_bundle;
pub mod observation;
pub mod run_pipeline;
pub mod types;
