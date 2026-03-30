//! Evaluation result types for stateless CLI grading.

use bridge_session::session::{BidFeedbackDTO, BidGrade, BiddingViewport};
use serde::{Deserialize, Serialize};

/// Result of grading a single atom (one bid decision).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AtomGradeResult {
    pub viewport: BiddingViewport,
    pub grade: BidGrade,
    pub correct: bool,
    pub acceptable: bool,
    pub skip: bool,
    pub your_bid: Option<String>,
    pub correct_bid: Option<String>,
    pub feedback: Option<BidFeedbackDTO>,
}

/// Result of starting a playthrough session.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaythroughStartResult {
    pub handle: PlaythroughHandle,
    pub first_step: Option<BiddingViewport>,
}

/// Opaque handle for a playthrough — identifies the session for subsequent steps.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaythroughHandle {
    pub seed: u64,
    pub total_user_steps: usize,
    pub atoms_covered: Vec<String>,
}

/// Result of grading a single playthrough bid.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaythroughGradeResult {
    pub step: BiddingViewport,
    pub grade: String,
    pub correct: bool,
    pub acceptable: bool,
    pub feedback: Option<BidFeedbackDTO>,
    pub next_step: Option<BiddingViewport>,
    pub complete: bool,
    pub your_bid: String,
}
