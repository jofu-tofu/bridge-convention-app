//! Bridge session crate — game state, drill lifecycle, controllers, inference, and heuristics.
//!
//! Phase 4 of the Rust/WASM migration. Depends on bridge-engine (pure game logic)
//! and bridge-conventions (convention data model + pipeline).

pub mod dds;
pub mod heuristics;
pub mod inference;
pub mod phase_coordinator;
pub mod phase_machine;
pub mod session;
pub mod types;

// Re-export key types at crate root for convenience.
pub use heuristics::play_profiles::PlayProfileId;
pub use phase_coordinator::{
    resolve_transition, PhaseEvent, PromptActionMode, ServiceAction, TransitionDescriptor,
    ViewportNeeded,
};
pub use phase_machine::{is_valid_transition, valid_targets};
pub use types::{
    DrillSettings, DrillTuning, GamePhase, OpponentMode, PlayPreference,
    PracticeFocus, PracticeMode, PracticeRole, PromptMode, VulnerabilityDistribution,
};
