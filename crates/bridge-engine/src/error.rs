use thiserror::Error;

#[derive(Debug, Error)]
pub enum EngineError {
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
}
