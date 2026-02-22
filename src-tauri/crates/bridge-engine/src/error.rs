use thiserror::Error;

#[derive(Debug, Error)]
pub enum EngineError {
    #[error("Hand must have exactly 13 cards, got {0}")]
    InvalidHandSize(usize),

    #[error("Cannot add call to completed auction")]
    AuctionComplete,

    #[error("Illegal call: {0}")]
    IllegalCall(String),

    #[error("Trick must have exactly 4 plays")]
    IncompleteTrick,

    #[error("No bids in auction — cannot determine declarer")]
    NoBidsInAuction,

    #[error("Failed to generate deal after {0} attempts")]
    MaxAttemptsExceeded(u32),

    #[error("{0}")]
    NotImplemented(String),

    #[cfg(feature = "dds")]
    #[error("DDS error: {0}")]
    DdsError(String),
}
