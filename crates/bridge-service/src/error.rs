//! Service error types.

use thiserror::Error;

/// Errors that can occur in the service layer.
#[derive(Debug, Error)]
pub enum ServiceError {
    #[error("No active session")]
    NoSession,

    #[error("Invalid session handle: {0}")]
    InvalidHandle(String),

    #[error("Bundle not found: {0}")]
    BundleNotFound(String),

    #[error("Module not found: {0}")]
    ModuleNotFound(String),

    #[error("Invalid atom ID: {0}")]
    InvalidAtomId(String),

    #[error("Invalid bid: {0}")]
    InvalidBid(String),

    #[error("Session not in expected phase")]
    WrongPhase,

    #[error("DDS not available on this platform")]
    DdsNotAvailable,

    #[error("Playthrough step {0} out of range")]
    StepOutOfRange(usize),

    #[error("Invalid system config: {0}")]
    InvalidConfig(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl ServiceError {
    /// Convert a serde_json error to an internal service error.
    pub fn from_json(e: serde_json::Error) -> Self {
        ServiceError::Internal(format!("JSON error: {}", e))
    }
}
