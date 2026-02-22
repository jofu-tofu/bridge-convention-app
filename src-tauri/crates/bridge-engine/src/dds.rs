// DDS solver wrapper using dds-bridge crate (v0.8)
//
// dds-bridge API (verified from docs.rs/dds-bridge/0.8.0):
//   solve_deal(deal: dds_bridge::deal::Deal) -> Result<TricksTable, Error>
//   calculate_par(tricks: TricksTable, vul: Vulnerability, dealer: Seat) -> Result<Par, SystemError>
//   Deal([Hand; 4]) indexed by Seat (N=0, E=1, S=2, W=3)
//   Hand([Holding; 4]) indexed by Suit (C=0, D=1, H=2, S=3)
//   Holding: bitset of ranks, insert(rank: u8) where rank 2-14
//   Card::new(suit, rank) where rank 2-14 (J=11, Q=12, K=13, A=14)
//   TricksTable([TricksRow; 5]) indexed by Strain (C=0, D=1, H=2, S=3, NT=4)
//   TricksRow.get(seat) -> u8
//   Par { score: i32, contracts: Vec<(Contract, Seat, i8)> }
//   Contract { bid: Bid { level: u8, strain: Strain }, penalty: Penalty }
//   Vulnerability: bitflags (NS, EW), empty() = none, all() = both

use std::collections::HashMap;

use dds_bridge::contract::{Penalty, Strain};
use dds_bridge::deal::{self as dds_deal, SmallSet};
use dds_bridge::solver;

use crate::error::EngineError;
use crate::types::{
    BidSuit, DDSolution, Deal, ParContract, ParInfo, Rank, Seat, Suit, Vulnerability,
};

/// Map our Rank enum to dds-bridge's u8 rank (2-14).
fn rank_to_u8(rank: Rank) -> u8 {
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

/// Map our Suit to dds-bridge Suit.
fn to_dds_suit(suit: Suit) -> dds_deal::Suit {
    match suit {
        Suit::Clubs => dds_deal::Suit::Clubs,
        Suit::Diamonds => dds_deal::Suit::Diamonds,
        Suit::Hearts => dds_deal::Suit::Hearts,
        Suit::Spades => dds_deal::Suit::Spades,
    }
}

/// Map our Seat to dds-bridge Seat.
fn to_dds_seat(seat: Seat) -> dds_deal::Seat {
    match seat {
        Seat::North => dds_deal::Seat::North,
        Seat::East => dds_deal::Seat::East,
        Seat::South => dds_deal::Seat::South,
        Seat::West => dds_deal::Seat::West,
    }
}

/// Map dds-bridge Strain to our BidSuit.
fn from_dds_strain(strain: Strain) -> BidSuit {
    match strain {
        Strain::Clubs => BidSuit::Clubs,
        Strain::Diamonds => BidSuit::Diamonds,
        Strain::Hearts => BidSuit::Hearts,
        Strain::Spades => BidSuit::Spades,
        Strain::Notrump => BidSuit::NoTrump,
    }
}

/// Map dds-bridge Seat to our Seat.
fn from_dds_seat(seat: dds_deal::Seat) -> Seat {
    match seat {
        dds_deal::Seat::North => Seat::North,
        dds_deal::Seat::East => Seat::East,
        dds_deal::Seat::South => Seat::South,
        dds_deal::Seat::West => Seat::West,
    }
}

/// Map our Vulnerability to dds-bridge Vulnerability.
fn to_dds_vulnerability(vul: Vulnerability) -> solver::Vulnerability {
    match vul {
        Vulnerability::None => solver::Vulnerability::empty(),
        Vulnerability::NorthSouth => solver::Vulnerability::NS,
        Vulnerability::EastWest => solver::Vulnerability::EW,
        Vulnerability::Both => solver::Vulnerability::all(),
    }
}

/// Convert our Deal to dds-bridge Deal format.
pub(crate) fn to_dds_deal(deal: &Deal) -> Result<dds_bridge::deal::Deal, EngineError> {
    let mut dds_deal = dds_bridge::deal::Deal::default();

    for seat in [Seat::North, Seat::East, Seat::South, Seat::West] {
        let hand = deal
            .hands
            .get(&seat)
            .ok_or_else(|| EngineError::DdsError(format!("Missing hand for seat {:?}", seat)))?;

        let dds_seat = to_dds_seat(seat);
        for card in &hand.cards {
            let dds_suit = to_dds_suit(card.suit);
            let rank = rank_to_u8(card.rank);
            dds_deal[dds_seat][dds_suit].insert(rank);
        }
    }

    Ok(dds_deal)
}

/// All strains in dds-bridge order.
const STRAINS: [Strain; 5] = [
    Strain::Clubs,
    Strain::Diamonds,
    Strain::Hearts,
    Strain::Spades,
    Strain::Notrump,
];

/// All seats.
const SEATS: [Seat; 4] = [Seat::North, Seat::East, Seat::South, Seat::West];

/// Extract 4x5 tricks table from dds-bridge TricksTable.
pub(crate) fn from_tricks_table(
    table: &solver::TricksTable,
) -> HashMap<Seat, HashMap<BidSuit, u32>> {
    let mut result = HashMap::new();
    for seat in SEATS {
        let mut seat_tricks = HashMap::new();
        for strain in STRAINS {
            let tricks = table[strain].get(to_dds_seat(seat));
            seat_tricks.insert(from_dds_strain(strain), u32::from(tricks));
        }
        result.insert(seat, seat_tricks);
    }
    result
}

/// Solve a deal and compute par score.
/// Returns DDSolution with tricks table and optional par info.
pub fn solve_deal_with_par(deal: &Deal) -> Result<DDSolution, EngineError> {
    // Validate 52 cards before calling DDS
    let total_cards: usize = deal.hands.values().map(|h| h.cards.len()).sum();
    if total_cards != 52 {
        return Err(EngineError::DdsError(format!(
            "Deal has {total_cards} cards, expected 52"
        )));
    }

    let dds_deal = to_dds_deal(deal)?;

    let tricks_table = solver::solve_deal(dds_deal)
        .map_err(|e| EngineError::DdsError(format!("solve_deal failed: {e}")))?;

    let tricks = from_tricks_table(&tricks_table);

    // Calculate par
    let dds_vul = to_dds_vulnerability(deal.vulnerability);
    let dds_dealer = to_dds_seat(deal.dealer);

    let par = match solver::calculate_par(tricks_table, dds_vul, dds_dealer) {
        Ok(par_result) => Some(ParInfo {
            score: par_result.score,
            contracts: par_result
                .contracts
                .iter()
                .map(|(contract, declarer, overtricks)| ParContract {
                    level: contract.bid.level,
                    strain: from_dds_strain(contract.bid.strain),
                    declarer: from_dds_seat(*declarer),
                    doubled: contract.penalty != Penalty::None,
                    overtricks: *overtricks,
                })
                .collect(),
        }),
        Err(e) => {
            eprintln!("calculate_par failed: {e}");
            None
        }
    };

    Ok(DDSolution { tricks, par })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{Card, Hand};
    use dds_bridge::deal::SmallSet;

    /// Build a known deal for testing.
    /// North: SA SK SQ SJ HA HK HQ DA DK DQ CA CK CQ (37 HCP)
    /// East-South-West: remaining cards distributed
    fn make_test_deal() -> Deal {
        let north = Hand {
            cards: vec![
                Card { suit: Suit::Spades, rank: Rank::Ace },
                Card { suit: Suit::Spades, rank: Rank::King },
                Card { suit: Suit::Spades, rank: Rank::Queen },
                Card { suit: Suit::Spades, rank: Rank::Jack },
                Card { suit: Suit::Hearts, rank: Rank::Ace },
                Card { suit: Suit::Hearts, rank: Rank::King },
                Card { suit: Suit::Hearts, rank: Rank::Queen },
                Card { suit: Suit::Diamonds, rank: Rank::Ace },
                Card { suit: Suit::Diamonds, rank: Rank::King },
                Card { suit: Suit::Diamonds, rank: Rank::Queen },
                Card { suit: Suit::Clubs, rank: Rank::Ace },
                Card { suit: Suit::Clubs, rank: Rank::King },
                Card { suit: Suit::Clubs, rank: Rank::Queen },
            ],
        };
        // Distribute remaining 39 cards to E/S/W (13 each)
        let remaining_ranks = [
            Rank::Ten, Rank::Nine, Rank::Eight, Rank::Seven, Rank::Six,
            Rank::Five, Rank::Four, Rank::Three, Rank::Two,
        ];
        let remaining_suits = [Suit::Spades, Suit::Hearts, Suit::Diamonds, Suit::Clubs];

        let mut all_remaining = Vec::new();
        for &suit in &remaining_suits {
            for &rank in &remaining_ranks {
                all_remaining.push(Card { suit, rank });
            }
        }
        // Also add the Jack of H, D, C (North only has SJ)
        all_remaining.push(Card { suit: Suit::Hearts, rank: Rank::Jack });
        all_remaining.push(Card { suit: Suit::Diamonds, rank: Rank::Jack });
        all_remaining.push(Card { suit: Suit::Clubs, rank: Rank::Jack });

        let east = Hand { cards: all_remaining[0..13].to_vec() };
        let south = Hand { cards: all_remaining[13..26].to_vec() };
        let west = Hand { cards: all_remaining[26..39].to_vec() };

        let mut hands = HashMap::new();
        hands.insert(Seat::North, north);
        hands.insert(Seat::East, east);
        hands.insert(Seat::South, south);
        hands.insert(Seat::West, west);

        Deal {
            hands,
            dealer: Seat::North,
            vulnerability: Vulnerability::None,
        }
    }

    #[test]
    fn to_dds_deal_converts_all_52_cards() {
        let deal = make_test_deal();
        let dds_deal = to_dds_deal(&deal).unwrap();

        // Count total cards across all hands and suits
        let mut total = 0u32;
        for seat in [
            dds_deal::Seat::North,
            dds_deal::Seat::East,
            dds_deal::Seat::South,
            dds_deal::Seat::West,
        ] {
            for suit in [
                dds_deal::Suit::Clubs,
                dds_deal::Suit::Diamonds,
                dds_deal::Suit::Hearts,
                dds_deal::Suit::Spades,
            ] {
                total += dds_deal[seat][suit].len() as u32;
            }
        }
        assert_eq!(total, 52, "Deal should have exactly 52 cards");
    }

    #[test]
    fn solve_deal_returns_tricks_and_par() {
        let deal = make_test_deal();
        let solution = solve_deal_with_par(&deal).unwrap();

        // North has 37 HCP — should make many tricks in NT
        let north_nt = solution.tricks[&Seat::North][&BidSuit::NoTrump];
        assert!(north_nt >= 10, "North with 37 HCP should make 10+ tricks in NT, got {north_nt}");

        // All seats and strains should be present
        for seat in &SEATS {
            assert!(solution.tricks.contains_key(seat), "Missing seat {:?}", seat);
            let seat_tricks = &solution.tricks[seat];
            assert_eq!(seat_tricks.len(), 5, "Each seat should have 5 strains");
        }

        // Par should be present for a valid deal
        assert!(solution.par.is_some(), "Par should be calculated");
        let par = solution.par.unwrap();
        assert!(!par.contracts.is_empty(), "Par should have at least one contract");
    }
}
