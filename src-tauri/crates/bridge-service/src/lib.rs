//! Bridge service crate — thin hexagonal port implementing ServicePort.
//!
//! Delegates to bridge-session controllers. All methods are synchronous.
//! Depends on bridge-engine, bridge-conventions, and bridge-session.

pub(crate) mod bundle_resolver;
pub(crate) mod config_resolver;
pub mod convention_adapter;
pub(crate) mod drill_setup;
pub mod error;
pub mod feedback_assembler;
pub mod port;
pub mod request_types;
pub mod response_types;
pub mod service_impl;
pub mod session_manager;
pub(crate) mod validation;

pub use error::ServiceError;
pub use port::{DevServicePort, ServicePort};
pub use request_types::{DrillHandle, SessionConfig};
pub use service_impl::{DdsPlayContext, ServicePortImpl};

// Re-export response types
pub use response_types::{
    AiBidEntryDTO, AiPlayEntryDTO, BidSubmitResult, ConventionInfo, DDSolutionResult,
    DrillStartResult, PhaseTransition, PlayEntryResult, ServicePublicBeliefState,
};
