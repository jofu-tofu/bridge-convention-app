//! Per-session state — encapsulates all mutable state for a single drill session.
//!
//! Ported from TS `src/session/session-state.ts`. No UI dependencies.
//! Pure domain struct with methods for play initialization, inference processing,
//! and card tracking.

use std::collections::HashMap;
use std::collections::HashSet;

use bridge_engine::types::{
    Auction, AuctionEntry, Call, Card, Contract, Deal, PlayedCard, Seat, Suit, Trick,
};
use bridge_engine::constants::{bid_suit_to_suit, next_seat, partner_seat};

use crate::inference::InferenceCoordinator;
use crate::inference::types::{InferenceSnapshot, PublicBeliefState};
use crate::inference::{Posterior, PosteriorEngine, UniformPosterior};
use bridge_engine::strategy::ChainTrace;
use serde::{Serialize, Deserialize};

use crate::heuristics::{BiddingStrategy, BidResult};
use crate::heuristics::play_profiles::{PlayProfileId, get_profile};
use crate::types::{GamePhase, PlayPreference, PracticeFocus, PracticeMode};

use super::bid_feedback_builder::BidGrade;
use super::build_viewport::BidHistoryEntryView;
use super::build_viewport::AnnotationType;

// ── Debug log ─────────────────────────────────────────────────────

/// A single entry in the per-deal debug log, capturing bidding decisions
/// for the debug panel.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DebugLogEntry {
    /// Entry kind: "pre-bid", "user-bid", "ai-bid"
    pub kind: String,
    /// Zero-based turn index in the auction
    pub turn_index: usize,
    /// Which seat this entry is about
    pub seat: Seat,
    /// The call that was made (None for pre-bid snapshots)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub call: Option<Call>,
    /// What the strategy expected for this seat
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expected_call: Option<Call>,
    /// Explanation for the expected call
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expected_explanation: Option<String>,
    /// Grade assigned to the user's bid (user-bid only)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub grade: Option<BidGrade>,
    /// Strategy chain trace showing which strategies were attempted
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trace: Option<ChainTrace>,
}

// ── SeatStrategy ────────────────────────────────────────────────────

/// Strategy assignment for a single seat.
pub enum SeatStrategy {
    /// Human player — UI waits for input.
    User,
    /// AI-controlled seat with a bidding strategy.
    Ai(Box<dyn BiddingStrategy>),
}

// ── PlayState ───────────────────────────────────────────────────────

/// Play-phase mutable state, separated for partial-borrow ergonomics.
#[derive(Debug, Clone, Default)]
pub struct PlayState {
    pub tricks: Vec<Trick>,
    pub current_trick: Vec<PlayedCard>,
    pub current_player: Option<Seat>,
    pub declarer_tricks_won: u32,
    pub defender_tricks_won: u32,
    pub dummy_seat: Option<Seat>,
    pub trump_suit: Option<Suit>,
    pub play_score: Option<i32>,
}


// ── SessionState ────────────────────────────────────────────────────

/// Per-session mutable state for a single drill.
///
/// Owns the deal, auction, inference coordinator, and play state.
/// No Svelte or UI dependencies — pure domain logic.
pub struct SessionState {
    // Game state
    pub deal: Deal,
    pub auction: Auction,
    pub phase: GamePhase,
    pub contract: Option<Contract>,
    pub effective_user_seat: Option<Seat>,
    pub legal_calls: Vec<Call>,

    // Session metadata
    pub convention_id: String,
    pub convention_name: String,
    pub is_off_convention: bool,
    pub practice_mode: PracticeMode,
    pub practice_focus: PracticeFocus,
    pub play_preference: PlayPreference,
    pub user_seat: Seat,

    // Inference
    pub inference_coordinator: InferenceCoordinator,
    pub public_belief_state: PublicBeliefState,

    // Bid history (accumulated from inference annotations)
    pub bid_history: Vec<BidHistoryEntryView>,

    // Debug log (accumulated per-deal, cleared on new deal)
    pub debug_log: Vec<DebugLogEntry>,

    // Play recommendations (accumulated during play, cleared per deal)
    pub play_recommendations: Vec<super::build_viewport::PlayRecommendation>,

    // Play state (separated for partial borrows)
    pub play: PlayState,

    // Play configuration
    pub posterior: Option<Posterior>,
    pub play_profile_id: PlayProfileId,
    pub play_seed: u64,
}

impl SessionState {
    /// Create a new session state from a drill config and deal.
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        deal: Deal,
        user_seat: Seat,
        convention_id: String,
        convention_name: Option<String>,
        coordinator: InferenceCoordinator,
        is_off_convention: bool,
        practice_mode: PracticeMode,
        practice_focus: PracticeFocus,
        play_preference: PlayPreference,
        play_profile_id: PlayProfileId,
        play_seed: u64,
    ) -> Self {
        let public_belief_state = coordinator.get_public_belief_state().clone();
        let resolved_name = convention_name.unwrap_or_else(|| convention_id.clone());

        Self {
            deal,
            auction: Auction { entries: vec![], is_complete: false },
            phase: GamePhase::Bidding,
            contract: None,
            effective_user_seat: None,
            legal_calls: Vec::new(),

            convention_id,
            convention_name: resolved_name,
            is_off_convention,
            practice_mode,
            practice_focus,
            play_preference,
            user_seat,

            inference_coordinator: coordinator,
            public_belief_state,

            bid_history: Vec::new(),
            debug_log: Vec::new(),
            play_recommendations: Vec::new(),

            play: PlayState::default(),

            posterior: None,
            play_profile_id,
            play_seed,
        }
    }

    /// Check if the given seat is the user's seat.
    pub fn is_user_seat(&self, seat: Seat) -> bool {
        seat == self.user_seat
    }

    /// Process a bid through inference and update the public belief state and bid history.
    pub fn process_bid(
        &mut self,
        entry: &AuctionEntry,
        auction_before: &Auction,
        bid_result: Option<&BidResult>,
        convention_id: &str,
        is_user: bool,
        is_correct: Option<bool>,
        constraints: &[bridge_conventions::types::meaning::FactConstraint],
    ) {
        use bridge_conventions::pipeline::evaluation::alert::resolve_alert;
        use bridge_engine::strategy::Disclosure;

        let (rule_name, explanation) = match bid_result {
            Some(result) => (
                Some(result.rule_name.as_deref().unwrap_or("unknown")),
                Some(result.explanation.as_str()),
            ),
            None => (None, None),
        };

        // Pass explanation as meaning so annotations get the convention's description
        // rather than generic "Natural bid" / "Pass".
        let meaning = explanation;

        self.inference_coordinator.process_bid(
            entry,
            auction_before,
            rule_name,
            explanation,
            meaning,
            constraints,
            Some(convention_id),
        );
        // Update public belief state from the coordinator (avoids clone by using
        // the coordinator's state directly for the annotation lookup below).
        // The coordinator's process_bid returns &PublicBeliefState, so we access
        // the annotation before cloning the full state.

        // INVARIANT: inference_coordinator.process_bid() appends exactly one
        // BidAnnotation per call (including for Pass/Double/Redouble).
        // See annotation_producer.rs — all code paths produce one annotation.
        // Extract annotation meaning before cloning the full belief state, to
        // avoid cloning the entire PublicBeliefState (only need the meaning string).
        let annotation_meaning = {
            let annotation = self.inference_coordinator.get_public_belief_state()
                .annotations.last()
                .expect("inference must produce exactly one annotation per process_bid call");
            annotation.meaning.clone()
        };
        self.public_belief_state = self.inference_coordinator.get_public_belief_state().clone();

        // Resolve annotation type from the convention's disclosure level.
        // Heuristic/fallback bids have no disclosure → Educational.
        // Natural/Standard bids → Educational (not alertable).
        // Alert/Announcement → Alert/Announce.
        let disclosure = bid_result
            .and_then(|r| r.disclosure)
            .unwrap_or(Disclosure::Natural);
        // Convert bridge-engine Disclosure to bridge-conventions Disclosure for resolve_alert
        let conv_disclosure = match disclosure {
            Disclosure::Alert => bridge_conventions::types::meaning::Disclosure::Alert,
            Disclosure::Announcement => bridge_conventions::types::meaning::Disclosure::Announcement,
            Disclosure::Natural => bridge_conventions::types::meaning::Disclosure::Natural,
            Disclosure::Standard => bridge_conventions::types::meaning::Disclosure::Standard,
        };
        let bid_alert = resolve_alert(conv_disclosure);
        let annotation_type = bid_alert.annotation_type.map(|at| {
            use bridge_conventions::pipeline::evaluation::alert::AnnotationType as ConvAnnotationType;
            match at {
                ConvAnnotationType::Alert => AnnotationType::Alert,
                ConvAnnotationType::Announce => AnnotationType::Announce,
                ConvAnnotationType::Educational => AnnotationType::Educational,
            }
        });

        let (meaning_opt, alert_label) = if annotation_meaning.is_empty() {
            (None, None)
        } else if bid_alert.alertable || annotation_type == Some(AnnotationType::Educational) {
            // Both meaning and alert_label share the same string.
            let meaning_copy = annotation_meaning.clone();
            (Some(meaning_copy), Some(annotation_meaning))
        } else {
            (Some(annotation_meaning), None)
        };

        self.bid_history.push(BidHistoryEntryView {
            seat: entry.seat,
            call: entry.call.clone(),
            meaning: meaning_opt,
            is_user,
            is_correct,
            alert_label,
            annotation_type,
        });
    }

    /// NS inference timeline.
    pub fn get_ns_timeline(&self) -> &[InferenceSnapshot] {
        self.inference_coordinator.get_ns_timeline()
    }

    /// EW inference timeline.
    pub fn get_ew_timeline(&self) -> &[InferenceSnapshot] {
        self.inference_coordinator.get_ew_timeline()
    }

    // ── Play initialization ─────────────────────────────────────────

    /// Initialize play state from the contract. Called when transitioning to PLAYING.
    pub fn initialize_play(&mut self, contract: &Contract) {
        self.play = PlayState {
            tricks: Vec::new(),
            current_trick: Vec::new(),
            current_player: Some(next_seat(contract.declarer)),
            declarer_tricks_won: 0,
            defender_tricks_won: 0,
            dummy_seat: Some(partner_seat(contract.declarer)),
            trump_suit: bid_suit_to_suit(contract.strain),
            play_score: None,
        };
        self.initialize_posterior();
    }

    /// Initialize posterior based on the play profile configuration.
    fn initialize_posterior(&mut self) {
        use crate::inference::private_belief::condition_on_own_hand;

        let profile = get_profile(self.play_profile_id);
        if !profile.use_inferences {
            self.posterior = None;
            return;
        }

        let raw_ranges: HashMap<Seat, crate::inference::types::DerivedRanges> = self
            .public_belief_state
            .beliefs
            .iter()
            .map(|(seat, beliefs)| (*seat, beliefs.ranges.clone()))
            .collect();

        // Condition ranges on observer's own hand: cap each non-observer seat's
        // HCP and suit lengths based on what the observer can see.
        let ranges = match self.deal.hands.get(&self.user_seat) {
            Some(hand) => condition_on_own_hand(&raw_ranges, self.user_seat, hand),
            None => raw_ranges,
        };

        if profile.use_posterior {
            let observer_hand = self
                .deal
                .hands
                .get(&self.user_seat)
                .map(|h| h.cards.clone())
                .unwrap_or_default();
            let mut known_cards = HashMap::new();
            known_cards.insert(self.user_seat, observer_hand);
            self.posterior = Some(Posterior::MonteCarlo(PosteriorEngine::new(
                self.user_seat,
                known_cards,
                ranges,
                self.play_seed,
            )));
        } else {
            self.posterior = Some(Posterior::Uniform(UniformPosterior::new()));
        }
    }

    /// Check if a seat is user-controlled during play.
    /// User controls their own seat and dummy (if user is declarer).
    pub fn is_user_controlled_play(&self, seat: Seat) -> bool {
        let Some(ref contract) = self.contract else { return false };
        let Some(effective) = self.effective_user_seat else { return false };

        if seat == effective {
            return true;
        }
        // Declarer also controls dummy
        if seat == partner_seat(contract.declarer) && contract.declarer == effective {
            return true;
        }
        false
    }

    /// Get remaining cards for a seat (original hand minus played cards).
    pub fn get_remaining_cards(&self, seat: Seat) -> Vec<Card> {
        let mut played = HashSet::new();

        for trick in &self.play.tricks {
            for p in &trick.plays {
                if p.seat == seat {
                    played.insert(card_key(&p.card));
                }
            }
        }
        for p in &self.play.current_trick {
            if p.seat == seat {
                played.insert(card_key(&p.card));
            }
        }

        match self.deal.hands.get(&seat) {
            Some(hand) => hand
                .cards
                .iter()
                .filter(|c| !played.contains(&card_key(c)))
                .cloned()
                .collect(),
            None => Vec::new(),
        }
    }

    /// Get lead suit of current trick (None if no cards played yet).
    pub fn get_lead_suit(&self) -> Option<Suit> {
        self.play
            .current_trick
            .first()
            .map(|pc| pc.card.suit)
    }
}

// ── Free functions ──────────────────────────────────────────────────

/// Get current turn seat from the auction entries and dealer.
pub fn get_current_turn(auction: &Auction, dealer: Seat) -> Option<Seat> {
    if auction.entries.is_empty() {
        return Some(dealer);
    }
    auction
        .entries
        .last()
        .map(|entry| next_seat(entry.seat))
}

/// Create a string key for a card (for HashSet lookup).
fn card_key(card: &Card) -> (Suit, bridge_engine::types::Rank) {
    (card.suit, card.rank)
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_engine::constants::SEATS;
    use bridge_engine::types::{BidSuit, Hand, Rank, Vulnerability};

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

    fn make_coordinator() -> InferenceCoordinator {
        InferenceCoordinator::new(None)
    }

    fn make_state() -> SessionState {
        SessionState::new(
            make_deal(),
            Seat::South,
            "test-convention".to_string(),
            None,
            make_coordinator(),
            false,
            PracticeMode::DecisionDrill,
            PracticeFocus::default(),
            PlayPreference::Skip,
            PlayProfileId::ClubPlayer,
            0,
        )
    }

    #[test]
    fn initial_state() {
        let state = make_state();
        assert_eq!(state.phase, GamePhase::Bidding);
        assert!(state.auction.entries.is_empty());
        assert!(state.contract.is_none());
        assert_eq!(state.user_seat, Seat::South);
        assert_eq!(state.convention_name, "test-convention");
    }

    #[test]
    fn is_user_seat() {
        let state = make_state();
        assert!(state.is_user_seat(Seat::South));
        assert!(!state.is_user_seat(Seat::North));
    }

    #[test]
    fn get_current_turn_empty_auction() {
        let auction = Auction { entries: vec![], is_complete: false };
        assert_eq!(get_current_turn(&auction, Seat::North), Some(Seat::North));
    }

    #[test]
    fn get_current_turn_after_bid() {
        let auction = Auction {
            entries: vec![AuctionEntry { seat: Seat::North, call: Call::Pass }],
            is_complete: false,
        };
        assert_eq!(get_current_turn(&auction, Seat::North), Some(Seat::East));
    }

    #[test]
    fn bid_suit_to_suit_mapping() {
        assert_eq!(bid_suit_to_suit(BidSuit::Clubs), Some(Suit::Clubs));
        assert_eq!(bid_suit_to_suit(BidSuit::Diamonds), Some(Suit::Diamonds));
        assert_eq!(bid_suit_to_suit(BidSuit::Hearts), Some(Suit::Hearts));
        assert_eq!(bid_suit_to_suit(BidSuit::Spades), Some(Suit::Spades));
        assert_eq!(bid_suit_to_suit(BidSuit::NoTrump), None);
    }

    #[test]
    fn initialize_play_sets_state() {
        let mut state = make_state();
        let contract = Contract {
            level: 3,
            strain: BidSuit::NoTrump,
            doubled: false,
            redoubled: false,
            declarer: Seat::South,
        };
        state.initialize_play(&contract);

        assert_eq!(state.play.current_player, Some(Seat::West)); // left of declarer
        assert_eq!(state.play.dummy_seat, Some(Seat::North)); // partner of declarer
        assert_eq!(state.play.trump_suit, None); // NT
        assert_eq!(state.play.declarer_tricks_won, 0);
        assert_eq!(state.play.defender_tricks_won, 0);
    }

    #[test]
    fn initialize_play_with_trump() {
        let mut state = make_state();
        let contract = Contract {
            level: 4,
            strain: BidSuit::Spades,
            doubled: false,
            redoubled: false,
            declarer: Seat::North,
        };
        state.initialize_play(&contract);

        assert_eq!(state.play.trump_suit, Some(Suit::Spades));
        assert_eq!(state.play.current_player, Some(Seat::East));
        assert_eq!(state.play.dummy_seat, Some(Seat::South));
    }

    #[test]
    fn is_user_controlled_play_declarer() {
        let mut state = make_state();
        state.contract = Some(Contract {
            level: 3,
            strain: BidSuit::NoTrump,
            doubled: false,
            redoubled: false,
            declarer: Seat::South,
        });
        state.effective_user_seat = Some(Seat::South);

        // User controls own seat
        assert!(state.is_user_controlled_play(Seat::South));
        // User controls dummy (partner of declarer)
        assert!(state.is_user_controlled_play(Seat::North));
        // Not opponents
        assert!(!state.is_user_controlled_play(Seat::East));
        assert!(!state.is_user_controlled_play(Seat::West));
    }

    #[test]
    fn is_user_controlled_play_not_declarer() {
        let mut state = make_state();
        state.contract = Some(Contract {
            level: 3,
            strain: BidSuit::NoTrump,
            doubled: false,
            redoubled: false,
            declarer: Seat::North,
        });
        state.effective_user_seat = Some(Seat::South);

        // User controls own seat
        assert!(state.is_user_controlled_play(Seat::South));
        // NOT dummy (North is declarer, South is dummy, but user is South)
        // Actually North is declarer, so dummy = South's partner = North's partner = South
        // Wait: partner_seat(North) = South. So dummy = South. User = South. So user IS dummy.
        // But user doesn't control declarer (North)
        assert!(!state.is_user_controlled_play(Seat::North));
    }

    #[test]
    fn get_remaining_cards_filters_played() {
        let mut state = make_state();
        let cards = vec![
            Card { suit: Suit::Spades, rank: Rank::Ace },
            Card { suit: Suit::Spades, rank: Rank::King },
            Card { suit: Suit::Hearts, rank: Rank::Queen },
        ];
        state.deal.hands.insert(Seat::South, Hand { cards });

        // Play one card
        state.play.current_trick.push(PlayedCard {
            card: Card { suit: Suit::Spades, rank: Rank::Ace },
            seat: Seat::South,
        });

        let remaining = state.get_remaining_cards(Seat::South);
        assert_eq!(remaining.len(), 2);
        assert!(remaining.iter().any(|c| c.rank == Rank::King));
        assert!(remaining.iter().any(|c| c.rank == Rank::Queen));
    }

    #[test]
    fn get_lead_suit_empty_trick() {
        let state = make_state();
        assert_eq!(state.get_lead_suit(), None);
    }

    #[test]
    fn get_lead_suit_with_cards() {
        let mut state = make_state();
        state.play.current_trick.push(PlayedCard {
            card: Card { suit: Suit::Diamonds, rank: Rank::Ten },
            seat: Seat::North,
        });
        assert_eq!(state.get_lead_suit(), Some(Suit::Diamonds));
    }

    #[test]
    fn convention_name_defaults_to_id() {
        let state = make_state();
        assert_eq!(state.convention_name, "test-convention");
    }

    #[test]
    fn convention_name_override() {
        let state = SessionState::new(
            make_deal(),
            Seat::South,
            "nt-bundle".to_string(),
            Some("1NT Responses".to_string()),
            make_coordinator(),
            false,
            PracticeMode::DecisionDrill,
            PracticeFocus::default(),
            PlayPreference::Skip,
            PlayProfileId::ClubPlayer,
            0,
        );
        assert_eq!(state.convention_name, "1NT Responses");
    }
}
