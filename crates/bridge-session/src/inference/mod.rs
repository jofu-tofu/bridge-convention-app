//! Inference subsystem — extracts hand information from bids with per-partnership
//! information asymmetry.
//!
//! Architecture:
//! - `InferenceProvider` trait: primary difficulty axis for bid interpretation
//! - `NaturalInferenceProvider`: system-parameterized natural bidding theory
//! - `InferenceEngine`: incremental per-bid processing with asymmetric providers
//! - `InferenceCoordinator`: coordinates NS and EW engines for a drill
//! - Posterior: stub returning uniform distributions (full implementation deferred)

pub mod annotation_producer;
pub mod belief_accumulator;
pub mod derive_beliefs;
pub mod inference_coordinator;
pub mod inference_engine;
pub mod natural_inference;
pub mod posterior;
pub mod private_belief;
pub mod types;

// Re-export key types at module level
pub use belief_accumulator::{apply_annotation, create_initial_belief_state};
pub use derive_beliefs::{derive_public_beliefs, hand_inference_to_constraints};
pub use inference_coordinator::InferenceCoordinator;
pub use inference_engine::InferenceEngine;
pub use natural_inference::NaturalInferenceProvider;
pub use posterior::{Posterior, PosteriorEngine, UniformPosterior};
pub use types::{
    BidAnnotation, DerivedRanges, DescriptiveConstraint, HandInference, InferenceConfig,
    InferenceExtractorInput, InferenceSnapshot, PublicBeliefState, PublicBeliefs, SuitInference,
};
