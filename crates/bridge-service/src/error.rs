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

    #[error("Session not in expected phase")]
    WrongPhase,

    #[error("DDS not available on this platform")]
    DdsNotAvailable,

    #[error("Invalid system config: {0}")]
    InvalidConfig(String),

    #[error("Internal error: {0}")]
    Internal(String),

    /// Rejection-sampling could not find a deal satisfying the chosen
    /// witness within the budget. UI treats this as "retry with new seed".
    #[error("Deal generation exhausted: {witness_summary}")]
    DealGenerationExhausted { witness_summary: String },
}
