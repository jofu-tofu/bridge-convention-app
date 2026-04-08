//! MC+DDS support types and helpers for async DDS-backed play search.

use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;

use bridge_engine::types::{Card, Contract, PlayedCard, Rank, Seat, Suit};
use serde::{Deserialize, Serialize};

use crate::inference::types::DerivedRanges;

pub mod evaluation;
pub mod pbn;
pub mod sampling;
pub mod suggest;

pub use evaluation::evaluate_cards;
pub use pbn::remaining_cards_to_pbn;
pub use sampling::sample_deals;
pub use suggest::mc_dds_suggest;

/// Async DDS solver future.
pub type DdsFuture = Pin<Box<dyn Future<Output = Result<SolveBoardResponse, DdsError>>>>;

/// A DDS solver is any async function mapping a solve request to a solve response.
pub type DdsSolverFn = dyn FnMut(SolveBoardRequest) -> DdsFuture;

/// Error returned by the DDS solver boundary.
#[derive(Debug, thiserror::Error)]
pub enum DdsError {
    #[error("DDS solve failed: {0}")]
    SolveFailed(String),
}

/// Positional DDS solve request built from the current play state.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SolveBoardRequest {
    pub trump: u8,
    pub first: u8,
    pub current_trick_suit: Vec<u8>,
    pub current_trick_rank: Vec<u8>,
    pub remain_cards_pbn: String,
}

/// Single DDS card result.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DdsCardResult {
    pub suit: Suit,
    pub rank: u8,
    pub score: i32,
}

/// DDS solve response payload.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SolveBoardResponse {
    pub cards: Vec<DdsCardResult>,
}

/// Config for MC+DDS sampling and evaluation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McddConfig {
    pub sample_count: usize,
    pub batch_size: usize,
    pub max_batches: usize,
    pub max_attempts_multiplier: usize,
}

impl Default for McddConfig {
    fn default() -> Self {
        Self {
            sample_count: 30,
            batch_size: 15,
            max_batches: 2,
            max_attempts_multiplier: 20,
        }
    }
}

/// Aggregate score for a legal card across sampled DDS solves.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McddCardScore {
    pub avg_tricks: f64,
    pub count: usize,
}

/// MC+DDS suggestion result.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McddResult {
    pub best_card: Card,
    pub reason: String,
    pub scores: HashMap<String, McddCardScore>,
    pub samples_used: usize,
}

/// Inputs required to run MC+DDS search for the current play.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McddParams {
    pub seat: Seat,
    pub legal_plays: Vec<Card>,
    pub contract: Contract,
    pub current_trick: Vec<PlayedCard>,
    pub remaining_cards: HashMap<Seat, Vec<Card>>,
    pub visible_seats: Vec<Seat>,
    pub beliefs: HashMap<Seat, DerivedRanges>,
}

pub(crate) const ALL_SEATS: [Seat; 4] = [Seat::North, Seat::East, Seat::South, Seat::West];
pub(crate) const PBN_SEAT_ORDER: [Seat; 4] = [Seat::North, Seat::East, Seat::South, Seat::West];
pub(crate) const PBN_SUIT_ORDER: [Suit; 4] =
    [Suit::Spades, Suit::Hearts, Suit::Diamonds, Suit::Clubs];

pub(crate) fn card_key(card: &Card) -> String {
    format!("{}{}", suit_char(card.suit), rank_char(card.rank))
}

pub(crate) fn dds_card_key(suit: Suit, rank: u8) -> Option<String> {
    Some(format!("{}{}", suit_char(suit), rank_char_from_u8(rank)?))
}

pub(crate) fn suit_char(suit: Suit) -> char {
    match suit {
        Suit::Spades => 'S',
        Suit::Hearts => 'H',
        Suit::Diamonds => 'D',
        Suit::Clubs => 'C',
    }
}

pub(crate) fn rank_char(rank: Rank) -> char {
    match rank {
        Rank::Ace => 'A',
        Rank::King => 'K',
        Rank::Queen => 'Q',
        Rank::Jack => 'J',
        Rank::Ten => 'T',
        Rank::Nine => '9',
        Rank::Eight => '8',
        Rank::Seven => '7',
        Rank::Six => '6',
        Rank::Five => '5',
        Rank::Four => '4',
        Rank::Three => '3',
        Rank::Two => '2',
    }
}

pub(crate) fn rank_char_from_u8(rank: u8) -> Option<char> {
    rank_from_u8(rank).map(rank_char)
}

pub(crate) fn rank_from_u8(rank: u8) -> Option<Rank> {
    match rank {
        2 => Some(Rank::Two),
        3 => Some(Rank::Three),
        4 => Some(Rank::Four),
        5 => Some(Rank::Five),
        6 => Some(Rank::Six),
        7 => Some(Rank::Seven),
        8 => Some(Rank::Eight),
        9 => Some(Rank::Nine),
        10 => Some(Rank::Ten),
        11 => Some(Rank::Jack),
        12 => Some(Rank::Queen),
        13 => Some(Rank::King),
        14 => Some(Rank::Ace),
        _ => None,
    }
}

pub(crate) fn rank_to_u8(rank: Rank) -> u8 {
    match rank {
        Rank::Two => 2,
        Rank::Three => 3,
        Rank::Four => 4,
        Rank::Five => 5,
        Rank::Six => 6,
        Rank::Seven => 7,
        Rank::Eight => 8,
        Rank::Nine => 9,
        Rank::Ten => 10,
        Rank::Jack => 11,
        Rank::Queen => 12,
        Rank::King => 13,
        Rank::Ace => 14,
    }
}

pub(crate) fn suit_to_dds_index(suit: Suit) -> u8 {
    match suit {
        Suit::Spades => 0,
        Suit::Hearts => 1,
        Suit::Diamonds => 2,
        Suit::Clubs => 3,
    }
}

pub(crate) fn seat_to_dds_index(seat: Seat) -> u8 {
    match seat {
        Seat::North => 0,
        Seat::East => 1,
        Seat::South => 2,
        Seat::West => 3,
    }
}

#[cfg(test)]
pub(crate) mod test_support {
    use std::collections::HashMap;
    use std::future::Future;
    use std::pin::Pin;
    use std::ptr;
    use std::task::{Context, Poll, RawWaker, RawWakerVTable, Waker};

    use bridge_engine::types::{Card, Rank, Suit};

    use super::{DdsError, DdsFuture, SolveBoardRequest, SolveBoardResponse};

    pub(crate) fn card(suit: Suit, rank: Rank) -> Card {
        Card { suit, rank }
    }

    pub(crate) fn mock_solver(
        precomputed: HashMap<String, SolveBoardResponse>,
    ) -> impl FnMut(SolveBoardRequest) -> DdsFuture {
        move |req: SolveBoardRequest| {
            let result = precomputed
                .get(&req.remain_cards_pbn)
                .cloned()
                .ok_or_else(|| {
                    DdsError::SolveFailed(format!("unknown PBN: {}", req.remain_cards_pbn))
                });
            Box::pin(async move { result })
        }
    }

    pub(crate) fn block_on<F: Future>(future: F) -> F::Output {
        let waker = noop_waker();
        let mut context = Context::from_waker(&waker);
        let mut future = Box::pin(future);

        loop {
            match Future::poll(Pin::as_mut(&mut future), &mut context) {
                Poll::Ready(output) => return output,
                Poll::Pending => std::thread::yield_now(),
            }
        }
    }

    fn noop_waker() -> Waker {
        // SAFETY: the vtable never dereferences the data pointer and is valid for a null pointer.
        unsafe { Waker::from_raw(RawWaker::new(ptr::null(), &NOOP_WAKER_VTABLE)) }
    }

    static NOOP_WAKER_VTABLE: RawWakerVTable = RawWakerVTable::new(
        clone_noop_waker,
        noop_waker_action,
        noop_waker_action,
        noop_waker_action,
    );

    unsafe fn clone_noop_waker(_data: *const ()) -> RawWaker {
        RawWaker::new(ptr::null(), &NOOP_WAKER_VTABLE)
    }

    unsafe fn noop_waker_action(_data: *const ()) {}
}
