//! Bidding controller — pure synchronous bidding logic.
//!
//! Ported from TS `src/session/bidding-controller.ts`. Major simplification:
//! all functions are synchronous (Rust calls bridge_engine directly, no
//! EnginePort async boundary). Convention strategy grading is simplified —
//! full teaching resolution deferred to convention pipeline integration.

use std::collections::HashMap;

use bridge_conventions::adapter::strategy_evaluation::StrategyEvaluation;
use bridge_conventions::teaching::teaching_types::{ExplanationKind, MeaningStatus};
use bridge_conventions::types::meaning::FactConstraint;
use bridge_engine::auction::{add_call, get_contract, get_legal_calls, is_auction_complete};
use bridge_engine::constants::next_seat;
use bridge_engine::hand_evaluator::evaluate_hand_hcp;
use bridge_engine::types::{Auction, AuctionEntry, Call, Hand, Seat};

use crate::heuristics::{BidResult, BiddingContext};
use crate::phase_machine::is_valid_transition;
use crate::types::{GamePhase, PlayPreference};

use super::bid_feedback_builder::{assemble_bid_feedback, BidFeedbackDTO, BidGrade};
use super::session_state::{get_current_turn, DebugLogEntry, SeatStrategy, SessionState};
use super::viewport_types::{BidAttemptRecord, BidHistoryEntryView, ReviewCondition};

// ── Result types ───────────────────────────────────────────────────

/// Result of processing a user's bid.
#[derive(Debug)]
pub struct BidProcessResult {
    /// Whether the bid was accepted (correct or no strategy to check against).
    pub accepted: bool,
    /// Feedback about the bid grade/explanation.
    pub feedback: Option<BidFeedbackDTO>,
    /// AI bids that ran after the user's bid.
    pub ai_bids: Vec<AiBidEntry>,
    /// Whether the auction completed (3 passes after a bid, or 4 passes).
    pub auction_complete: bool,
    /// Phase transition if the auction completed.
    pub phase_transition: Option<(GamePhase, GamePhase)>,
    /// The user's bid history entry (for UI display).
    pub user_history_entry: Option<BidHistoryEntryView>,
}

/// A single AI bid for animation/replay.
#[derive(Debug, Clone)]
pub struct AiBidEntry {
    pub seat: Seat,
    pub call: Call,
    pub history_entry: BidHistoryEntryView,
}

// ── Public API ─────────────────────────────────────────────────────

/// Process a user's bid: grade, apply if correct, run AI bids, return result.
///
/// Synchronous — calls bridge_engine functions directly.
/// Convention strategy grading is simplified for Phase 4.
pub fn process_bid(
    state: &mut SessionState,
    call: Call,
    seat_strategies: &HashMap<Seat, SeatStrategy>,
) -> BidProcessResult {
    let current_turn = get_current_turn(&state.auction, state.deal.dealer);

    // Guard: must be user's turn
    let current_turn = match current_turn {
        Some(seat) if state.is_user_seat(seat) => seat,
        _ => return empty_result(),
    };

    // Check if there's a convention strategy for grading
    let expected_result = get_expected_bid(state, current_turn, seat_strategies);

    let feedback = assemble_bid_feedback(&call, expected_result.as_ref());

    // Capture debug log entry for this user bid
    state.debug_log.push(DebugLogEntry {
        kind: "user-bid".to_string(),
        turn_index: state.auction.entries.len(),
        seat: current_turn,
        call: Some(call.clone()),
        expected_call: expected_result.as_ref().map(|r| r.call.clone()),
        expected_explanation: expected_result.as_ref().map(|r| r.explanation.clone()),
        grade: Some(feedback.grade),
        trace: expected_result.as_ref().and_then(|r| r.trace.clone()),
        evaluation_snapshot: capture_evaluation_snapshot(current_turn, seat_strategies),
        bid_feedback: Some(feedback.clone()),
    });

    // Grade-acceptance policy: Correct/Acceptable advance;
    // NearMiss/Incorrect block and require retry.
    let should_reject = matches!(feedback.grade, BidGrade::NearMiss | BidGrade::Incorrect);

    if should_reject {
        // Capture the wrong bid attempt for review screen
        state.pending_attempts.push(extract_attempt_record(
            &feedback,
            expected_result.as_ref(),
            current_turn,
            state.deal.hands.get(&current_turn),
            seat_strategies,
        ));
        return BidProcessResult {
            accepted: false,
            feedback: Some(feedback),
            ai_bids: Vec::new(),
            auction_complete: false,
            phase_transition: None,
            user_history_entry: None,
        };
    }

    // Apply user's bid to auction
    apply_bid_and_run_ai(
        state,
        current_turn,
        call,
        expected_result.as_ref(),
        seat_strategies,
        Some(feedback),
    )
}

/// Run initial AI bids after drill start (before user's first turn).
/// Returns the list of AI bids for animation.
pub fn run_initial_ai_bids(
    state: &mut SessionState,
    seat_strategies: &HashMap<Seat, SeatStrategy>,
) -> Vec<AiBidEntry> {
    let current_turn = get_current_turn(&state.auction, state.deal.dealer);
    let current_turn = match current_turn {
        Some(seat) => seat,
        None => return Vec::new(),
    };

    // If it's already the user's turn, just fetch legal calls
    if state.is_user_seat(current_turn) {
        state.legal_calls = get_legal_calls(&state.auction, current_turn);
        return Vec::new();
    }

    let (ai_bids, _complete) = run_ai_bid_loop(state, current_turn, seat_strategies);
    ai_bids
}

/// Initialize auction from a pre-set initial auction.
/// Replays entries through inference.
pub fn initialize_auction(
    state: &mut SessionState,
    initial_auction: &Auction,
    _seat_strategies: &HashMap<Seat, SeatStrategy>,
) {
    state.auction = initial_auction.clone();

    // Replay initial auction through inference
    for i in 0..initial_auction.entries.len() {
        let entry = &initial_auction.entries[i];
        let auction_before = Auction {
            entries: initial_auction.entries[..i].to_vec(),
            is_complete: false,
        };
        let convention_id = state.convention_id.clone();
        state.process_bid(
            entry,
            &auction_before,
            None,
            &convention_id,
            false,
            None,
            &[],
        );
    }
}

// ── Internal helpers ───────────────────────────────────────────────

/// Capture the stashed StrategyEvaluation for the debug log.
/// Returns None in release builds or when no evaluation is stashed.
///
/// Note: all seats (including the human player's) use SeatStrategy::Ai in production
/// (see config_resolver.rs:86-92). SeatStrategy::User is only used in test helpers.
fn capture_evaluation_snapshot(
    seat: Seat,
    seat_strategies: &HashMap<Seat, SeatStrategy>,
) -> Option<StrategyEvaluation> {
    if !cfg!(debug_assertions) {
        return None;
    }
    let strategy = match seat_strategies.get(&seat) {
        Some(SeatStrategy::Ai(s)) => s,
        _ => return None,
    };
    let boxed = strategy.stashed_evaluation()?;
    boxed.downcast_ref::<StrategyEvaluation>().cloned()
}

/// Extract FactConstraints from a seat's strategy evaluation.
/// Uses `stashed_evaluation()` on BiddingStrategy, then downcasts to
/// `StrategyEvaluation` (from bridge-conventions) to extract satisfied clauses.
/// Returns empty Vec if the strategy has no evaluation (non-convention strategies,
/// no match, or heuristic/natural bids).
fn extract_constraints(
    seat: Seat,
    seat_strategies: &HashMap<Seat, SeatStrategy>,
) -> Vec<FactConstraint> {
    let strategy = match seat_strategies.get(&seat) {
        Some(SeatStrategy::Ai(s)) => s,
        _ => return Vec::new(),
    };

    let boxed = match strategy.stashed_evaluation() {
        Some(b) => b,
        None => return Vec::new(),
    };

    let eval = match boxed.downcast_ref::<StrategyEvaluation>() {
        Some(e) => e,
        None => return Vec::new(),
    };

    let selected = match eval
        .pipeline_result
        .as_ref()
        .and_then(|pr| pr.selected.as_ref())
    {
        Some(s) => s,
        None => return Vec::new(),
    };

    selected
        .proposal()
        .clauses
        .iter()
        .filter(|clause| clause.satisfied)
        .map(|clause| FactConstraint {
            fact_id: clause.fact_id.clone(),
            operator: clause.operator.clone(),
            value: clause.value.clone(),
            is_public: clause.is_public,
        })
        .collect()
}

/// Clone the StrategyEvaluation from a seat's stashed evaluation (release-safe).
fn clone_strategy_evaluation(
    seat: Seat,
    seat_strategies: &HashMap<Seat, SeatStrategy>,
) -> Option<StrategyEvaluation> {
    let strategy = match seat_strategies.get(&seat) {
        Some(SeatStrategy::Ai(s)) => s,
        _ => return None,
    };
    let boxed = strategy.stashed_evaluation()?;
    boxed.downcast_ref::<StrategyEvaluation>().cloned()
}

/// Build a BidAttemptRecord from feedback + strategy evaluation for review.
fn extract_attempt_record(
    feedback: &BidFeedbackDTO,
    expected_result: Option<&BidResult>,
    seat: Seat,
    hand: Option<&Hand>,
    seat_strategies: &HashMap<Seat, SeatStrategy>,
) -> BidAttemptRecord {
    let evaluation = clone_strategy_evaluation(seat, seat_strategies);
    let tp = evaluation
        .as_ref()
        .and_then(|e| e.teaching_projection.as_ref());
    let wrong_bid_meaning = tp.and_then(|p| {
        p.call_views
            .iter()
            .find(|cv| cv.call == feedback.user_call)
            .and_then(|cv| cv.primary_meaning.clone())
    });
    let conditions = tp
        .map(|p| {
            p.primary_explanation
                .iter()
                .filter(|n| n.kind == ExplanationKind::Condition)
                .map(|n| ReviewCondition {
                    description: n.content.clone(),
                    passed: n.passed.unwrap_or(false),
                    observed_value: hand.and_then(|h| {
                        n.explanation_id
                            .as_deref()
                            .and_then(|id| observed_value_for_condition(id, h))
                    }),
                    explanation_id: n.explanation_id.clone(),
                })
                .collect()
        })
        .unwrap_or_default();
    let correct_bid_label = tp.and_then(|p| {
        p.meaning_views
            .iter()
            .find(|mv| mv.status == MeaningStatus::Live)
            .map(|mv| mv.display_label.clone())
    });
    BidAttemptRecord {
        user_call: feedback.user_call.clone(),
        grade: feedback.grade,
        wrong_bid_meaning,
        conditions,
        expected_call: feedback.expected_call.clone(),
        expected_explanation: expected_result.map(|r| r.explanation.clone()),
        correct_bid_label,
    }
}

fn observed_value_for_condition(explanation_id: &str, hand: &Hand) -> Option<String> {
    let fact_id = explanation_id.split(':').next()?;
    let ev = evaluate_hand_hcp(hand);
    match fact_id {
        "hand.hcp" => Some(ev.hcp.to_string()),
        "hand.suitLength.spades" => Some(ev.shape[0].to_string()),
        "hand.suitLength.hearts" => Some(ev.shape[1].to_string()),
        "hand.suitLength.diamonds" => Some(ev.shape[2].to_string()),
        "hand.suitLength.clubs" => Some(ev.shape[3].to_string()),
        _ => None,
    }
}

/// Get expected bid from strategy for grading.
fn get_expected_bid(
    state: &SessionState,
    seat: Seat,
    seat_strategies: &HashMap<Seat, SeatStrategy>,
) -> Option<BidResult> {
    let strategy = match seat_strategies.get(&seat) {
        Some(SeatStrategy::Ai(strategy)) => strategy,
        _ => return None,
    };

    let hand = state.deal.hands.get(&seat)?;

    let evaluation = evaluate_hand_hcp(hand);
    let context = BiddingContext {
        hand: hand.clone(),
        auction: state.auction.clone(),
        seat,
        evaluation,
        vulnerability: Some(state.deal.vulnerability),
        dealer: Some(state.deal.dealer),
    };

    Some(strategy.suggest_bid(&context).unwrap_or_else(|| BidResult {
        call: Call::Pass,
        rule_name: None,
        explanation: "No convention applies — pass".to_string(),
        ..Default::default()
    }))
}

/// Apply user's bid, run AI bids, and return result.
fn apply_bid_and_run_ai(
    state: &mut SessionState,
    seat: Seat,
    call: Call,
    expected_result: Option<&BidResult>,
    seat_strategies: &HashMap<Seat, SeatStrategy>,
    pre_feedback: Option<BidFeedbackDTO>,
) -> BidProcessResult {
    let user_entry = AuctionEntry {
        seat,
        call: call.clone(),
    };
    let auction_before = state.auction.clone();

    // Apply user's bid to auction
    match add_call(&state.auction, user_entry.clone()) {
        Ok(new_auction) => state.auction = new_auction,
        Err(_) => return empty_result(),
    }

    // Process through inference — extract constraints from the user seat's strategy
    // evaluation (computed by get_expected_bid just before this call).
    let constraints = extract_constraints(seat, seat_strategies);
    let convention_id = state.convention_id.clone();
    let is_correct = pre_feedback
        .as_ref()
        .map(|f| matches!(f.grade, BidGrade::Correct | BidGrade::Acceptable));
    state.process_bid(
        &user_entry,
        &auction_before,
        expected_result,
        &convention_id,
        true,
        is_correct,
        &constraints,
    );

    // Attach grade and prior attempts to the user's bid history entry.
    // pending_attempts accumulated during reject→retry cycles; drain them now.
    let prior_attempts = if state.pending_attempts.is_empty() {
        None
    } else {
        Some(std::mem::take(&mut state.pending_attempts))
    };
    if let (Some(last_entry), Some(feedback)) =
        (state.bid_history.last_mut(), pre_feedback.as_ref())
    {
        last_entry.grade = Some(feedback.grade);
        last_entry.prior_attempts = prior_attempts;
    }

    // Capture now — run_ai_bid_loop() will append more entries to bid_history.
    // ORDERING CONTRACT: user's process_bid() runs before AI bids, so .last()
    // is guaranteed to be the user's entry at this point.
    let user_history_entry = state.bid_history.last().cloned();

    // Check if auction is complete
    if is_auction_complete(&state.auction) {
        let from_phase = state.phase;
        handle_auction_complete(state);
        return BidProcessResult {
            accepted: true,
            feedback: pre_feedback,
            ai_bids: Vec::new(),
            auction_complete: true,
            phase_transition: Some((from_phase, state.phase)),
            user_history_entry,
        };
    }

    // Run AI bids
    let next_turn = next_seat(seat);
    let (ai_bids, auction_complete) = run_ai_bid_loop(state, next_turn, seat_strategies);

    let phase_transition = if auction_complete {
        Some((GamePhase::Bidding, state.phase))
    } else {
        None
    };

    BidProcessResult {
        accepted: true,
        feedback: pre_feedback,
        ai_bids,
        auction_complete,
        phase_transition,
        user_history_entry,
    }
}

/// Run AI bid loop from a given seat until user's turn or auction completion.
fn run_ai_bid_loop(
    state: &mut SessionState,
    start_seat: Seat,
    seat_strategies: &HashMap<Seat, SeatStrategy>,
) -> (Vec<AiBidEntry>, bool) {
    let mut ai_bids = Vec::new();
    let mut current_seat = start_seat;

    while !state.is_user_seat(current_seat) {
        // Get strategy for this seat
        let bid_result = get_ai_bid(state, current_seat, seat_strategies);

        let result = match bid_result {
            Some(r) => r,
            None => {
                // No strategy — default to pass
                BidResult {
                    call: Call::Pass,
                    rule_name: None,
                    explanation: String::new(),
                    ..Default::default()
                }
            }
        };

        let entry = AuctionEntry {
            seat: current_seat,
            call: result.call.clone(),
        };
        let auction_before = state.auction.clone();

        match add_call(&state.auction, entry.clone()) {
            Ok(new_auction) => state.auction = new_auction,
            Err(_) => break,
        }

        // Capture debug log entry for AI bid
        state.debug_log.push(DebugLogEntry {
            kind: "ai-bid".to_string(),
            turn_index: state.auction.entries.len().saturating_sub(1),
            seat: current_seat,
            call: Some(result.call.clone()),
            expected_call: None,
            expected_explanation: Some(result.explanation.clone()),
            grade: None,
            trace: result.trace.clone(),
            evaluation_snapshot: capture_evaluation_snapshot(current_seat, seat_strategies),
            bid_feedback: None,
        });

        // Process through inference — extract constraints from the AI seat's strategy
        // evaluation (suggest_bid stashed the evaluation synchronously before returning).
        let constraints = extract_constraints(current_seat, seat_strategies);
        let convention_id = state.convention_id.clone();
        state.process_bid(
            &entry,
            &auction_before,
            Some(&result),
            &convention_id,
            false,
            None,
            &constraints,
        );

        // INVARIANT: process_bid always pushes exactly one entry to bid_history.
        let history_entry = state
            .bid_history
            .last()
            .cloned()
            .expect("process_bid must push a history entry");

        ai_bids.push(AiBidEntry {
            seat: current_seat,
            call: result.call,
            history_entry,
        });

        // Check if auction is complete
        if is_auction_complete(&state.auction) {
            handle_auction_complete(state);
            return (ai_bids, true);
        }

        current_seat = next_seat(current_seat);
    }

    // Fetch legal calls for user's turn
    if state.is_user_seat(current_seat) {
        state.legal_calls = get_legal_calls(&state.auction, current_seat);
    }

    (ai_bids, false)
}

/// Get the next AI bid for a seat using its assigned strategy.
fn get_ai_bid(
    state: &SessionState,
    seat: Seat,
    seat_strategies: &HashMap<Seat, SeatStrategy>,
) -> Option<BidResult> {
    let strategy = match seat_strategies.get(&seat) {
        Some(SeatStrategy::Ai(strategy)) => strategy,
        _ => return None,
    };

    let hand = state.deal.hands.get(&seat)?;
    let evaluation = evaluate_hand_hcp(hand);
    let context = BiddingContext {
        hand: hand.clone(),
        auction: state.auction.clone(),
        seat,
        evaluation,
        vulnerability: Some(state.deal.vulnerability),
        dealer: Some(state.deal.dealer),
    };

    let result = strategy.suggest_bid(&context);
    match result {
        None => Some(BidResult {
            call: Call::Pass,
            rule_name: None,
            explanation: String::new(),
            ..Default::default()
        }),
        Some(bid_result) => {
            // Validate the suggested call is legal
            if !bridge_engine::auction::is_legal_call(&state.auction, &bid_result.call, seat) {
                Some(BidResult {
                    call: Call::Pass,
                    rule_name: None,
                    explanation: String::new(),
                    ..Default::default()
                })
            } else {
                Some(bid_result)
            }
        }
    }
}

/// Handle auction completion: extract contract, transition phase.
fn handle_auction_complete(state: &mut SessionState) {
    let contract = get_contract(&state.auction).ok().flatten();
    state.contract = contract.clone();

    match contract {
        Some(ref c) => {
            state.effective_user_seat = Some(state.user_seat);
            match state.play_preference {
                PlayPreference::Skip => {
                    if is_valid_transition(state.phase, GamePhase::Explanation) {
                        state.phase = GamePhase::Explanation;
                    }
                }
                PlayPreference::Always => {
                    state.initialize_play(c);
                    if is_valid_transition(state.phase, GamePhase::Playing) {
                        state.phase = GamePhase::Playing;
                    }
                }
                PlayPreference::Prompt => {
                    if is_valid_transition(state.phase, GamePhase::DeclarerPrompt) {
                        state.phase = GamePhase::DeclarerPrompt;
                    }
                }
            }
        }
        None => {
            // Passout
            if is_valid_transition(state.phase, GamePhase::Explanation) {
                state.phase = GamePhase::Explanation;
            }
        }
    }
}

fn empty_result() -> BidProcessResult {
    BidProcessResult {
        accepted: false,
        feedback: None,
        ai_bids: Vec::new(),
        auction_complete: false,
        phase_transition: None,
        user_history_entry: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::heuristics::{BidResult, BiddingContext, BiddingStrategy};
    use crate::inference::InferenceCoordinator;
    use crate::types::{PracticeFocus, PracticeMode};
    use bridge_engine::constants::SEATS;
    use bridge_engine::types::{BidSuit, Deal, Hand, Vulnerability};

    // ── Test strategies ────────────────────────────────────────────

    struct AlwaysPass;
    impl BiddingStrategy for AlwaysPass {
        fn id(&self) -> &str {
            "always-pass"
        }
        fn name(&self) -> &str {
            "Always Pass"
        }
        fn suggest_bid(&self, _ctx: &BiddingContext) -> Option<BidResult> {
            Some(BidResult {
                call: Call::Pass,
                rule_name: None,
                explanation: "Always pass".to_string(),
                ..Default::default()
            })
        }
        fn as_any(&self) -> &dyn std::any::Any {
            self
        }
    }

    struct NeverMatches;
    impl BiddingStrategy for NeverMatches {
        fn id(&self) -> &str {
            "never-matches"
        }
        fn name(&self) -> &str {
            "Never Matches"
        }
        fn suggest_bid(&self, _ctx: &BiddingContext) -> Option<BidResult> {
            None
        }
        fn as_any(&self) -> &dyn std::any::Any {
            self
        }
    }

    // ── Helpers ────────────────────────────────────────────────────

    fn make_deal() -> Deal {
        let mut hands = HashMap::new();
        for &seat in &SEATS {
            hands.insert(seat, Hand { cards: vec![] });
        }
        Deal {
            hands,
            dealer: Seat::North,
            vulnerability: Vulnerability::None,
        }
    }

    fn make_state() -> SessionState {
        SessionState::new(
            make_deal(),
            Seat::South,
            "test".to_string(),
            None,
            InferenceCoordinator::new(None),
            false,
            PracticeMode::DecisionDrill,
            PracticeFocus::default(),
            PlayPreference::Skip,
            crate::heuristics::play_profiles::PlayProfileId::ClubPlayer,
            0,
        )
    }

    fn make_strategies_all_pass() -> HashMap<Seat, SeatStrategy> {
        let mut strategies = HashMap::new();
        strategies.insert(Seat::South, SeatStrategy::User);
        strategies.insert(Seat::North, SeatStrategy::Ai(Box::new(AlwaysPass)));
        strategies.insert(Seat::East, SeatStrategy::Ai(Box::new(AlwaysPass)));
        strategies.insert(Seat::West, SeatStrategy::Ai(Box::new(AlwaysPass)));
        strategies
    }

    fn make_strategies_with_user_strategy() -> HashMap<Seat, SeatStrategy> {
        let mut strategies = HashMap::new();
        strategies.insert(Seat::South, SeatStrategy::Ai(Box::new(AlwaysPass)));
        strategies.insert(Seat::North, SeatStrategy::Ai(Box::new(AlwaysPass)));
        strategies.insert(Seat::East, SeatStrategy::Ai(Box::new(AlwaysPass)));
        strategies.insert(Seat::West, SeatStrategy::Ai(Box::new(AlwaysPass)));
        strategies
    }

    // ── Tests ──────────────────────────────────────────────────────

    #[test]
    fn run_initial_ai_bids_when_user_first() {
        // Dealer is South (user) — no AI bids should run
        let mut state = make_state();
        state.deal.dealer = Seat::South;
        let strategies = make_strategies_all_pass();

        let ai_bids = run_initial_ai_bids(&mut state, &strategies);
        assert!(ai_bids.is_empty());
        // Legal calls should be populated
        assert!(!state.legal_calls.is_empty());
    }

    #[test]
    fn run_initial_ai_bids_before_user_turn() {
        // Dealer is North — AI bids N, E, W before user (South) gets turn
        let mut state = make_state();
        state.deal.dealer = Seat::North;
        let strategies = make_strategies_all_pass();

        let ai_bids = run_initial_ai_bids(&mut state, &strategies);
        // Dealer=North, so N bids, then E bids, then South (user) is next
        assert_eq!(ai_bids.len(), 2);
        assert_eq!(ai_bids[0].seat, Seat::North);
        assert_eq!(ai_bids[1].seat, Seat::East);
        // Legal calls should be populated for user
        assert!(!state.legal_calls.is_empty());
    }

    #[test]
    fn process_bid_accepts_any_legal_bid_without_strategy() {
        let mut state = make_state();
        state.deal.dealer = Seat::South;
        // No strategy for user seat
        let mut strategies = HashMap::new();
        strategies.insert(Seat::North, SeatStrategy::Ai(Box::new(AlwaysPass)));
        strategies.insert(Seat::East, SeatStrategy::Ai(Box::new(AlwaysPass)));
        strategies.insert(Seat::West, SeatStrategy::Ai(Box::new(AlwaysPass)));

        let result = process_bid(
            &mut state,
            Call::Bid {
                level: 1,
                strain: BidSuit::Clubs,
            },
            &strategies,
        );
        assert!(result.accepted);
    }

    #[test]
    fn process_bid_correct_with_matching_strategy() {
        let mut state = make_state();
        state.deal.dealer = Seat::South;
        let strategies = make_strategies_with_user_strategy();

        // Strategy expects pass, user bids pass
        let result = process_bid(&mut state, Call::Pass, &strategies);
        assert!(result.accepted);
        if let Some(ref feedback) = result.feedback {
            assert_eq!(feedback.grade, BidGrade::Correct);
        }
    }

    #[test]
    fn process_bid_rejected_with_wrong_bid() {
        let mut state = make_state();
        state.deal.dealer = Seat::South;
        let strategies = make_strategies_with_user_strategy();

        // Strategy expects pass, user bids 1C
        let result = process_bid(
            &mut state,
            Call::Bid {
                level: 1,
                strain: BidSuit::Clubs,
            },
            &strategies,
        );
        assert!(!result.accepted);
        assert!(result.feedback.is_some());
        assert_eq!(result.feedback.unwrap().grade, BidGrade::Incorrect);
    }

    #[test]
    fn process_bid_runs_ai_after_user() {
        let mut state = make_state();
        state.deal.dealer = Seat::South;
        let strategies = make_strategies_all_pass();

        // User passes (no strategy = any bid accepted)
        let result = process_bid(&mut state, Call::Pass, &strategies);
        assert!(result.accepted);
        // AI seats (N, E, W) should have bid
        assert_eq!(result.ai_bids.len(), 3);
    }

    #[test]
    fn auction_completes_with_four_passes() {
        let mut state = make_state();
        state.deal.dealer = Seat::South;
        let strategies = make_strategies_all_pass();

        let result = process_bid(&mut state, Call::Pass, &strategies);
        assert!(result.accepted);
        assert!(result.auction_complete);
        assert_eq!(state.phase, GamePhase::Explanation); // passout → explanation
        assert!(result.phase_transition.is_some());
    }

    #[test]
    fn initialize_auction_replays_entries() {
        let mut state = make_state();
        let initial = Auction {
            entries: vec![
                AuctionEntry {
                    seat: Seat::North,
                    call: Call::Pass,
                },
                AuctionEntry {
                    seat: Seat::East,
                    call: Call::Pass,
                },
            ],
            is_complete: false,
        };
        let strategies = make_strategies_all_pass();

        initialize_auction(&mut state, &initial, &strategies);
        assert_eq!(state.auction.entries.len(), 2);
    }

    #[test]
    fn not_user_turn_returns_empty() {
        let mut state = make_state();
        state.deal.dealer = Seat::North; // Not user's turn
        let strategies = make_strategies_all_pass();

        let result = process_bid(&mut state, Call::Pass, &strategies);
        assert!(!result.accepted);
    }

    #[test]
    fn handle_auction_complete_with_contract_skip() {
        let mut state = make_state();
        state.play_preference = PlayPreference::Skip;
        // Set up a completed auction with a contract
        state.auction = Auction {
            entries: vec![
                AuctionEntry {
                    seat: Seat::North,
                    call: Call::Bid {
                        level: 1,
                        strain: BidSuit::Clubs,
                    },
                },
                AuctionEntry {
                    seat: Seat::East,
                    call: Call::Pass,
                },
                AuctionEntry {
                    seat: Seat::South,
                    call: Call::Pass,
                },
                AuctionEntry {
                    seat: Seat::West,
                    call: Call::Pass,
                },
            ],
            is_complete: true,
        };

        handle_auction_complete(&mut state);
        assert!(state.contract.is_some());
        assert_eq!(state.phase, GamePhase::Explanation);
    }

    #[test]
    fn handle_auction_complete_with_contract_always_play() {
        let mut state = make_state();
        state.play_preference = PlayPreference::Always;
        state.auction = Auction {
            entries: vec![
                AuctionEntry {
                    seat: Seat::North,
                    call: Call::Bid {
                        level: 1,
                        strain: BidSuit::Clubs,
                    },
                },
                AuctionEntry {
                    seat: Seat::East,
                    call: Call::Pass,
                },
                AuctionEntry {
                    seat: Seat::South,
                    call: Call::Pass,
                },
                AuctionEntry {
                    seat: Seat::West,
                    call: Call::Pass,
                },
            ],
            is_complete: true,
        };

        handle_auction_complete(&mut state);
        assert!(state.contract.is_some());
        assert_eq!(state.phase, GamePhase::Playing);
    }

    #[test]
    fn handle_auction_complete_passout() {
        let mut state = make_state();
        state.auction = Auction {
            entries: vec![
                AuctionEntry {
                    seat: Seat::North,
                    call: Call::Pass,
                },
                AuctionEntry {
                    seat: Seat::East,
                    call: Call::Pass,
                },
                AuctionEntry {
                    seat: Seat::South,
                    call: Call::Pass,
                },
                AuctionEntry {
                    seat: Seat::West,
                    call: Call::Pass,
                },
            ],
            is_complete: true,
        };

        handle_auction_complete(&mut state);
        assert!(state.contract.is_none());
        assert_eq!(state.phase, GamePhase::Explanation);
    }

    #[test]
    fn process_bid_rejects_non_pass_when_strategy_returns_none() {
        let mut state = make_state();
        state.deal.dealer = Seat::South;
        // Strategy exists but returns None (no convention surfaces match)
        let mut strategies = HashMap::new();
        strategies.insert(Seat::South, SeatStrategy::Ai(Box::new(NeverMatches)));
        strategies.insert(Seat::North, SeatStrategy::Ai(Box::new(AlwaysPass)));
        strategies.insert(Seat::East, SeatStrategy::Ai(Box::new(AlwaysPass)));
        strategies.insert(Seat::West, SeatStrategy::Ai(Box::new(AlwaysPass)));

        // Non-pass bid should be rejected — expected bid defaults to Pass
        let result = process_bid(
            &mut state,
            Call::Bid {
                level: 3,
                strain: BidSuit::Spades,
            },
            &strategies,
        );
        assert!(!result.accepted);
        let feedback = result.feedback.unwrap();
        assert_eq!(feedback.grade, BidGrade::Incorrect);
        assert_eq!(feedback.expected_call, Some(Call::Pass));
    }

    #[test]
    fn process_bid_accepts_pass_when_strategy_returns_none() {
        let mut state = make_state();
        state.deal.dealer = Seat::South;
        let mut strategies = HashMap::new();
        strategies.insert(Seat::South, SeatStrategy::Ai(Box::new(NeverMatches)));
        strategies.insert(Seat::North, SeatStrategy::Ai(Box::new(AlwaysPass)));
        strategies.insert(Seat::East, SeatStrategy::Ai(Box::new(AlwaysPass)));
        strategies.insert(Seat::West, SeatStrategy::Ai(Box::new(AlwaysPass)));

        // Pass should be accepted when no convention surfaces match
        let result = process_bid(&mut state, Call::Pass, &strategies);
        assert!(result.accepted);
        let feedback = result.feedback.unwrap();
        assert_eq!(feedback.grade, BidGrade::Correct);
    }
}
