//! Play controller — pure synchronous play logic.
//!
//! Ported from TS `src/session/play-controller.ts`. Major simplification:
//! all functions are synchronous (Rust calls bridge_engine directly, no
//! EnginePort async boundary). World-class advisor / recommendation tracking
//! deferred — uses heuristic play chain only.

use bridge_engine::constants::{next_seat, partner_seat};
use bridge_engine::play::{get_legal_plays, get_trick_winner};
use bridge_engine::scoring::calculate_score;
use bridge_engine::types::{Card, Hand, PlayedCard, Seat, Trick};

use crate::heuristics::play_types::PlayContext;
use crate::heuristics::suggest_play;
use crate::phase_machine::is_valid_transition;
use crate::types::GamePhase;

use super::session_state::SessionState;

// ── Result types ───────────────────────────────────────────────────

/// Result of processing a user's card play.
#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayCardResult {
    /// Whether the card was accepted (legal play).
    pub accepted: bool,
    /// Whether a trick was completed by this play.
    pub trick_complete: bool,
    /// Whether all 13 tricks are complete.
    pub play_complete: bool,
    /// Final score if play is complete.
    pub score: Option<i32>,
    /// AI plays that ran after the user's play.
    pub ai_plays: Vec<AiPlayEntry>,
    /// Legal plays for the next user turn (None if play complete or AI's turn).
    pub legal_plays: Option<Vec<Card>>,
    /// Current player after all processing (None if play complete).
    pub current_player: Option<Seat>,
}

/// A single AI card play for animation/replay.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiPlayEntry {
    pub seat: Seat,
    pub card: Card,
    pub reason: String,
    pub trick_complete: bool,
}

// ── Public API ─────────────────────────────────────────────────────

/// Process a user's card play: validate, play it, run AI plays to completion
/// or next user turn, return result.
///
/// Synchronous — calls bridge_engine functions directly.
pub fn process_play_card(
    state: &mut SessionState,
    card: Card,
    seat: Seat,
) -> PlayCardResult {
    // Guard: must have an active player and contract
    if state.play.current_player.is_none() || state.contract.is_none() {
        return empty_play_result();
    }

    // Guard: card must be from the correct seat
    if Some(seat) != state.play.current_player {
        return empty_play_result();
    }

    // Guard: seat must be user-controlled
    if !state.is_user_controlled_play(seat) {
        return empty_play_result();
    }

    // Validate the card is legal
    let remaining = state.get_remaining_cards(seat);
    let lead_suit = state.get_lead_suit();
    let legal_plays = get_legal_plays(&Hand { cards: remaining }, lead_suit);
    let is_legal = legal_plays
        .iter()
        .any(|c| c.suit == card.suit && c.rank == card.rank);
    if !is_legal {
        return empty_play_result();
    }

    // Play the user's card
    add_card_to_trick(state, &card, seat);

    // Check if trick is complete after user's play
    if state.play.current_trick.len() == 4 {
        score_trick(state);

        if state.play.tricks.len() == 13 {
            complete_play(state);
            return PlayCardResult {
                accepted: true,
                trick_complete: true,
                play_complete: true,
                score: state.play.play_score,
                ai_plays: Vec::new(),
                legal_plays: None,
                current_player: None,
            };
        }

        // Trick complete, next player is the winner (set by score_trick)
        if let Some(current) = state.play.current_player {
            if !state.is_user_controlled_play(current) {
                let ai_plays = run_ai_play_loop(state);
                return build_result(state, true, ai_plays);
            }
        }

        // User leads next trick
        let next_legal = get_next_legal_plays(state);
        return PlayCardResult {
            accepted: true,
            trick_complete: true,
            play_complete: false,
            score: None,
            ai_plays: Vec::new(),
            legal_plays: Some(next_legal),
            current_player: state.play.current_player,
        };
    }

    // Trick not complete — advance to next player
    if let Some(current) = state.play.current_player {
        state.play.current_player = Some(next_seat(current));
    }

    // If next player is AI, run AI plays
    if let Some(current) = state.play.current_player {
        if !state.is_user_controlled_play(current) {
            let ai_plays = run_ai_play_loop(state);
            return build_result(state, false, ai_plays);
        }
    }

    // Next player is user-controlled
    let next_legal = get_next_legal_plays(state);
    PlayCardResult {
        accepted: true,
        trick_complete: false,
        play_complete: false,
        score: None,
        ai_plays: Vec::new(),
        legal_plays: Some(next_legal),
        current_player: state.play.current_player,
    }
}

/// Run initial AI plays when entering the play phase.
/// If the opening leader (or subsequent players) are AI-controlled,
/// play cards until it's a user-controlled seat's turn.
pub fn run_initial_ai_plays(state: &mut SessionState) -> Vec<AiPlayEntry> {
    if state.play.current_player.is_none() || state.contract.is_none() {
        return Vec::new();
    }
    if let Some(current) = state.play.current_player {
        if state.is_user_controlled_play(current) {
            return Vec::new();
        }
    }
    run_ai_play_loop(state)
}

// ── Internal helpers ───────────────────────────────────────────────

/// Add a card to the current trick.
fn add_card_to_trick(state: &mut SessionState, card: &Card, seat: Seat) {
    state.play.current_trick.push(PlayedCard {
        card: card.clone(),
        seat,
    });
}

/// Score a completed trick: determine winner, update counts, append to tricks.
fn score_trick(state: &mut SessionState) {
    let contract = match &state.contract {
        Some(c) => c,
        None => return,
    };

    let trick = Trick {
        plays: std::mem::take(&mut state.play.current_trick),
        trump_suit: state.play.trump_suit,
        winner: None,
    };

    let winner = match get_trick_winner(&trick) {
        Ok(w) => w,
        Err(_) => return,
    };

    let completed_trick = Trick {
        plays: trick.plays,
        trump_suit: trick.trump_suit,
        winner: Some(winner),
    };

    let declarer = contract.declarer;
    let dummy = partner_seat(declarer);
    if winner == declarer || winner == dummy {
        state.play.declarer_tricks_won += 1;
    } else {
        state.play.defender_tricks_won += 1;
    }

    state.play.tricks.push(completed_trick);
    // current_trick is already empty from std::mem::take above
    state.play.current_player = Some(winner);
}

/// Complete the play: calculate score, transition to EXPLANATION.
fn complete_play(state: &mut SessionState) {
    let contract = match &state.contract {
        Some(ref c) => c,
        None => return,
    };

    let score = calculate_score(
        contract,
        state.play.declarer_tricks_won as u8,
        state.deal.vulnerability,
    );
    state.play.play_score = Some(score);
    state.play.current_player = None;

    if is_valid_transition(state.phase, GamePhase::Explanation) {
        state.phase = GamePhase::Explanation;
    }
}

/// Build PlayContext for AI card selection.
fn build_play_context(state: &SessionState, seat: Seat, legal_cards: &[Card]) -> PlayContext {
    let contract = state.contract.as_ref().expect("build_play_context requires active contract");
    let remaining = state.get_remaining_cards(seat);
    let dummy_visible = !state.play.tricks.is_empty() || !state.play.current_trick.is_empty();
    let dummy_seat = state.play.dummy_seat;
    let is_dummy_playing = dummy_seat == Some(seat);

    let dummy_hand = if dummy_visible {
        if let Some(ds) = dummy_seat {
            let other_seat = if is_dummy_playing {
                contract.declarer
            } else {
                ds
            };
            Some(Hand {
                cards: state.get_remaining_cards(other_seat),
            })
        } else {
            None
        }
    } else {
        None
    };

    PlayContext {
        hand: Hand { cards: remaining },
        current_trick: state.play.current_trick.clone(),
        previous_tricks: state.play.tricks.clone(),
        contract: contract.clone(),
        seat,
        trump_suit: state.play.trump_suit,
        legal_plays: legal_cards.to_vec(),
        dummy_hand,
    }
}

/// Select a card using the heuristic play chain.
fn select_ai_card(state: &SessionState, seat: Seat, legal_cards: &[Card]) -> (Card, String) {
    let ctx = build_play_context(state, seat, legal_cards);
    let result = suggest_play(&ctx);
    (result.card, result.reason)
}

/// Run AI play loop from the current player until a user-controlled seat
/// or play completion.
fn run_ai_play_loop(state: &mut SessionState) -> Vec<AiPlayEntry> {
    let mut ai_plays = Vec::new();

    while let Some(current) = state.play.current_player {
        if state.is_user_controlled_play(current) {
            break;
        }
        if state.contract.is_none() {
            break;
        }

        let seat = current;
        let remaining = state.get_remaining_cards(seat);
        let lead_suit = state.get_lead_suit();
        let legal_plays = get_legal_plays(&Hand { cards: remaining }, lead_suit);

        if legal_plays.is_empty() {
            break;
        }

        let (card, reason) = select_ai_card(state, seat, &legal_plays);
        add_card_to_trick(state, &card, seat);
        let is_trick_complete = state.play.current_trick.len() == 4;

        ai_plays.push(AiPlayEntry {
            seat,
            card,
            reason,
            trick_complete: is_trick_complete,
        });

        if is_trick_complete {
            score_trick(state);

            if state.play.tricks.len() == 13 {
                complete_play(state);
                return ai_plays;
            }
            // After scoring, current_player is the winner.
            // If winner is user-controlled, loop will break on next iteration.
            continue;
        }

        state.play.current_player = Some(next_seat(current));
    }

    ai_plays
}

/// Get legal plays for the current player.
fn get_next_legal_plays(state: &SessionState) -> Vec<Card> {
    match state.play.current_player {
        Some(seat) => {
            let remaining = state.get_remaining_cards(seat);
            let lead_suit = state.get_lead_suit();
            get_legal_plays(&Hand { cards: remaining }, lead_suit)
        }
        None => Vec::new(),
    }
}

/// Build a PlayCardResult from state after AI play loop.
fn build_result(
    state: &SessionState,
    trick_completed_before: bool,
    ai_plays: Vec<AiPlayEntry>,
) -> PlayCardResult {
    let play_complete = state.play.current_player.is_none();

    PlayCardResult {
        accepted: true,
        trick_complete: trick_completed_before,
        play_complete,
        score: if play_complete { state.play.play_score } else { None },
        ai_plays,
        legal_plays: None,
        current_player: state.play.current_player,
    }
}

fn empty_play_result() -> PlayCardResult {
    PlayCardResult {
        accepted: false,
        trick_complete: false,
        play_complete: false,
        score: None,
        ai_plays: Vec::new(),
        legal_plays: None,
        current_player: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use bridge_engine::types::{BidSuit, Contract, Deal, Hand, Rank, Suit, Vulnerability};
    use crate::inference::InferenceCoordinator;
    use crate::types::{PlayPreference, PracticeFocus, PracticeMode};

    fn card(suit: Suit, rank: Rank) -> Card {
        Card { suit, rank }
    }

    fn make_deal_with_hands() -> Deal {
        // Give each seat 13 cards for a realistic deal
        let mut hands = HashMap::new();
        let ranks = [
            Rank::Two, Rank::Three, Rank::Four, Rank::Five,
            Rank::Six, Rank::Seven, Rank::Eight, Rank::Nine,
            Rank::Ten, Rank::Jack, Rank::Queen, Rank::King, Rank::Ace,
        ];

        // South: all spades
        hands.insert(Seat::South, Hand {
            cards: ranks.iter().map(|&r| card(Suit::Spades, r)).collect(),
        });
        // North: all hearts
        hands.insert(Seat::North, Hand {
            cards: ranks.iter().map(|&r| card(Suit::Hearts, r)).collect(),
        });
        // East: all diamonds
        hands.insert(Seat::East, Hand {
            cards: ranks.iter().map(|&r| card(Suit::Diamonds, r)).collect(),
        });
        // West: all clubs
        hands.insert(Seat::West, Hand {
            cards: ranks.iter().map(|&r| card(Suit::Clubs, r)).collect(),
        });

        Deal {
            hands,
            dealer: Seat::North,
            vulnerability: Vulnerability::None,
        }
    }

    fn make_play_state(declarer: Seat) -> SessionState {
        let contract = Contract {
            level: 3,
            strain: BidSuit::NoTrump,
            doubled: false,
            redoubled: false,
            declarer,
        };
        let mut state = SessionState::new(
            make_deal_with_hands(),
            Seat::South,
            "test".to_string(),
            None,
            InferenceCoordinator::new(None),
            false,
            PracticeMode::DecisionDrill,
            PracticeFocus::default(),
            PlayPreference::Always,
        );
        state.contract = Some(contract.clone());
        state.effective_user_seat = Some(Seat::South);
        state.phase = GamePhase::Playing;
        state.initialize_play(&contract);
        state
    }

    #[test]
    fn empty_result_when_no_contract() {
        let mut state = SessionState::new(
            make_deal_with_hands(),
            Seat::South,
            "test".to_string(),
            None,
            InferenceCoordinator::new(None),
            false,
            PracticeMode::DecisionDrill,
            PracticeFocus::default(),
            PlayPreference::Always,
        );
        let result = process_play_card(
            &mut state,
            card(Suit::Spades, Rank::Ace),
            Seat::South,
        );
        assert!(!result.accepted);
    }

    #[test]
    fn reject_wrong_seat() {
        let mut state = make_play_state(Seat::South);
        // Current player is West (left of declarer South)
        assert_eq!(state.play.current_player, Some(Seat::West));

        // Try to play from South (not current player)
        let result = process_play_card(
            &mut state,
            card(Suit::Spades, Rank::Ace),
            Seat::South,
        );
        assert!(!result.accepted);
    }

    #[test]
    fn run_initial_ai_plays_when_ai_leads() {
        // South is declarer, West leads — AI controls W, E
        let mut state = make_play_state(Seat::South);
        assert_eq!(state.play.current_player, Some(Seat::West));

        let ai_plays = run_initial_ai_plays(&mut state);
        // AI should play cards until user-controlled seat (South or North/dummy)
        assert!(!ai_plays.is_empty());
        assert_eq!(ai_plays[0].seat, Seat::West);
    }

    #[test]
    fn run_initial_ai_plays_empty_when_user_leads() {
        // North is declarer, East leads — user controls South (defender)
        let mut state = make_play_state(Seat::North);
        // East leads (left of North)
        assert_eq!(state.play.current_player, Some(Seat::East));
        // East is not user-controlled, so AI plays should run
        // But let's test with South as declarer where West leads
        // Actually let's set up where user leads
        state.play.current_player = Some(Seat::South);
        let ai_plays = run_initial_ai_plays(&mut state);
        assert!(ai_plays.is_empty());
    }

    #[test]
    fn add_card_to_trick_works() {
        let mut state = make_play_state(Seat::South);
        add_card_to_trick(&mut state, &card(Suit::Spades, Rank::Ace), Seat::West);
        assert_eq!(state.play.current_trick.len(), 1);
        assert_eq!(state.play.current_trick[0].seat, Seat::West);
    }

    #[test]
    fn score_trick_determines_winner() {
        let mut state = make_play_state(Seat::South);
        // Play a complete trick in NT — highest of led suit wins
        add_card_to_trick(&mut state, &card(Suit::Spades, Rank::Two), Seat::West);
        add_card_to_trick(&mut state, &card(Suit::Spades, Rank::Three), Seat::North);
        add_card_to_trick(&mut state, &card(Suit::Spades, Rank::Ace), Seat::East);
        add_card_to_trick(&mut state, &card(Suit::Spades, Rank::King), Seat::South);
        // Note: in practice these cards might not all be spades from the test deal,
        // but we're testing the scoring logic, not the legal play validation

        score_trick(&mut state);

        assert_eq!(state.play.tricks.len(), 1);
        assert!(state.play.current_trick.is_empty());
        assert_eq!(state.play.tricks[0].winner, Some(Seat::East)); // Ace wins
        // East is a defender (not declarer South or dummy North)
        assert_eq!(state.play.defender_tricks_won, 1);
        assert_eq!(state.play.declarer_tricks_won, 0);
        assert_eq!(state.play.current_player, Some(Seat::East));
    }

    #[test]
    fn score_trick_declarer_wins() {
        let mut state = make_play_state(Seat::South);
        // South leads with Ace — should win
        add_card_to_trick(&mut state, &card(Suit::Spades, Rank::Ace), Seat::South);
        add_card_to_trick(&mut state, &card(Suit::Spades, Rank::Two), Seat::West);
        add_card_to_trick(&mut state, &card(Suit::Spades, Rank::Three), Seat::North);
        add_card_to_trick(&mut state, &card(Suit::Spades, Rank::Four), Seat::East);

        score_trick(&mut state);

        assert_eq!(state.play.declarer_tricks_won, 1);
        assert_eq!(state.play.defender_tricks_won, 0);
        assert_eq!(state.play.current_player, Some(Seat::South));
    }

    #[test]
    fn complete_play_calculates_score() {
        let mut state = make_play_state(Seat::South);
        // Simulate 13 completed tricks (9 by declarer for 3NT making)
        state.play.declarer_tricks_won = 9;
        state.play.defender_tricks_won = 4;
        for _ in 0..13 {
            state.play.tricks.push(Trick {
                plays: vec![],
                trump_suit: None,
                winner: Some(Seat::South),
            });
        }

        complete_play(&mut state);

        assert!(state.play.play_score.is_some());
        // 3NT making = 400 (NV)
        assert_eq!(state.play.play_score.unwrap(), 400);
        assert_eq!(state.phase, GamePhase::Explanation);
        assert!(state.play.current_player.is_none());
    }

    #[test]
    fn process_play_card_accepts_legal_card() {
        // South declarer, West leads. Run AI until user's turn first.
        let mut state = make_play_state(Seat::South);

        // Manually set current player to South to test user play
        state.play.current_player = Some(Seat::South);
        // South has all spades, lead suit is None (first play in trick)
        let result = process_play_card(
            &mut state,
            card(Suit::Spades, Rank::Ace),
            Seat::South,
        );
        assert!(result.accepted);
        assert!(!result.trick_complete);
        assert!(!result.play_complete);
    }

    #[test]
    fn reject_illegal_card() {
        let mut state = make_play_state(Seat::South);
        state.play.current_player = Some(Seat::South);

        // Add a lead card to establish lead suit
        add_card_to_trick(&mut state, &card(Suit::Diamonds, Rank::Two), Seat::West);
        state.play.current_player = Some(Seat::South);

        // South has only spades, must follow suit if possible (but can't follow diamonds)
        // Actually South is void in diamonds, so any card is legal
        // Let's test with a card South doesn't have
        let result = process_play_card(
            &mut state,
            card(Suit::Diamonds, Rank::Ace), // South doesn't have diamonds
            Seat::South,
        );
        // South should be able to play any card since void in diamonds
        // But Ace of Diamonds is not in South's hand
        assert!(!result.accepted);
    }

    #[test]
    fn build_play_context_constructs_correctly() {
        let state = make_play_state(Seat::South);
        let legal = vec![card(Suit::Spades, Rank::Ace)];
        let ctx = build_play_context(&state, Seat::South, &legal);

        assert_eq!(ctx.seat, Seat::South);
        assert!(ctx.trump_suit.is_none()); // NT
        assert_eq!(ctx.legal_plays.len(), 1);
    }
}
