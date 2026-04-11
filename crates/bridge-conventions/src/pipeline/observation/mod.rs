//! Observation layer: surface selection + observation log construction.
//!
//! Replays local FSMs, matches routes and negotiation predicates,
//! and builds the observation log from auction history.

pub mod committed_step;
pub mod local_fsm;
pub mod negotiation_extractor;
pub mod negotiation_matcher;
pub mod normalize_intent;
pub mod route_matcher;
pub mod rule_interpreter;
