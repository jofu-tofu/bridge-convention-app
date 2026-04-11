//! Viewport DTO types — struct/enum definitions for all four viewport builders
//! (bidding, declarer prompt, playing, explanation).

use std::collections::HashMap;

use bridge_engine::types::{
    Call, Card, Contract, DistributionPoints, Hand, PlayedCard, Seat, Suit, SuitLength, Trick,
    Vulnerability,
};
use serde::{Deserialize, Serialize};

use crate::types::{PracticeMode, PromptMode};

use super::bid_feedback_builder::BidGrade;

// ── Viewport DTOs ─────────────────────────────────────────────────

/// Hand evaluation for display.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HandEvaluationView {
    pub hcp: u32,
    pub shape: SuitLength,
    pub is_balanced: bool,
    pub distribution_points: DistributionPoints,
}

/// Single auction entry for display.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuctionEntryView {
    pub seat: Seat,
    pub call: Call,
    pub call_display: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alert_label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub annotation_type: Option<AnnotationType>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meaning: Option<String>,
}

/// ACBL annotation type.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AnnotationType {
    Alert,
    Announce,
    Educational,
}

/// A single failed bid attempt captured for review-phase display.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BidAttemptRecord {
    pub user_call: Call,
    pub grade: BidGrade,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wrong_bid_meaning: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub conditions: Vec<ReviewCondition>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expected_call: Option<Call>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expected_explanation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correct_bid_label: Option<String>,
}

/// A single condition check result for review display.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewCondition {
    pub description: String,
    pub passed: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub observed_value: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub explanation_id: Option<String>,
}

/// Viewport-safe bid history entry (subset of full BidHistoryEntry).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BidHistoryEntryView {
    pub seat: Seat,
    pub call: Call,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meaning: Option<String>,
    pub is_user: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_correct: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub grade: Option<BidGrade>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prior_attempts: Option<Vec<BidAttemptRecord>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub arc_label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alert_label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub annotation_type: Option<AnnotationType>,
}

/// Play recommendation for review.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayRecommendation {
    pub trick_index: u32,
    pub play_index: u32,
    pub seat: Seat,
    pub card_played: Card,
    pub recommended_card: Card,
    pub reason: String,
    pub is_optimal: bool,
}

// ── Bid context ──────────────────────────────────────────────────

/// Classification of a legal call relative to the practice focus.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BidRole {
    Target,
    Prerequisite,
    FollowUp,
    OffConvention,
}

/// Bid context view — classifies legal calls by their relation to the focus.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BidContextView {
    pub call_roles: Vec<CallRoleEntry>,
}

/// Role classification for a single call.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CallRoleEntry {
    pub call: Call,
    pub role: BidRole,
}

/// A bidding option — an active meaning surface shown during bidding.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiddingOptionView {
    pub call: Call,
    pub surface_name: String,
    pub summary: String,
}

// ── Bidding Viewport ──────────────────────────────────────────────

/// Bidding viewport — what the player sees during bidding.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiddingViewport {
    pub seat: Seat,
    pub convention_name: String,
    pub hand: Hand,
    pub hand_evaluation: HandEvaluationView,
    pub hand_summary: String,
    pub visible_hands: HashMap<Seat, Hand>,
    pub auction_entries: Vec<AuctionEntryView>,
    pub dealer: Seat,
    pub vulnerability: Vulnerability,
    pub legal_calls: Vec<Call>,
    pub is_user_turn: bool,
    pub current_bidder: Seat,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub practice_mode: Option<PracticeMode>,
    /// Bid context — classifies legal calls by their relation to practice focus.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bid_context: Option<BidContextView>,
    /// Active bidding options from convention surfaces at this turn.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bidding_options: Option<Vec<BiddingOptionView>>,
}

/// Declarer prompt viewport.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeclarerPromptViewport {
    pub user_seat: Seat,
    pub visible_hands: HashMap<Seat, Hand>,
    pub dealer: Seat,
    pub vulnerability: Vulnerability,
    pub auction_entries: Vec<AuctionEntryView>,
    pub contract: Contract,
    pub prompt_mode: PromptMode,
}

/// Playing viewport — what the player sees during play.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayingViewport {
    pub user_seat: Seat,
    pub rotated: bool,
    pub visible_hands: HashMap<Seat, Hand>,
    pub dealer: Seat,
    pub vulnerability: Vulnerability,
    pub contract: Option<Contract>,
    pub current_player: Option<Seat>,
    pub current_trick: Vec<PlayedCard>,
    pub trump_suit: Option<Suit>,
    pub legal_plays: Vec<Card>,
    pub user_controlled_seats: Vec<Seat>,
    pub remaining_cards: HashMap<Seat, Vec<Card>>,
    pub tricks: Vec<Trick>,
    pub declarer_tricks_won: u32,
    pub defender_tricks_won: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auction_entries: Option<Vec<AuctionEntryView>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bid_history: Option<Vec<BidHistoryEntryView>>,
}

/// Explanation viewport — review screen with all hands visible.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplanationViewport {
    pub user_seat: Seat,
    pub all_hands: HashMap<Seat, Hand>,
    pub dealer: Seat,
    pub vulnerability: Vulnerability,
    pub auction_entries: Vec<AuctionEntryView>,
    pub contract: Option<Contract>,
    pub score: Option<i32>,
    pub declarer_tricks_won: u32,
    pub defender_tricks_won: u32,
    pub bid_history: Vec<BidHistoryEntryView>,
    pub tricks: Vec<Trick>,
    pub play_recommendations: Vec<PlayRecommendation>,
}

// ── Builder Input types ───────────────────────────────────────────

/// Input for building a BiddingViewport.
pub struct BuildBiddingViewportInput<'a> {
    pub deal: &'a bridge_engine::types::Deal,
    pub user_seat: Seat,
    pub auction: &'a bridge_engine::types::Auction,
    pub bid_history: &'a [BidHistoryEntryView],
    pub legal_calls: &'a [Call],
    pub face_up_seats: &'a std::collections::HashSet<Seat>,
    pub convention_name: String,
    pub is_user_turn: bool,
    pub current_bidder: Seat,
    pub practice_mode: Option<PracticeMode>,
    pub bid_context: Option<BidContextView>,
    pub bidding_options: Option<Vec<BiddingOptionView>>,
}

/// Input for building a DeclarerPromptViewport.
pub struct BuildDeclarerPromptViewportInput<'a> {
    pub deal: &'a bridge_engine::types::Deal,
    pub user_seat: Seat,
    pub face_up_seats: &'a std::collections::HashSet<Seat>,
    pub auction: &'a bridge_engine::types::Auction,
    pub bid_history: &'a [BidHistoryEntryView],
    pub contract: Contract,
    pub prompt_mode: PromptMode,
}

/// Input for building a PlayingViewport.
pub struct BuildPlayingViewportInput<'a> {
    pub deal: &'a bridge_engine::types::Deal,
    pub user_seat: Seat,
    pub face_up_seats: &'a std::collections::HashSet<Seat>,
    pub auction: Option<&'a bridge_engine::types::Auction>,
    pub bid_history: Option<&'a [BidHistoryEntryView]>,
    pub rotated: bool,
    pub contract: Option<Contract>,
    pub current_player: Option<Seat>,
    pub current_trick: Vec<PlayedCard>,
    pub trump_suit: Option<Suit>,
    pub legal_plays: Vec<Card>,
    pub user_controlled_seats: Vec<Seat>,
    pub remaining_cards: HashMap<Seat, Vec<Card>>,
    pub tricks: Vec<Trick>,
    pub declarer_tricks_won: u32,
    pub defender_tricks_won: u32,
}

/// Input for building an ExplanationViewport.
pub struct BuildExplanationViewportInput<'a> {
    pub deal: &'a bridge_engine::types::Deal,
    pub user_seat: Seat,
    pub auction: &'a bridge_engine::types::Auction,
    pub bid_history: Vec<BidHistoryEntryView>,
    pub contract: Option<Contract>,
    pub score: Option<i32>,
    pub declarer_tricks_won: u32,
    pub defender_tricks_won: u32,
    pub tricks: Vec<Trick>,
    pub play_recommendations: Vec<PlayRecommendation>,
}
