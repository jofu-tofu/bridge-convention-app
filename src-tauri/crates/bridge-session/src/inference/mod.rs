//! Inference subsystem — extracts hand information from bids with per-partnership
//! information asymmetry.
//!
//! Architecture:
//! - `InferenceProvider` trait: primary difficulty axis for bid interpretation
//! - `NaturalInferenceProvider`: system-parameterized natural bidding theory
//! - `InferenceEngine`: incremental per-bid processing with asymmetric providers
//! - `InferenceCoordinator`: coordinates NS and EW engines for a drill
//! - Posterior: stub returning uniform distributions (full implementation deferred)

pub mod types;
pub mod derive_beliefs;
pub mod belief_accumulator;
pub mod natural_inference;
pub mod inference_engine;
pub mod annotation_producer;
pub mod inference_coordinator;
pub mod posterior;

// Re-export key types at module level
pub use types::{
    HandInference, SuitInference, PublicBeliefs, DerivedRanges, QualitativeConstraint,
    BidAnnotation, PublicBeliefState, InferenceConfig, InferenceSnapshot,
    InferenceExtractorInput,
};
pub use derive_beliefs::{derive_public_beliefs, hand_inference_to_constraints};
pub use belief_accumulator::{create_initial_belief_state, apply_annotation};
pub use natural_inference::NaturalInferenceProvider;
pub use inference_engine::InferenceEngine;
pub use inference_coordinator::InferenceCoordinator;
pub use posterior::UniformPosterior;
