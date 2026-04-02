//! Bridge service crate — thin hexagonal port implementing ServicePort.
//!
//! Delegates to bridge-session controllers. All methods are synchronous.
//! Depends on bridge-engine, bridge-conventions, and bridge-session.

pub(crate) mod bundle_resolver;
pub(crate) mod config_resolver;
pub mod convention_adapter;
pub mod error;
pub mod evaluation;
pub mod feedback_assembler;
pub mod port;
pub mod request_types;
pub mod response_types;
pub mod service_impl;
pub mod session_manager;

pub use error::ServiceError;
pub use port::{DevServicePort, ServicePort};
pub use request_types::{SessionConfig, SessionHandle};
pub use service_impl::ServicePortImpl;

// Re-export response types
pub use response_types::{
    AiBidEntryDTO, AiPlayEntryDTO, BidSubmitResult, ConventionInfo, DDSolutionResult,
    DrillStartResult, PhaseTransition, PromptAcceptResult, ServicePublicBeliefState,
};

// Re-export evaluation types
pub use evaluation::types::{
    AtomGradeResult, PlaythroughGradeResult, PlaythroughHandle, PlaythroughStartResult,
};
